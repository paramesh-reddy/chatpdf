/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Copy, Check, Sparkles, Quote } from 'lucide-react';
import ApiService from '../api.ts';
import { DocumentRecord, ChatSession, Message } from '../types.ts';

interface ChatWindowProps {
  documentRecord: DocumentRecord;
  activeSession: ChatSession | null;
  onSessionCreated: (sess: ChatSession) => void;
  onPageSelect: (pageNumber: number) => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export default function ChatWindow({
  documentRecord,
  activeSession,
  onSessionCreated,
  onPageSelect,
  showToast,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const isStreamingRef = useRef(false);
  const streamingRef = useRef('');
  const sessionIdRef = useRef<string | null>(activeSession?.id || null);
  const skipLoadRef = useRef(false);

  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);
  useEffect(() => { sessionIdRef.current = activeSession?.id || null; }, [activeSession?.id]);

  useEffect(() => {
    if (isStreamingRef.current) return;
    if (skipLoadRef.current) { skipLoadRef.current = false; return; }
    if (activeSession) loadMessages(activeSession.id);
    else setMessages([]);
  }, [activeSession?.id, documentRecord.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming, isStreaming]);

  const loadMessages = async (sessionId: string) => {
    setLoading(true);
    try {
      setMessages(await ApiService.listMessages(sessionId));
    } catch {
      showToast('Failed to load messages', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (text?: string) => {
    const question = (text || input).trim();
    if (!question || isStreaming) return;

    setInput('');
    setIsStreaming(true);
    isStreamingRef.current = true;
    setStreaming('');
    streamingRef.current = '';

    setMessages((prev) => [...prev, {
      id: `user-${Date.now()}`,
      sessionId: sessionIdRef.current || 'temp',
      role: 'user',
      content: question,
      createdAt: new Date().toISOString(),
    }]);

    ApiService.streamChat(
      { documentId: documentRecord.id, sessionId: sessionIdRef.current || undefined, question },
      {
        onChunk: (chunk) => {
          streamingRef.current += chunk;
          setStreaming(streamingRef.current);
        },
        onSessionCreated: (data) => {
          skipLoadRef.current = true;
          sessionIdRef.current = data.sessionId;
          onSessionCreated({
            id: data.sessionId,
            userId: ApiService.getUserId() || '',
            documentId: documentRecord.id,
            title: data.title,
            createdAt: new Date().toISOString(),
          });
        },
        onDone: async (meta) => {
          sessionIdRef.current = meta.sessionId;
          const answerText = meta.answer || streamingRef.current;

          if (answerText) {
            setMessages((prev) => [...prev, {
              id: `msg-${Date.now()}`,
              sessionId: meta.sessionId,
              role: 'assistant',
              content: answerText,
              createdAt: new Date().toISOString(),
              sourcePages: meta.source_pages,
              confidenceScore: meta.confidence_score,
            }]);
          } else {
            // Fallback: load from server if stream text was lost
            try {
              const saved = await ApiService.listMessages(meta.sessionId);
              setMessages(saved);
            } catch {
              showToast('Response saved but could not display', 'error');
            }
          }

          setIsStreaming(false);
          isStreamingRef.current = false;
          setStreaming('');
          streamingRef.current = '';
        },
        onError: (err) => {
          showToast(err || 'Failed to get response', 'error');
          setIsStreaming(false);
          isStreamingRef.current = false;
          setStreaming('');
          streamingRef.current = '';
        },
      }
    );
  };

  const suggestions = [
    'Summarize this document in bullet points',
    'What are the key skills and experience mentioned?',
    'List the most important details from this PDF',
  ];

  const showFeed = messages.length > 0 || isStreaming;

  return (
    <div className="h-full flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden dark:border-slate-800/80 dark:bg-slate-900/50">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2 dark:border-slate-800/60">
        <div className="h-7 w-7 rounded-lg bg-cyan-500/15 flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">DocuMind AI</h3>
          <p className="text-[11px] text-slate-500">Intelligent answers with page citations</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {loading && !isStreaming ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 text-slate-500 animate-spin" />
          </div>
        ) : !showFeed ? (
          <div className="py-6">
            <p className="text-sm text-slate-500 text-center mb-6 dark:text-slate-400">
              Ask a question about <span className="text-slate-700 font-medium dark:text-slate-300">{documentRecord.name}</span>
            </p>
            <div className="space-y-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-600 hover:text-slate-900 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400 dark:hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-cyan-600 text-white rounded-br-md'
                    : 'bg-slate-100 text-slate-800 border border-slate-200 rounded-bl-md dark:bg-slate-800/80 dark:text-slate-200 dark:border-slate-700/50'
                }`}>
                  {msg.role === 'assistant' && (
                    <p className="text-[10px] font-medium text-cyan-400 mb-1.5 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> DocuMind AI
                    </p>
                  )}
                  {msg.content ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  ) : msg.role === 'assistant' ? (
                    <p className="text-sm text-slate-500 italic">No response generated.</p>
                  ) : null}

                  {msg.role === 'assistant' && msg.sourcePages && msg.sourcePages.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700/40">
                      <Quote className="h-3 w-3 text-slate-500" />
                      {msg.sourcePages.map((page) => (
                        <button
                          key={page}
                          onClick={() => onPageSelect(page)}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 font-medium transition-colors"
                        >
                          Page {page}
                        </button>
                      ))}
                      {msg.confidenceScore !== undefined && (
                        <span className="text-[10px] text-slate-500 ml-auto">{msg.confidenceScore}% match</span>
                      )}
                    </div>
                  )}

                  {msg.role === 'assistant' && msg.content && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(msg.content);
                        setCopiedId(msg.id);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      className="mt-2 text-slate-600 hover:text-slate-400 transition-colors"
                    >
                      {copiedId === msg.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {isStreaming && (
              <div className="flex justify-start">
                <div className="max-w-[88%] rounded-2xl rounded-bl-md px-4 py-3 bg-slate-100 border border-slate-200 dark:bg-slate-800/80 dark:border-slate-700/50">
                  {streaming ? (
                    <>
                      <p className="text-[10px] font-medium text-cyan-400 mb-1.5 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> DocuMind AI
                      </p>
                      <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed dark:text-slate-200">{streaming}</p>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                      <span className="text-xs">Analyzing document...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t border-slate-200 bg-slate-50 dark:border-slate-800/60 dark:bg-slate-900/30">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isStreaming}
            placeholder="Ask a question about this document..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 disabled:opacity-50 dark:bg-slate-800/80 dark:border-slate-700/50 dark:text-white dark:placeholder-slate-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="px-3 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
