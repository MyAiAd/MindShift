'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface StepChatContext {
  stepLabel: string;
  userInput: string;
  actualMessage: string;
  expectedStep: string;
  actualStep: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  stepContext: StepChatContext;
  savedStepId?: string;
  onCorrectionApplied: (correctedText: string) => void;
  onClose: () => void;
}

const CORRECTION_PREFIX = 'CORRECTION_CONFIRMED:';

function extractCorrection(text: string): string | null {
  const idx = text.indexOf(CORRECTION_PREFIX);
  if (idx === -1) return null;
  const jsonStart = idx + CORRECTION_PREFIX.length;
  try {
    // Find matching closing brace
    let depth = 0;
    let end = jsonStart;
    for (; end < text.length; end++) {
      if (text[end] === '{') depth++;
      else if (text[end] === '}') { depth--; if (depth === 0) { end++; break; } }
    }
    const parsed = JSON.parse(text.slice(jsonStart, end));
    return parsed.correctedText ?? null;
  } catch {
    return null;
  }
}

export default function StepChatPanel({ stepContext, savedStepId, onCorrectionApplied, onClose }: Props) {
  const seedMessage = `I can see this step returned: "${stepContext.actualMessage.slice(0, 120)}${stepContext.actualMessage.length > 120 ? '…' : ''}". What should it say instead?`;

  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: seedMessage },
  ]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingCorrection, setPendingCorrection] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText('');
    setIsStreaming(true);

    // Add placeholder assistant message
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      const resp = await fetch('/api/labs/v5-tests/step-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepContext,
          messages: newMessages,
        }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error('Stream request failed');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: accumulated };
          return next;
        });

        const correction = extractCorrection(accumulated);
        if (correction) {
          setPendingCorrection(correction);
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: 'assistant', content: '[Error: failed to get AI response]' };
        return next;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const applyCorrection = async (correctedText: string) => {
    onCorrectionApplied(correctedText);

    if (savedStepId) {
      await fetch(`/api/labs/v5-tests/steps/${savedStepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_status: 'flag',
          review_note: correctedText,
          suggested_correction: correctedText,
        }),
      });
    }

    onClose();
  };

  // Strip CORRECTION_CONFIRMED line from displayed text
  const displayContent = (content: string) => {
    const idx = content.indexOf(CORRECTION_PREFIX);
    return idx !== -1 ? content.slice(0, idx).trim() : content;
  };

  return (
    <div className="border border-border rounded-lg bg-card dark:bg-card overflow-hidden flex flex-col" style={{ maxHeight: '420px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-secondary/30 border-b border-border">
        <span className="text-xs font-semibold text-foreground">💬 AI Correction Assistant — <span className="font-mono text-muted-foreground">{stepContext.stepLabel}</span></span>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-xs px-1.5 py-0.5 rounded hover:bg-secondary transition-colors"
        >
          ✕ Close
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0" style={{ maxHeight: '260px' }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-secondary/50 text-foreground border border-border/50'
              }`}
            >
              {msg.role === 'assistant' && i === messages.length - 1 && isStreaming
                ? displayContent(msg.content) + '▌'
                : displayContent(msg.content)}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending correction banner */}
      {pendingCorrection && (
        <div className="mx-3 mb-2 p-2.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
          <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-300 mb-1">AI suggests this correction:</p>
          <p className="text-xs text-yellow-900 dark:text-yellow-200 italic mb-2">"{pendingCorrection}"</p>
          <div className="flex gap-2">
            <button
              onClick={() => applyCorrection(pendingCorrection)}
              className="px-2.5 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-xs font-medium transition-colors"
            >
              Apply as Correction
            </button>
            <button
              onClick={() => setPendingCorrection(null)}
              className="px-2.5 py-1 border border-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 rounded text-xs transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 px-3 py-2 border-t border-border">
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          placeholder="Describe what this step should say…"
          className="flex-1 text-xs px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          onClick={sendMessage}
          disabled={isStreaming || !inputText.trim()}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium transition-colors"
        >
          {isStreaming ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
