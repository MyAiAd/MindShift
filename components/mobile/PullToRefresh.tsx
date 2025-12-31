'use client';

import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { impactFeedback, selectionFeedback } from '@/lib/haptics';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  threshold?: number;
  maxPullDistance?: number;
  disabled?: boolean;
}

export function PullToRefresh({
  onRefresh,
  children,
  threshold = 80,
  maxPullDistance = 150,
  disabled = false,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canRefresh, setCanRefresh] = useState(false);
  
  const touchStartY = useRef(0);
  const scrollStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if we're at the top of the scroll container
  const isAtTop = () => {
    const container = containerRef.current;
    if (!container) return false;
    return container.scrollTop <= 0;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isRefreshing || !isAtTop()) return;
    
    touchStartY.current = e.touches[0].clientY;
    scrollStartY.current = containerRef.current?.scrollTop || 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || isRefreshing || !isAtTop()) return;

    const touchY = e.touches[0].clientY;
    const distance = touchY - touchStartY.current;

    // Only pull down if we're pulling from the top and moving downward
    if (distance > 0 && scrollStartY.current === 0) {
      // Apply resistance curve - gets harder to pull as distance increases
      const resistance = Math.min(distance, maxPullDistance) / 2.5;
      setPullDistance(resistance);

      // Haptic feedback at threshold
      if (resistance >= threshold && !canRefresh) {
        impactFeedback('medium');
        setCanRefresh(true);
      } else if (resistance < threshold && canRefresh) {
        selectionFeedback();
        setCanRefresh(false);
      }

      // Prevent default scrolling when pulling
      if (distance > 10) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = async () => {
    if (disabled || isRefreshing) return;

    if (canRefresh) {
      setIsRefreshing(true);
      impactFeedback('heavy');
      
      try {
        await onRefresh();
        impactFeedback('light');
      } catch (error) {
        console.error('Refresh error:', error);
      } finally {
        setIsRefreshing(false);
        setCanRefresh(false);
      }
    }

    setPullDistance(0);
    setCanRefresh(false);
  };

  // Calculate indicator opacity and rotation based on pull distance
  const indicatorOpacity = Math.min(pullDistance / threshold, 1);
  const indicatorRotation = (pullDistance / threshold) * 180;

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-y-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      aria-label="Pull down to refresh"
    >
      {/* Pull indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center z-50 pointer-events-none transition-transform duration-200"
        style={{
          transform: `translateY(${isRefreshing ? threshold : pullDistance}px)`,
          opacity: isRefreshing ? 1 : indicatorOpacity,
          height: `${threshold}px`,
        }}
        role="status"
        aria-live="polite"
        aria-label={isRefreshing ? 'Refreshing content' : canRefresh ? 'Release to refresh' : 'Pull down to refresh'}
      >
        <div
          className={`
            flex items-center justify-center
            w-10 h-10 rounded-full
            bg-card
            shadow-lg
            transition-colors duration-200
            ${canRefresh ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}
          `}
        >
          {isRefreshing ? (
            <Loader2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400 animate-spin" />
          ) : (
            <svg
              className="h-5 w-5 text-muted-foreground dark:text-muted-foreground transition-colors"
              style={{
                transform: `rotate(${indicatorRotation}deg)`,
                color: canRefresh ? 'rgb(79 70 229)' : undefined,
              }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Content with pull offset */}
      <div
        className="transition-transform duration-200"
        style={{
          transform: `translateY(${isRefreshing ? threshold : pullDistance}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
