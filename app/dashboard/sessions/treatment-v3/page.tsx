'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import TreatmentSession from '@/components/treatment/v3/TreatmentSession';
import { Brain, ArrowLeft, BarChart3, Zap } from 'lucide-react';
import Link from 'next/link';

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
      const newSessionId = `session-v3-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      router.replace(`/dashboard/sessions/treatment-v3?sessionId=${newSessionId}`);
    } else {
      setSessionId(id);
      setShouldResume(resumeFlag);
      
      // Clean up the URL by removing the resume parameter after we've captured it
      if (resumeFlag) {
        const newUrl = `/dashboard/sessions/treatment-v3?sessionId=${id}`;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [searchParams, router]);

  const handleSessionComplete = (sessionData: any) => {
    console.log('V3 Session completed:', sessionData);
    // You could show a completion modal or redirect
    setTimeout(() => {
      router.push('/dashboard/sessions?completed=true&version=v3');
    }, 3000);
  };

  const handleSessionError = (error: string) => {
    console.error('V3 Session error:', error);
    // You could show an error modal or redirect
    alert(`V3 Session error: ${error}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-300">Loading V3...</span>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Authentication Required</h1>
          <p className="text-gray-600 dark:text-gray-300">Please sign in to access V3 treatment sessions.</p>
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
        <span className="ml-2 text-gray-600 dark:text-gray-300">Initializing V3 session...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link 
                href="/dashboard/sessions"
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="flex items-center space-x-2">
                <Brain className="h-6 w-6 text-indigo-600" />
                <span className="text-lg font-semibold text-gray-900 dark:text-white">Treatment Session V3</span>
                <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400 rounded-full flex items-center space-x-1">
                  <Zap className="h-3 w-3" />
                  <span>V3</span>
                </span>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                ID: {sessionId.slice(-8)}
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link 
                href="/dashboard/sessions/analytics"
                className="text-gray-500 hover:text-indigo-600 transition-colors flex items-center space-x-1"
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
          version="v3"
        />
      </div>

      {/* Performance Info Footer - Updated for V3 */}
      <div className="fixed bottom-24 left-0 right-0 md:left-64 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 px-4 py-2 z-20">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-4">
              <span className="flex items-center space-x-1">
                <Zap className="h-3 w-3 text-orange-500" />
                <span>V3 Enhanced Architecture</span>
              </span>
              <span>•</span>
              <span>Advanced State Management</span>
              <span>•</span>
              <span>Improved Validation</span>
            </div>
            <div className="flex items-center space-x-4">
              <span>Target: &lt;150ms Response</span>
              <span>•</span>
              <span>Enhanced Therapeutic Protocols</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TreatmentSessionV3Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-300">Loading V3...</span>
      </div>
    }>
      <TreatmentSessionContent />
    </Suspense>
  );
} 