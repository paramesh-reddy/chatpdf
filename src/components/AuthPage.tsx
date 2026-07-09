/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FileText, Mail, Lock, ArrowRight, Sparkles, User, Sun, Moon } from 'lucide-react';
import ApiService from '../api.ts';
import { useTheme } from '../context/ThemeContext.tsx';

interface AuthPageProps {
  onAuthSuccess: () => void;
}

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) { setError('Please fill in all fields'); return; }
    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (mode === 'register' && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') await ApiService.login(email, password);
      else await ApiService.register(email, password, fullName.trim() || undefined);
      onAuthSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex relative dark:bg-slate-950">
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute top-4 right-4 z-10 p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 shadow-sm hover:text-slate-900 transition-colors dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-white"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white">DocuMind AI</h1>
              <p className="text-xs text-slate-500">Document Intelligence Platform</p>
            </div>
          </div>

          <div className="flex p-1 rounded-xl bg-slate-100 border border-slate-200 mb-8 dark:bg-slate-900 dark:border-slate-800">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === 'login'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === 'register'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Register
            </button>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1 dark:text-white">
            {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            {mode === 'login'
              ? 'Access your documents and AI chat workspace'
              : 'Get started with DocuMind AI for free'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 dark:text-slate-400">Full name</label>
                <div className="relative">
                  <User className="h-4 w-4 text-slate-400 absolute left-3 top-3 dark:text-slate-600" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                    placeholder="Parameshwar"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 dark:text-slate-400">Email address</label>
              <div className="relative">
                <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-3 dark:text-slate-600" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                  placeholder="you@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 dark:text-slate-400">Password</label>
              <div className="relative">
                <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-3 dark:text-slate-600" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 dark:text-slate-400">Confirm password</label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-3 dark:text-slate-600" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm disabled:opacity-50 transition-colors shadow-lg shadow-cyan-600/20 mt-2"
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 items-center justify-center p-12 bg-gradient-to-br from-slate-100 via-slate-50 to-cyan-50 border-l border-slate-200 relative overflow-hidden dark:from-slate-900 dark:via-slate-950 dark:to-cyan-950/40 dark:border-slate-800/50">
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl" />
        <div className="relative max-w-md space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            DocuMind AI
          </div>
          <h2 className="text-3xl font-display font-bold text-slate-900 leading-tight dark:text-white">
            Chat with your PDFs using <span className="text-cyan-600 dark:text-cyan-400">AI intelligence</span>
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Upload documents, ask questions in natural language, and get accurate answers with page-level citations. Built for students, researchers, and professionals.
          </p>
          <ul className="space-y-3">
            {['Secure login & personal workspace', 'Instant PDF indexing', 'AI answers with page citations'].map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
