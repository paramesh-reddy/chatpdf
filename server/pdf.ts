/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PDFParse } from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from './splitter.ts';
import { TextChunk } from '../src/types.ts';

/**
 * Extracts page-wise text from a PDF buffer, mapping page numbers (1-indexed) to their raw text content.
 * Blank or whitespace-only pages are excluded.
 */
export async function extractPageWiseText(buffer: Buffer): Promise<{ [pageNum: number]: string }> {
  const pages: { [pageNum: number]: string } = {};

  try {
    // Converts Buffer to Uint8Array as recommended by LoadParameters
    const uint8Array = new Uint8Array(buffer);
    const parser = new PDFParse({ data: uint8Array });
    const textResult = await parser.getText();

    if (textResult && textResult.pages) {
      for (const page of textResult.pages) {
        if (page && page.text && page.text.trim().length > 0) {
          pages[page.num] = page.text.replace(/\s+/g, ' ').trim();
        }
      }
    }

    try {
      await parser.destroy();
    } catch (destroyError) {
      console.warn('Warning: Failed to destroy PDFParse instance:', destroyError);
    }

    return pages;
  } catch (error) {
    console.error('Error during PDF text extraction:', error);
    throw new Error('Failed to parse PDF document. Ensure it is a valid, unencrypted PDF.');
  }
}

/**
 * Split page-wise text into overlapping chunks, recording the origin page for each chunk.
 */
export function chunkPageWiseText(
  pages: { [pageNum: number]: string },
  documentId: string
): TextChunk[] {
  const splitter = new RecursiveCharacterTextSplitter(1000, 200);
  const chunks: TextChunk[] = [];
  let chunkIndex = 0;

  // Process pages in order
  const pageNumbers = Object.keys(pages)
    .map(Number)
    .sort((a, b) => a - b);

  for (const pageNum of pageNumbers) {
    const pageText = pages[pageNum];
    const pageChunks = splitter.splitText(pageText);

    for (const textOfChunk of pageChunks) {
      chunks.push({
        id: `${documentId}-chunk-${chunkIndex}`,
        documentId,
        text: textOfChunk,
        pageNumber: pageNum,
        index: chunkIndex,
      });
      chunkIndex++;
    }
  }

  return chunks;
}
