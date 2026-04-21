'use client';

import React, { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import TreatmentSession from '@/components/treatment/v7/TreatmentSession';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// Track B (Realtime speech-to-speech) was evaluated in
// docs/v7-pipeline-decision.md and removed on 2026-04-21 in favour of the
// request/response pipeline (Track A) with the pinned marin voice. The
// feature-flag plumbing, the V7RealtimeSession shell, the
// /api/treatment-v7/realtime-session route, and the VAD tuner were all
// deleted in the same commit.

const V7AudioPreloader = dynamic(
  () => import('@/components/treatment/v7/V7AudioPreloader'),
  {
    ssr: false,
    loading: () => null,
  }
);

class SessionErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error?.message || 'Unknown render error' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Treatment V7 render error:', error, info);
  }

  handleForceReload = async () => {
    if (typeof window === 'undefined') return;

    try {
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(cacheKey => caches.delete(cacheKey)));
      }
    } catch (error) {
      console.warn('Force reload cache clear failed:', error);
    } finally {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-destructive/30 bg-card p-5 text-center">
          <h2 className="text-lg font-semibold text-foreground mb-2">Session failed to render</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Please reload the page. If the issue persists, use Force Refresh.
          </p>
          {this.state.errorMessage && (
            <p className="text-xs text-destructive mb-4 break-words">{this.state.errorMessage}</p>
          )}
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm"
            >
              Reload
            </button>
            <button
              onClick={() => {
                void this.handleForceReload();
              }}
              className="px-3 py-2 rounded-md bg-secondary text-foreground hover:bg-secondary/80 text-sm"
            >
              Force Refresh
            </button>
          </div>
        </div>
      </div>
    );
  }
}

function resolveInitialVoice(): string {
  if (typeof window === 'undefined') return 'marin';
  const explicit = window.localStorage.getItem('v7_voice_id');
  if (explicit) return explicit;
  const legacy = window.localStorage.getItem('v7_selected_voice');
  if (legacy) return legacy;
  const envDefault = process.env.NEXT_PUBLIC_V7_DEFAULT_VOICE;
  if (envDefault) return envDefault;
  return 'marin';
}

function TreatmentSessionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [sessionId, setSessionId] = useState<string>('');
  const [shouldResume, setShouldResume] = useState<boolean>(false);
  const [selectedVoice, setSelectedVoice] = useState<string>('marin');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setSelectedVoice(resolveInitialVoice());

    const handleVoiceChange = (e: CustomEvent<string>) => {
      if (typeof e.detail === 'string' && e.detail.length > 0) {
        setSelectedVoice(e.detail);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if ((e.key === 'v7_selected_voice' || e.key === 'v7_voice_id') && e.newValue) {
        setSelectedVoice(e.newValue);
      }
    };

    window.addEventListener('v7-voice-changed', handleVoiceChange as EventListener);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('v7-voice-changed', handleVoiceChange as EventListener);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    const id = searchParams.get('sessionId');
    const resumeFlag = searchParams.get('resume') === 'true';

    if (!id) {
      const newSessionId = `session-v7-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      router.replace(`/dashboard/sessions/treatment-v7?sessionId=${newSessionId}`);
      return;
    }

    setSessionId(id);
    setShouldResume(resumeFlag);

    if (resumeFlag) {
      const newUrl = `/dashboard/sessions/treatment-v7?sessionId=${id}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [searchParams, router]);

  const handleSessionComplete = (sessionData: any) => {
    console.log('V7 session completed:', sessionData);
    setTimeout(() => {
      router.push('/dashboard/sessions?completed=true&version=v7');
    }, 3000);
  };

  const handleSessionError = (error: string) => {
    console.error('V7 session error:', error);
    alert(`V7 session error: ${error}`);
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-muted-foreground">Loading V7...</span>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Authentication Required</h1>
          <p className="text-muted-foreground">Please sign in to access V7 treatment sessions.</p>
          <Link href="/auth" className="mt-4 inline-block text-primary hover:text-primary/80">
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
        <span className="ml-2 text-muted-foreground">Initializing V7 session...</span>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-secondary/20">
      <V7AudioPreloader voice={selectedVoice} />

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

      <div className="py-2 md:py-8">
        <SessionErrorBoundary>
          <TreatmentSession
            sessionId={sessionId}
            userId={user.id}
            shouldResume={shouldResume}
            onComplete={handleSessionComplete}
            onError={handleSessionError}
            version="v7"
          />
        </SessionErrorBoundary>
      </div>
    </div>
  );
}

export default function TreatmentSessionV7Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2 text-muted-foreground">Loading V7...</span>
        </div>
      }
    >
      <TreatmentSessionContent />
    </Suspense>
  );
}
