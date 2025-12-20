'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SkipToContentProps {
  targetId?: string;
  className?: string;
}

export function SkipToContent({ 
  targetId = 'main-content',
  className 
}: SkipToContentProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className={cn(
        // Visually hidden by default
        'sr-only focus:not-sr-only',
        // When focused, show it
        'focus:fixed focus:top-4 focus:left-4 focus:z-[9999]',
        'focus:px-4 focus:py-2 focus:rounded-lg',
        'focus:bg-indigo-600 focus:text-white',
        'focus:font-medium focus:text-sm',
        'focus:shadow-lg focus:outline-none',
        'focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
        // Smooth transition
        'transition-all duration-200',
        className
      )}
    >
      Skip to main content
    </a>
  );
}

export default SkipToContent;
