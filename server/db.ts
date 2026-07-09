/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { User, DocumentRecord, TextChunk, VectorRecord, ChatSession, Message } from '../src/types.ts';

const DB_FILE = path.join(process.cwd(), 'db.json');
const VECTORS_FILE = path.join(process.cwd(), 'vectors.json');

interface Schema {
  users: User[];
  documents: DocumentRecord[];
  chunks: TextChunk[];
  chatSessions: ChatSession[];
  messages: Message[];
}

const defaultSchema: Schema = {
  users: [],
  documents: [],
  chunks: [],
  chatSessions: [],
  messages: [],
};

// Helper to ensure database files exist
function initDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultSchema, null, 2), 'utf-8');
  }
  if (!fs.existsSync(VECTORS_FILE)) {
    fs.writeFileSync(VECTORS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

initDatabase();

export class Database {
  private static readDB(): Schema {
    try {
      initDatabase();
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(content) as Schema;
    } catch (error) {
      console.error('Error reading DB, resetting to defaults:', error);
      return defaultSchema;
    }
  }

  private static writeDB(data: Schema) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error writing DB:', error);
    }
  }

  private static readVectors(): VectorRecord[] {
    try {
      initDatabase();
      const content = fs.readFileSync(VECTORS_FILE, 'utf-8');
      return JSON.parse(content) as VectorRecord[];
    } catch (error) {
      console.error('Error reading vectors, resetting:', error);
      return [];
    }
  }

  private static writeVectors(data: VectorRecord[]) {
    try {
      fs.writeFileSync(VECTORS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error writing vectors:', error);
    }
  }

  // --- USERS ---
  public static getUsers(): User[] {
    return this.readDB().users;
  }

  public static getUserByEmail(email: string): User | undefined {
    return this.readDB().users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  public static getUserById(id: string): User | undefined {
    return this.readDB().users.find(u => u.id === id);
  }

  public static createUser(user: User): User {
    const db = this.readDB();
    db.users.push(user);
    this.writeDB(db);
    return user;
  }

  // --- DOCUMENTS ---
  public static getDocuments(userId: string): DocumentRecord[] {
    return this.readDB().documents.filter(d => d.userId === userId);
  }

  public static getDocument(id: string): DocumentRecord | undefined {
    return this.readDB().documents.find(d => d.id === id);
  }

  public static createDocument(
    doc: DocumentRecord,
    chunks: TextChunk[],
    vectors: VectorRecord[]
  ): DocumentRecord {
    const db = this.readDB();
    db.documents.push(doc);
    db.chunks.push(...chunks);
    this.writeDB(db);

    const allVectors = this.readVectors();
    allVectors.push(...vectors);
    this.writeVectors(allVectors);

    return doc;
  }

  public static deleteDocument(id: string) {
    const db = this.readDB();
    db.documents = db.documents.filter(d => d.id !== id);
    db.chunks = db.chunks.filter(c => c.documentId !== id);
    db.chatSessions = db.chatSessions.filter(s => s.documentId !== id);
    // Delete messages associated with deleted sessions
    const sessionIds = new Set(db.chatSessions.map(s => s.id));
    db.messages = db.messages.filter(m => sessionIds.has(m.sessionId));
    this.writeDB(db);

    const allVectors = this.readVectors();
    const filteredVectors = allVectors.filter(v => v.documentId !== id);
    this.writeVectors(filteredVectors);
  }

  public static getChunks(documentId: string): TextChunk[] {
    return this.readDB().chunks.filter(c => c.documentId === documentId);
  }

  public static toggleDocumentStar(id: string): DocumentRecord | undefined {
    const db = this.readDB();
    const doc = db.documents.find(d => d.id === id);
    if (doc) {
      doc.isStarred = !doc.isStarred;
      this.writeDB(db);
    }
    return doc;
  }

  public static updateDocumentTags(id: string, tags: string[]): DocumentRecord | undefined {
    const db = this.readDB();
    const doc = db.documents.find(d => d.id === id);
    if (doc) {
      doc.tags = tags;
      this.writeDB(db);
    }
    return doc;
  }

  // --- CHAT SESSIONS ---
  public static getChatSessions(userId: string): ChatSession[] {
    return this.readDB().chatSessions.filter(s => s.userId === userId);
  }

  public static getChatSessionsByDoc(userId: string, documentId: string): ChatSession[] {
    return this.readDB().chatSessions.filter(s => s.userId === userId && s.documentId === documentId);
  }

  public static getChatSession(id: string): ChatSession | undefined {
    return this.readDB().chatSessions.find(s => s.id === id);
  }

  public static createChatSession(session: ChatSession): ChatSession {
    const db = this.readDB();
    db.chatSessions.push(session);
    this.writeDB(db);
    return session;
  }

  // --- MESSAGES ---
  public static getMessages(sessionId: string): Message[] {
    return this.readDB().messages.filter(m => m.sessionId === sessionId);
  }

  public static createMessage(message: Message): Message {
    const db = this.readDB();
    db.messages.push(message);
    this.writeDB(db);
    return message;
  }

  // --- VECTOR SEARCH ---
  /**
   * Computes the cosine similarity between two numeric vectors.
   */
  private static cosineSimilarity(v1: number[], v2: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < v1.length; i++) {
      dotProduct += v1[i] * v2[i];
      normA += v1[i] * v1[i];
      normB += v2[i] * v2[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Performs semantic vector search on chunks belonging to a document.
   * Returns top matched chunks with their similarity scores.
   */
  public static searchSimilarChunks(
    documentId: string,
    queryEmbedding: number[],
    limit = 5
  ): { chunk: TextChunk; similarity: number }[] {
    return this.searchSimilarChunksAcrossDocuments([documentId], queryEmbedding, limit);
  }

  /**
   * Search across multiple documents and return the best matching chunks globally.
   */
  public static searchSimilarChunksAcrossDocuments(
    documentIds: string[],
    queryEmbedding: number[],
    limit = 5
  ): { chunk: TextChunk; similarity: number; documentName: string }[] {
    const db = this.readDB();
    const allVectors = this.readVectors();
    const docIdSet = new Set(documentIds);

    const docVectors = allVectors.filter(v => docIdSet.has(v.documentId));
    const docChunks = db.chunks.filter(c => docIdSet.has(c.documentId));
    const docNameById = new Map(
      db.documents.filter(d => docIdSet.has(d.id)).map(d => [d.id, d.name])
    );

    const results = docVectors.map(vec => {
      const similarity = this.cosineSimilarity(vec.values, queryEmbedding);
      const chunk = docChunks.find(c => c.id === vec.chunkId);
      const documentName = docNameById.get(vec.documentId) || 'Unknown document';
      return { chunk, similarity, documentName };
    });

    return results
      .filter((r): r is { chunk: TextChunk; similarity: number; documentName: string } => r.chunk !== undefined)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
}
