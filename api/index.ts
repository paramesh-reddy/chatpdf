import type { VercelRequest, VercelResponse } from '@vercel/node';
import serverless from 'serverless-http';
import { createApp } from '../server/app';

const handler = serverless(createApp());

export default async function handlerWrapper(req: VercelRequest, res: VercelResponse) {
  return handler(req as any, res as any);
}
