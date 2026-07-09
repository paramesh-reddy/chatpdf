/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, Sparkles, AlertCircle, Quote, MessageSquare, ArrowRight, Shield, 
  RefreshCw, Loader2, Copy, Download, Share2, Clipboard, Trash2, Check 
} from 'lucide-react';
import ApiService from '../api.ts';
import { DocumentRecord, ChatSession, Message } from '../types.ts';

interface ChatWindowProps {
  documentRecord: DocumentRecord | null;
  activeSession: ChatSession | null;
  onSessionCreated: (sess: ChatSession) => void;
  onPageSelect: (pageNumber: number) => void;
  theme: 'dark' | 'light';
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export default function ChatWindow({
  documentRecord,
  activeSession,
  onSessionCreated,
  onPageSelect,
  theme,
  showToast,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [streamingAnswer, setStreamingAnswer] = useState('');
  const [streamingMeta, setStreamingMeta] = useState<{ source_pages: number[]; confidence_score: number } | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messageEndRef = useRef<HTMLDivElement>(null);

  // Load message logs when session is activated
  useEffect(() => {
    if (activeSession) {
      loadMessages();
    } else {
      setMessages([]);
    }
    setStreamingAnswer('');
    setStreamingMeta(null);
    setIsStreaming(false);
    setErrorText(null);
  }, [activeSession]);

  // Autoscroll to bottom
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingAnswer, isStreaming]);

  const loadMessages = async () => {
    if (!activeSession) return;
    setMessagesLoading(true);
    try {
      const data = await ApiService.listMessages(activeSession.id);
      setMessages(data);
    } catch (e) {
      console.error('Failed to load chat messages:', e);
      showToast('Failed to load chat logs', 'error');
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSend = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText || inputMessage;
    if (!textToSend.trim() || !documentRecord || isStreaming) return;

    setInputMessage('');
    setErrorText(null);
    setIsStreaming(true);
    setStreamingAnswer('');
    setStreamingMeta(null);

    // Render User message locally immediately for quick feedback
    const userTempMessage: Message = {
      id: `user-temp-${Date.now()}`,
      sessionId: activeSession?.id || 'temp',
      role: 'user',
      content: textToSend,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userTempMessage]);

    // Use full-stack SSE streaming
    ApiService.streamChat(
      {
        documentId: documentRecord.id,
        sessionId: activeSession?.id,
        question: textToSend,
      },
      {
        onChunk: (chunk) => {
          setStreamingAnswer((prev) => prev + chunk);
        },
        onSessionCreated: (sessData) => {
          const newSession: ChatSession = {
            id: sessData.sessionId,
            userId: ApiService.getUserId() || '',
            documentId: documentRecord.id,
            title: sessData.title,
            createdAt: new Date().toISOString(),
          };
          onSessionCreated(newSession);
        },
        onDone: (meta) => {
          setStreamingMeta({
            source_pages: meta.source_pages,
            confidence_score: meta.confidence_score,
          });

          // Sync database message array
          setTimeout(() => {
            loadMessages();
            setIsStreaming(false);
            setStreamingAnswer('');
            setStreamingMeta(null);
            showToast('Gemini response finalized.', 'success');
          }, 500);
        },
        onError: (err) => {
          setErrorText(err || 'RAG generation error occurred.');
          setIsStreaming(false);
          setStreamingAnswer('');
          setStreamingMeta(null);
          showToast('Could not complete query streaming.', 'error');
        },
      }
    );
  };

