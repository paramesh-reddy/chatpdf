/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { UploadCloud, AlertTriangle, Loader2, X } from 'lucide-react';
import ApiService from '../api.ts';
import { DocumentRecord } from '../types.ts';

interface UploadDialogProps {
  onClose: () => void;
  onUploadSuccess: (doc: DocumentRecord) => void;
}

export default function UploadDialog({ onClose, onUploadSuccess }: UploadDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    if (file.type !== 'application/pdf') { setError('Only PDF files are supported.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Maximum file size is 10MB.'); return; }

    setUploading(true);
    setError('');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      const doc = await ApiService.uploadDocument(file.name, file.size, base64);
      onUploadSuccess(doc);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm dark:bg-black/70">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 relative dark:bg-slate-900 dark:border-slate-800"
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800">
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-lg font-semibold text-slate-900 mb-1 dark:text-white">Upload PDF</h3>
        <p className="text-sm text-slate-500 mb-6">Your document will be indexed for AI-powered chat</p>

        {uploading ? (
          <div className="py-14 text-center">
            <Loader2 className="h-8 w-8 text-cyan-500 animate-spin mx-auto mb-3 dark:text-cyan-400" />
            <p className="text-sm text-slate-600 dark:text-slate-400">Indexing document...</p>
            <p className="text-xs text-slate-600 mt-1">Extracting text and generating embeddings</p>
          </div>
        ) : error ? (
          <div className="py-10 text-center">
            <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-400 mb-4">{error}</p>
            <button onClick={() => setError('')} className="text-sm text-cyan-600 hover:text-cyan-500 dark:text-cyan-400 dark:hover:text-cyan-300">Try again</button>
          </div>
        ) : (
          <div
            onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
              dragActive ? 'border-cyan-500 bg-cyan-500/5' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800/30'
            }`}
          >
            <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
            <UploadCloud className={`h-10 w-10 mx-auto mb-3 ${dragActive ? 'text-cyan-500' : 'text-slate-400 dark:text-slate-600'}`} />
            <p className="text-sm text-slate-700 font-medium dark:text-slate-300">Drop your PDF here or click to browse</p>
            <p className="text-xs text-slate-600 mt-1">PDF only · Max 10MB</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
