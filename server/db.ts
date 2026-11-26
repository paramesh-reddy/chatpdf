/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from 'dotenv';
import pg from 'pg';
import { User, DocumentRecord, TextChunk, VectorRecord, ChatSession, Message } from '../src/types.ts';

dotenv.config();

const { Pool } = pg;

let pool: InstanceType<typeof Pool> | null = null;

function databaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error('DATABASE_URL is not defined in the environment.');
  }
  try {
    const url = new URL(raw);
    // channel_binding and sslmode=require (pg 8 treats it as verify-full) both
    // break node-postgres on Vercel. SSL is set on the pool instead.
    url.searchParams.delete('channel_binding');
    url.searchParams.delete('sslmode');
    return url.toString();
  } catch {
    return raw;
  }
}

function getPool(): InstanceType<typeof Pool> {
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl(),
      ssl: { rejectUnauthorized: false },
    });
    pool.on('error', (error) => {
      console.error('Postgres pool error:', error);
    });
  }
  return pool;
}

let ready: Promise<void> | null = null;

async function ensureReady(): Promise<void> {
  if (!ready) {
    ready = initSchema().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

async function initSchema(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      size INTEGER NOT NULL,
      page_count INTEGER NOT NULL,
      uploaded_at TIMESTAMPTZ NOT NULL,
      file_type TEXT,
      is_starred BOOLEAN NOT NULL DEFAULT FALSE,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      metadata JSONB
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      page_number INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vectors (
      chunk_id TEXT PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
      document_id TEXT NOT NULL,
      values JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      document_ids JSONB,
      title TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      source_pages JSONB,
      source_documents JSONB,
      confidence_score INTEGER
    );
  `);
}

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name ?? undefined,
    createdAt: asIso(row.created_at),
  };
}

function mapDocument(row: any): DocumentRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    size: row.size,
    pageCount: row.page_count,
    uploadedAt: asIso(row.uploaded_at),
    fileType: row.file_type ?? undefined,
    isStarred: row.is_starred,
    tags: row.tags ?? [],
    metadata: row.metadata ?? undefined,
  };
}

function mapChunk(row: any): TextChunk {
  return {
    id: row.id,
    documentId: row.document_id,
    text: row.text,
    pageNumber: row.page_number,
    index: row.chunk_index,
  };
}

function mapSession(row: any): ChatSession {
  return {
    id: row.id,
    userId: row.user_id,
    documentId: row.document_id,
    documentIds: row.document_ids ?? undefined,
    title: row.title,
    createdAt: asIso(row.created_at),
  };
}

function mapMessage(row: any): Message {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    createdAt: asIso(row.created_at),
    sourcePages: row.source_pages ?? undefined,
    sourceDocuments: row.source_documents ?? undefined,
    confidenceScore: row.confidence_score ?? undefined,
  };
}

export class Database {
  public static async getUsers(): Promise<User[]> {
    await ensureReady();
    const { rows } = await getPool().query('SELECT * FROM users ORDER BY created_at ASC');
    return rows.map(mapUser);
  }

  public static async getUserByEmail(email: string): Promise<User | undefined> {
    await ensureReady();
    const { rows } = await getPool().query('SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1', [email]);
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  public static async getUserById(id: string): Promise<User | undefined> {
    await ensureReady();
    const { rows } = await getPool().query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  public static async createUser(user: User): Promise<User> {
    await ensureReady();
    await getPool().query(
      `INSERT INTO users (id, email, password_hash, display_name, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, user.email, user.passwordHash, user.displayName ?? null, user.createdAt]
    );
    return user;
  }

  public static async getDocuments(userId: string): Promise<DocumentRecord[]> {
    await ensureReady();
    const { rows } = await getPool().query(
      'SELECT * FROM documents WHERE user_id = $1 ORDER BY uploaded_at DESC',
      [userId]
    );
    return rows.map(mapDocument);
  }

  public static async getDocument(id: string): Promise<DocumentRecord | undefined> {
    await ensureReady();
    const { rows } = await getPool().query('SELECT * FROM documents WHERE id = $1 LIMIT 1', [id]);
    return rows[0] ? mapDocument(rows[0]) : undefined;
  }

  public static async createDocument(
    doc: DocumentRecord,
    chunks: TextChunk[],
    vectors: VectorRecord[]
  ): Promise<DocumentRecord> {
    await ensureReady();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO documents (id, user_id, name, size, page_count, uploaded_at, file_type, is_starred, tags, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)`,
        [
          doc.id,
          doc.userId,
          doc.name,
          doc.size,
          doc.pageCount,
          doc.uploadedAt,
          doc.fileType ?? null,
          doc.isStarred ?? false,
          JSON.stringify(doc.tags ?? []),
          doc.metadata ? JSON.stringify(doc.metadata) : null,
        ]
      );
      for (const chunk of chunks) {
        await client.query(
          `INSERT INTO chunks (id, document_id, text, page_number, chunk_index)
           VALUES ($1, $2, $3, $4, $5)`,
          [chunk.id, chunk.documentId, chunk.text, chunk.pageNumber, chunk.index]
        );
      }
      for (const vector of vectors) {
        await client.query(
          `INSERT INTO vectors (chunk_id, document_id, values)
           VALUES ($1, $2, $3::jsonb)`,
          [vector.chunkId, vector.documentId, JSON.stringify(vector.values)]
        );
      }
      await client.query('COMMIT');
      return doc;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public static async deleteDocument(id: string): Promise<void> {
    await ensureReady();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const sessions = await client.query('SELECT id FROM chat_sessions WHERE document_id = $1', [id]);
      const sessionIds = sessions.rows.map((row) => row.id);
      if (sessionIds.length > 0) {
        await client.query('DELETE FROM messages WHERE session_id = ANY($1::text[])', [sessionIds]);
        await client.query('DELETE FROM chat_sessions WHERE id = ANY($1::text[])', [sessionIds]);
      }
      await client.query('DELETE FROM documents WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public static async getChunks(documentId: string): Promise<TextChunk[]> {
    await ensureReady();
    const { rows } = await getPool().query(
      'SELECT * FROM chunks WHERE document_id = $1 ORDER BY chunk_index ASC',
      [documentId]
    );
    return rows.map(mapChunk);
  }

  public static async toggleDocumentStar(id: string): Promise<DocumentRecord | undefined> {
    await ensureReady();
    const { rows } = await getPool().query(
      `UPDATE documents SET is_starred = NOT is_starred WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0] ? mapDocument(rows[0]) : undefined;
  }

  public static async updateDocumentTags(id: string, tags: string[]): Promise<DocumentRecord | undefined> {
    await ensureReady();
    const { rows } = await getPool().query(
      `UPDATE documents SET tags = $2::jsonb WHERE id = $1 RETURNING *`,
      [id, JSON.stringify(tags)]
    );
    return rows[0] ? mapDocument(rows[0]) : undefined;
  }

  public static async getChatSessions(userId: string): Promise<ChatSession[]> {
    await ensureReady();
    const { rows } = await getPool().query(
      'SELECT * FROM chat_sessions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return rows.map(mapSession);
  }

  public static async getChatSessionsByDoc(userId: string, documentId: string): Promise<ChatSession[]> {
    await ensureReady();
    const { rows } = await getPool().query(
      'SELECT * FROM chat_sessions WHERE user_id = $1 AND document_id = $2 ORDER BY created_at DESC',
      [userId, documentId]
    );
    return rows.map(mapSession);
  }

  public static async getChatSession(id: string): Promise<ChatSession | undefined> {
    await ensureReady();
    const { rows } = await getPool().query('SELECT * FROM chat_sessions WHERE id = $1 LIMIT 1', [id]);
    return rows[0] ? mapSession(rows[0]) : undefined;
  }

  public static async createChatSession(session: ChatSession): Promise<ChatSession> {
    await ensureReady();
    await getPool().query(
      `INSERT INTO chat_sessions (id, user_id, document_id, document_ids, title, created_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
      [
        session.id,
        session.userId,
        session.documentId,
        session.documentIds ? JSON.stringify(session.documentIds) : null,
        session.title,
        session.createdAt,
      ]
    );
    return session;
  }

  public static async getMessages(sessionId: string): Promise<Message[]> {
    await ensureReady();
    const { rows } = await getPool().query(
      'SELECT * FROM messages WHERE session_id = $1 ORDER BY created_at ASC',
      [sessionId]
    );
    return rows.map(mapMessage);
  }

  public static async createMessage(message: Message): Promise<Message> {
    await ensureReady();
    await getPool().query(
      `INSERT INTO messages (id, session_id, role, content, created_at, source_pages, source_documents, confidence_score)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)`,
      [
        message.id,
        message.sessionId,
        message.role,
        message.content,
        message.createdAt,
        message.sourcePages ? JSON.stringify(message.sourcePages) : null,
        message.sourceDocuments ? JSON.stringify(message.sourceDocuments) : null,
        message.confidenceScore ?? null,
      ]
    );
    return message;
  }

  private static cosineSimilarity(v1: number[], v2: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    const length = Math.min(v1.length, v2.length);
    for (let i = 0; i < length; i++) {
      dotProduct += v1[i] * v2[i];
      normA += v1[i] * v1[i];
      normB += v2[i] * v2[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  public static async searchSimilarChunks(
    documentId: string,
    queryEmbedding: number[],
    limit = 5
  ): Promise<{ chunk: TextChunk; similarity: number }[]> {
    const matches = await this.searchSimilarChunksAcrossDocuments([documentId], queryEmbedding, limit);
    return matches.map(({ chunk, similarity }) => ({ chunk, similarity }));
  }

  public static async searchSimilarChunksAcrossDocuments(
    documentIds: string[],
    queryEmbedding: number[],
    limit = 5
  ): Promise<{ chunk: TextChunk; similarity: number; documentName: string }[]> {
    await ensureReady();
    if (documentIds.length === 0) return [];

    const { rows } = await getPool().query(
      `SELECT c.id, c.document_id, c.text, c.page_number, c.chunk_index,
              v.values, d.name AS document_name
       FROM vectors v
       JOIN chunks c ON c.id = v.chunk_id
       JOIN documents d ON d.id = c.document_id
       WHERE v.document_id = ANY($1::text[])`,
      [documentIds]
    );

    return rows
      .map((row) => ({
        chunk: mapChunk(row),
        similarity: this.cosineSimilarity(row.values as number[], queryEmbedding),
        documentName: row.document_name || 'Unknown document',
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
}
