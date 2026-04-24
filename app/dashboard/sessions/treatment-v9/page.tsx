'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth';
import TreatmentSession from '@/components/treatment/v9/TreatmentSession';
import { getVoicePreferences } from '@/lib/v9/v9-preferences';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// R13.2: the static-audio preloader runs client-only so we can fetch
// manifests and populate `globalAudioCache` before the first bubble
// lands. Dynamic import keeps the preloader out of the SSR bundle.
const V9AudioPreloader = dynamic(
  () => import('@/components/treatment/v9/V9AudioPreloader'),
  { ssr: false },
);

/**
 * Resolve the pinned voice the same way TreatmentSession does so the
 * preloader asks the resolver for the exact manifest it will need.
 * Mirrors the logic in `TreatmentSession.tsx` (see R5/R6 block).
 */
function resolveInitialVoice(): string {
  if (typeof window === 'undefined') return 'marin';
  const explicit = window.localStorage.getItem('v9_voice_id');
  if (explicit) return explicit;
  const legacy = window.localStorage.getItem('v9_selected_voice');
  if (legacy) return legacy;
  const envDefault =
    process.env.NEXT_PUBLIC_V9_DEFAULT_VOICE ??
    process.env.NEXT_PUBLIC_V7_DEFAULT_VOICE;
  if (envDefault) return envDefault;
  return 'marin';
}

/**
 * V9 treatment session page. Wires the v9 TreatmentSession component to
 * the logged-in user and to /api/treatment-v9. V9 is a voice adapter
 * around v2's state machine; see docs/v9-voice-clone.md for the full
 * rationale.
 */

class SessionErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unknown render error',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Treatment V9 render error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-destructive/30 bg-card p-5 text-center">
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Session failed to render
          </h2>
          {this.state.errorMessage ? (
            <p className="text-xs text-destructive mb-4 break-words">
              {this.state.errorMessage}
            </p>
          ) : null}
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

function TreatmentSessionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [sessionId, setSessionId] = useState<string>('');
  const [shouldResume, setShouldResume] = useState<boolean>(false);

  // R13.2: resolve the pinned voice once at mount; re-render-triggered
  // changes are fine because the preloader is idempotent per voice.
  const [preloadVoice, setPreloadVoice] = useState<string>('marin');
  useEffect(() => {
    setPreloadVoice(resolveInitialVoice());
    // Warm `globalAudioCache` aggressively only if the user has the
    // speaker on. Cuts first-message TTS latency and keeps unused
    // audio off mobile data plans.
    const prefs = getVoicePreferences();
    if (!prefs.speakerEnabled) {
      // Still load the manifest index (cheap, ~10KB) so resolver
      // telemetry is populated in the admin drawer. But skip the
      // preloader's per-clip fetch by not mounting it below. A future
      // change could decouple manifest loading from clip preloading.
    }
  }, []);

  useEffect(() => {
    const id = searchParams.get('sessionId');
    const resumeFlag = searchParams.get('resume') === 'true';

    if (!id) {
      const newSessionId = `session-v9-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      router.replace(`/dashboard/sessions/treatment-v9?sessionId=${newSessionId}`);
      return;
    }

    setSessionId(id);
    setShouldResume(resumeFlag);

    if (resumeFlag) {
      window.history.replaceState(
        {},
        '',
        `/dashboard/sessions/treatment-v9?sessionId=${id}`,
      );
    }
  }, [searchParams, router]);

  const handleSessionComplete = (sessionData: unknown) => {
    console.log('V9 session completed:', sessionData);
    setTimeout(() => {
      router.push('/dashboard/sessions?completed=true&version=v9');
    }, 3000);
  };

  const handleSessionError = (error: string) => {
    console.error('V9 session error:', error);
    alert(`V9 session error: ${error}`);
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-muted-foreground">Loading V9...</span>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">
            Authentication Required
          </h1>
          <p className="text-muted-foreground">
            Please sign in to access V9 treatment sessions.
          </p>
          <Link
            href="/auth"
            className="mt-4 inline-block text-primary hover:text-primary/80"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-muted-foreground">Initializing V9 session…</span>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-secondary/20">
      <div className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border pt-safe">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center space-x-3">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <span className="text-base font-semibold text-foreground">Shifting</span>
          </div>
        </div>
      </div>

      <div className="h-header-safe"></div>

      {/* R13.2: mount the preloader alongside the session so manifests
          load in parallel with the backend's `action: 'start'` call.
          Preloader returns null and cancels fetches on unmount. */}
      <V9AudioPreloader voice={preloadVoice} />

      <div className="py-2 md:py-8">
        <SessionErrorBoundary>
          <TreatmentSession
            sessionId={sessionId}
            userId={user.id}
            shouldResume={shouldResume}
            onComplete={handleSessionComplete}
            onError={handleSessionError}
          />
        </SessionErrorBoundary>
      </div>
    </div>
  );
}

export default function TreatmentSessionV9Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2 text-muted-foreground">Loading V9…</span>
        </div>
      }
    >
      <TreatmentSessionContent />
    </Suspense>
  );
}
