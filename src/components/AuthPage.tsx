/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, FileText, ArrowRight, ShieldCheck, HelpCircle, Sparkles, Cpu, Layers, CheckCircle } from 'lucide-react';
import ApiService from '../api.ts';

interface AuthPageProps {
  onAuthSuccess: () => void;
}

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        await ApiService.login(email, password);
      } else {
        await ApiService.register(email, password);
      }
      onAuthSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex font-sans" id="auth-page">
      {/* Left Pane: Pristine Login / Registration Form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24 bg-slate-950 relative z-10">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          {/* Logo Brand Header */}
          <div className="text-left">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="h-11 w-11 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-400/15 mb-6"
            >
              <FileText className="h-5.5 w-5.5 text-slate-950" />
            </motion.div>
            
            <h2 className="text-2xl font-extrabold tracking-tight text-white font-display">
              {isLogin ? 'Sign in to DocuMind AI' : 'Create your DocuMind AI account'}
            </h2>
            <p className="mt-1.5 text-xs text-slate-400">
              {isLogin 
                ? 'Access your unified enterprise PDF intelligence workspace.' 
                : 'Get started with instant page-wise text parsing and vectorization.'}
            </p>
          </div>

          <div className="mt-8">
            <motion.div
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              <form className="space-y-5" onSubmit={handleSubmit}>
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-xl text-xs font-semibold" id="auth-error">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-400 font-mono mb-1.5">
                    EMAIL ADDRESS
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-slate-500" />
                    </div>
                    <input
                      id="auth-email-input"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-3.5 py-2.5 border border-slate-800 bg-slate-900 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                      placeholder="name@company.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 font-mono mb-1.5">
                    PASSWORD
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-slate-500" />
                    </div>
                    <input
                      id="auth-password-input"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-3.5 py-2.5 border border-slate-800 bg-slate-900 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {!isLogin && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 font-mono mb-1.5">
                      CONFIRM PASSWORD
                    </label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-slate-500" />
                      </div>
                      <input
                        id="auth-confirm-password-input"
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="block w-full pl-10 pr-3.5 py-2.5 border border-slate-800 bg-slate-900 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    id="auth-submit-btn"
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-lg text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 disabled:opacity-50 cursor-pointer transition-all duration-200"
                  >
                    {loading ? (
                      <div className="flex items-center space-x-2">
                        <svg className="animate-spin h-4 w-4 text-slate-950" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span>Signing In...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1.5">
                        <span>{isLogin ? 'Sign In Workspace' : 'Initialize Account'}</span>
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-6 pt-4 border-t border-slate-900">
                <div className="text-center">
                  <button
                    id="auth-switch-mode-btn"
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setError(null);
                    }}
                    className="font-semibold text-cyan-400 hover:text-cyan-300 text-xs transition-colors duration-150 cursor-pointer"
                  >
                    {isLogin ? 'Create a free enterprise account' : 'Sign in with an existing account'}
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Informative Security Section */}
            <div className="mt-10 flex items-center justify-center space-x-5 text-slate-600 text-[10px] text-center">
              <span className="flex items-center space-x-1">
                <ShieldCheck className="h-3.5 w-3.5 text-cyan-500" />
                <span>AES-256 Credentials</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <HelpCircle className="h-3.5 w-3.5 text-cyan-500" />
                <span>Encrypted Vectors</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane: Immersive Product Overview & Graphics */}
      <div className="hidden lg:flex flex-1 relative bg-slate-900 overflow-hidden items-center justify-center p-12 border-l border-slate-800">
        {/* Subtle geometric glowing background circles */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-cyan-500/5 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-500/5 blur-[120px]" />

        <div className="max-w-md w-full space-y-8 relative z-10 text-slate-300">
          <div className="space-y-4">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider font-mono uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
              <span>DOCUMIND AI CORE</span>
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-white font-display leading-tight">
              Transform documents into <span className="text-cyan-400">conversational assets</span>.
            </h1>
            <p className="text-slate-400 text-xs leading-relaxed">
              DocuMind AI is an enterprise-grade document intelligence network. We parse, index, and query dense semantic page chunks via Google Gemini, guaranteeing citations with perfect spatial grounding.
            </p>
          </div>

          <div className="space-y-4 pt-4">
            <div className="flex items-start space-x-3.5">
              <div className="h-7 w-7 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-cyan-400 flex-shrink-0 mt-0.5">
                <Cpu className="h-3.5 w-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wide">High-Dimensional Embeddings</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  PDF segments are automatically converted into dense 768-dimensional semantic structures, indexed locally for near-instant cosine search.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3.5">
              <div className="h-7 w-7 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-indigo-400 flex-shrink-0 mt-0.5">
                <Layers className="h-3.5 w-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wide">Recursive Splitting Core</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Maintains continuous document layout context by splitting recursively over semantic separators with a strict overlap safety coefficient.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3.5">
              <div className="h-7 w-7 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5">
                <CheckCircle className="h-3.5 w-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wide">Verifiable Citation Grounding</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Every streamed word traces back to its original page index. Zero hallucinations, fully observable context citations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
