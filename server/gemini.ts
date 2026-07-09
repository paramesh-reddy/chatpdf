/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';

// Initialize Gemini SDK with telemetry header as required by the system instructions
export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

/**
 * Generates embeddings for an array of text chunks using gemini-embedding-2-preview.
 * Implements batching to ensure stability for larger PDF documents.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not defined in the environment.');
  }

  const batchSize = 20;
  const promises: Promise<number[][]>[] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    promises.push((async () => {
      try {
        const response = await ai.models.embedContent({
          model: 'gemini-embedding-2-preview',
          contents: batch,
        });

        if (response.embeddings) {
          return response.embeddings.map((e) => e.values);
        } else {
          throw new Error('Embeddings response did not contain values');
        }
      } catch (error) {
        console.error(`Error generating embeddings batch starting at index ${i}:`, error);
        throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : String(error)}`);
      }
    })());
  }

  const results = await Promise.all(promises);
  return results.flat();
}

/**
 * Generates a prompt for Gemini using the context chunks and user question.
 */
export function buildRAGPrompt(
  question: string,
  contextChunks: { text: string; pageNumber: number }[]
): string {
  const formattedContext = contextChunks
    .map((chunk, idx) => `[Source ${idx + 1}] (Page ${chunk.pageNumber}):\n${chunk.text}`)
    .join('\n\n---\n\n');

  return `You are ChatPDF, an expert document assistant. Answer the user's question based strictly on the provided context.
If the answer cannot be found in the context, clearly state that you don't know based on the document, but do NOT make up information.
Always reference your sources by using [Source X] (or page numbers) where appropriate in your text.

CONTEXT:
${formattedContext}

QUESTION:
${question}

ANSWER:`;
}
