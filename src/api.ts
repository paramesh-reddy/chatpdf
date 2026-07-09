/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthResponse, DocumentRecord, ChatSession, Message, TextChunk } from './types.ts';

class ApiService {
  public static onUnauthorized: (() => void) | null = null;

  private static accessToken: string | null = localStorage.getItem('access_token');
  private static refreshToken: string | null = localStorage.getItem('refresh_token');
  private static userEmail: string | null = localStorage.getItem('user_email');
  private static userId: string | null = localStorage.getItem('user_id');
  private static userDisplayName: string | null = localStorage.getItem('user_display_name');

  public static getEmail(): string | null {
    return this.userEmail;
  }

  public static getDisplayName(): string | null {
    return this.userDisplayName;
  }

  public static setDisplayName(name: string | null) {
    this.userDisplayName = name;
    if (name) localStorage.setItem('user_display_name', name);
    else localStorage.removeItem('user_display_name');
  }

  public static getUserId(): string | null {
    return this.userId;
  }

  public static isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  public static setTokens(auth: AuthResponse) {
    this.accessToken = auth.accessToken;
    this.refreshToken = auth.refreshToken;
    this.userEmail = auth.user.email;
    this.userId = auth.user.id;
    this.userDisplayName = auth.user.displayName || null;

    localStorage.setItem('access_token', auth.accessToken);
    localStorage.setItem('refresh_token', auth.refreshToken);
    localStorage.setItem('user_email', auth.user.email);
    localStorage.setItem('user_id', auth.user.id);
    if (auth.user.displayName) {
      localStorage.setItem('user_display_name', auth.user.displayName);
    } else {
      localStorage.removeItem('user_display_name');
    }
  }

