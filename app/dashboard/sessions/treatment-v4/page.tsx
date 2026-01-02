'use client';

import React, { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import TreatmentSession from '@/components/treatment/v4/TreatmentSession';
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
  const [selectedVoice, setSelectedVoice] = useState<string>('rachel');

  // Load voice preference from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedVoice = localStorage.getItem('v4_selected_voice') || 'rachel';
      setSelectedVoice(savedVoice);
    }
  }, []);

  useEffect(() => {
    const id = searchParams.get('sessionId');
    const resumeFlag = searchParams.get('resume') === 'true';
    
    if (!id) {
      // Generate a new session ID if none provided
      const newSessionId = `session-v4-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      router.replace(`/dashboard/sessions/treatment-v4?sessionId=${newSessionId}`);
    } else {
      setSessionId(id);
      setShouldResume(resumeFlag);
      
      // Clean up the URL by removing the resume parameter after we've captured it
      if (resumeFlag) {
        const newUrl = `/dashboard/sessions/treatment-v4?sessionId=${id}`;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [searchParams, router]);

  const handleSessionComplete = (sessionData: any) => {
    console.log('V4 Session completed:', sessionData);
    // You could show a completion modal or redirect
    setTimeout(() => {
      router.push('/dashboard/sessions?completed=true&version=v4');
    }, 3000);
  };

  const handleSessionError = (error: string) => {
    console.error('V4 Session error:', error);
    // You could show an error modal or redirect
    alert(`V4 Session error: ${error}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-muted-foreground dark:text-[#93a1a1]">Loading V3...</span>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground dark:text-[#fdf6e3] mb-4">Authentication Required</h1>
          <p className="text-muted-foreground dark:text-[#93a1a1]">Please sign in to access V4 treatment sessions.</p>
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
        <span className="ml-2 text-muted-foreground dark:text-[#93a1a1]">Initializing V4 session...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/20 dark:bg-[#002b36]">
      {/* V4 Audio Preloader - loads static audio for selected voice */}
      <V4AudioPreloader voice={selectedVoice} />
      
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
          version="v4"
        />
      </div>
    </div>
  );
}

export default function TreatmentSessionV4Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-muted-foreground dark:text-[#93a1a1]">Loading V3...</span>
      </div>
    }>
      <TreatmentSessionContent />
    </Suspense>
  );
} 