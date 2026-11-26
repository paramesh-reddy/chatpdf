/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createApp } from './server/app.ts';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = createApp();

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
      if (path.extname(req.path)) {
        res.status(404).type('text/plain').send('Not found');
        return;
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] DocuMind AI listening on port ${PORT}`);
    console.log(`[Server] Running in ${process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
  });
}

startServer().catch(err => {
  console.error('Failed to start full-stack server:', err);
});