  public static clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.userEmail = null;
    this.userId = null;
    this.userDisplayName = null;

    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_display_name');
  }

  private static async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = path;
    const headers = new Headers(options.headers || {});

    if (this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }

    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401 || res.status === 403) {
      // Access token expired, attempt token refresh
      if (this.refreshToken) {
        try {
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: this.refreshToken }),
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            this.accessToken = data.accessToken;
            localStorage.setItem('access_token', data.accessToken);

            // Retry the original request
            headers.set('Authorization', `Bearer ${this.accessToken}`);
            const retryRes = await fetch(url, { ...options, headers });
            if (!retryRes.ok) {
              const errData = await retryRes.json().catch(() => ({}));
              throw new Error(errData.error || 'Request failed after token refresh');
            }
            return retryRes.json() as Promise<T>;
          }
        } catch (refreshErr) {
          console.error('Failed to auto-refresh session:', refreshErr);
          this.clearTokens();
          if (this.onUnauthorized) {
            this.onUnauthorized();
          } else {
            window.location.reload();
          }
          throw new Error('Session expired. Please log in again.');
        }
      }
      this.clearTokens();
      if (this.onUnauthorized) {
        this.onUnauthorized();
      }
      throw new Error('Unauthorized or session expired');
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (text.trim().startsWith('<')) {
        throw new Error(
          res.status === 502
            ? 'Server is unavailable (502). The backend may be down or still starting.'
            : `Server error (${res.status}). Please check that the backend is running.`
        );
      }
      let message = `HTTP error ${res.status}`;
      try {
        const errData = JSON.parse(text);
        message = errData.error || message;
      } catch {
        if (text) message = text;
      }
      throw new Error(message);
    }

    return res.json() as Promise<T>;
  }

  // --- AUTH ---
  public static async register(email: string, password: string, displayName?: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
    this.setTokens(data);
    return data;
  }

  public static async login(email: string, password: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setTokens(data);
    return data;
  }

  public static async logout(): Promise<void> {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Backend logout failed or offline:', e);
    } finally {
      this.clearTokens();
    }
  }

  public static async getProfile(): Promise<{ user: { id: string; email: string; displayName?: string } }> {
    return this.request('/api/auth/me', { method: 'GET' });
  }

  // --- DOCUMENTS ---
  public static async listDocuments(): Promise<DocumentRecord[]> {
    return this.request<DocumentRecord[]>('/api/documents');
  }

  public static async getDocument(id: string): Promise<DocumentRecord> {
    return this.request<DocumentRecord>(`/api/documents/${id}`);
  }

  public static async listDocumentChunks(id: string): Promise<TextChunk[]> {
    return this.request<TextChunk[]>(`/api/documents/${id}/chunks`);
  }

  public static async deleteDocument(id: string): Promise<void> {
    await this.request(`/api/documents/${id}`, { method: 'DELETE' });
  }

  public static async toggleDocumentStar(id: string): Promise<DocumentRecord> {
    return this.request<DocumentRecord>(`/api/documents/${id}/star`, { method: 'POST' });
  }

  public static async updateDocumentTags(id: string, tags: string[]): Promise<DocumentRecord> {
    return this.request<DocumentRecord>(`/api/documents/${id}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tags }),
    });
  }

  public static async uploadDocument(
    fileName: string,
    fileSize: number,
    base64Data: string
  ): Promise<DocumentRecord> {
    return this.request<DocumentRecord>('/api/documents/upload', {
      method: 'POST',
      body: JSON.stringify({ fileName, fileSize, base64Data }),
    });
  }

  // --- CHAT SESSIONS ---
  public static async listSessions(documentId: string): Promise<ChatSession[]> {
    return this.request<ChatSession[]>(`/api/chat/sessions?documentId=${documentId}`);
  }

  public static async createSession(documentId: string, title: string): Promise<ChatSession> {
    return this.request<ChatSession>('/api/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({ documentId, title }),
    });
  }

  public static async listMessages(sessionId: string): Promise<Message[]> {
    return this.request<Message[]>(`/api/chat/sessions/${sessionId}/messages`);
  }

  // --- CHAT SSE STREAMING UTILITY ---
  /**
   * Establishes an EventSource-like SSE fetch stream for answers.
   */
  public static streamChat(
    params: {
      documentId?: string;
      documentIds?: string[];
      sessionId?: string;
      question: string;
    },
    callbacks: {
      onChunk: (text: string) => void;
      onSessionCreated?: (session: { sessionId: string; title: string }) => void;
      onDone: (meta: {
        source_pages: number[];
        source_documents?: { documentId: string; documentName: string; pageNumber: number }[];
        confidence_score: number;
        sessionId: string;
        answer?: string;
      }) => void;
      onError: (err: string) => void;
    }
  ) {
    if (!this.accessToken) {
      callbacks.onError('Not authenticated');
      return { close: () => {} };
    }

    const urlParams = new URLSearchParams({
      token: this.accessToken,
      question: params.question,
    });

    if (params.documentIds && params.documentIds.length > 0) {
      urlParams.append('documentIds', params.documentIds.join(','));
      urlParams.append('documentId', params.documentIds[0]);
    } else if (params.documentId) {
      urlParams.append('documentId', params.documentId);
    }

    if (params.sessionId) {
      urlParams.append('sessionId', params.sessionId);
    }

    const sseUrl = `/api/chat/stream?${urlParams.toString()}`;
    const controller = new AbortController();

    // Use standard window.fetch to read SSE chunks using ReadableStream
    fetch(sseUrl, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const errText = await response.text();
          const isHtml = errText.trim().startsWith('<');
          if (isHtml) {
            throw new Error(
              response.status === 502
                ? 'Server is unavailable (502). The backend may be down or still starting. Please try again in a moment.'
                : `Server error (${response.status}). Please check that the backend is running.`
            );
          }
          throw new Error(errText || `Server returned ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder('utf-8');
        if (!reader) {
          throw new Error('Response body is not readable');
        }

        let buffer = '';
        let accumulatedText = '';
        let currentEvent = 'message';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
              currentEvent = 'message';
              continue;
            }

            if (trimmed.startsWith('event:')) {
              currentEvent = trimmed.replace('event:', '').trim();
            } else if (trimmed.startsWith('data:')) {
              const dataStr = trimmed.replace('data:', '').trim();
              try {
                const data = JSON.parse(dataStr);

                if (currentEvent === 'session_created') {
                  if (callbacks.onSessionCreated) callbacks.onSessionCreated(data);
                } else if (currentEvent === 'done') {
                  callbacks.onDone({
                    ...data,
                    answer: data.answer || accumulatedText,
                  });
                } else if (currentEvent === 'error') {
                  callbacks.onError(data.error || 'Streaming error');
                } else if (data.text) {
                  accumulatedText += data.text;
                  callbacks.onChunk(data.text);
                }
              } catch (e) {
                console.error('SSE JSON parsing error on line:', trimmed, e);
              }
            }
          }
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          callbacks.onError(err.message || String(err));
        }
      });

    return {
      close: () => {
        controller.abort();
      },
    };
  }
}

export default ApiService;
