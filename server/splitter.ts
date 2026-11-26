/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class RecursiveCharacterTextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;
  private separators: string[];

  constructor(
    chunkSize = 1000,
    chunkOverlap = 200,
    separators = ["\n\n", "\n", " ", ""]
  ) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
    this.separators = separators;
  }

  public splitText(text: string): string[] {
    return this.split(text, this.separators);
  }

  private split(text: string, separators: string[]): string[] {
    const finalChunks: string[] = [];
    
    // Choose the best separator
    let separator = separators[separators.length - 1];
    let remainingSeparators = separators;
    for (let i = 0; i < separators.length; i++) {
      const sep = separators[i];
      if (sep === "") {
        separator = sep;
        remainingSeparators = [];
        break;
      }
      if (text.includes(sep)) {
        separator = sep;
        remainingSeparators = separators.slice(i + 1);
        break;
      }
    }

    // Split text by the selected separator
    const splits = separator === "" ? Array.from(text) : text.split(separator);
    
    let currentChunk: string[] = [];
    let currentLength = 0;

    for (const split of splits) {
      const splitLength = split.length;

      // If a single split exceeds the chunk size, we need to split it recursively
      if (splitLength > this.chunkSize) {
        if (currentChunk.length > 0) {
          finalChunks.push(currentChunk.join(separator));
          currentChunk = [];
          currentLength = 0;
        }

        if (remainingSeparators.length > 0) {
          const recursiveChunks = this.split(split, remainingSeparators);
          finalChunks.push(...recursiveChunks);
        } else {
          // Hard split if no more separators
          let start = 0;
          while (start < split.length) {
            finalChunks.push(split.substring(start, start + this.chunkSize));
            start += this.chunkSize - this.chunkOverlap;
          }
        }
        continue;
      }

      // Check if adding this split exceeds chunk size
      const separatorLength = currentChunk.length > 0 ? separator.length : 0;
      if (currentLength + splitLength + separatorLength > this.chunkSize) {
        // Save current chunk
        finalChunks.push(currentChunk.join(separator));

        // Keep elements for the overlap
        const overlapChunk: string[] = [];
        let overlapLength = 0;
        
        // Traverse backwards to gather overlap items
        for (let j = currentChunk.length - 1; j >= 0; j--) {
          const item = currentChunk[j];
          const sepLen = overlapChunk.length > 0 ? separator.length : 0;
          if (overlapLength + item.length + sepLen <= this.chunkOverlap) {
            overlapChunk.unshift(item);
            overlapLength += item.length + sepLen;
          } else {
            break;
          }
        }

        currentChunk = overlapChunk;
        currentLength = overlapLength;
      }

      currentChunk.push(split);
      currentLength += splitLength + (currentChunk.length > 1 ? separator.length : 0);
    }

    if (currentChunk.length > 0) {
      finalChunks.push(currentChunk.join(separator));
    }

    // Filter out empty chunks and trim whitespace
    return finalChunks.map(c => c.trim()).filter(c => c.length > 0);
  }
}
