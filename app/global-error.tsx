'use client';

import { useEffect, useState } from 'react';
import { forceRefreshApp } from '@/lib/client-recovery';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    console.error('App global error boundary:', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center px-4 bg-background text-foreground">
          <div className="w-full max-w-lg rounded-xl border border-red-200 bg-card p-6 text-center shadow-sm">
            <h1 className="text-xl font-semibold mb-2">App crashed</h1>
            <p className="text-sm text-muted-foreground mb-4">
              A global runtime error occurred. Reload the app to recover.
            </p>
            {error?.message ? (
              <p className="text-xs text-red-600 mb-4 break-words">{error.message}</p>
            ) : null}
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => reset()}
                className="px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-2 rounded-md bg-secondary text-foreground hover:bg-secondary/80 text-sm"
              >
                Reload
              </button>
              <button
                onClick={() => {
                  setIsRecovering(true);
                  void forceRefreshApp();
                }}
                disabled={isRecovering}
                className="px-3 py-2 rounded-md bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-60 text-sm"
              >
                {isRecovering ? 'Refreshing...' : 'Force Refresh'}
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
