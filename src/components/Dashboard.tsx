/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileText, UploadCloud, Search, Clock, Layers, HardDrive,
  MessageSquare, ChevronRight, Plus, Sparkles,
} from 'lucide-react';
import { getProfileDisplayName } from '../utils/profile.ts';
import { DocumentRecord } from '../types.ts';

interface DashboardProps {
  documents: DocumentRecord[];
  loading: boolean;
  onSelectDoc: (doc: DocumentRecord) => void;
  onUpload: () => void;
}

export default function Dashboard({
  documents,
  loading,
  onSelectDoc,
  onUpload,
}: DashboardProps) {
  const [search, setSearch] = useState('');
  const displayName = getProfileDisplayName();

  const filtered = documents.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = documents.reduce((s, d) => s + d.pageCount, 0);
  const totalSize = documents.reduce((s, d) => s + d.size, 0);
  const sizeMB = (totalSize / 1024 / 1024).toFixed(1);

  const stats = [
    { label: 'Documents', value: documents.length, icon: FileText, accent: 'from-cyan-500/15 to-cyan-600/5 border-cyan-200 dark:from-cyan-500/20 dark:to-cyan-600/5 dark:border-cyan-500/20', iconColor: 'text-cyan-600 dark:text-cyan-400' },
    { label: 'Pages Indexed', value: totalPages, icon: Layers, accent: 'from-blue-500/15 to-blue-600/5 border-blue-200 dark:from-blue-500/20 dark:to-blue-600/5 dark:border-blue-500/20', iconColor: 'text-blue-600 dark:text-blue-400' },
    { label: 'Storage', value: `${sizeMB} MB`, icon: HardDrive, accent: 'from-emerald-500/15 to-emerald-600/5 border-emerald-200 dark:from-emerald-500/20 dark:to-emerald-600/5 dark:border-emerald-500/20', iconColor: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'AI Engine', value: 'GPT-4o', icon: MessageSquare, accent: 'from-amber-500/15 to-amber-600/5 border-amber-200 dark:from-amber-500/20 dark:to-amber-600/5 dark:border-amber-500/20', iconColor: 'text-amber-600 dark:text-amber-400' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 w-full dark:bg-slate-950">
      <div className="relative w-full border-b border-slate-200 bg-gradient-to-r from-white via-slate-50 to-cyan-50 px-6 lg:px-10 py-8 lg:py-10 dark:border-slate-800/80 dark:from-slate-900 dark:via-slate-950 dark:to-cyan-950/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none dark:bg-cyan-600/5" />
        <div className="relative w-full flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <span className="text-xs font-semibold text-cyan-600 uppercase tracking-wider dark:text-cyan-400">
                Welcome back, {displayName}
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-slate-900 leading-tight dark:text-white">
              DocuMind AI Workspace
            </h1>
            <p className="text-slate-600 text-sm mt-3 max-w-3xl leading-relaxed dark:text-slate-400">
              Upload documents, ask questions, and receive AI-powered answers with precise page citations,
              semantic search, and enterprise-grade document intelligence.
            </p>
          </div>
          <button
            onClick={onUpload}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition-all shadow-lg shadow-cyan-600/20 hover:shadow-cyan-500/30 flex-shrink-0"
          >
            <UploadCloud className="h-4 w-4" />
            Upload PDF
          </button>
        </div>
      </div>

      <div className="w-full p-6 lg:p-8 space-y-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`p-5 rounded-2xl border bg-gradient-to-br ${stat.accent} bg-white transition-all hover:scale-[1.01] dark:bg-transparent`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{stat.label}</span>
                <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your Documents</h2>
              <p className="text-xs text-slate-500 mt-0.5">Click a document to open and chat</p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="h-4 w-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500/50 dark:bg-slate-900 dark:border-slate-800 dark:text-white dark:placeholder-slate-500"
              />
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-40 rounded-2xl border border-slate-200 bg-slate-100 animate-pulse dark:border-slate-800 dark:bg-slate-900/40" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center w-full dark:border-slate-800 dark:bg-slate-900/30">
              <div className="h-16 w-16 mx-auto mb-5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <FileText className="h-8 w-8 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2 dark:text-white">
                {documents.length === 0 ? 'No documents yet' : 'No results'}
              </h3>
              <p className="text-sm text-slate-500 mb-8 max-w-md mx-auto">
                {documents.length === 0
                  ? 'Upload your first PDF to start using DocuMind AI.'
                  : 'Try a different search term.'}
              </p>
              {documents.length === 0 && (
                <button
                  onClick={onUpload}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold"
                >
                  <Plus className="h-4 w-4" />
                  Upload your first PDF
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
              {filtered.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => onSelectDoc(doc)}
                  className="group text-left p-5 rounded-2xl border border-slate-200 bg-white hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/5 transition-all duration-200 dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-11 w-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                      <FileText className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div className="flex items-center gap-1 text-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity dark:text-cyan-400">
                      <span className="text-[10px] font-medium">Open</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 truncate group-hover:text-cyan-600 transition-colors mb-2 dark:text-white dark:group-hover:text-cyan-300">
                    {doc.name}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{doc.pageCount} page{doc.pageCount !== 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span>{(doc.size / 1024).toFixed(0)} KB</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400 dark:border-slate-800 dark:text-slate-600">
                    <Clock className="h-3 w-3" />
                    Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                  </div>
                </button>
              ))}

              <button
                onClick={onUpload}
                className="p-5 rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all flex flex-col items-center justify-center min-h-[168px] gap-3 text-slate-400 hover:text-cyan-600 dark:border-slate-800 dark:bg-transparent dark:text-slate-500 dark:hover:text-cyan-400"
              >
                <div className="h-11 w-11 rounded-xl border border-slate-300 flex items-center justify-center dark:border-slate-700">
                  <Plus className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium">Add new document</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
