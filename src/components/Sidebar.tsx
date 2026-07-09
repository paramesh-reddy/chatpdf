/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, FileText, MessageSquare, Trash2,
  Loader2, PanelLeftClose, PanelLeft,
} from 'lucide-react';
import ApiService from '../api.ts';
import { DocumentRecord, ChatSession } from '../types.ts';

interface SidebarProps {
  view: 'dashboard' | 'workspace';
  documents: DocumentRecord[];
  selectedDoc: DocumentRecord | null;
  selectedSession: ChatSession | null;
  loading: boolean;
  onGoDashboard: () => void;
  onSelectDoc: (doc: DocumentRecord) => void;
  onSelectSession: (session: ChatSession | null) => void;
  onDeleteDoc: (docId: string) => void;
}

export default function Sidebar({
  view,
  documents,
  selectedDoc,
  selectedSession,
  loading,
  onGoDashboard,
  onSelectDoc,
  onSelectSession,
  onDeleteDoc,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  useEffect(() => {
    if (selectedDoc && view === 'workspace') {
      setSessionsLoading(true);
      ApiService.listSessions(selectedDoc.id)
        .then((data) => setSessions(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())))
        .catch(console.error)
        .finally(() => setSessionsLoading(false));
    } else {
      setSessions([]);
    }
  }, [selectedDoc?.id, view, selectedSession?.id]);

  const NavItem = ({
    active, icon: Icon, label, onClick,
  }: { active: boolean; icon: React.ElementType; label: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-cyan-500/10 text-cyan-700 border border-cyan-500/20 dark:text-cyan-300'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50'
      }`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {!collapsed && <span>{label}</span>}
    </button>
  );

  return (
    <aside
      className={`flex-shrink-0 h-full border-r border-slate-200 bg-white flex flex-col transition-all duration-200 dark:border-slate-800/80 dark:bg-slate-950 ${
        collapsed ? 'w-[60px]' : 'w-64'
      }`}
    >
      {/* Brand + collapse */}
      <div className={`flex items-center ${collapsed ? 'justify-center p-3' : 'justify-between px-4 py-3'} border-b border-slate-200 dark:border-slate-800/60`}>
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
              <FileText className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate dark:text-white">DocuMind AI</p>
              <p className="text-[9px] text-slate-500">Intelligence</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0 dark:hover:text-slate-300 dark:hover:bg-slate-800"
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation */}
      <div className="p-3 space-y-1">
        <NavItem
          active={view === 'dashboard'}
          icon={LayoutDashboard}
          label="Dashboard"
          onClick={onGoDashboard}
        />
      </div>

      {/* Documents */}
      <div className="flex-1 flex flex-col min-h-0 px-3 pb-3">
        {!collapsed && (
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-3 mb-2 mt-2">
            Documents
          </p>
        )}

        <div className="flex-1 overflow-y-auto space-y-0.5 scrollbar-thin">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 text-slate-600 animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            !collapsed && (
              <p className="text-xs text-slate-600 text-center py-4 px-2">No PDFs uploaded</p>
            )
          ) : (
            documents.map((doc) => {
              const isActive = selectedDoc?.id === doc.id && view === 'workspace';
              return (
                <div key={doc.id} className="group relative">
                  <button
                    onClick={() => onSelectDoc(doc)}
                    title={collapsed ? doc.name : undefined}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                      isActive
                        ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'
                    }`}
                  >
                    <FileText className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-cyan-400' : ''}`} />
                    {!collapsed && (
                      <span className="text-xs font-medium truncate flex-1">{doc.name}</span>
                    )}
                  </button>
                  {!collapsed && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${doc.name}"?`)) onDeleteDoc(doc.id);
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Chat history (workspace only) */}
        {view === 'workspace' && selectedDoc && !collapsed && (
          <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col min-h-0 max-h-[40%] dark:border-slate-800/60">
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-3 mb-2">
              Chat History
            </p>
            <div className="flex-1 overflow-y-auto space-y-0.5 scrollbar-thin">
              {sessionsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-3.5 w-3.5 text-slate-600 animate-spin" />
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-[11px] text-slate-600 text-center py-3 px-2">No chats yet</p>
              ) : (
                sessions.map((sess) => (
                  <button
                    key={sess.id}
                    onClick={() => onSelectSession(sess)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                      selectedSession?.id === sess.id
                        ? 'bg-cyan-500/10 text-cyan-700 border border-cyan-500/20 dark:text-cyan-300'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 border border-transparent dark:hover:bg-slate-800/50 dark:hover:text-slate-300'
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="text-[11px] truncate">{sess.title}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
