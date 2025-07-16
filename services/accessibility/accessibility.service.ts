// ===============================================
// REUSABLE MYAI TEMPLATE - ACCESSIBILITY SERVICE
// ===============================================
// Comprehensive accessibility utilities for WCAG 2.1 AA compliance

import config from '@/lib/config';

export interface AccessibilityPreferences {
  highContrast: boolean;
  reducedMotion: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  keyboardNavigation: boolean;
  screenReaderOptimized: boolean;
}

export interface AriaAttributes {
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  expanded?: boolean;
  selected?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  live?: 'polite' | 'assertive' | 'off';
  atomic?: boolean;
  relevant?: 'additions' | 'removals' | 'text' | 'all';
  role?: string;
  level?: number;
  current?: 'page' | 'step' | 'location' | 'date' | 'time' | boolean;
}

export interface KeyboardNavigationOptions {
  trapFocus?: boolean;
  restoreFocus?: boolean;
  escapeToClose?: boolean;
  arrowKeyNavigation?: boolean;
  homeEndKeys?: boolean;
}

export class AccessibilityService {
  private static instance: AccessibilityService;
  private preferences: AccessibilityPreferences;
  private announcementRegion: HTMLElement | null = null;
  private focusHistory: HTMLElement[] = [];

  private constructor() {
    this.preferences = this.getStoredPreferences();
    this.initializeAccessibility();
  }

  public static getInstance(): AccessibilityService {
    if (!AccessibilityService.instance) {
      AccessibilityService.instance = new AccessibilityService();
    }
    return AccessibilityService.instance;
  }

  private initializeAccessibility() {
    if (typeof window === 'undefined') return;

    // Apply stored preferences
    this.applyPreferences();

    // Create announcement region for screen readers
    this.createAnnouncementRegion();

    // Listen for keyboard navigation
    this.setupKeyboardNavigation();

    // Setup focus management
    this.setupFocusManagement();

    // Check for prefers-reduced-motion
    this.handleReducedMotion();
  }

  private getStoredPreferences(): AccessibilityPreferences {
    if (typeof window === 'undefined') {
      return {
        highContrast: false,
        reducedMotion: false,
        fontSize: 'medium',
        keyboardNavigation: true,
        screenReaderOptimized: true,
      };
    }

    const stored = localStorage.getItem('accessibility-preferences');
    if (stored) {
      return JSON.parse(stored);
    }

    // Detect system preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;

    return {
      highContrast: prefersHighContrast,
      reducedMotion: prefersReducedMotion,
      fontSize: 'medium',
      keyboardNavigation: true,
      screenReaderOptimized: true,
    };
  }

  public updatePreferences(preferences: Partial<AccessibilityPreferences>) {
    this.preferences = { ...this.preferences, ...preferences };
    localStorage.setItem('accessibility-preferences', JSON.stringify(this.preferences));
    this.applyPreferences();
  }

