'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Bug } from 'lucide-react';
import { TreatmentMessage } from './shared/types';
import { getResolverTelemetry } from '@/lib/v9/static-audio-resolver';

/**
 * V9 AdminDebugDrawer.
 *
 * Direct port of `components/treatment/v7/AdminDebugDrawer.tsx` (R2).
 * Changes from V7:
 *  - Imports `TreatmentMessage` from `./shared/types` (V9's types file)
 *  - Optional `voicePair` prop displays the pinned STT/TTS pair from
 *    `v9HandleStartSession`'s `startJson.voicePair` (R9 / Technical
 *    Considerations > Admin drawer surface).
 *  - Optional static-audio telemetry panel (R13.4) surfaces the hash
 *    resolver's hit/miss counts for the current session.
 *
 * Admin-only gating (R2: "returns null unless super_admin or
 * tenant_admin") is enforced by the parent (`TreatmentSession`)
 * wrapping the render in an `isAdmin` check — same pattern V7 uses.
 * The drawer itself does not re-check `profile.role` to keep the
 * component a pure view.
 *
 * Keyboard shortcut: `Ctrl+Shift+D` / `Cmd+Shift+D` (unchanged).
 * Theme tokens: already compliant — `bg-card/95`, `bg-primary`,
 * `text-muted-foreground`, etc. No raw Tailwind colors were present
 * in the V7 source, so none were introduced.
 */

export interface AdminDebugDrawerVoicePair {
  stt: string;
  tts: string;
}

interface AdminDebugDrawerProps {
  messages: TreatmentMessage[];
  isProcessing: boolean;
  isOpen: boolean;
  onToggle: () => void;
  /** R9: pinned voice pair for this session (from startJson.voicePair). */
  voicePair?: AdminDebugDrawerVoicePair | null;
  /**
   * R13.4: opt-in telemetry surface. When true, the drawer reads the
   * resolver's in-memory counters via `getResolverTelemetry()` and
   * shows hit-rate alongside the debug log. Defaults to false so the
   * drawer can be rendered in contexts where the resolver isn't wired
   * (e.g. the R14 visual-regression tests).
   */
  showAudioTelemetry?: boolean;
}

export default function AdminDebugDrawer({
  messages,
  isProcessing,
  isOpen,
  onToggle,
  voicePair = null,
  showAudioTelemetry = false,
}: AdminDebugDrawerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 80;
    isNearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

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

  // Re-read telemetry every time the drawer opens or messages change.
  // The resolver's counter is session-scoped in-memory; a simple
  // re-read on render is cheap and avoids a subscription API.
  const telemetry = showAudioTelemetry ? getResolverTelemetry() : null;
  const telemetryTotal = telemetry
    ? telemetry.hitsV9 + telemetry.hitsV7 + telemetry.misses
    : 0;
  const telemetryHitRate = telemetry && telemetryTotal > 0
    ? Math.round(((telemetry.hitsV9 + telemetry.hitsV7) / telemetryTotal) * 100)
    : 0;

  return (
    <>
      {/* Edge tab — always visible when drawer is closed, attached to drawer when open */}
      <button
        onClick={onToggle}
        className={`fixed top-1/2 -translate-y-1/2 z-40 flex items-center gap-1 py-3 px-1.5 rounded-l-md border border-r-0 border-border/50 bg-card/80 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-card transition-all duration-300 ${
          isOpen ? 'right-80 sm:right-96' : 'right-0'
        }`}
        aria-label={isOpen ? 'Close debug panel' : 'Open debug panel'}
        data-testid="v9-admin-drawer-toggle"
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
        data-testid="v9-admin-drawer-panel"
      >
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bug className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                V9 Debug Log
              </span>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {messages.length} msgs
            </span>
          </div>

          {/* R9: pinned voice-pair panel */}
          {voicePair ? (
            <div
              className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground font-mono"
              data-testid="v9-admin-voice-pair"
            >
              <span className="opacity-60">Voice:</span>
              <span className="text-foreground">
                {voicePair.stt} <span className="opacity-60">→</span>{' '}
                {voicePair.tts}
              </span>
            </div>
          ) : null}

          {/* R13.4: static-audio telemetry panel */}
          {telemetry ? (
            <div
              className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground font-mono"
              data-testid="v9-admin-audio-telemetry"
            >
              <span className="opacity-60">Audio:</span>
              <span>
                V9 <span className="text-foreground">{telemetry.hitsV9}</span>
              </span>
              <span>
                V7 <span className="text-foreground">{telemetry.hitsV7}</span>
              </span>
              <span>
                miss <span className="text-foreground">{telemetry.misses}</span>
              </span>
              <span className="ml-auto opacity-60">{telemetryHitRate}% hit</span>
            </div>
          ) : null}
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
