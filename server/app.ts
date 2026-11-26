/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import type { Request, Response, NextFunction } from 'express';
import { Database } from './db.ts';
import { extractPageWiseText, chunkPageWiseText } from './pdf.ts';
import { generateEmbeddings, buildRAGPrompt, getAI } from './openai.ts';
import type { User, DocumentRecord, VectorRecord, ChatSession, Message } from '../src/types.ts';

dotenv.config();

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || 'chatpdf-access-secret-2026-key';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'chatpdf-refresh-secret-2026-key';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  jwt.verify(token, ACCESS_TOKEN_SECRET, (err, decoded: any) => {
    if (err) {
      res.status(403).json({ error: 'Invalid or expired access token' });
      return;
    }
    req.user = { id: decoded.userId, email: decoded.email };
    next();
  });
}

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'DocuMind AI' });
  });

  app.post('/api/auth/register', async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, displayName } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      const existingUser = await Database.getUserByEmail(email);
      if (existingUser) {
        res.status(409).json({ error: 'A user with this email already exists' });
        return;
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const newUser: User = {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        email,
        passwordHash,
        displayName: displayName?.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      await Database.createUser(newUser);

      const accessToken = jwt.sign({ userId: newUser.id, email: newUser.email }, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
      const refreshToken = jwt.sign({ userId: newUser.id, email: newUser.email }, REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

      res.status(201).json({
        user: { id: newUser.id, email: newUser.email, displayName: newUser.displayName },
        accessToken,
        refreshToken,
      });
    } catch (error) {
      console.error('Registration error:', error);
      const message = error instanceof Error ? error.message : '';
      const safe = /DATABASE_URL/i.test(message)
        ? 'Database is not configured. Add DATABASE_URL in the Vercel project settings and redeploy.'
        : 'Internal server error during registration';
      res.status(500).json({ error: safe });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      const user = await Database.getUserByEmail(email);
      if (!user) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const accessToken = jwt.sign({ userId: user.id, email: user.email }, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
      const refreshToken = jwt.sign({ userId: user.id, email: user.email }, REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

      res.status(200).json({
        user: { id: user.id, email: user.email, displayName: user.displayName },
        accessToken,
        refreshToken,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error during login' });
    }
  });

  app.post('/api/auth/refresh', async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }

    try {
      const decoded: any = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
      const user = await Database.getUserById(decoded.userId);
      if (!user) {
        res.status(403).json({ error: 'User no longer exists' });
        return;
      }

      const accessToken = jwt.sign({ userId: user.id, email: user.email }, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
      res.status(200).json({ accessToken });
    } catch {
      res.status(403).json({ error: 'Invalid or expired refresh token' });
    }
  });

  app.post('/api/auth/logout', (_req: Request, res: Response): void => {
    res.status(200).json({ message: 'Logged out successfully' });
  });

  app.get('/api/auth/me', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = await Database.getUserById(req.user!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.status(200).json({
      user: { id: user.id, email: user.email, displayName: user.displayName },
    });
  });

  app.get('/api/documents', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const documents = await Database.getDocuments(req.user!.id);
      res.status(200).json(documents);
    } catch (error) {
      console.error('Fetch documents error:', error);
      res.status(500).json({ error: 'Failed to retrieve documents.' });
    }
  });

  app.get('/api/documents/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const document = await Database.getDocument(req.params.id);
      if (!document || document.userId !== req.user!.id) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      res.status(200).json(document);
    } catch (error) {
      console.error('Fetch document detail error:', error);
      res.status(500).json({ error: 'Failed to retrieve document details.' });
    }
  });

  app.get('/api/documents/:id/chunks', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const document = await Database.getDocument(req.params.id);
      if (!document || document.userId !== req.user!.id) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      const chunks = await Database.getChunks(req.params.id);
      res.status(200).json(chunks);
    } catch (error) {
      console.error('Fetch document chunks error:', error);
      res.status(500).json({ error: 'Failed to retrieve document chunks.' });
    }
  });

  app.post('/api/documents/upload', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { fileName, fileSize, base64Data } = req.body;

      if (!fileName || !fileSize || !base64Data) {
        res.status(400).json({ error: 'fileName, fileSize, and base64Data are required.' });
        return;
      }

      const bytes = Buffer.from(base64Data, 'base64');
      if (bytes.length > 10 * 1024 * 1024) {
        res.status(400).json({ error: 'PDF file size exceeds the 10MB upload limit.' });
        return;
      }

      const pages = await extractPageWiseText(bytes);
      const pageCount = Object.keys(pages).length;

      if (pageCount === 0) {
        res.status(400).json({ error: 'Failed to extract text. The PDF might be empty, password protected, or scanned images only.' });
        return;
      }

      const documentId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const chunks = chunkPageWiseText(pages, documentId);
      const embeddingVectors = await generateEmbeddings(chunks.map(c => c.text));
      const vectors: VectorRecord[] = embeddingVectors.map((vals, i) => ({
        chunkId: chunks[i].id,
        documentId,
        values: vals,
      }));

      const docRecord: DocumentRecord = {
        id: documentId,
        userId: req.user!.id,
        name: fileName,
        size: fileSize,
        pageCount,
        uploadedAt: new Date().toISOString(),
        tags: [/resume/i.test(fileName) ? 'Resumes' : 'Uncategorized'],
      };

      await Database.createDocument(docRecord, chunks, vectors);
      res.status(201).json(docRecord);
    } catch (error) {
      console.error('PDF upload/vectorization processing error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred while parsing and embedding the PDF.' });
    }
  });

  app.post('/api/documents/:id/star', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const document = await Database.getDocument(req.params.id);
      if (!document || document.userId !== req.user!.id) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      const updated = await Database.toggleDocumentStar(req.params.id);
      res.status(200).json(updated);
    } catch (error) {
      console.error('Star document error:', error);
      res.status(500).json({ error: 'Failed to star document.' });
    }
  });

  app.post('/api/documents/:id/tags', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { tags } = req.body;
      const document = await Database.getDocument(req.params.id);
      if (!document || document.userId !== req.user!.id) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      const updated = await Database.updateDocumentTags(req.params.id, Array.isArray(tags) ? tags : []);
      res.status(200).json(updated);
    } catch (error) {
      console.error('Update document tags error:', error);
      res.status(500).json({ error: 'Failed to update document tags.' });
    }
  });

  app.delete('/api/documents/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const document = await Database.getDocument(req.params.id);
      if (!document || document.userId !== req.user!.id) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      await Database.deleteDocument(req.params.id);
      res.status(200).json({ message: 'Document and vectors deleted successfully.' });
    } catch (error) {
      console.error('Delete document error:', error);
      res.status(500).json({ error: 'Failed to delete document.' });
    }
  });

  app.get('/api/chat/sessions', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { documentId } = req.query;
      if (!documentId) {
        res.status(400).json({ error: 'documentId query parameter is required' });
        return;
      }

      const sessions = await Database.getChatSessionsByDoc(req.user!.id, documentId as string);
      res.status(200).json(sessions);
    } catch (error) {
      console.error('Fetch sessions error:', error);
      res.status(500).json({ error: 'Failed to retrieve chat sessions.' });
    }
  });

  app.post('/api/chat/sessions', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { documentId, title } = req.body;
      if (!documentId || !title) {
        res.status(400).json({ error: 'documentId and title are required.' });
        return;
      }

      const document = await Database.getDocument(documentId);
      if (!document || document.userId !== req.user!.id) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      const newSession: ChatSession = {
        id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        userId: req.user!.id,
        documentId,
        title,
        createdAt: new Date().toISOString(),
      };

      await Database.createChatSession(newSession);
      res.status(201).json(newSession);
    } catch (error) {
      console.error('Create session error:', error);
      res.status(500).json({ error: 'Failed to create chat session.' });
    }
  });

  app.get('/api/chat/sessions/:sessionId/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const session = await Database.getChatSession(req.params.sessionId);
      if (!session || session.userId !== req.user!.id) {
        res.status(404).json({ error: 'Chat session not found' });
        return;
      }

      const messages = await Database.getMessages(req.params.sessionId);
      res.status(200).json(messages);
    } catch (error) {
      console.error('Fetch messages error:', error);
      res.status(500).json({ error: 'Failed to retrieve messages.' });
    }
  });

  app.get('/api/chat/stream', async (req: Request, res: Response): Promise<void> => {
    const token = req.query.token as string;
    const documentId = req.query.documentId as string;
    const documentIdsParam = req.query.documentIds as string | undefined;
    const sessionId = req.query.sessionId as string;
    const question = req.query.question as string;

    if (!token || !question) {
      res.status(400).json({ error: 'token and question parameters are required.' });
      return;
    }

    if (!documentId && !documentIdsParam) {
      res.status(400).json({ error: 'documentId or documentIds parameter is required.' });
      return;
    }

    let userId = '';

    try {
      const decoded: any = jwt.verify(token, ACCESS_TOKEN_SECRET);
      userId = decoded.userId;
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const targetDocumentIds = documentIdsParam
      ? documentIdsParam.split(',').map(id => id.trim()).filter(Boolean)
      : [documentId];

    const ownedDocs = (await Promise.all(targetDocumentIds.map(id => Database.getDocument(id))))
      .filter((doc): doc is DocumentRecord => !!doc && doc.userId === userId);

    if (ownedDocs.length === 0) {
      res.status(403).json({ error: 'Document access forbidden.' });
      return;
    }

    const ownedDocIds = ownedDocs.map(d => d.id);
    const isMultiDocument = ownedDocIds.length > 1;
    const primaryDocumentId = ownedDocIds[0];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      const queryEmbeddings = await generateEmbeddings([question]);
      const queryVector = queryEmbeddings[0];
      const searchResults = await Database.searchSimilarChunksAcrossDocuments(ownedDocIds, queryVector, 8);

      if (searchResults.length === 0) {
        res.write(`data: ${JSON.stringify({ text: 'No relevant content found in the selected documents to answer this question.' })}\n\n`);
        res.write(`event: done\ndata: ${JSON.stringify({ source_pages: [], source_documents: [], confidence_score: 0, sessionId: sessionId || '' })}\n\n`);
        res.end();
        return;
      }

      const topChunks = searchResults.map(r => r.chunk);
      const sourcePages = Array.from(new Set(topChunks.map(c => c.pageNumber))).sort((a, b) => a - b);
      const sourceDocuments = searchResults.map(r => ({
        documentId: r.chunk.documentId,
        documentName: r.documentName,
        pageNumber: r.chunk.pageNumber,
      }));
      const avgSimilarity = searchResults.reduce((sum, r) => sum + r.similarity, 0) / searchResults.length;
      const confidenceScore = Math.min(100, Math.max(10, Math.round(avgSimilarity * 100 + 10)));
      const prompt = buildRAGPrompt(
        question,
        searchResults.map(r => ({
          text: r.chunk.text,
          pageNumber: r.chunk.pageNumber,
          documentName: r.documentName,
        })),
        isMultiDocument
      );

      let targetSessionId = sessionId;
      const conversationMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      if (targetSessionId) {
        const session = await Database.getChatSession(targetSessionId);
        if (session && session.userId === userId) {
          const pastMessages = (await Database.getMessages(targetSessionId)).slice(-10);
          for (const msg of pastMessages) {
            conversationMessages.push({
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msg.content,
            });
          }
        }
      } else {
        targetSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const shortTitle = question.length > 30 ? question.substring(0, 30) + '...' : question;
        await Database.createChatSession({
          id: targetSessionId,
          userId,
          documentId: isMultiDocument ? 'workspace' : primaryDocumentId,
          documentIds: isMultiDocument ? ownedDocIds : undefined,
          title: shortTitle,
          createdAt: new Date().toISOString(),
        });
        res.write(`event: session_created\ndata: ${JSON.stringify({ sessionId: targetSessionId, title: shortTitle })}\n\n`);
      }

      conversationMessages.push({ role: 'user', content: prompt });
      const userMessage: Message = {
        id: `msg-${Date.now()}-user`,
        sessionId: targetSessionId,
        role: 'user',
        content: question,
        createdAt: new Date().toISOString(),
      };
      await Database.createMessage(userMessage);

      const client = getAI();
      const stream = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: conversationMessages,
        stream: true,
      });

      let fullAnswerText = '';
      for await (const chunk of stream) {
        const chunkText = chunk.choices[0]?.delta?.content || '';
        fullAnswerText += chunkText;
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      }

      const uniqueSourceDocuments = Array.from(
        new Map(sourceDocuments.map(s => [`${s.documentId}-${s.pageNumber}`, s])).values()
      );
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-assistant`,
        sessionId: targetSessionId,
        role: 'assistant',
        content: fullAnswerText,
        createdAt: new Date().toISOString(),
        sourcePages,
        sourceDocuments: uniqueSourceDocuments,
        confidenceScore,
      };
      await Database.createMessage(assistantMessage);

      res.write(`event: done\ndata: ${JSON.stringify({
        source_pages: sourcePages,
        source_documents: uniqueSourceDocuments,
        confidence_score: confidenceScore,
        sessionId: targetSessionId,
        answer: fullAnswerText,
      })}\n\n`);
      res.end();
    } catch (error) {
      console.error('SSE RAG streaming failure:', error);
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'RAG generation pipeline failed.' })}\n\n`);
      res.end();
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