  private applyPreferences() {
    const root = document.documentElement;

    // High contrast mode
    if (this.preferences.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Reduced motion
    if (this.preferences.reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }

    // Font size
    root.classList.remove('font-small', 'font-medium', 'font-large', 'font-xlarge');
    root.classList.add(`font-${this.preferences.fontSize}`);

    // Keyboard navigation highlighting
    if (this.preferences.keyboardNavigation) {
      root.classList.add('keyboard-navigation');
    } else {
      root.classList.remove('keyboard-navigation');
    }

    // Screen reader optimization
    if (this.preferences.screenReaderOptimized) {
      root.classList.add('screen-reader-optimized');
    } else {
      root.classList.remove('screen-reader-optimized');
    }
  }

  private createAnnouncementRegion() {
    if (this.announcementRegion) return;

    this.announcementRegion = document.createElement('div');
    this.announcementRegion.setAttribute('aria-live', 'polite');
    this.announcementRegion.setAttribute('aria-atomic', 'true');
    this.announcementRegion.setAttribute('aria-relevant', 'additions text');
    this.announcementRegion.className = 'sr-only';
    this.announcementRegion.id = 'accessibility-announcements';

    document.body.appendChild(this.announcementRegion);
  }

  public announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
    if (!this.announcementRegion) return;

    this.announcementRegion.setAttribute('aria-live', priority);
    this.announcementRegion.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      if (this.announcementRegion) {
        this.announcementRegion.textContent = '';
      }
    }, 1000);
  }

  private setupKeyboardNavigation() {
    document.addEventListener('keydown', (event) => {
      // Skip navigation shortcut
      if (event.key === 'Tab' && event.ctrlKey) {
        event.preventDefault();
        this.skipToMainContent();
      }

      // Focus visible indicator
      if (event.key === 'Tab') {
        document.body.classList.add('keyboard-navigation-active');
      }
    });

    document.addEventListener('mousedown', () => {
      document.body.classList.remove('keyboard-navigation-active');
    });
  }

  private setupFocusManagement() {
    // Track focus changes
    document.addEventListener('focusin', (event) => {
      if (event.target instanceof HTMLElement) {
        this.focusHistory.push(event.target);
        // Keep only last 10 focused elements
        if (this.focusHistory.length > 10) {
          this.focusHistory.shift();
        }
      }
    });
  }

  private handleReducedMotion() {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        this.updatePreferences({ reducedMotion: true });
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    handleChange(mediaQuery as any);
  }

  public skipToMainContent() {
    const mainContent = document.querySelector('main, [role="main"], #main-content');
    if (mainContent instanceof HTMLElement) {
      mainContent.focus();
      mainContent.scrollIntoView({ behavior: 'smooth' });
      this.announce('Skipped to main content');
    }
  }

  public generateAriaAttributes(options: AriaAttributes): Record<string, any> {
    const attrs: Record<string, any> = {};

    if (options.label) attrs['aria-label'] = options.label;
    if (options.labelledBy) attrs['aria-labelledby'] = options.labelledBy;
    if (options.describedBy) attrs['aria-describedby'] = options.describedBy;
    if (options.expanded !== undefined) attrs['aria-expanded'] = options.expanded;
    if (options.selected !== undefined) attrs['aria-selected'] = options.selected;
    if (options.disabled !== undefined) attrs['aria-disabled'] = options.disabled;
    if (options.hidden !== undefined) attrs['aria-hidden'] = options.hidden;
    if (options.live) attrs['aria-live'] = options.live;
    if (options.atomic !== undefined) attrs['aria-atomic'] = options.atomic;
    if (options.relevant) attrs['aria-relevant'] = options.relevant;
    if (options.role) attrs['role'] = options.role;
    if (options.level) attrs['aria-level'] = options.level;
    if (options.current !== undefined) attrs['aria-current'] = options.current;

    return attrs;
  }

  public setupFocusTrap(container: HTMLElement, options: KeyboardNavigationOptions = {}) {
    const focusableSelectors = [
      'button:not([disabled])',
      '[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ');

    const focusableElements = container.querySelectorAll(focusableSelectors) as NodeListOf<HTMLElement>;
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!options.trapFocus) return;

      if (event.key === 'Tab') {
        if (event.shiftKey) {
          if (document.activeElement === firstFocusable) {
            event.preventDefault();
            lastFocusable.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            event.preventDefault();
            firstFocusable.focus();
          }
        }
      }

      if (event.key === 'Escape' && options.escapeToClose) {
        event.preventDefault();
        this.restoreFocus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    // Focus first element
    if (firstFocusable) {
      firstFocusable.focus();
    }

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }

  public restoreFocus() {
    const lastFocused = this.focusHistory[this.focusHistory.length - 2];
    if (lastFocused && document.body.contains(lastFocused)) {
      lastFocused.focus();
    }
  }

  public checkColorContrast(foreground: string, background: string): {
    ratio: number;
    level: 'AA' | 'AAA' | 'fail';
  } {
    const getLuminance = (color: string): number => {
      const rgb = parseInt(color.replace('#', ''), 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = (rgb >> 0) & 0xff;

      const sRGB = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });

      return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
    };

    const l1 = getLuminance(foreground);
    const l2 = getLuminance(background);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

    let level: 'AA' | 'AAA' | 'fail' = 'fail';
    if (ratio >= 7) level = 'AAA';
    else if (ratio >= 4.5) level = 'AA';

    return { ratio, level };
  }

  public getPreferences(): AccessibilityPreferences {
    return { ...this.preferences };
  }

  public isEnabled(): boolean {
    return config.features.accessibilityCompliance;
  }
}

// Export utilities for easy use
export const accessibility = AccessibilityService.getInstance();

// React hooks
export const useAccessibility = () => {
  const service = AccessibilityService.getInstance();
  return {
    preferences: service.getPreferences(),
    updatePreferences: service.updatePreferences.bind(service),
    announce: service.announce.bind(service),
    skipToMainContent: service.skipToMainContent.bind(service),
    generateAriaAttributes: service.generateAriaAttributes.bind(service),
    setupFocusTrap: service.setupFocusTrap.bind(service),
    restoreFocus: service.restoreFocus.bind(service),
    checkColorContrast: service.checkColorContrast.bind(service),
    isEnabled: service.isEnabled.bind(service),
  };
}; 