/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import OpenAI from 'openai';

let aiInstance: OpenAI | null = null;

export function getAI(): OpenAI {
  if (!aiInstance) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not defined in the environment.');
    }
    aiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return aiInstance;
}

/**
 * Generates embeddings for text chunks using OpenAI text-embedding-3-small.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const client = getAI();

  const batchSize = 20;
  const promises: Promise<number[][]>[] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    promises.push((async () => {
      try {
        const response = await client.embeddings.create({
          model: 'text-embedding-3-small',
          input: batch,
        });

        if (response.data) {
          return response.data.map((e) => e.embedding);
        } else {
          throw new Error('Embeddings response did not contain data');
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
 * Builds a RAG prompt from retrieved context chunks and the user question.
 */
export function buildRAGPrompt(
  question: string,
  contextChunks: { text: string; pageNumber: number; documentName?: string }[],
  multiDocument = false
): string {
  const formattedContext = contextChunks
    .map((chunk, idx) => {
      const sourceLabel = chunk.documentName
        ? `${chunk.documentName}, Page ${chunk.pageNumber}`
        : `Page ${chunk.pageNumber}`;
      return `[Source ${idx + 1}] (${sourceLabel}):\n${chunk.text}`;
    })
    .join('\n\n---\n\n');

  const scopeHint = multiDocument
    ? 'The context may come from multiple documents. Compare and synthesize across sources when relevant.'
    : 'Answer based strictly on the provided document context.';

  return `You are DocuMind AI, an expert document assistant. ${scopeHint}
If the answer cannot be found in the context, clearly state that you don't know based on the documents, but do NOT make up information.
Always reference your sources by using [Source X] where appropriate in your text.

CONTEXT:
${formattedContext}

QUESTION:
${question}

ANSWER:`;
}
