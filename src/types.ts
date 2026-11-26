/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  displayName?: string;
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
  values: number[]; // OpenAI text-embedding-3-small (1536 dimensions)
}

export interface ChatSession {
  id: string;
  userId: string;
  documentId: string;
  documentIds?: string[];
  title: string;
  createdAt: string;
}

export interface SourceCitation {
  documentId: string;
  documentName: string;
  pageNumber: number;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  sourcePages?: number[];
  sourceDocuments?: SourceCitation[];
  confidenceScore?: number;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    displayName?: string;
  };
  accessToken: string;
  refreshToken: string;
}

export interface ChatResponse {
  answer: string;
  source_pages: number[];
  confidence_score: number;
}
