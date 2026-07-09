/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface DocumentMetadata {
  name: string;
  size: number;
  pageCount: number;
  uploadedAt: string;
}

export interface DocumentRecord {
  id: string;
  userId: string;
  name: string;
  size: number;
  pageCount: number;
  uploadedAt: string;
  metadata?: Record<string, any>;
  fileType?: string;
  isStarred?: boolean;
  tags?: string[];
}

export interface TextChunk {
  id: string;
  documentId: string;
  text: string;
  pageNumber: number;
  index: number;
}

export interface VectorRecord {
  chunkId: string;
  documentId: string;
  values: number[]; // The embedding vector values (768 dimensions for Gemini Embeddings)
}

export interface ChatSession {
  id: string;
  userId: string;
  documentId: string;
  title: string;
  createdAt: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  sourcePages?: number[];
  confidenceScore?: number;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
  };
  accessToken: string;
  refreshToken: string;
}

export interface ChatResponse {
  answer: string;
  source_pages: number[];
  confidence_score: number;
}
