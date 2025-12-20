'use client';

import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
            <WifiOff className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 dark:text-gray-600" strokeWidth={1.5} />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
          You're Offline
        </h1>

        {/* Description */}
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6 sm:mb-8">
          It looks like you've lost your internet connection. Don't worry, you can still access some features while offline.
        </p>

        {/* Features Available Offline */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-6 sm:mb-8 text-left">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Available Offline:
          </h2>
          <ul className="space-y-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>View previously loaded pages</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Access cached content</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Review your offline-saved data</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={handleRefresh}
            className="w-full touch-target"
            size="lg"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>

          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-500">
            We'll automatically reconnect when your internet is back
          </p>
        </div>

        {/* Online Status Indicator */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 dark:text-gray-500">
            <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-600"></div>
            <span>Connection Status: Offline</span>
          </div>
        </div>
      </div>
    </div>
  );
}
