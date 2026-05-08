'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  forceRefreshApp,
  getRecoveryErrorMessage,
  hasAutoRecoveryAttempted,
  isChunkLoadLikeError,
  markAutoRecoveryAttempted,
} from '@/lib/client-recovery';

type RuntimeBoundaryState = {
  hasError: boolean;
  errorMessage: string;
};

class RuntimeBoundary extends React.Component<{ children: React.ReactNode }, RuntimeBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): RuntimeBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected app render error',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App runtime boundary caught error:', error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return <RuntimeCrashFallback errorMessage={this.state.errorMessage} />;
  }
}

function RuntimeCrashFallback({ errorMessage }: { errorMessage: string }) {
  const [isRecovering, setIsRecovering] = useState(false);

  const handleForceRefresh = useCallback(async () => {
    setIsRecovering(true);
    await forceRefreshApp();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background text-foreground">
      <div className="w-full max-w-lg rounded-xl border border-red-200 bg-card p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
        <p className="text-sm text-muted-foreground mb-4">
          The app hit a runtime error. Please reload the page. If this keeps happening, use Force
          Refresh to clear cached files.
        </p>
        {errorMessage ? (
          <p className="text-xs text-red-600 mb-4 break-words">{errorMessage}</p>
        ) : null}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
          >
            Reload
          </button>
          <button
            onClick={() => {
              void handleForceRefresh();
            }}
            disabled={isRecovering}
            className="px-3 py-2 rounded-md bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-60 text-sm"
          >
            {isRecovering ? 'Refreshing...' : 'Force Refresh'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppRuntimeGuard({ children }: { children: React.ReactNode }) {
  const [isRecovering, setIsRecovering] = useState(false);

  const attemptAutoRecovery = useCallback(async (reason: unknown) => {
    if (hasAutoRecoveryAttempted()) return;

    markAutoRecoveryAttempted();
    setIsRecovering(true);
    console.warn('Auto runtime recovery triggered:', getRecoveryErrorMessage(reason));
    await forceRefreshApp();
  }, []);

  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      if (isChunkLoadLikeError(event.error || event.message)) {
        void attemptAutoRecovery(event.error || event.message);
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadLikeError(event.reason)) {
        void attemptAutoRecovery(event.reason);
      }
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [attemptAutoRecovery]);

  return (
    <>
      {isRecovering ? (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white text-xs text-center py-2">
          Recovering from an app update issue...
        </div>
      ) : null}
      <RuntimeBoundary>{children}</RuntimeBoundary>
    </>
  );
}
