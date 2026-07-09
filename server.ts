/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import OpenAI from 'openai';

import { Database } from './server/db.ts';
import { extractPageWiseText, chunkPageWiseText } from './server/pdf.ts';
import { generateEmbeddings, buildRAGPrompt, getAI } from './server/gemini.ts';
import { User, DocumentRecord, TextChunk, VectorRecord, ChatSession, Message } from './src/types.ts';

const PORT = 3000;
const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || 'chatpdf-access-secret-2026-key';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'chatpdf-refresh-secret-2026-key';

// Extend Express Request type to include user info
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

// Authentication middleware
function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

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

async function startServer() {
  const app = express();

  // Configure high payload limits for base64 file uploads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Simple Request Logging Middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // ==========================================
  // 1. AUTHENTICATION ENDPOINTS
  // ==========================================

  // Register
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

      // Hash password using bcryptjs
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const newUser: User = {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        email,
        passwordHash,
        createdAt: new Date().toISOString(),
      };

      Database.createUser(newUser);

      // Generate JWT Tokens
      const accessToken = jwt.sign(
        { userId: newUser.id, email: newUser.email },
        ACCESS_TOKEN_SECRET,
        { expiresIn: '15m' }
      );
      const refreshToken = jwt.sign(
        { userId: newUser.id, email: newUser.email },
        REFRESH_TOKEN_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        user: { id: newUser.id, email: newUser.email },
        accessToken,
        refreshToken,
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error during registration' });
    }
  });

  // Login
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

      // Generate JWT Tokens
      const accessToken = jwt.sign(
        { userId: user.id, email: user.email },
        ACCESS_TOKEN_SECRET,
        { expiresIn: '15m' }
      );
      const refreshToken = jwt.sign(
        { userId: user.id, email: user.email },
        REFRESH_TOKEN_SECRET,
        { expiresIn: '7d' }
      );

      res.status(200).json({
        user: { id: user.id, email: user.email },
        accessToken,
        refreshToken,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error during login' });
    }
  });

  // Refresh Token
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

      // Check if user still exists
      const user = Database.getUserById(decoded.userId);
      if (!user) {
        res.status(403).json({ error: 'User no longer exists' });
        return;
      }

      // Issue new short-lived access token
      const accessToken = jwt.sign(
        { userId: user.id, email: user.email },
        ACCESS_TOKEN_SECRET,
        { expiresIn: '15m' }
      );

      res.status(200).json({ accessToken });
    });
  });

  // Logout (client handles clearing storage, server acknowledges)
  app.post('/api/auth/logout', (req: Request, res: Response): void => {
    res.status(200).json({ message: 'Logged out successfully' });
  });

  // Get current user profile
  app.get('/api/auth/me', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
    res.status(200).json({ user: req.user });
  });

  // ==========================================
  // 2. DOCUMENT MANAGEMENT ENDPOINTS
  // ==========================================

  // List all uploaded documents for user
  app.get('/api/documents', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
    try {
      const documents = Database.getDocuments(req.user!.id);
      res.status(200).json(documents);
    } catch (error) {
      console.error('Fetch documents error:', error);
      res.status(500).json({ error: 'Failed to retrieve documents.' });
    }
  });

  // Get a single document details
  app.get('/api/documents/:id', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
    try {
      const document = Database.getDocument(req.params.id);
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

  // Get a single document chunks
  app.get('/api/documents/:id/chunks', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
    try {
      const document = Database.getDocument(req.params.id);
      if (!document || document.userId !== req.user!.id) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      const chunks = Database.getChunks(req.params.id);
      res.status(200).json(chunks);
    } catch (error) {
      console.error('Fetch document chunks error:', error);
      res.status(500).json({ error: 'Failed to retrieve document chunks.' });
    }
  });

  // Upload and process base64 encoded PDF
  app.post('/api/documents/upload', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { fileName, fileSize, base64Data } = req.body;

      if (!fileName || !fileSize || !base64Data) {
        res.status(400).json({ error: 'fileName, fileSize, and base64Data are required.' });
        return;
      }

      // Validation check for 10MB limit
      const bytes = Buffer.from(base64Data, 'base64');
      if (bytes.length > 10 * 1024 * 1024) {
        res.status(400).json({ error: 'PDF file size exceeds the 10MB upload limit.' });
        return;
      }

      console.log(`[Upload] Processing document "${fileName}" (${(bytes.length / 1024 / 1024).toFixed(2)} MB)...`);

      // 1. Extract page-wise text
      const pages = await extractPageWiseText(bytes);
      const pageCount = Object.keys(pages).length;

      if (pageCount === 0) {
        res.status(400).json({ error: 'Failed to extract text. The PDF might be empty, password protected, or scanned images only.' });
        return;
      }

      const documentId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // 2. Chunk page-wise text
      const chunks = chunkPageWiseText(pages, documentId);
      console.log(`[Upload] Extracted ${pageCount} pages and split into ${chunks.length} chunks.`);

      // 3. Generate Embeddings using Gemini Embedding API in batched calls
      console.log(`[Upload] Requesting embeddings for ${chunks.length} chunks from Gemini API...`);
      const embeddingVectors = await generateEmbeddings(chunks.map(c => c.text));

      // 4. Map embedding values to chunks and prepare vector records
      const vectors: VectorRecord[] = embeddingVectors.map((vals, i) => ({
        chunkId: chunks[i].id,
        documentId,
        values: vals,
      }));

      // 5. Store document record, metadata, text chunks, and vectors in DB
      const docRecord: DocumentRecord = {
        id: documentId,
        userId: req.user!.id,
        name: fileName,
        size: fileSize,
        pageCount,
        uploadedAt: new Date().toISOString(),
      };

      Database.createDocument(docRecord, chunks, vectors);
      console.log(`[Upload] Document "${fileName}" successfully processed and vectorized! ID: ${documentId}`);

      res.status(201).json(docRecord);
    } catch (error) {
      console.error('PDF upload/vectorization processing error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred while parsing and embedding the PDF.' });
    }
  });

  // Toggle star status of document
  app.post('/api/documents/:id/star', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
    try {
      const document = Database.getDocument(req.params.id);
      if (!document || document.userId !== req.user!.id) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      const updated = Database.toggleDocumentStar(req.params.id);
      res.status(200).json(updated);
    } catch (error) {
      console.error('Star document error:', error);
      res.status(500).json({ error: 'Failed to star document.' });
    }
  });

  // Update tags of document
  app.post('/api/documents/:id/tags', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
    try {
      const { tags } = req.body;
      const document = Database.getDocument(req.params.id);
      if (!document || document.userId !== req.user!.id) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      const updated = Database.updateDocumentTags(req.params.id, Array.isArray(tags) ? tags : []);
      res.status(200).json(updated);
    } catch (error) {
      console.error('Update document tags error:', error);
      res.status(500).json({ error: 'Failed to update document tags.' });
    }
  });

  // Delete document
  app.delete('/api/documents/:id', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
    try {
      const document = Database.getDocument(req.params.id);
      if (!document || document.userId !== req.user!.id) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      Database.deleteDocument(req.params.id);
      res.status(200).json({ message: 'Document and vectors deleted successfully.' });
    } catch (error) {
      console.error('Delete document error:', error);
      res.status(500).json({ error: 'Failed to delete document.' });
    }
  });

  // ==========================================
  // 3. CHAT SESSIONS & HISTORY ENDPOINTS
  // ==========================================

  // List sessions associated with a document
  app.get('/api/chat/sessions', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
    try {
      const { documentId } = req.query;
      if (!documentId) {
        res.status(400).json({ error: 'documentId query parameter is required' });
        return;
      }

      const sessions = Database.getChatSessionsByDoc(req.user!.id, documentId as string);
      res.status(200).json(sessions);
    } catch (error) {
      console.error('Fetch sessions error:', error);
      res.status(500).json({ error: 'Failed to retrieve chat sessions.' });
    }
  });

  // Create a new session
  app.post('/api/chat/sessions', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
    try {
      const { documentId, title } = req.body;
      if (!documentId || !title) {
        res.status(400).json({ error: 'documentId and title are required.' });
        return;
      }

      const document = Database.getDocument(documentId);
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

      Database.createChatSession(newSession);
      res.status(201).json(newSession);
    } catch (error) {
      console.error('Create session error:', error);
      res.status(500).json({ error: 'Failed to create chat session.' });
    }
  });

  // List messages in a session
  app.get('/api/chat/sessions/:sessionId/messages', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
    try {
      const session = Database.getChatSession(req.params.sessionId);
      if (!session || session.userId !== req.user!.id) {
        res.status(404).json({ error: 'Chat session not found' });
        return;
      }

      const messages = Database.getMessages(req.params.sessionId);
      res.status(200).json(messages);
    } catch (error) {
      console.error('Fetch messages error:', error);
      res.status(500).json({ error: 'Failed to retrieve messages.' });
    }
  });

  // ==========================================
  // 4. CHAT RAG SSE STREAMING ENDPOINT
  // ==========================================
  app.get('/api/chat/stream', async (req: Request, res: Response): Promise<void> => {
    // SSE parameters can be passed in query string for easy client-side EventSource/fetch streaming setup
    const token = req.query.token as string;
    const documentId = req.query.documentId as string;
    const sessionId = req.query.sessionId as string;
    const question = req.query.question as string;

    if (!token || !documentId || !question) {
      res.status(400).json({ error: 'token, documentId, and question parameters are required.' });
      return;
    }

    let userId = '';
    let email = '';

    try {
      // 1. Authenticate JWT token
      const decoded: any = jwt.verify(token, ACCESS_TOKEN_SECRET);
      userId = decoded.userId;
      email = decoded.email;
    } catch (err) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Verify document ownership
    const docRecord = Database.getDocument(documentId);
    if (!docRecord || docRecord.userId !== userId) {
      res.status(403).json({ error: 'Document access forbidden.' });
      return;
    }

    // Prepare SSE connection headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      // 2. Generate embedding for query
      const queryEmbeddings = await generateEmbeddings([question]);
      const queryVector = queryEmbeddings[0];

      // 3. Search ChromaDB equivalent local index for top 5 relevant chunks
      const searchResults = Database.searchSimilarChunks(documentId, queryVector, 5);
      
      if (searchResults.length === 0) {
        // Send a direct response indicating no context
        res.write(`data: ${JSON.stringify({ text: "No relevant content found in the document to answer this question." })}\n\n`);
        const finalMeta = {
          source_pages: [],
          confidence_score: 0,
          sessionId: sessionId || '',
        };
        res.write(`event: done\ndata: ${JSON.stringify(finalMeta)}\n\n`);
        res.end();
        return;
      }

      const topChunks = searchResults.map(r => r.chunk);
      const sourcePages = Array.from(new Set(topChunks.map(c => c.pageNumber))).sort((a, b) => a - b);
      
      // Calculate confidence score based on the highest matches' similarity values
      const avgSimilarity = searchResults.reduce((sum, r) => sum + r.similarity, 0) / searchResults.length;
      // Convert typical 0.5-0.9 cosine similarity values into a user-friendly 0-100% confidence scale
      const confidenceScore = Math.min(100, Math.max(10, Math.round(avgSimilarity * 100 + 10)));

      // 4. Build system/RAG prompt
      const prompt = buildRAGPrompt(question, topChunks.map(c => ({ text: c.text, pageNumber: c.pageNumber })));

      // 5. Gather chat history if session is active
      let targetSessionId = sessionId;
      const conversationMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      if (targetSessionId) {
        const session = Database.getChatSession(targetSessionId);
        if (session && session.userId === userId) {
          const pastMessages = Database.getMessages(targetSessionId).slice(-10); // last 10 messages for context
          for (const msg of pastMessages) {
            conversationMessages.push({
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msg.content,
            });
          }
        }
      } else {
        // Automatically create a new session if none was provided
        targetSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const shortTitle = question.length > 30 ? question.substring(0, 30) + '...' : question;
        Database.createChatSession({
          id: targetSessionId,
          userId,
          documentId,
          title: shortTitle,
          createdAt: new Date().toISOString(),
        });

        // Notify client of the newly created session id immediately
        res.write(`event: session_created\ndata: ${JSON.stringify({ sessionId: targetSessionId, title: shortTitle })}\n\n`);
      }

      // Append current context and prompt
      conversationMessages.push({
        role: 'user',
        content: prompt,
      });

      // Save user question message
      const userMessage: Message = {
        id: `msg-${Date.now()}-user`,
        sessionId: targetSessionId,
        role: 'user',
        content: question,
        createdAt: new Date().toISOString(),
      };
      Database.createMessage(userMessage);

      // 6. Call OpenAI GPT-4 Streaming API
      console.log(`[RAG Stream] Querying OpenAI model for response on session ${targetSessionId}...`);
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
        // Stream text chunk as an SSE event
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      }

      // Save assistant answer message
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-assistant`,
        sessionId: targetSessionId,
        role: 'assistant',
        content: fullAnswerText,
        createdAt: new Date().toISOString(),
        sourcePages,
        confidenceScore,
      };
      Database.createMessage(assistantMessage);

      // 7. Send final "done" event with source citations and score
      const doneMeta = {
        source_pages: sourcePages,
        confidence_score: confidenceScore,
        sessionId: targetSessionId,
      };
      res.write(`event: done\ndata: ${JSON.stringify(doneMeta)}\n\n`);
      res.end();
    } catch (error) {
      console.error('SSE RAG streaming failure:', error);
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'RAG generation pipeline failed.' })}\n\n`);
      res.end();
    }
  });

  // ==========================================
  // 5. VITE DEVELOPMENT OR PRODUCTION SETUP
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Full-stack ChatPDF listening on port ${PORT}`);
    console.log(`[Server] Running in ${process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
  });
}

startServer().catch(err => {
  console.error('Failed to start full-stack server:', err);
});
