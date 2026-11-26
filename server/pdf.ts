/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createRequire } from 'node:module';
import { RecursiveCharacterTextSplitter } from './splitter.ts';
import { TextChunk } from '../src/types.ts';

const nodeRequire = createRequire(import.meta.url);

// Literal requires so the Vercel file tracer ships the native canvas build.
// pdfjs-dist reads DOMMatrix while its module is evaluated; Node does not provide it.
function preloadCanvas(): void {
  try {
    nodeRequire('@napi-rs/canvas');
  } catch (error) {
    console.warn('Unable to preload @napi-rs/canvas:', error);
  }
  try {
    nodeRequire('@napi-rs/canvas-linux-x64-gnu');
  } catch {
    // Installed for the Vercel Linux runtime. It cannot load on other operating systems.
  }
}

preloadCanvas();

type PdfRuntime = {
  PDFParse: typeof import('pdf-parse').PDFParse;
  CanvasFactory?: typeof import('pdf-parse/worker').CanvasFactory;
};

let runtimePromise: Promise<PdfRuntime> | null = null;

function installDomPolyfills(): void {
  const g = globalThis as any;

  if (typeof g.DOMMatrix === 'undefined') {
    g.DOMMatrix = class DOMMatrixPolyfill {
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;
      is2D = true;
      constructor(init?: number[]) {
        if (Array.isArray(init) && init.length >= 6) {
          [this.a, this.b, this.c, this.d, this.e, this.f] = init;
        }
      }
      multiplySelf() { return this; }
      preMultiplySelf() { return this; }
      translate() { return this; }
      translateSelf() { return this; }
      scale() { return this; }
      scaleSelf() { return this; }
      invertSelf() { return this; }
      inverse() { return new g.DOMMatrix(); }
      transformPoint(point?: { x?: number; y?: number }) {
        return { x: point?.x ?? 0, y: point?.y ?? 0, z: 0, w: 1 };
      }
    };
  }

  if (typeof g.ImageData === 'undefined') {
    g.ImageData = class ImageDataPolyfill {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
        if (typeof dataOrWidth === 'number') {
          this.width = dataOrWidth;
          this.height = widthOrHeight;
          this.data = new Uint8ClampedArray(this.width * this.height * 4);
        } else {
          this.data = dataOrWidth;
          this.width = widthOrHeight;
          this.height = height ?? dataOrWidth.length / 4 / widthOrHeight;
        }
      }
    };
  }

  if (typeof g.Path2D === 'undefined') {
    g.Path2D = class Path2DPolyfill {
      addPath() {}
      closePath() {}
      moveTo() {}
      lineTo() {}
      bezierCurveTo() {}
      quadraticCurveTo() {}
      rect() {}
    };
  }
}

async function loadPdfRuntime(): Promise<PdfRuntime> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      installDomPolyfills();
      let CanvasFactory: PdfRuntime['CanvasFactory'];
      try {
        // Must run before `pdf-parse`, which evaluates pdfjs and touches DOMMatrix immediately.
        const worker = await import('pdf-parse/worker');
        CanvasFactory = worker.CanvasFactory;
      } catch (error) {
        console.warn('pdf-parse canvas worker unavailable; using DOM polyfills.', error);
      }
      const { PDFParse } = await import('pdf-parse');
      return { PDFParse, CanvasFactory };
    })().catch((error) => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
}

/**
 * Extracts page-wise text from a PDF buffer, mapping page numbers (1-indexed) to their raw text content.
 * Blank or whitespace-only pages are excluded.
 */
export async function extractPageWiseText(buffer: Buffer): Promise<{ [pageNum: number]: string }> {
  const pages: { [pageNum: number]: string } = {};

  try {
    const { PDFParse, CanvasFactory } = await loadPdfRuntime();
    // Converts Buffer to Uint8Array as recommended by LoadParameters
    const uint8Array = new Uint8Array(buffer);
    const parser = new PDFParse({
      data: uint8Array,
      ...(CanvasFactory ? { CanvasFactory } : {}),
    });
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
