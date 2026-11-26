/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { FileText, MessageSquare, Check, AlertCircle } from 'lucide-react';

import ApiService from './api.ts';
import { DocumentRecord, ChatSession } from './types.ts';
import AuthPage from './components/AuthPage.tsx';
import Navbar from './components/Navbar.tsx';
import Sidebar from './components/Sidebar.tsx';
import Dashboard from './components/Dashboard.tsx';
import PdfViewer from './components/PdfViewer.tsx';
import ChatWindow from './components/ChatWindow.tsx';
import UploadDialog from './components/UploadDialog.tsx';

type AppView = 'dashboard' | 'workspace';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(ApiService.isAuthenticated());
  const [view, setView] = useState<AppView>('dashboard');
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [workspaceTab, setWorkspaceTab] = useState<'pdf' | 'chat'>('chat');

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  };

  useEffect(() => {
    ApiService.onUnauthorized = () => {
      setIsAuthenticated(false);
      setView('dashboard');
      setSelectedDoc(null);
      setSelectedSession(null);
      setDocuments([]);
    };
    return () => { ApiService.onUnauthorized = null; };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadDocuments();
      ApiService.getProfile()
        .then((profile) => {
          if (profile.user.displayName) {
            ApiService.setDisplayName(profile.user.displayName);
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated]);

  const loadDocuments = async () => {
    setLoadingDocs(true);
    try {
      const data = await ApiService.listDocuments();
      setDocuments(data.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()));
    } catch {
      showToast('Failed to load documents', 'error');
    } finally {
      setLoadingDocs(false);
    }
  };

  const goDashboard = () => {
    setView('dashboard');
    setSelectedSession(null);
  };

  const openDocument = (doc: DocumentRecord) => {
    setSelectedDoc(doc);
    setActivePage(1);
    setSelectedSession(null);
    setView('workspace');
    setWorkspaceTab('chat');
  };

  const handleUploadSuccess = (newDoc: DocumentRecord) => {
    setDocuments((prev) => [newDoc, ...prev]);
    openDocument(newDoc);
    showToast('Document uploaded and indexed', 'success');
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      await ApiService.deleteDocument(docId);
      const remaining = documents.filter((d) => d.id !== docId);
      setDocuments(remaining);
      if (selectedDoc?.id === docId) {
        setSelectedDoc(null);
        setSelectedSession(null);
        setView('dashboard');
      }
      showToast('Document removed', 'info');
    } catch {
      showToast('Delete failed', 'error');
    }
  };

  const handleSignOut = () => {
    ApiService.clearTokens();
    setIsAuthenticated(false);
    setView('dashboard');
    setSelectedDoc(null);
    setSelectedSession(null);
    setDocuments([]);
  };

  if (!isAuthenticated) {
    return <AuthPage onAuthSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden dark:bg-slate-950 dark:text-slate-100">
      <Navbar
        view={view}
        selectedDoc={selectedDoc}
        onGoDashboard={goDashboard}
        onUpload={() => setIsUploadOpen(true)}
        onSignOut={handleSignOut}
      />

      <div className="flex flex-1 min-h-0">
        <Sidebar
          view={view}
          documents={documents}
          selectedDoc={selectedDoc}
          selectedSession={selectedSession}
          loading={loadingDocs}
          onGoDashboard={goDashboard}
          onSelectDoc={openDocument}
          onSelectSession={setSelectedSession}
          onDeleteDoc={handleDeleteDoc}
        />

        <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950">
          {view === 'dashboard' ? (
            <Dashboard
              documents={documents}
              loading={loadingDocs}
              onSelectDoc={openDocument}
              onUpload={() => setIsUploadOpen(true)}
            />
          ) : selectedDoc ? (
            <>
              {/* Workspace toolbar — full width tabs */}
              <div className="flex items-center justify-between px-4 lg:px-6 py-2 border-b border-slate-200 bg-white/80 dark:border-slate-800/60 dark:bg-slate-900/30">
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 border border-slate-200 w-full max-w-md dark:bg-slate-900 dark:border-slate-800">
                  <button
                    onClick={() => setWorkspaceTab('pdf')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                      workspaceTab === 'pdf'
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Document
                  </button>
                  <button
                    onClick={() => setWorkspaceTab('chat')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                      workspaceTab === 'chat'
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    AI Chat
                  </button>
                </div>
                <p className="text-xs text-slate-500 hidden sm:block flex-shrink-0 ml-4">
                  {selectedDoc.pageCount} pages · {(selectedDoc.size / 1024).toFixed(0)} KB
                </p>
              </div>

              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 min-h-0 p-3 lg:p-4 lg:gap-4">
                <div className={`${workspaceTab === 'pdf' ? 'block' : 'hidden lg:block'} h-full min-h-0`}>
                  <PdfViewer
                    documentRecord={selectedDoc}
                    activePage={activePage}
                    onPageChange={setActivePage}
                  />
                </div>
                <div className={`${workspaceTab === 'chat' ? 'block' : 'hidden lg:block'} h-full min-h-0`}>
                  <ChatWindow
                    documentRecord={selectedDoc}
                    activeSession={selectedSession}
                    onSessionCreated={setSelectedSession}
                    onPageSelect={(page) => { setActivePage(page); setWorkspaceTab('pdf'); }}
                    showToast={showToast}
                  />
                </div>
              </div>
            </>
          ) : (
            <Dashboard
              documents={documents}
              loading={loadingDocs}
              onSelectDoc={openDocument}
              onUpload={() => setIsUploadOpen(true)}
            />
          )}
        </main>
      </div>

      <AnimatePresence>
        {isUploadOpen && (
          <UploadDialog
            onClose={() => setIsUploadOpen(false)}
            onUploadSuccess={handleUploadSuccess}
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-5 right-5 z-50 space-y-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-xl backdrop-blur-md pointer-events-auto border ${
                toast.type === 'success'
                  ? 'bg-emerald-50/95 text-emerald-700 border-emerald-200 dark:bg-emerald-950/90 dark:text-emerald-300 dark:border-emerald-800/50'
                  : toast.type === 'error'
                    ? 'bg-red-50/95 text-red-700 border-red-200 dark:bg-red-950/90 dark:text-red-300 dark:border-red-800/50'
                    : 'bg-white/95 text-slate-700 border-slate-200 dark:bg-slate-900/90 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              {toast.type === 'success' ? <Check className="h-4 w-4" /> :
               toast.type === 'error' ? <AlertCircle className="h-4 w-4" /> : null}
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
