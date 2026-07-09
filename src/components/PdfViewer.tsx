/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Search, Loader2, FileText } from 'lucide-react';
import ApiService from '../api.ts';
import { DocumentRecord, TextChunk } from '../types.ts';

interface PdfViewerProps {
  documentRecord: DocumentRecord | null;
  activePage: number;
  onPageChange: (page: number) => void;
}

export default function PdfViewer({ documentRecord, activePage, onPageChange }: PdfViewerProps) {
  const [chunks, setChunks] = useState<TextChunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!documentRecord) { setChunks([]); return; }
    setLoading(true);
    ApiService.listDocumentChunks(documentRecord.id)
      .then(setChunks)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [documentRecord]);

  const pagesData = useMemo(() => {
    const map: Record<number, string> = {};
    for (const chunk of chunks) {
      map[chunk.pageNumber] = (map[chunk.pageNumber] || '') + chunk.text + ' ';
    }
    return map;
  }, [chunks]);

  const totalPages = documentRecord?.pageCount || 0;
  const pageContent = pagesData[activePage] || '';

  const highlight = (text: string) => {
    if (!searchTerm.trim()) return text;
    const regex = new RegExp(`(${searchTerm.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi');
    return text.split(regex).map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-amber-200 text-amber-900 rounded px-0.5">{part}</mark> : part
    );
  };

  if (!documentRecord) return null;

  return (
    <div className="h-full flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden dark:border-slate-800/80 dark:bg-slate-900/50">
      {/* Toolbar */}
      <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-3 dark:border-slate-800/60">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-cyan-600 flex-shrink-0 dark:text-cyan-400" />
          <span className="text-xs font-medium text-slate-700 truncate dark:text-slate-300">{documentRecord.name}</span>
        </div>
        <div className="relative flex-shrink-0">
          <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-2" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Find in page..."
            className="w-36 pl-8 pr-2 py-1.5 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500/50 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder-slate-500"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-slate-100/70 scrollbar-thin dark:bg-slate-800/20">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 text-slate-500 animate-spin" />
          </div>
        ) : pageContent ? (
          <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-xl min-h-[480px] p-8 lg:p-10">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-6">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Page {activePage}</span>
              <span className="text-[10px] text-slate-400">{totalPages} pages total</span>
            </div>
            <p className="text-sm text-slate-800 leading-[1.8] whitespace-pre-wrap">
              {highlight(pageContent)}
            </p>
          </div>
        ) : (
          <p className="text-center text-slate-500 text-sm py-20">No text content on this page</p>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 0 && (
        <div className="px-4 py-2.5 border-t border-slate-200 flex items-center justify-center gap-4 bg-slate-50 dark:border-slate-800/60 dark:bg-slate-900/30">
          <button
            onClick={() => onPageChange(activePage - 1)}
            disabled={activePage <= 1}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-slate-500 font-medium dark:text-slate-400">
            Page <span className="text-slate-900 dark:text-white">{activePage}</span> of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(activePage + 1)}
            disabled={activePage >= totalPages}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
