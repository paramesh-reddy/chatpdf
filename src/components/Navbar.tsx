/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  FileText, Plus, ChevronRight, LayoutDashboard, LogOut, Bell, Sun, Moon,
} from 'lucide-react';
import ApiService from '../api.ts';
import { useTheme } from '../context/ThemeContext.tsx';
import { getProfileDisplayName } from '../utils/profile.ts';
import { DocumentRecord } from '../types.ts';

interface NavbarProps {
  view: 'dashboard' | 'workspace';
  selectedDoc: DocumentRecord | null;
  onGoDashboard: () => void;
  onUpload: () => void;
  onSignOut: () => void;
}

export default function Navbar({
  view,
  selectedDoc,
  onGoDashboard,
  onUpload,
  onSignOut,
}: NavbarProps) {
  const email = ApiService.getEmail() || '';
  const displayName = getProfileDisplayName();
  const initials = displayName.charAt(0).toUpperCase();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-14 flex-shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur-md flex items-center justify-between px-4 lg:px-6 z-20 dark:border-slate-800/80 dark:bg-slate-950/90">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onGoDashboard}
          className="flex items-center gap-2.5 hover:opacity-90 transition-opacity"
        >
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <span className="font-display font-bold text-slate-900 text-base hidden sm:block dark:text-white">DocuMind AI</span>
        </button>

        <ChevronRight className="h-3.5 w-3.5 text-slate-400 hidden sm:block flex-shrink-0 dark:text-slate-600" />

        <nav className="flex items-center gap-1.5 text-sm min-w-0">
          <button
            onClick={onGoDashboard}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
              view === 'dashboard'
                ? 'text-slate-900 font-medium dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Dashboard</span>
          </button>

          {view === 'workspace' && selectedDoc && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 dark:text-slate-600" />
              <span className="text-slate-900 font-medium truncate max-w-[140px] sm:max-w-[240px] dark:text-white" title={selectedDoc.name}>
                {selectedDoc.name}
              </span>
              <span className="hidden lg:inline-flex items-center gap-1 ml-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse dark:bg-emerald-400" />
                Ready
              </span>
            </>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onUpload}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors shadow-sm shadow-cyan-600/20"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Upload PDF</span>
        </button>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors dark:hover:text-slate-200 dark:hover:bg-slate-800/60"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors hidden md:flex dark:hover:text-slate-300 dark:hover:bg-slate-800/60">
          <Bell className="h-4 w-4" />
        </button>

        <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block dark:bg-slate-800" />

        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-semibold text-cyan-600 dark:bg-slate-800 dark:border-slate-700 dark:text-cyan-300">
            {initials}
          </div>
          <div className="hidden lg:block min-w-0">
            <p className="text-xs font-medium text-slate-800 truncate max-w-[120px] dark:text-slate-200">{displayName}</p>
            <p className="text-[10px] text-slate-500 truncate max-w-[120px]">{email}</p>
          </div>
          <button
            onClick={onSignOut}
            className="p-2 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors dark:hover:text-red-400 dark:hover:bg-red-500/10"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
