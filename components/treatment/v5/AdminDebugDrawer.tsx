'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Bug } from 'lucide-react';
import { TreatmentMessage } from './shared/types';

interface AdminDebugDrawerProps {
  messages: TreatmentMessage[];
  isProcessing: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

export default function AdminDebugDrawer({
  messages,
  isProcessing,
  isOpen,
  onToggle,
}: AdminDebugDrawerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  // Track whether user is near the bottom of the scroll area
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 80;
    isNearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // Auto-scroll when new messages arrive (only if user is near bottom)
  useEffect(() => {
    if (isNearBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  // Keyboard shortcut: Ctrl+Shift+D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggle]);

  return (
    <>
      {/* Edge tab — always visible when drawer is closed, attached to drawer when open */}
      <button
        onClick={onToggle}
        className={`fixed top-1/2 -translate-y-1/2 z-40 flex items-center gap-1 py-3 px-1.5 rounded-l-md border border-r-0 border-border/50 bg-card/80 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-card transition-all duration-300 ${
          isOpen ? 'right-80 sm:right-96' : 'right-0'
        }`}
        aria-label={isOpen ? 'Close debug panel' : 'Open debug panel'}
      >
        <Bug className="h-3.5 w-3.5" />
        {isOpen ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-30 w-80 sm:w-96 bg-card/95 backdrop-blur-sm border-l border-border flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bug className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                Debug Log
              </span>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {messages.length} msgs
            </span>
          </div>
        </div>

        {/* Message list */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0"
        >
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-3 py-1.5 rounded-lg text-xs ${
                  message.isUser
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>

                {/* Timing metrics */}
                {!message.isUser &&
                  (message.textRenderTime || message.audioStartTime) && (
                    <div
                      className="mt-1.5 pt-1.5 border-t border-border/30 text-[10px] text-muted-foreground font-mono"
                      aria-hidden="true"
                    >
                      ⏱️
                      {message.textRenderTime && (
                        <span className="ml-1">
                          Text:{' '}
                          <span className="font-semibold">
                            {Math.round(message.textRenderTime)}ms
                          </span>
                        </span>
                      )}
                      {message.audioStartTime && (
                        <span className="ml-1">
                          | Audio:{' '}
                          <span className="font-semibold">
                            {Math.round(message.audioStartTime)}ms
                          </span>
                        </span>
                      )}
                      {message.textRenderTime && message.audioStartTime && (
                        <span className="ml-1">
                          | Δ:{' '}
                          <span
                            className={`font-semibold ${
                              message.textRenderTime - message.audioStartTime > 0
                                ? 'text-accent'
                                : 'text-destructive'
                            }`}
                          >
                            {Math.round(
                              message.textRenderTime - message.audioStartTime
                            )}
                            ms
                          </span>
                        </span>
                      )}
                    </div>
                  )}
              </div>
            </div>
          ))}

          {/* Processing shimmer */}
          {isProcessing && (
            <div className="flex justify-end">
              <div className="max-w-[85%] px-3 py-1.5 rounded-lg bg-primary/20 animate-pulse">
                <div className="space-y-1.5">
                  <div className="h-2.5 bg-primary/40 rounded w-3/4"></div>
                  <div className="h-2.5 bg-primary/40 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
