/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, ChevronRight, Search, FileText, Loader2, 
  Maximize2, Minimize2, Copy, Download, Share2, Clipboard 
} from 'lucide-react';
import ApiService from '../api.ts';
import { DocumentRecord, TextChunk } from '../types.ts';

interface PdfViewerProps {
  documentRecord: DocumentRecord | null;
  activePage: number;
  onPageChange: (page: number) => void;
  theme: 'dark' | 'light';
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export default function PdfViewer({ 
  documentRecord, 
  activePage, 
  onPageChange,
  theme,
  showToast,
}: PdfViewerProps) {
  const [chunks, setChunks] = useState<TextChunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Fetch document chunks to assemble page content
  useEffect(() => {
    if (documentRecord) {
      loadDocumentChunks();
    } else {
      setChunks([]);
    }
  }, [documentRecord]);

  const loadDocumentChunks = async () => {
    if (!documentRecord) return;
    setLoading(true);
    try {
      const data = await ApiService.listDocumentChunks(documentRecord.id);
      setChunks(data);
    } catch (e) {
      console.error('Failed to load document text chunks:', e);
      showToast('Failed to retrieve layout chunks', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Group chunks by page numbers
  const pagesData = useMemo(() => {
    const pageMap: { [pageNum: number]: string } = {};
    for (const chunk of chunks) {
      if (!pageMap[chunk.pageNumber]) {
        pageMap[chunk.pageNumber] = '';
      }
      pageMap[chunk.pageNumber] += chunk.text + ' ';
    }
    return pageMap;
  }, [chunks]);

  const totalPages = documentRecord ? documentRecord.pageCount : 0;
  const pageContent = pagesData[activePage] || '';

  // Highlights search matches in text
  const highlightText = (text: string, search: string) => {
    if (!search.trim()) return text;
    const regex = new RegExp(`(${search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) => 
          regex.test(part) ? (
            <span key={i} className="bg-cyan-400/35 text-cyan-200 font-bold px-0.5 rounded">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const handlePrevPage = () => {
    if (activePage > 1) {
      onPageChange(activePage - 1);
    }
  };

  const handleNextPage = () => {
    if (activePage < totalPages) {
      onPageChange(activePage + 1);
    }
  };

  const handleCopyPageText = () => {
    if (!pageContent) return;
    navigator.clipboard.writeText(pageContent.trim());
    showToast(`Page ${activePage} text copied to clipboard`, 'success');
  };

  const handleDownloadPageText = () => {
    if (!pageContent) return;
    const blob = new Blob([pageContent.trim()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${documentRecord?.name || 'document'}-page-${activePage}.txt`;
    link.click();
    showToast(`Page ${activePage} downloaded successfully`, 'success');
  };

  const isDark = theme === 'dark';

  return (
    <div
      className={`flex flex-col h-full border rounded-2xl overflow-hidden transition-all duration-300 ${
        isFullScreen ? 'fixed inset-4 z-50 shadow-2xl' : 'relative'
      } ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}
      id="pdf-viewer-root"
    >
      {/* Header controls */}
      <div className={`p-4 border-b flex items-center justify-between ${
        isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
      }`} id="pdf-viewer-header">
        <div className="flex items-center space-x-2.5 min-w-0">
          <FileText className="h-4.5 w-4.5 text-cyan-400 flex-shrink-0" />
          <div className="min-w-0">
            <h4 className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {documentRecord ? documentRecord.name : 'AetherDocs Reader'}
            </h4>
            <p className="text-[10px] text-slate-500 font-mono">
              {documentRecord ? `${totalPages} parsed pages` : 'Select a document to begin'}
            </p>
          </div>
        </div>

        {documentRecord && (
          <div className="flex items-center space-x-2">
            {/* Search Input */}
            <div className="relative hidden sm:block">
              <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-2" />
              <input
                id="pdf-search-input"
                type="text"
                placeholder="Find in page..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-36 lg:w-44 pl-8 pr-2.5 py-1 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                  isDark
                    ? 'bg-slate-900 border-slate-800 text-white placeholder-slate-600'
                    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 shadow-sm'
                }`}
              />
            </div>

            {/* Action controls (Copy page text, download page text) */}
            {pageContent && (
              <>
                <button
                  onClick={handleCopyPageText}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    isDark 
                      ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white' 
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 shadow-sm'
                  }`}
                  title="Copy page text"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleDownloadPageText}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    isDark 
                      ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white' 
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 shadow-sm'
                  }`}
                  title="Download page text"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </>
            )}

            {/* Fullscreen Toggle */}
            <button
              id="pdf-fullscreen-btn"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                isDark 
                  ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white' 
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 shadow-sm'
              }`}
              title={isFullScreen ? 'Exit full screen' : 'View full screen'}
            >
              {isFullScreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Main text pane */}
      <div className={`flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center items-start scrollbar-thin ${
        isDark ? 'bg-slate-950/20' : 'bg-slate-50/40'
      }`} id="pdf-viewer-content">
        <AnimatePresence mode="wait">
          {!documentRecord ? (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-12"
            >
              <FileText className="h-12 w-12 mb-3 text-slate-600 stroke-[1.5]" />
              <p className="text-xs font-bold">No Document Selected</p>
              <p className="text-[11px] text-slate-500 max-w-xs mt-1 leading-relaxed">
                Choose a vectorized PDF file from the sidebar or dashboard to inspect its pages.
              </p>
            </motion.div>
          ) : loading ? (
            <motion.div
              key="loading-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col items-center justify-center text-center py-12"
            >
              <Loader2 className="h-7 w-7 text-cyan-400 animate-spin mb-3" />
              <p className="text-xs text-slate-500 font-mono">Assembling layout structure...</p>
            </motion.div>
          ) : (
            <motion.div
              key={`page-${activePage}`}
              initial={{ opacity: 0, scale: 0.995 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.995 }}
              transition={{ duration: 0.15 }}
              className={`w-full max-w-2xl border rounded-2xl p-6 lg:p-8 shadow-md min-h-[450px] flex flex-col justify-between ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
              }`}
              id="pdf-page-card"
            >
              <div>
                {/* Document/Page Marker */}
                <div className="flex items-center justify-between border-b pb-3 mb-6 text-[9px] font-mono tracking-wider text-slate-500 border-slate-800/10">
                  <span className="truncate pr-4">INDEX: {documentRecord.name}</span>
                  <span className="flex-shrink-0">PAGE {activePage} OF {totalPages}</span>
                </div>

                {/* Page Extracted Text */}
                {pageContent ? (
                  <p className={`leading-relaxed text-xs sm:text-sm font-sans whitespace-pre-wrap text-justify ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    {highlightText(pageContent, searchTerm)}
                  </p>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-600 py-12">
                    <FileText className="h-10 w-10 mb-2 stroke-[1.5]" />
                    <p className="text-xs">Page {activePage} has no indexed context.</p>
                  </div>
                )}
              </div>

              {/* Decorative footnote */}
              <div className="border-t border-slate-800/10 mt-8 pt-3 text-[9px] font-mono text-center text-slate-500">
                AetherDocs Security Grounding Protocol • High-Fidelity Chunk Parsing
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer page selector */}
      {documentRecord && !loading && (
        <div className={`p-3 border-t flex items-center justify-center space-x-6 ${
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`} id="pdf-viewer-footer">
          <button
            id="pdf-prev-page-btn"
            onClick={handlePrevPage}
            disabled={activePage <= 1}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              isDark 
                ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white' 
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 shadow-sm'
            }`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="text-xs font-mono text-slate-500">
            Page <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{activePage}</span> of <span className="font-bold">{totalPages}</span>
          </span>

          <button
            id="pdf-next-page-btn"
            onClick={handleNextPage}
            disabled={activePage >= totalPages}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              isDark 
                ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white' 
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 shadow-sm'
            }`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
