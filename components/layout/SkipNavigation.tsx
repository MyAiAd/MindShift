// ===============================================
// SKIP NAVIGATION COMPONENT
// ===============================================
// Provides keyboard users with a way to skip to main content

'use client';

import { useAccessibility } from '@/services/accessibility/accessibility.service';

export default function SkipNavigation() {
  const { skipToMainContent, isEnabled } = useAccessibility();

  if (!isEnabled()) return null;

  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-indigo-600 focus:text-white focus:font-medium focus:text-sm focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200"
      onClick={(e) => {
        e.preventDefault();
        skipToMainContent();
      }}
    >
      Skip to main content
    </a>
  );
} 