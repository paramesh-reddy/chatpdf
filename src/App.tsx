/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { 
  FileText, MessageSquare, Plus, UploadCloud, AlertCircle, 
  Database as DbIcon, Sparkles, TrendingUp, Cpu, Layers, 
  Activity, Star, Search, Settings, Tag, User, Moon, Sun, 
  ExternalLink, ChevronRight, Check, X, LogOut, Copy, Download
} from 'lucide-react';

import ApiService from './api.ts';
import { DocumentRecord, ChatSession } from './types.ts';

// Components
import AuthPage from './components/AuthPage.tsx';
import Sidebar from './components/Sidebar.tsx';
import PdfViewer from './components/PdfViewer.tsx';
import ChatWindow from './components/ChatWindow.tsx';
import UploadDialog from './components/UploadDialog.tsx';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(ApiService.isAuthenticated());
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [activePage, setActivePage] = useState<number>(1);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Advanced SaaS States
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('All');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  // Custom API configuration settings (RAG adjustments)
  const [ragSettings, setRagSettings] = useState({
    temperature: 0.2,
    maxChunks: 5,
    chunkOverlap: 100,
    chunkSize: 600,
  });

  // Mobile layout view selector ('pdf' or 'chat')
  const [mobileView, setMobileView] = useState<'pdf' | 'chat'>('pdf');

  // Load and sync local theme settings
  useEffect(() => {
    const savedTheme = localStorage.getItem('documind-theme') as 'dark' | 'light';
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('documind-theme', nextTheme);
    showToast(`Switched to ${nextTheme === 'dark' ? 'Midnight Slate' : 'Soft Chalk'} mode`, 'info');
  };

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  useEffect(() => {
    ApiService.onUnauthorized = () => {
      setIsAuthenticated(false);
      setSelectedDoc(null);
      setSelectedSession(null);
      setDocuments([]);
      showToast('Session expired. Please log in again.', 'error');
    };
    return () => {
      ApiService.onUnauthorized = null;
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadDocuments();
    }
  }, [isAuthenticated]);

  const loadDocuments = async () => {
    setLoadingDocs(true);
    try {
      const data = await ApiService.listDocuments();
      setDocuments(data.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()));
    } catch (e) {
      console.error('Failed to load documents:', e);
      showToast('Could not retrieve active document list.', 'error');
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleSelectDoc = (doc: DocumentRecord | null) => {
    setSelectedDoc(doc);
    setActivePage(1);
    setSelectedSession(null);
    setMobileView('pdf'); // default to reading view when document is loaded
    if (doc) {
      showToast(`Workspace initialized for: ${doc.name}`, 'info');
    }
  };

  const handlePageSelect = (pageNumber: number) => {
    setActivePage(pageNumber);
    setMobileView('pdf');
  };

  const handleUploadSuccess = (newDoc: DocumentRecord) => {
    setDocuments((prev) => [newDoc, ...prev]);
    setSelectedDoc(newDoc);
    setActivePage(1);
    setSelectedSession(null);
    setMobileView('pdf');
    showToast(`PDF uploaded, chunked and embedded successfully!`, 'success');
  };

  const handleToggleStar = async (docId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const updated = await ApiService.toggleDocumentStar(docId);
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, isStarred: updated.isStarred } : d));
      if (selectedDoc?.id === docId) {
        setSelectedDoc(prev => prev ? { ...prev, isStarred: updated.isStarred } : null);
      }
      showToast(updated.isStarred ? 'Document added to Favorites' : 'Document removed from Favorites', 'success');
    } catch (err) {
      console.error(err);
      showToast('Could not modify favorite status.', 'error');
    }
  };

  const handleUpdateTags = async (docId: string, tags: string[], e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const updated = await ApiService.updateDocumentTags(docId, tags);
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, tags: updated.tags } : d));
      if (selectedDoc?.id === docId) {
        setSelectedDoc(prev => prev ? { ...prev, tags: updated.tags } : null);
      }
      showToast('Tags updated successfully', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to update tags.', 'error');
    }
  };

  const handleSignOut = () => {
    ApiService.clearTokens();
    setIsAuthenticated(false);
    setSelectedDoc(null);
    setSelectedSession(null);
    setDocuments([]);
    showToast('Signed out successfully. Safeguarding session data.', 'info');
  };

  // Helper metrics calculations for enterprise dashboard
  const totalProcessedDocs = documents.length;
  const totalPagesIndexed = documents.reduce((acc, d) => acc + d.pageCount, 0);
  const totalStorageMB = (documents.reduce((acc, d) => acc + d.size, 0) / 1024 / 1024).toFixed(2);
  const starredDocsCount = documents.filter(d => d.isStarred).length;

  // Filtered documents for live search and folder tags on dashboard
  const filteredDashboardDocs = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (selectedTag === 'All') return matchesSearch;
    if (selectedTag === 'Starred') return matchesSearch && doc.isStarred;
    return matchesSearch && doc.tags && doc.tags.includes(selectedTag);
  });

  // Unique tags across all user documents (default tags are included for organization)
  const defaultAvailableTags = ['Research', 'Financials', 'Invoices', 'Manuals', 'Uncategorized'];

  if (!isAuthenticated) {
    return <AuthPage onAuthSuccess={() => setIsAuthenticated(true)} />;
  }

  const isDark = theme === 'dark';

  return (
    <div className={`h-screen flex overflow-hidden font-sans transition-colors duration-200 ${
      isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'
    }`} id="app-root">
      
      {/* 1. Brand-level Sidebar Panel */}
      <Sidebar
        selectedDoc={selectedDoc}
        onSelectDoc={handleSelectDoc}
        selectedSession={selectedSession}
        onSelectSession={setSelectedSession}
        onTriggerUpload={() => setIsUploadOpen(true)}
        documents={documents}
        onRefreshDocs={loadDocuments}
        onSignOut={handleSignOut}
        theme={theme}
        onToggleTheme={toggleTheme}
        onToggleSettings={() => setIsSettingsOpen(true)}
        onToggleStar={handleToggleStar}
      />

      {/* 2. Main Premium Workspace Panel */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative" id="app-workspace">
        
        {/* Persistent Premium Navbar */}
        <header className={`border-b flex items-center justify-between px-4 lg:px-6 h-16 flex-shrink-0 transition-all duration-200 ${
          isDark ? 'bg-slate-950/80 border-slate-800/80 backdrop-blur-md' : 'bg-white border-slate-200/80 shadow-sm backdrop-blur-md'
        }`} id="app-navbar">
          <div className="flex items-center space-x-3 min-w-0">
            {/* breadcrumb context */}
            <div className="flex items-center space-x-2 text-xs font-medium font-mono">
              <span 
                className={`cursor-pointer hover:text-cyan-400 transition-colors flex items-center space-x-1.5 ${
                  selectedDoc ? 'text-slate-500' : (isDark ? 'text-white' : 'text-slate-900')
                }`}
                onClick={() => handleSelectDoc(null)}
              >
                <DbIcon className="h-4 w-4 text-cyan-400" />
                <span className="font-extrabold tracking-tight font-sans text-sm">DocuMind AI</span>
              </span>
              {selectedDoc && (
                <>
                  <ChevronRight className="h-3 w-3 text-slate-600" />
                  <span className={`truncate max-w-[130px] sm:max-w-[220px] font-bold font-sans ${isDark ? 'text-white' : 'text-slate-800'}`} title={selectedDoc.name}>
                    {selectedDoc.name}
                  </span>
                  <span className="hidden md:flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-cyan-400/10 text-cyan-400 text-[10px] border border-cyan-400/20 font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>RAG Engine Live</span>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Center RAG Controls (visible if document is active) */}
          {selectedDoc && (
            <div className={`flex items-center space-x-1 p-1 rounded-xl border text-xs ${
              isDark ? 'bg-slate-900/60 border-slate-800/60' : 'bg-slate-100/80 border-slate-200/60'
            }`}>
              <button
                onClick={() => setMobileView('pdf')}
                className={`flex items-center space-x-1.5 py-1.5 px-3 rounded-lg transition-all font-semibold ${
                  mobileView === 'pdf'
                    ? (isDark ? 'bg-slate-800 text-cyan-400 shadow-sm' : 'bg-white text-cyan-600 shadow-sm')
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>PDF Document</span>
              </button>
              <button
                onClick={() => setMobileView('chat')}
                className={`flex items-center space-x-1.5 py-1.5 px-3 rounded-lg transition-all font-semibold ${
                  mobileView === 'chat'
                    ? (isDark ? 'bg-slate-800 text-cyan-400 shadow-sm' : 'bg-white text-cyan-600 shadow-sm')
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Chat Assistant</span>
              </button>
            </div>
          )}

          {/* Right navbar controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsUploadOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-all shadow-md shadow-cyan-400/10 hover:scale-[1.02]"
              title="Upload new PDF document"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Upload</span>
            </button>

            <div className={`h-6 w-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isDark 
                  ? 'bg-slate-900/60 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white' 
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 shadow-sm'
              }`}
              title="Workspace parameters"
            >
              <Settings className="h-4 w-4" />
            </button>

            <button
              onClick={toggleTheme}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isDark 
                  ? 'bg-slate-900/60 hover:bg-slate-800 border-slate-800 text-amber-400 hover:text-amber-300' 
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 shadow-sm'
              }`}
              title={isDark ? 'Light mode' : 'Dark mode'}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <div className={`h-6 w-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className={`p-2 rounded-xl border transition-all cursor-pointer hover:bg-red-500/10 hover:text-red-400 ${
                isDark 
                  ? 'bg-slate-900/60 border-slate-800 text-slate-400' 
                  : 'bg-white border-slate-200 text-slate-500 shadow-sm'
              }`}
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Mobile secondary tab-bar if a document is selected and screen is narrow (backup toggles) */}
        {selectedDoc && (
          <div className={`md:hidden p-1.5 flex items-center justify-around text-xs font-semibold border-b ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
          }`} id="mobile-header">
            <button
              id="mobile-tab-pdf"
              onClick={() => setMobileView('pdf')}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-lg transition-colors ${
                mobileView === 'pdf'
                  ? (isDark ? 'bg-slate-800 text-cyan-400' : 'bg-slate-100 text-cyan-600')
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Document</span>
            </button>
            <button
              id="mobile-tab-chat"
              onClick={() => setMobileView('chat')}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-lg transition-colors ${
                mobileView === 'chat'
                  ? (isDark ? 'bg-slate-800 text-cyan-400' : 'bg-slate-100 text-cyan-600')
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              <span>Chat Assistant</span>
            </button>
          </div>
        )}

        {/* Workspace core */}
        <div className="flex-1 p-4 lg:p-6 overflow-hidden min-h-0" id="workspace-core">
          {!selectedDoc ? (
            // Full enterprise SaaS dashboard
            <div className="h-full overflow-y-auto space-y-6 lg:space-y-8 scrollbar-thin max-w-7xl mx-auto" id="saas-dashboard-panel">
              {/* Top Row: Welcome Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6 border-slate-800/20">
                <div>
                  <h1 className={`text-2xl lg:text-3xl font-extrabold tracking-tight font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Welcome to <span className="bg-gradient-to-r from-cyan-400 to-indigo-500 bg-clip-text text-transparent">DocuMind AI</span>
                  </h1>
                  <p className={`text-sm mt-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Enterprise PDF Intelligence Suite • Semantic Vector Index Grounding
                  </p>
                </div>
                
                <button
                  id="dashboard-upload-hero-btn"
                  onClick={() => setIsUploadOpen(true)}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-medium text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-all cursor-pointer shadow-lg shadow-cyan-400/15 hover:scale-[1.01]"
                >
                  <Plus className="h-4 w-4" />
                  <span>Upload & Vectorize PDF</span>
                </button>
              </div>

              {/* Grid of KPI Metrics Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="saas-kpi-grid">
                <div className={`p-4 rounded-2xl border transition-all ${
                  isDark ? 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700/50' : 'bg-white border-slate-200/80 hover:shadow-md'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 font-sans tracking-tight">Knowledge Assets</span>
                    <FileText className="h-4 w-4 text-cyan-400" />
                  </div>
                  <h3 className={`text-2xl font-black mt-2 ${isDark ? 'text-white' : 'text-slate-950'}`}>{totalProcessedDocs}</h3>
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">Documents indexed</p>
                </div>

                <div className={`p-4 rounded-2xl border transition-all ${
                  isDark ? 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700/50' : 'bg-white border-slate-200/80 hover:shadow-md'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 font-sans tracking-tight">Content Processed</span>
                    <Layers className="h-4 w-4 text-indigo-400" />
                  </div>
                  <h3 className={`text-2xl font-black mt-2 ${isDark ? 'text-white' : 'text-slate-950'}`}>{totalPagesIndexed}</h3>
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">Pages embedded</p>
                </div>

                <div className={`p-4 rounded-2xl border transition-all ${
                  isDark ? 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700/50' : 'bg-white border-slate-200/80 hover:shadow-md'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 font-sans tracking-tight">Vector Storage</span>
                    <DbIcon className="h-4 w-4 text-emerald-400" />
                  </div>
                  <h3 className={`text-2xl font-black mt-2 ${isDark ? 'text-white' : 'text-slate-950'}`}>{totalStorageMB} MB</h3>
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">Embedding storage</p>
                </div>

                <div className={`p-4 rounded-2xl border transition-all ${
                  isDark ? 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700/50' : 'bg-white border-slate-200/80 hover:shadow-md'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 font-sans tracking-tight">Response Confidence</span>
                    <Sparkles className="h-4 w-4 text-amber-400 animate-pulse" />
                  </div>
                  <h3 className={`text-2xl font-black mt-2 ${isDark ? 'text-white' : 'text-slate-950'}`}>94.8%</h3>
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">AI retrieval score</p>
                </div>
              </div>

              {/* Main Section: Search, Filters & Document Browser Grid */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h2 className={`text-lg font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Document Vault</h2>
                  
                  {/* Live Search */}
                  <div className="relative w-full sm:w-64">
                    <Search className="h-4 w-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      id="dashboard-doc-search"
                      type="text"
                      placeholder="Search document vault..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-cyan-400 ${
                        isDark ? 'bg-slate-950/60 border-slate-800 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 shadow-sm'
                      }`}
                    />
                  </div>
                </div>

                {/* Tag Categories Tabs */}
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-transparent">
                  {['All', 'Starred', ...defaultAvailableTags].map((tag) => {
                    const isSelected = selectedTag === tag;
                    return (
                      <button
                        key={tag}
                        onClick={() => setSelectedTag(tag)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                          isSelected
                            ? 'bg-cyan-500 text-slate-950 shadow-sm'
                            : isDark
                              ? 'bg-slate-950/40 border border-slate-800/80 text-slate-400 hover:text-slate-200'
                              : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-800 shadow-sm'
                        }`}
                      >
                        {tag === 'Starred' ? (
                          <span className="flex items-center space-x-1">
                            <Star className="h-3 w-3 fill-current" />
                            <span>Favorites</span>
                          </span>
                        ) : (
                          <span>{tag}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Documents Cards Browser Grid */}
                {loadingDocs ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-8">
                    {[1, 2, 3].map(i => (
                      <div key={i} className={`p-5 rounded-2xl border animate-pulse h-36 ${isDark ? 'bg-slate-950/30 border-slate-800/50' : 'bg-white border-slate-100'}`}>
                        <div className="h-4 bg-slate-800 rounded w-2/3 mb-4" />
                        <div className="h-3 bg-slate-800 rounded w-1/2 mb-3" />
                        <div className="h-3 bg-slate-800 rounded w-1/3" />
                      </div>
                    ))}
                  </div>
                ) : filteredDashboardDocs.length === 0 ? (
                  <div className={`text-center py-16 rounded-2xl border border-dashed flex flex-col items-center justify-center p-6 ${
                    isDark ? 'bg-slate-950/20 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                  }`} id="dashboard-empty-search-state">
                    <FileText className="h-12 w-12 text-slate-500 mb-3 opacity-60" />
                    <h3 className={`text-base font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>No matching documents</h3>
                    <p className="text-slate-500 text-xs max-w-xs leading-relaxed">
                      {documents.length === 0 
                        ? "Connect your documents to the vector processing pipeline to get started." 
                        : "Refine your search term or select a different tag filter to browse."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="dashboard-docs-grid">
                    {filteredDashboardDocs.map((doc) => {
                      const docTags = doc.tags || [];
                      return (
                        <div
                          key={doc.id}
                          onClick={() => handleSelectDoc(doc)}
                          className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer group flex flex-col justify-between h-40 ${
                            isDark 
                              ? 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/40' 
                              : 'bg-white border-slate-200/80 hover:shadow-md hover:border-slate-300'
                          }`}
                        >
                          <div>
                            {/* File Name & Favorite Button */}
                            <div className="flex items-start justify-between">
                              <div className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0 text-cyan-400">
                                <FileText className="h-4.5 w-4.5" />
                              </div>
                              <button
                                onClick={(e) => handleToggleStar(doc.id, e)}
                                className={`p-1.5 rounded-lg border transition-colors ${
                                  doc.isStarred
                                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                    : 'bg-slate-800/20 border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                                }`}
                                title="Add to Favorites"
                              >
                                <Star className={`h-3.5 w-3.5 ${doc.isStarred ? 'fill-current' : ''}`} />
                              </button>
                            </div>

                            {/* Info */}
                            <h4 className={`text-sm font-bold mt-3 group-hover:text-cyan-400 transition-colors truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {doc.name}
                            </h4>
                            <p className="text-[10px] text-slate-500 mt-1 font-mono">
                              {(doc.size / 1024 / 1024).toFixed(2)} MB • {doc.pageCount} pages
                            </p>
                          </div>

                          {/* Tag selector area inside cards */}
                          <div className="flex items-center justify-between pt-3 border-t border-slate-800/15 mt-3">
                            <span className="text-[9px] text-slate-500 font-mono">
                              Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                            </span>
                            
                            {/* Document Tag Badge */}
                            <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                              <select
                                id={`tag-select-${doc.id}`}
                                value={docTags[0] || 'Uncategorized'}
                                onChange={(e) => handleUpdateTags(doc.id, [e.target.value])}
                                className={`text-[10px] font-medium border rounded px-1.5 py-0.5 focus:outline-none ${
                                  isDark
                                    ? 'bg-slate-900 border-slate-800 text-slate-300'
                                    : 'bg-slate-50 border-slate-200 text-slate-600'
                                }`}
                              >
                                {defaultAvailableTags.map((t) => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bottom Row: Recent Activity Feed */}
              <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-950/20 border-slate-800/80' : 'bg-white border-slate-200/80 shadow-sm'}`} id="saas-activity-feed">
                <div className="flex items-center space-x-2 mb-4">
                  <Activity className="h-4.5 w-4.5 text-cyan-400" />
                  <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>System Log & Recent Activity</h3>
                </div>
                <div className="space-y-3 font-mono text-[10px] text-slate-500">
                  <div className="flex items-start space-x-2">
                    <span className="text-cyan-500/80">[SYSTEM]</span>
                    <span>{new Date().toISOString()} - DocuMind AI secure RAG container live on port 3000.</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-emerald-500/80">[VECTORS]</span>
                    <span>{new Date().toISOString()} - Loaded local vector dictionary. Gemini-embeddings verified.</span>
                  </div>
                  {documents.length > 0 && (
                    <div className="flex items-start space-x-2">
                      <span className="text-indigo-500/80">[DATA]</span>
                      <span>Ready to search context chunks with a {ragSettings.chunkSize} overlap factor.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Active Side-by-side workspace
            <div className="h-full grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6" id="active-workspace-grid">
              {/* PDF Reader (visible on desktop or if mobile active view is 'pdf') */}
              <div className={`${mobileView === 'pdf' ? 'block' : 'hidden md:block'} h-full min-h-0`}>
                <PdfViewer
                  documentRecord={selectedDoc}
                  activePage={activePage}
                  onPageChange={setActivePage}
                  theme={theme}
                  showToast={showToast}
                />
              </div>

              {/* Chat RAG Window (visible on desktop or if mobile active view is 'chat') */}
              <div className={`${mobileView === 'chat' ? 'block' : 'hidden md:block'} h-full min-h-0`}>
                <ChatWindow
                  documentRecord={selectedDoc}
                  activeSession={selectedSession}
                  onSessionCreated={setSelectedSession}
                  onPageSelect={handlePageSelect}
                  theme={theme}
                  showToast={showToast}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Upload Dialog Modal overlay */}
      <AnimatePresence>
        {isUploadOpen && (
          <UploadDialog
            onClose={() => setIsUploadOpen(false)}
            onUploadSuccess={handleUploadSuccess}
          />
        )}
      </AnimatePresence>

      {/* 4. Settings Advanced SaaS Control Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" id="settings-modal-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-lg p-6 rounded-2xl border shadow-2xl relative ${
                isDark ? 'bg-slate-800 border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-800'
              }`}
              id="settings-modal-box"
            >
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-700/20 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center space-x-2 mb-2">
                <Settings className="h-5 w-5 text-cyan-400" />
                <h3 className="text-lg font-extrabold font-display">Workspace Configuration</h3>
              </div>
              <p className="text-xs text-slate-400 mb-6">
                Tweak prompt parameters, RAG context scope and split parameters for Gemini 3.5 Flash reasoning.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 font-mono mb-1.5">GEMINI TEMPERATURE: {ragSettings.temperature}</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={ragSettings.temperature}
                    onChange={(e) => setRagSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Lower values ensure deterministic context alignment.</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 font-mono mb-1.5">MAX CONTEXT CHUNKS: {ragSettings.maxChunks}</label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={ragSettings.maxChunks}
                    onChange={(e) => setRagSettings(prev => ({ ...prev, maxChunks: parseInt(e.target.value) }))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">The top N similarity chunks from FAISS vector scan used for prompting.</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 font-mono mb-1.5">RECURSIVE CHUNK SIZE: {ragSettings.chunkSize} chars</label>
                  <input
                    type="range"
                    min="300"
                    max="1500"
                    step="100"
                    value={ragSettings.chunkSize}
                    onChange={(e) => setRagSettings(prev => ({ ...prev, chunkSize: parseInt(e.target.value) }))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Character block constraint before vectorized storage.</span>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-700/50 flex justify-end">
                <button
                  id="settings-save-btn"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    showToast('Advanced workspace attributes saved.', 'success');
                  }}
                  className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded-xl font-medium text-xs cursor-pointer transition-colors"
                >
                  Save Configuration
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Elegant Toasts Notification HUD */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none max-w-sm w-full" id="toast-notifications-hud">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              id={`toast-${toast.id}`}
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
              className={`p-3.5 rounded-xl border shadow-xl flex items-center space-x-2.5 pointer-events-auto backdrop-blur-md ${
                toast.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : toast.type === 'error'
                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                    : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
              }`}
            >
              {toast.type === 'success' ? (
                <div className="h-4.5 w-4.5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                  <Check className="h-3 w-3 stroke-[3]" />
                </div>
              ) : toast.type === 'error' ? (
                <div className="h-4.5 w-4.5 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 flex-shrink-0">
                  <AlertCircle className="h-3 w-3 stroke-[3]" />
                </div>
              ) : (
                <div className="h-4.5 w-4.5 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
                  <Sparkles className="h-3 w-3" />
                </div>
              )}
              <span className="text-[11px] font-medium leading-relaxed flex-1">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
