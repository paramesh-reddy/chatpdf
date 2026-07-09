/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, Plus, MessageSquare, Trash2, LogOut, ChevronLeft, ChevronRight, 
  User, Loader2, Search, Star, Settings, Moon, Sun, ShieldCheck 
} from 'lucide-react';
import ApiService from '../api.ts';
import { DocumentRecord, ChatSession } from '../types.ts';

interface SidebarProps {
  selectedDoc: DocumentRecord | null;
  onSelectDoc: (doc: DocumentRecord | null) => void;
  selectedSession: ChatSession | null;
  onSelectSession: (session: ChatSession | null) => void;
  onTriggerUpload: () => void;
  documents: DocumentRecord[];
  onRefreshDocs: () => Promise<void>;
  onSignOut: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onToggleSettings: () => void;
  onToggleStar: (docId: string, e?: React.MouseEvent) => void;
}

export default function Sidebar({
  selectedDoc,
  onSelectDoc,
  selectedSession,
  onSelectSession,
  onTriggerUpload,
  documents,
  onRefreshDocs,
  onSignOut,
  theme,
  onToggleTheme,
  onToggleSettings,
  onToggleStar,
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [docDeleting, setDocDeleting] = useState<string | null>(null);

  // Local filtering states for the sidebar list
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [filterFavorites, setFilterFavorites] = useState(false);

  // Fetch sessions whenever active document changes
  useEffect(() => {
    if (selectedDoc) {
      loadSessions();
    } else {
      setSessions([]);
    }
  }, [selectedDoc]);

  const loadSessions = async () => {
    if (!selectedDoc) return;
    setSessionsLoading(true);
    try {
      const data = await ApiService.listSessions(selectedDoc.id);
      setSessions(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      console.error('Failed to load chat sessions:', e);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleCreateSession = async () => {
    if (!selectedDoc) return;
    try {
      const title = `Chat on ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const newSess = await ApiService.createSession(selectedDoc.id, title);
      setSessions(prev => [newSess, ...prev]);
      onSelectSession(newSess);
    } catch (e) {
      console.error('Failed to create chat session:', e);
    }
  };

  const handleDeleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this PDF and all its vectors? This cannot be undone.')) {
      return;
    }
    setDocDeleting(id);
    try {
      await ApiService.deleteDocument(id);
      await onRefreshDocs();
      if (selectedDoc?.id === id) {
        onSelectDoc(null);
        onSelectSession(null);
      }
    } catch (err) {
      console.error('Failed to delete document:', err);
    } finally {
      setDocDeleting(null);
    }
  };

  const isDark = theme === 'dark';

  // Apply sidebar-level text filter & favorite filter
  const displayedDocs = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(sidebarSearch.toLowerCase());
    const matchesFav = !filterFavorites || doc.isStarred;
    return matchesSearch && matchesFav;
  });

  return (
    <div className="relative flex h-full font-sans" id="sidebar-container">
      {/* Sidebar collapsible drawer */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`h-full border-r flex flex-col overflow-hidden transition-colors duration-200 ${
              isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
            }`}
            id="sidebar-drawer"
          >
            {/* Header branding */}
            <div className={`p-4 border-b flex items-center justify-between ${
              isDark ? 'bg-slate-900/50 border-slate-800/80' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => onSelectDoc(null)}>
                <div className="h-9 w-9 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-400/20 group-hover:scale-[1.02] transition-transform">
                  <FileText className="h-4.5 w-4.5 text-slate-950" />
                </div>
                <div>
                  <h1 className={`font-extrabold text-sm font-display tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    DocuMind AI
                  </h1>
                  <span className="text-[9px] font-mono font-semibold text-cyan-400 block tracking-wider uppercase">Document Intelligence</span>
                </div>
              </div>

              {/* Theme Toggle Button */}
              <button
                id="sidebar-theme-toggle"
                onClick={onToggleTheme}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  isDark 
                    ? 'bg-slate-900/60 hover:bg-slate-800 border-slate-800 hover:border-slate-700 text-amber-400 hover:scale-105' 
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600 hover:scale-105'
                }`}
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
            </div>

            {/* Document Section */}
            <div className="p-4 flex flex-col flex-1 min-h-0">
              
              {/* Document List Header Controls */}
              <div className="flex items-center justify-between mb-3.5">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase font-mono">My Documents</span>
                <div className="flex items-center space-x-1">
                  {/* Favorites Filter Toggle */}
                  <button
                    onClick={() => setFilterFavorites(!filterFavorites)}
                    className={`p-1 rounded-lg border transition-all cursor-pointer ${
                      filterFavorites
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        : isDark
                          ? 'bg-slate-900/50 hover:bg-slate-800 border-slate-800 text-slate-500'
                          : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-400'
                    }`}
                    title={filterFavorites ? "Show all files" : "Show favorites only"}
                  >
                    <Star className={`h-3 w-3 ${filterFavorites ? 'fill-current' : ''}`} />
                  </button>

                  <button
                    id="sidebar-upload-btn"
                    onClick={onTriggerUpload}
                    className="p-1 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 transition-colors cursor-pointer"
                    title="Upload new PDF"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Sidebar Search Bar */}
              <div className="relative mb-3.5">
                <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="Filter vault..."
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  className={`w-full pl-8 pr-2 py-1 text-[11px] rounded-lg border focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                    isDark
                      ? 'bg-slate-900/40 border-slate-800 text-slate-300 placeholder-slate-600'
                      : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
                  }`}
                />
              </div>

              {/* Document List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin" id="sidebar-docs-list">
                {displayedDocs.length === 0 ? (
                  <div className={`text-center py-6 px-3 border border-dashed rounded-xl ${
                    isDark ? 'border-slate-800 bg-slate-900/10 text-slate-600' : 'border-slate-200 bg-slate-50/50 text-slate-400'
                  }`}>
                    <FileText className="h-6 w-6 mx-auto mb-1.5 opacity-50" />
                    <p className="text-[10px]">No PDFs match.</p>
                  </div>
                ) : (
                  displayedDocs.map((doc) => {
                    const isSelected = selectedDoc?.id === doc.id;
                    const isDeleting = docDeleting === doc.id;
                    return (
                      <div
                        id={`doc-item-${doc.id}`}
                        key={doc.id}
                        onClick={() => {
                          if (!isDeleting) {
                            onSelectDoc(doc);
                            onSelectSession(null);
                          }
                        }}
                        className={`group relative flex items-center justify-between p-2 rounded-xl transition-all duration-150 cursor-pointer border ${
                          isSelected
                            ? isDark
                              ? 'bg-slate-800/80 border-slate-700 text-white shadow-sm'
                              : 'bg-slate-100 border-slate-200 text-slate-900 shadow-sm'
                            : isDark
                              ? 'bg-slate-900/10 hover:bg-slate-900/40 border-transparent text-slate-400 hover:text-slate-200'
                              : 'bg-transparent hover:bg-slate-50 border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <FileText className={`h-4 w-4 flex-shrink-0 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold truncate pr-6">{doc.name}</p>
                            <p className="text-[9px] text-slate-500">
                              {(doc.size / 1024 / 1024).toFixed(2)} MB • {doc.pageCount} pgs
                            </p>
                          </div>
                        </div>

                        {/* Favorite Star badge inside sidebar */}
                        {doc.isStarred && !isSelected && (
                          <Star className="h-3 w-3 text-amber-400 fill-current absolute right-8" />
                        )}

                        <button
                          id={`delete-doc-btn-${doc.id}`}
                          onClick={(e) => handleDeleteDoc(doc.id, e)}
                          disabled={isDeleting}
                          className="absolute right-1.5 p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-slate-800/15 opacity-0 group-hover:opacity-100 transition-all duration-150 cursor-pointer disabled:opacity-50"
                          title="Delete PDF"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Sessions Divider / Header */}
              {selectedDoc && (
                <div className={`mt-4 border-t pt-4 flex flex-col flex-1 min-h-0 ${isDark ? 'border-slate-800/60' : 'border-slate-100'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase font-mono">Conversations</span>
                    <button
                      id="sidebar-new-chat-btn"
                      onClick={handleCreateSession}
                      className="p-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500 hover:text-slate-950 transition-all cursor-pointer text-[10px] flex items-center space-x-1 font-semibold"
                    >
                      <Plus className="h-3 w-3" />
                      <span>New Chat</span>
                    </button>
                  </div>

                  {/* Sessions List */}
                  <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin" id="sidebar-sessions-list">
                    {sessionsLoading ? (
                      <div className="flex items-center justify-center py-4 text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : sessions.length === 0 ? (
                      <div className="text-center py-4 text-slate-500">
                        <MessageSquare className="h-5 w-5 mx-auto mb-1 opacity-50" />
                        <p className="text-[9px]">No previous chats on this document.</p>
                      </div>
                    ) : (
                      sessions.map((sess) => {
                        const isSessSelected = selectedSession?.id === sess.id;
                        return (
                          <div
                            id={`session-item-${sess.id}`}
                            key={sess.id}
                            onClick={() => onSelectSession(sess)}
                            className={`flex items-center space-x-2 p-2 rounded-xl transition-all duration-150 cursor-pointer border text-[11px] ${
                              isSessSelected
                                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20 font-semibold'
                                : isDark
                                  ? 'hover:bg-slate-900/40 text-slate-400 hover:text-slate-300 border-transparent'
                                  : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800 border-transparent'
                            }`}
                          >
                            <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                            <p className="truncate flex-1">{sess.title}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Footer with Settings buttons */}
            <div className={`p-3.5 border-t flex items-center justify-between ${
              isDark ? 'border-slate-800 bg-slate-900/20' : 'border-slate-200 bg-slate-50/60'
            }`} id="sidebar-profile-footer">
              <div className="flex items-center space-x-2 min-w-0">
                <div className="h-7.5 w-7.5 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center flex-shrink-0 text-slate-300">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className={`text-[11px] font-bold truncate ${isDark ? 'text-white' : 'text-slate-950'}`}>
                    {ApiService.getEmail()}
                  </p>
                  <span className="text-[8px] text-slate-500 font-mono">ID: {ApiService.getUserId()?.substring(5, 11)}...</span>
                </div>
              </div>

              <div className="flex items-center space-x-1.5">
                {/* Workspace Settings toggler */}
                <button
                  onClick={onToggleSettings}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    isDark 
                      ? 'bg-slate-900/60 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white' 
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 shadow-sm'
                  }`}
                  title="Workspace settings"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>

                {/* Sign Out */}
                <button
                  id="sidebar-signout-btn"
                  onClick={onSignOut}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    isDark 
                      ? 'bg-slate-900/60 hover:bg-red-500/10 border-slate-800 text-slate-400 hover:text-red-400' 
                      : 'bg-white hover:bg-red-500/5 border-slate-200 text-slate-500 hover:text-red-500 shadow-sm'
                  }`}
                  title="Sign Out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapse Trigger Button */}
      <div className="absolute top-1/2 -right-3 transform -translate-y-1/2 z-40">
        <button
          id="sidebar-toggle-btn"
          onClick={() => setIsOpen(!isOpen)}
          className={`h-5.5 w-5.5 border rounded-full flex items-center justify-center shadow-md cursor-pointer transition-colors ${
            isDark 
              ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white shadow-black/30' 
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 shadow-slate-200'
          }`}
        >
          {isOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
