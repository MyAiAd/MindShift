'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface LoadingStateProps {
  variant?: 'card' | 'list' | 'table' | 'profile' | 'dashboard';
  count?: number;
  className?: string;
}

export function LoadingState({ variant = 'card', count = 1, className }: LoadingStateProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <div className={cn('animate-pulse', className)} role="status" aria-live="polite" aria-label="Loading content">
      {variant === 'card' && items.map((i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-4">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-3 min-w-0">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
            </div>
          </div>
        </div>
      ))}

      {variant === 'list' && items.map((i) => (
        <div key={i} className="flex items-center space-x-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          </div>
        </div>
      ))}

      {variant === 'table' && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="p-3 text-left">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                </th>
                <th className="p-3 text-left">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                </th>
                <th className="p-3 text-left hidden sm:table-cell">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-28" />
                </th>
                <th className="p-3 text-left hidden md:table-cell">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i} className="border-b border-gray-200 dark:border-gray-700">
                  <td className="p-3">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                  </td>
                  <td className="p-3">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                  </td>
                  <td className="p-3 hidden sm:table-cell">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                  </td>
                  <td className="p-3 hidden md:table-cell">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {variant === 'profile' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6">
            <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-4 w-full">
              <div className="space-y-2">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 mx-auto sm:mx-0" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mx-auto sm:mx-0" />
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5" />
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-28" />
              </div>
            </div>
          </div>
        </div>
      )}

      {variant === 'dashboard' && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                  <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-1" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24" />
              </div>
            ))}
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-4" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0" />
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Individual skeleton components for more granular control
export function SkeletonLine({ className, width = 'full' }: { className?: string; width?: 'full' | 'half' | 'quarter' | 'three-quarter' }) {
  const widthClasses = {
    full: 'w-full',
    half: 'w-1/2',
    quarter: 'w-1/4',
    'three-quarter': 'w-3/4',
  };

  return (
    <div className={cn('h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse', widthClasses[width], className)} />
  );
}

export function SkeletonCircle({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  return (
    <div className={cn('bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse', sizeClasses[size], className)} />
  );
}

export function SkeletonButton({ className }: { className?: string }) {
  return (
    <div className={cn('h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse w-24', className)} />
  );
}
