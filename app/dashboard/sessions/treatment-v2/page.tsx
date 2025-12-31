'use client';

import React, { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import TreatmentSession from '@/components/treatment/v2/TreatmentSession';
import { Brain, ArrowLeft, BarChart3 } from 'lucide-react';
import Link from 'next/link';

// Dynamic import for audio preloader
const V4AudioPreloader = dynamic(() => import('@/components/treatment/v4/V4AudioPreloader'), {
  ssr: false,
  loading: () => null,
});

function TreatmentSessionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [sessionId, setSessionId] = useState<string>('');
  const [shouldResume, setShouldResume] = useState<boolean>(false);

  useEffect(() => {
    const id = searchParams.get('sessionId');
    const resumeFlag = searchParams.get('resume') === 'true';
    
    if (!id) {
      // Generate a new session ID if none provided
      const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      router.replace(`/dashboard/sessions/treatment-v2?sessionId=${newSessionId}`);
    } else {
      setSessionId(id);
      setShouldResume(resumeFlag);
      
      // Clean up the URL by removing the resume parameter after we've captured it
      if (resumeFlag) {
        const newUrl = `/dashboard/sessions/treatment-v2?sessionId=${id}`;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [searchParams, router]);

  const handleSessionComplete = (sessionData: any) => {
    console.log('Session completed:', sessionData);
    // You could show a completion modal or redirect
    setTimeout(() => {
      router.push('/dashboard/sessions?completed=true');
    }, 3000);
  };

  const handleSessionError = (error: string) => {
    console.error('Session error:', error);
    // You could show an error modal or redirect
    alert(`Session error: ${error}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-muted-foreground dark:text-[#93a1a1]">Loading...</span>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
                      <h1 className="text-2xl font-bold text-foreground dark:text-[#fdf6e3] mb-4">Authentication Required</h1>
          <p className="text-muted-foreground dark:text-[#93a1a1]">Please sign in to access treatment sessions.</p>
          <Link href="/auth" className="mt-4 inline-block text-indigo-600 hover:text-indigo-700">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-muted-foreground dark:text-[#93a1a1]">Initializing session...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/20 dark:bg-[#002b36]">
      {/* V4 Audio Preloader */}
      <V4AudioPreloader />
      
      {/* Header */}
      <div className="bg-card dark:bg-[#073642] border-b border-border dark:border-[#586e75]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link 
                href="/dashboard/sessions"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="flex items-center space-x-2">
                <Brain className="h-6 w-6 text-indigo-600" />
                <span className="text-lg font-semibold text-foreground dark:text-[#fdf6e3]">Treatment Session</span>
              </div>
              <span className="text-sm text-muted-foreground dark:text-[#93a1a1] bg-secondary dark:bg-[#586e75] px-2 py-1 rounded">
                ID: {sessionId.slice(-8)}
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link 
                href="/dashboard/sessions/analytics"
                className="text-muted-foreground hover:text-indigo-600 transition-colors flex items-center space-x-1"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="text-sm">Analytics</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Treatment Session Component */}
      <div className="py-8">
        <TreatmentSession
          sessionId={sessionId}
          userId={user.id}
          shouldResume={shouldResume}
          onComplete={handleSessionComplete}
          onError={handleSessionError}
        />
      </div>

      {/* Performance Info Footer */}
      <div className="fixed bottom-24 left-0 right-0 md:left-64 bg-card/90 dark:bg-[#002b36]/90 backdrop-blur-sm border-t border-border dark:border-[#586e75] px-4 py-2 z-20">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between text-xs text-muted-foreground dark:text-[#839496]">
            <div className="flex items-center space-x-4">
              <span>Automation-First Architecture</span>
              <span>•</span>
              <span>95% Scripted Responses</span>
              <span>•</span>
              <span>5% AI Assistance</span>
            </div>
            <div className="flex items-center space-x-4">
              <span>Target: &lt;200ms Response</span>
              <span>•</span>
              <span>Cost: &lt;$0.05/session</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TreatmentSessionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-muted-foreground dark:text-[#93a1a1]">Loading...</span>
      </div>
    }>
      <TreatmentSessionContent />
    </Suspense>
  );
} 