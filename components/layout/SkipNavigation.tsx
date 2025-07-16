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
      className="skip-link"
      onClick={(e) => {
        e.preventDefault();
        skipToMainContent();
      }}
    >
      Skip to main content
    </a>
  );
} 