'use client';

import React, { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import TreatmentSession from '@/components/treatment/v5/TreatmentSession';
import { Brain, ArrowLeft, BarChart3 } from 'lucide-react';
import Link from 'next/link';

// Dynamic import for audio preloader
const V5AudioPreloader = dynamic(() => import('@/components/treatment/v5/V5AudioPreloader'), {
  ssr: false,
  loading: () => null,
});

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
    console.error('Treatment V5 render error:', error, info);
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

function TreatmentSessionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [sessionId, setSessionId] = useState<string>('');
  const [shouldResume, setShouldResume] = useState<boolean>(false);
  const [selectedVoice, setSelectedVoice] = useState<string>('heart');

  // Load voice preference from localStorage and listen for changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedVoice = localStorage.getItem('v5_selected_voice') || 'heart';
      setSelectedVoice(savedVoice);

      // Listen for voice changes from TreatmentSession settings (same-tab)
      const handleVoiceChange = (e: CustomEvent<string>) => {
        console.log('🎵 Voice changed to:', e.detail);
        setSelectedVoice(e.detail);
      };

      // Listen for storage changes (cross-tab)
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === 'v5_selected_voice' && e.newValue) {
          console.log('🎵 Voice changed (storage) to:', e.newValue);
          setSelectedVoice(e.newValue);
        }
      };

      window.addEventListener('v5-voice-changed', handleVoiceChange as EventListener);
      window.addEventListener('storage', handleStorageChange);
      return () => {
        window.removeEventListener('v5-voice-changed', handleVoiceChange as EventListener);
        window.removeEventListener('storage', handleStorageChange);
      };
    }
  }, []);

  useEffect(() => {
    const id = searchParams.get('sessionId');
    const resumeFlag = searchParams.get('resume') === 'true';
    
    if (!id) {
      // Generate a new session ID if none provided
      const newSessionId = `session-v5-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      router.replace(`/dashboard/sessions/treatment-v5?sessionId=${newSessionId}`);
    } else {
      setSessionId(id);
      setShouldResume(resumeFlag);
      
      // Clean up the URL by removing the resume parameter after we've captured it
      if (resumeFlag) {
        const newUrl = `/dashboard/sessions/treatment-v5?sessionId=${id}`;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [searchParams, router]);

  const handleSessionComplete = (sessionData: any) => {
    console.log('V5 Session completed:', sessionData);
    // You could show a completion modal or redirect
    setTimeout(() => {
      router.push('/dashboard/sessions?completed=true&version=v5');
    }, 3000);
  };

  const handleSessionError = (error: string) => {
    console.error('V5 Session error:', error);
    // You could show an error modal or redirect
    alert(`V5 Session error: ${error}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-muted-foreground ">Loading V5...</span>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground  mb-4">Authentication Required</h1>
          <p className="text-muted-foreground ">Please sign in to access V5 treatment sessions.</p>
          <Link href="/auth" className="mt-4 inline-block text-primary hover:text-primary/80">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-muted-foreground ">Initializing V5 session...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/20">
      {/* V5 Audio Preloader - loads static audio for selected voice */}
      <V5AudioPreloader voice={selectedVoice} />
      
      {/* Header - Compact, fixed */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
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

      {/* Spacer for fixed header */}
      <div className="h-14"></div>

      {/* Treatment Session Component - minimal top padding on mobile */}
      <div className="py-2 md:py-8">
        <SessionErrorBoundary>
          <TreatmentSession
            sessionId={sessionId}
            userId={user.id}
            shouldResume={shouldResume}
            onComplete={handleSessionComplete}
            onError={handleSessionError}
            version="v5"
          />
        </SessionErrorBoundary>
      </div>
    </div>
  );
}

export default function TreatmentSessionV5Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-muted-foreground ">Loading V5...</span>
      </div>
    }>
      <TreatmentSessionContent />
    </Suspense>
  );
} 