  const handleCopyMessage = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    showToast('Copied content to clipboard', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportChatMarkdown = () => {
    if (messages.length === 0) return;
    const header = `# AetherDocs AI Session Export\nDocument: ${documentRecord?.name || 'Untitled'}\nDate: ${new Date().toLocaleDateString()}\n\n`;
    const chatBody = messages.map(msg => {
      const roleStr = msg.role === 'user' ? '### USER QUESTION' : '### AI ASSISTANT';
      let msgStr = `${roleStr}\n${msg.content}\n\n`;
      if (msg.sourcePages && msg.sourcePages.length > 0) {
        msgStr += `*Page Citations: ${msg.sourcePages.join(', ')}*\n\n`;
      }
      return msgStr;
    }).join('---\n\n');

    const fullBlob = new Blob([header + chatBody], { type: 'text/markdown' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(fullBlob);
    link.download = `chat-export-${activeSession?.id || 'session'}.md`;
    link.click();
    showToast('Exported conversation as Markdown (.md)', 'success');
  };

  const isDark = theme === 'dark';

  const samplePrompts = [
    'Summarize this document in 3 bullet points.',
    'What are the core key takeaways from this PDF?',
    'What are the main findings or metrics mentioned?',
    'Explain any complex vocabulary or theories here.',
  ];

  return (
    <div className={`flex flex-col h-full border rounded-2xl overflow-hidden font-sans transition-colors duration-200 ${
      isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
    }`} id="chat-window-root">
      
      {/* Premium Header Control Line */}
      {documentRecord && (
        <div className={`p-4 border-b flex items-center justify-between ${
          isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`} id="chat-window-header">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
            <span className={`text-xs font-extrabold tracking-tight font-display uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Semantic RAG Console
            </span>
          </div>

          {/* Export action controls */}
          {messages.length > 0 && (
            <div className="flex items-center space-x-1.5">
              <button
                onClick={handleExportChatMarkdown}
                className={`p-1.5 rounded-lg border text-[10px] font-semibold flex items-center space-x-1 transition-all cursor-pointer ${
                  isDark
                    ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 hover:border-slate-700 text-slate-300'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600 shadow-sm'
                }`}
                title="Download Chat Log"
              >
                <Download className="h-3 w-3" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Messages Feed Area */}
      <div className={`flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin ${
        isDark ? 'bg-slate-950/10' : 'bg-slate-50/20'
      }`} id="chat-messages-container">
        {!documentRecord ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12" id="chat-no-doc-state">
            <MessageSquare className="h-12 w-12 mb-3.5 text-slate-600 opacity-60 stroke-[1.5]" />
            <p className={`text-sm font-bold ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>RAG Conversation Engine</p>
            <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
              Select or vectorize a document from your repository workspace to start searching page contexts.
            </p>
          </div>
        ) : messagesLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12">
            <Loader2 className="h-7 w-7 text-cyan-400 animate-spin mb-3" />
            <p className="text-xs text-slate-500 font-mono">Decoding indexed interaction history...</p>
          </div>
        ) : messages.length === 0 && !streamingAnswer && !isStreaming ? (
          // Welcome Prompts / Empty State
          <div className="h-full flex flex-col justify-center items-center py-8 text-center max-w-sm mx-auto" id="chat-empty-state">
            <div className="h-11 w-11 bg-cyan-400/10 border border-cyan-400/20 rounded-xl flex items-center justify-center mb-4 text-cyan-400 shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <h4 className={`font-extrabold text-base mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>Ask anything about this document!</h4>
            <p className="text-slate-500 text-xs mb-6 text-center leading-relaxed">
              Gemini has compiled semantic indices across the layout. Choose a sample query template or type your question below.
            </p>
            <div className="w-full space-y-2 text-left">
              {samplePrompts.map((prompt, idx) => (
                <button
                  id={`sample-prompt-btn-${idx}`}
                  key={idx}
                  onClick={() => handleSend(undefined, prompt)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs transition-all cursor-pointer group ${
                    isDark
                      ? 'bg-slate-950/40 hover:bg-slate-950 border-slate-800 text-slate-300'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600 shadow-sm'
                  }`}
                >
                  <span className="truncate pr-4 font-medium">{prompt}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4" id="chat-feed-list">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              const isCopied = copiedId === msg.id;
              return (
                <motion.div
                  id={`msg-bubble-${msg.id}`}
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] rounded-2xl p-4 border relative group shadow-sm ${
                    isUser
                      ? isDark
                        ? 'bg-slate-800 border-slate-700/60 text-slate-100'
                        : 'bg-slate-100 border-slate-200 text-slate-800'
                      : isDark
                        ? 'bg-slate-950 border-slate-800/80 text-slate-200'
                        : 'bg-white border-slate-200/80 text-slate-800'
                  }`}>
                    {/* Header Details / Copy response */}
                    <div className="flex items-center justify-between text-[9px] font-mono mb-1.5 text-slate-500">
                      <span>{isUser ? 'USER QUESTION' : 'ASSISTANT RESPONSE'}</span>
                      {!isUser && (
                        <button
                          onClick={() => handleCopyMessage(msg.content, msg.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-800/10 rounded text-slate-400 hover:text-white transition-opacity cursor-pointer"
                          title="Copy content"
                        >
                          {isCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        </button>
                      )}
                    </div>

                    {/* Message Content */}
                    <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans">{msg.content}</p>

                    {/* Citations & Score for Assistant answers */}
                    {!isUser && (msg.sourcePages || msg.confidenceScore) && (
                      <div className="mt-3.5 pt-2.5 border-t border-slate-800/10 flex flex-wrap items-center gap-3">
                        {/* Page citations badges */}
                        {msg.sourcePages && msg.sourcePages.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500 font-mono flex items-center">
                              <Quote className="h-3 w-3 mr-1 text-cyan-400" />
                              Pages:
                            </span>
                            {msg.sourcePages.map((page) => (
                              <button
                                id={`citation-badge-page-${page}`}
                                key={page}
                                onClick={() => onPageSelect(page)}
                                className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500 hover:text-slate-950 text-[10px] text-cyan-400 font-mono font-bold transition-colors cursor-pointer"
                                title={`Navigate PDF Reader to Page ${page}`}
                              >
                                {page}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Confidence meter badge */}
                        {msg.confidenceScore !== undefined && (
                          <div className="flex items-center space-x-1.5 ml-auto text-[9px] font-mono text-slate-500">
                            <Shield className={`h-3 w-3 ${msg.confidenceScore > 70 ? 'text-emerald-400' : 'text-yellow-400'}`} />
                            <span>{msg.confidenceScore}% RAG Confidence</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {/* SSE Streaming Active Answer */}
            {streamingAnswer && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
                id="chat-streaming-answer-box"
              >
                <div className={`max-w-[85%] rounded-2xl p-4 border shadow-sm ${
                  isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  <div className="flex items-center space-x-1.5 text-[9px] font-mono mb-1.5 text-cyan-400 animate-pulse">
                    <Sparkles className="h-3 w-3" />
                    <span>GENERATING RESPONSE...</span>
                  </div>
                  <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans">{streamingAnswer}</p>
                </div>
              </motion.div>
            )}

            {/* Typing status loader */}
            {isStreaming && !streamingAnswer && (
              <div className="flex items-center space-x-2 text-slate-500 text-[11px] font-mono py-1" id="chat-typing-indicator">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                <span>Gemini is scanning high-dimensional spaces...</span>
              </div>
            )}

            {errorText && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center space-x-2" id="chat-error-toast">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{errorText}</span>
                <button
                  id="chat-retry-btn"
                  onClick={() => {
                    const lastUserMsg = messages.filter(m => m.role === 'user').pop();
                    if (lastUserMsg) {
                      handleSend(undefined, lastUserMsg.content);
                    }
                  }}
                  className="underline flex items-center space-x-0.5 hover:text-white cursor-pointer font-semibold text-[10px]"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Retry</span>
                </button>
              </div>
            )}
          </div>
        )}
        <div ref={messageEndRef} />
      </div>

      {/* Footer controls input form */}
      {documentRecord && (
        <div className={`p-4 border-t ${
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`} id="chat-input-bar">
          <form className="flex items-center space-x-2.5" onSubmit={handleSend}>
            <input
              id="chat-message-input"
              type="text"
              placeholder={`Ask Gemini about "${documentRecord.name}"...`}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={isStreaming}
              className={`flex-1 border text-xs sm:text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all ${
                isDark
                  ? 'bg-slate-900 border-slate-800 text-white placeholder-slate-500'
                  : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 shadow-sm'
              }`}
            />
            <button
              id="chat-send-btn"
              type="submit"
              disabled={!inputMessage.trim() || isStreaming}
              className="p-2.5 rounded-xl text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all duration-150 flex-shrink-0"
              title="Send question"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
