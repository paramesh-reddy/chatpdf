import express from 'express';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { Database } from './db.ts';
import { extractPageWiseText, chunkPageWiseText } from './pdf.ts';
import { generateEmbeddings, buildRAGPrompt, getAI } from './openai.ts';
import type { Request, Response, NextFunction } from 'express';
import type { User, DocumentRecord, TextChunk, VectorRecord, ChatSession, Message } from '../src/types.ts';

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

  app.post('/api/auth/register', async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      const existingUser = Database.getUserByEmail(email);
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
        createdAt: new Date().toISOString(),
      };

      Database.createUser(newUser);

      const accessToken = jwt.sign({ userId: newUser.id, email: newUser.email }, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
      const refreshToken = jwt.sign({ userId: newUser.id, email: newUser.email }, REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

      res.status(201).json({ user: { id: newUser.id, email: newUser.email }, accessToken, refreshToken });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error during registration' });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      const user = Database.getUserByEmail(email);
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

      res.status(200).json({ user: { id: user.id, email: user.email }, accessToken, refreshToken });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error during login' });
    }
  });

  app.post('/api/auth/refresh', (req: Request, res: Response): void => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }

    jwt.verify(refreshToken, REFRESH_TOKEN_SECRET, (err: any, decoded: any) => {
      if (err) {
        res.status(403).json({ error: 'Invalid or expired refresh token' });
        return;
      }

      const user = Database.getUserById(decoded.userId);
      if (!user) {
        res.status(403).json({ error: 'User no longer exists' });
        return;
      }

      const accessToken = jwt.sign({ userId: user.id, email: user.email }, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
      res.status(200).json({ accessToken });
    });
  });

  app.post('/api/auth/logout', (req: Request, res: Response): void => {
    res.status(200).json({ message: 'Logged out successfully' });
  });

  app.get('/api/auth/me', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
    res.status(200).json({ user: req.user });
  });

  app.get('/api/documents', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
    try {
      const documents = Database.getDocuments(req.user!.id);
      res.status(200).json(documents);
    } catch (error) {
      console.error('Fetch documents error:', error);
      res.status(500).json({ error: 'Failed to retrieve documents.' });
    }
  });

  app.post('/api/documents/upload', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { fileName, fileSize, base64Data } = req.body;
      if (!fileName || !base64Data) {
        res.status(400).json({ error: 'Missing file data.' });
        return;
      }

      const buffer = Buffer.from(base64Data, 'base64');
      const tempPdfPath = path.join(process.cwd(), 'tmp-upload.pdf');
      fs.writeFileSync(tempPdfPath, buffer);

      const docId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const extractedText = await extractPageWiseText(buffer);
      const chunks = chunkPageWiseText(extractedText, docId);
      const embeddings = await generateEmbeddings(chunks.map(chunk => chunk.text));
      const pageCount = Object.keys(extractedText).length;

      const newDoc: DocumentRecord = {
        id: docId,
        userId: req.user!.id,
        name: fileName,
        fileType: 'application/pdf',
        uploadedAt: new Date().toISOString(),
        size: fileSize || buffer.length,
        pageCount,
        isStarred: false,
        tags: [],
      };

      const vectors = chunks.map((chunk, index) => ({
        id: `vec-${Date.now()}-${index}`,
        documentId: docId,
        chunkId: chunk.id,
        values: embeddings[index] || [],
      }));

      Database.createDocument(newDoc, chunks, vectors);

      res.status(200).json(newDoc);
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to process PDF.' });
    }
  });

  app.get('/api/documents/:id/chunks', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
    try {
      const document = Database.getDocument(req.params.id);
      if (!document) {
        res.status(404).json({ error: 'Document not found.' });
        return;
      }

      const chunks = Database.getChunks(req.params.id);
      res.status(200).json(chunks);
    } catch (error) {
      console.error('List chunks error:', error);
      res.status(500).json({ error: 'Failed to retrieve chunks.' });
      return;
    }
  });

  app.get('/api/chat/sessions', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
    try {
      const sessions = Database.getChatSessionsByDoc(req.user!.id, req.query.documentId as string);
      res.status(200).json(sessions);
    } catch (error) {
      console.error('List chat sessions error:', error);
      res.status(500).json({ error: 'Failed to retrieve chat sessions.' });
    }
  });

  app.get('/api/chat/sessions/:sessionId/messages', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
    try {
      const messages = Database.getMessages(req.params.sessionId);
      res.status(200).json(messages);
    } catch (error) {
      console.error('List messages error:', error);
      res.status(500).json({ error: 'Failed to retrieve messages.' });
    }
  });

  app.get('/api/chat/stream', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const documentId = req.query.documentId as string;
      const question = req.query.question as string;
      const sessionId = req.query.sessionId as string | undefined;

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const userId = req.user!.id;
      const chunks = Database.getChunks(documentId);
      const queryEmbedding = (await getAI().embeddings.create({
        model: 'text-embedding-3-small',
        input: question,
      })).data[0]?.embedding || [];

      const searchResults = Database.searchSimilarChunks(documentId, queryEmbedding, 5);
      const topChunks = searchResults.map(r => r.chunk).slice(0, 5);
      const sourcePages = Array.from(new Set(topChunks.map(c => c.pageNumber))).sort((a, b) => a - b);
      const avgSimilarity = searchResults.reduce((sum, r) => sum + r.similarity, 0) / searchResults.length;
      const confidenceScore = Math.min(100, Math.max(10, Math.round(avgSimilarity * 100 + 10)));
      const prompt = buildRAGPrompt(question, topChunks.map(c => ({ text: c.text, pageNumber: c.pageNumber })));

      let targetSessionId = sessionId;
      const conversationMessages: any[] = [];

      if (targetSessionId) {
        const session = Database.getChatSession(targetSessionId);
        if (session && session.userId === userId) {
          const pastMessages = Database.getMessages(targetSessionId).slice(-10);
          for (const msg of pastMessages) {
            conversationMessages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
          }
        }
      } else {
        targetSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const shortTitle = question.length > 30 ? question.substring(0, 30) + '...' : question;
        Database.createChatSession({ id: targetSessionId, userId, documentId, title: shortTitle, createdAt: new Date().toISOString() });
        res.write(`event: session_created\ndata: ${JSON.stringify({ sessionId: targetSessionId, title: shortTitle })}\n\n`);
      }

      conversationMessages.push({ role: 'user', content: prompt });
      const userMessage: Message = { id: `msg-${Date.now()}-user`, sessionId: targetSessionId, role: 'user', content: question, createdAt: new Date().toISOString() };
      Database.createMessage(userMessage);

      const client = getAI();
      const stream = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: conversationMessages, stream: true });

      let fullAnswerText = '';
      for await (const chunk of stream) {
        const chunkText = chunk.choices[0]?.delta?.content || '';
        fullAnswerText += chunkText;
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      }

      const assistantMessage: Message = { id: `msg-${Date.now()}-assistant`, sessionId: targetSessionId, role: 'assistant', content: fullAnswerText, createdAt: new Date().toISOString(), sourcePages, confidenceScore };
      Database.createMessage(assistantMessage);

      res.write(`event: done\ndata: ${JSON.stringify({ source_pages: sourcePages, confidence_score: confidenceScore, sessionId: targetSessionId })}\n\n`);
      res.end();
    } catch (error) {
      console.error('SSE RAG streaming failure:', error);
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'RAG generation pipeline failed.' })}\n\n`);
      res.end();
    }
  });

  app.get('*', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
