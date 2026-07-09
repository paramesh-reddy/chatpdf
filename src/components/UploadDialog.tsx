/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UploadCloud, File, AlertTriangle, CheckCircle, Loader2, X } from 'lucide-react';
import ApiService from '../api.ts';
import { DocumentRecord } from '../types.ts';

interface UploadDialogProps {
  onClose: () => void;
  onUploadSuccess: (doc: DocumentRecord) => void;
}

type Stage = 'idle' | 'reading' | 'extracting' | 'chunking' | 'vectorizing' | 'saving' | 'success' | 'error';

export default function UploadDialog({ onClose, onUploadSuccess }: UploadDialogProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const [progressText, setProgressText] = useState('');
  const [errorText, setErrorText] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setStage('error');
      setErrorText('Only PDF documents are supported. Please choose a valid .pdf file.');
      return;
    }

    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      setStage('error');
      setErrorText('File size exceeds the 10MB limit. Please upload a smaller PDF.');
      return;
    }

    try {
      // Step 1: Read File Locally
      setStage('reading');
      setProgressText('Reading PDF data locally...');
      
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.substring(result.indexOf(',') + 1);
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed to read document on your device.'));
        reader.readAsDataURL(file);
      });

      const base64Data = await base64Promise;

      // Step 2: Upload and Trigger Server Extraction
      setStage('extracting');
      setProgressText('Parsing PDF and extracting text page-by-page...');

      // Note: The uploadDocument endpoint does the extraction, chunking, embedding, and storage on the server!
      // To give a smooth UI feeling, we will simulate realistic micro-progressions for chunking and embedding,
      // which is perfect since the server returns the final compiled docRecord.
      
      const uploadPromise = ApiService.uploadDocument(file.name, file.size, base64Data);

      // Trigger stage progressions over the network transit duration
      const chunkingTimeout = setTimeout(() => {
        setStage('chunking');
        setProgressText('Splitting page text into recursive overlapping chunks...');
      }, 1500);

      const vectorizingTimeout = setTimeout(() => {
        setStage('vectorizing');
        setProgressText('Requesting Gemini Embedding API to generate vectors...');
      }, 3500);

      const savingTimeout = setTimeout(() => {
        setStage('saving');
        setProgressText('Storing vectors and metadata in persistent index...');
      }, 6500);

      const docRecord = await uploadPromise;

      // Clean timeouts
      clearTimeout(chunkingTimeout);
      clearTimeout(vectorizingTimeout);
      clearTimeout(savingTimeout);

      setStage('success');
      setProgressText('Document processed and vectorized successfully!');
      
      setTimeout(() => {
        onUploadSuccess(docRecord);
        onClose();
      }, 1500);

    } catch (err) {
      setStage('error');
      setErrorText(err instanceof Error ? err.message : 'An error occurred during PDF upload/vectorization.');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" id="upload-dialog-overlay">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-slate-800 rounded-2xl border border-slate-700/60 shadow-2xl p-6 relative overflow-hidden"
        id="upload-dialog-box"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          id="upload-close-btn"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-xl font-bold text-white mb-1">Vectorize PDF Document</h3>
        <p className="text-slate-400 text-sm mb-6">
          Upload any PDF. It is split recursively into chunks and embedded using Gemini Embeddings.
        </p>

        <AnimatePresence mode="wait">
          {stage === 'idle' && (
            <motion.div
              key="idle-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
                dragActive
                  ? 'border-cyan-400 bg-cyan-500/5'
                  : 'border-slate-600 hover:border-slate-500 bg-slate-900/50 hover:bg-slate-900/70'
              }`}
              id="upload-dropzone"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                id="upload-file-input"
              />
              <UploadCloud className={`h-12 w-12 mb-4 transition-colors duration-200 ${dragActive ? 'text-cyan-400' : 'text-slate-500'}`} />
              <p className="font-semibold text-slate-200 text-base mb-1">
                Drag and drop your PDF here
              </p>
              <p className="text-slate-400 text-sm mb-4">
                or click to search files
              </p>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                PDF up to 10MB
              </span>
            </motion.div>
          )}

          {stage !== 'idle' && stage !== 'error' && stage !== 'success' && (
            <motion.div
              key="loading-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-12 flex flex-col items-center text-center"
              id="upload-loading-view"
            >
              <div className="relative mb-6">
                <Loader2 className="h-14 w-14 text-cyan-400 animate-spin" />
                <File className="h-6 w-6 text-white absolute top-4 left-4" />
              </div>
              <h4 className="text-white font-semibold text-lg mb-2">Processing Document</h4>
              <p className="text-cyan-400 font-mono text-sm max-w-sm h-12 flex items-center justify-center">
                {progressText}
              </p>

              {/* Progress Stepper Display */}
              <div className="w-full max-w-xs mt-6 space-y-2 text-left">
                <div className="flex items-center space-x-2 text-xs">
                  <div className={`h-2 w-2 rounded-full ${stage === 'reading' ? 'bg-cyan-400' : 'bg-cyan-500'}`} />
                  <span className={stage === 'reading' ? 'text-white' : 'text-slate-500'}>Reading PDF locally</span>
                </div>
                <div className="flex items-center space-x-2 text-xs">
                  <div className={`h-2 w-2 rounded-full ${stage === 'extracting' ? 'bg-cyan-400 animate-pulse' : ['reading'].includes(stage) ? 'bg-slate-700' : 'bg-cyan-500'}`} />
                  <span className={stage === 'extracting' ? 'text-white' : ['reading'].includes(stage) ? 'text-slate-500' : 'text-slate-300'}>Extracting page text</span>
                </div>
                <div className="flex items-center space-x-2 text-xs">
                  <div className={`h-2 w-2 rounded-full ${stage === 'chunking' ? 'bg-cyan-400 animate-pulse' : ['reading', 'extracting'].includes(stage) ? 'bg-slate-700' : 'bg-cyan-500'}`} />
                  <span className={stage === 'chunking' ? 'text-white' : ['reading', 'extracting'].includes(stage) ? 'text-slate-500' : 'text-slate-300'}>Recursive overlapping splits</span>
                </div>
                <div className="flex items-center space-x-2 text-xs">
                  <div className={`h-2 w-2 rounded-full ${stage === 'vectorizing' ? 'bg-cyan-400 animate-pulse' : ['reading', 'extracting', 'chunking'].includes(stage) ? 'bg-slate-700' : 'bg-cyan-500'}`} />
                  <span className={stage === 'vectorizing' ? 'text-white' : ['reading', 'extracting', 'chunking'].includes(stage) ? 'text-slate-500' : 'text-slate-300'}>Google Gemini Embeddings</span>
                </div>
                <div className="flex items-center space-x-2 text-xs">
                  <div className={`h-2 w-2 rounded-full ${stage === 'saving' ? 'bg-cyan-400 animate-pulse' : ['reading', 'extracting', 'chunking', 'vectorizing'].includes(stage) ? 'bg-slate-700' : 'bg-cyan-500'}`} />
                  <span className={stage === 'saving' ? 'text-white' : ['reading', 'extracting', 'chunking', 'vectorizing'].includes(stage) ? 'text-slate-500' : 'text-slate-300'}>Indexing vector indices</span>
                </div>
              </div>
            </motion.div>
          )}

          {stage === 'success' && (
            <motion.div
              key="success-view"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="py-10 flex flex-col items-center text-center"
              id="upload-success-view"
            >
              <CheckCircle className="h-16 w-16 text-emerald-400 mb-4" />
              <h4 className="text-white font-semibold text-xl mb-2">Vectorization Complete</h4>
              <p className="text-slate-400 text-sm">{progressText}</p>
            </motion.div>
          )}

          {stage === 'error' && (
            <motion.div
              key="error-view"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="py-6 flex flex-col items-center text-center"
              id="upload-error-view"
            >
              <AlertTriangle className="h-14 w-14 text-red-400 mb-4 animate-bounce" />
              <h4 className="text-white font-semibold text-lg mb-2">Processing Failed</h4>
              <p className="text-red-400 text-sm max-w-sm mb-6">{errorText}</p>
              <button
                id="upload-retry-btn"
                onClick={() => setStage('idle')}
                className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-slate-700 hover:bg-slate-600 cursor-pointer transition-colors"
              >
                Choose Another File
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
