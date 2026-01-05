'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { ThemeId, getDefaultTheme, getThemeById, themes } from '@/lib/themes';

interface ThemeContextType {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  mode: 'light' | 'dark';
  // Glass effects
  glassEnabled: boolean;
  setGlassEnabled: (enabled: boolean) => void;
  glassIntensity: number;
  setGlassIntensity: (intensity: number) => void;
  glassAutoDisableMobile: boolean;
  setGlassAutoDisableMobile: (auto: boolean) => void;
  // Legacy compatibility
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Helper to detect mobile device
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 640 || 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(getDefaultTheme());
  const [mounted, setMounted] = useState(false);
  
  // Glass effect state
  const [glassEnabled, setGlassEnabledState] = useState(false);
  const [glassIntensity, setGlassIntensityState] = useState(1);
  const [glassAutoDisableMobile, setGlassAutoDisableMobileState] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    setMounted(true);
    
    // Try to load theme preference
    const savedTheme = localStorage.getItem('theme') as ThemeId;
    if (savedTheme && themes[savedTheme]) {
      setThemeState(savedTheme);
    } else {
      // Migration: Check old darkMode setting
      const oldDarkMode = localStorage.getItem('darkMode');
      if (oldDarkMode === 'true') {
        setThemeState('solarized-dark');
      } else if (oldDarkMode === 'false') {
        setThemeState('solarized-light');
      } else {
        // Default: use system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setThemeState(prefersDark ? 'solarized-dark' : 'solarized-light');
      }
    }
    
    // Load glass preferences
    const savedGlass = localStorage.getItem('glassEnabled');
    if (savedGlass !== null) {
      setGlassEnabledState(savedGlass === 'true');
    }

    const savedGlassIntensity = localStorage.getItem('glassIntensity');
    if (savedGlassIntensity !== null) {
      const intensity = parseFloat(savedGlassIntensity);
      if (!isNaN(intensity) && intensity >= 0.5 && intensity <= 2) {
        setGlassIntensityState(intensity);
      }
    }

    const savedGlassAutoMobile = localStorage.getItem('glassAutoDisableMobile');
    if (savedGlassAutoMobile !== null) {
      setGlassAutoDisableMobileState(savedGlassAutoMobile === 'true');
    }
  }, []);

  // Apply theme when it changes
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    const themeConfig = getThemeById(theme);

    // Remove all theme-related classes and attributes
    root.removeAttribute('data-theme');
    root.classList.remove('light', 'dark');

    // Set new theme
    root.setAttribute('data-theme', theme);
    root.classList.add(themeConfig.mode);

    // Save to localStorage
    localStorage.setItem('theme', theme);
    
    // Update old darkMode for backward compatibility
    localStorage.setItem('darkMode', (themeConfig.mode === 'dark').toString());
  }, [theme, mounted]);

  // Compute effective glass state (respects auto-disable on mobile)
  const effectiveGlassEnabled = useMemo(() => {
    if (!glassEnabled) return false;
    if (glassAutoDisableMobile && isMobileDevice()) return false;
    return true;
  }, [glassEnabled, glassAutoDisableMobile]);

  // Apply glass class when it changes
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;

    if (effectiveGlassEnabled) {
      root.classList.add('glass-enabled');
    } else {
      root.classList.remove('glass-enabled');
    }

    // Save preferences to localStorage
    localStorage.setItem('glassEnabled', String(glassEnabled));
    localStorage.setItem('glassAutoDisableMobile', String(glassAutoDisableMobile));
  }, [effectiveGlassEnabled, glassEnabled, glassAutoDisableMobile, mounted]);

  // Apply glass intensity to CSS variable
  useEffect(() => {
    if (!mounted) return;

    document.documentElement.style.setProperty('--glass-intensity', String(glassIntensity));
    localStorage.setItem('glassIntensity', String(glassIntensity));
  }, [glassIntensity, mounted]);

  const setTheme = (newTheme: ThemeId) => {
    setThemeState(newTheme);
  };

  const setGlassEnabled = (enabled: boolean) => {
    setGlassEnabledState(enabled);
  };

  const setGlassIntensity = (intensity: number) => {
    // Clamp intensity between 0.5 and 2
    const clampedIntensity = Math.max(0.5, Math.min(2, intensity));
    setGlassIntensityState(clampedIntensity);
  };

  const setGlassAutoDisableMobile = (auto: boolean) => {
    setGlassAutoDisableMobileState(auto);
  };

  // Get current theme mode
  const mode = getThemeById(theme).mode;
  const isDarkMode = mode === 'dark';

  // Legacy compatibility functions
  const toggleDarkMode = () => {
    // Toggle between light and dark variants of current theme family
    if (theme === 'solarized-dark') {
      setTheme('solarized-light');
    } else if (theme === 'solarized-light') {
      setTheme('solarized-dark');
    } else if (theme === 'gruvbox-dark') {
      setTheme('gruvbox-light');
    } else if (theme === 'gruvbox-light') {
      setTheme('gruvbox-dark');
    } else {
      // For themes without light variant, switch to solarized
      setTheme(isDarkMode ? 'solarized-light' : 'solarized-dark');
    }
  };

  const setDarkMode = (isDark: boolean) => {
    // Legacy compatibility: set to solarized variant
    setTheme(isDark ? 'solarized-dark' : 'solarized-light');
  };

  // Prevent flash of unstyled content
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        mode,
        glassEnabled,
        setGlassEnabled,
        glassIntensity,
        setGlassIntensity,
        glassAutoDisableMobile,
        setGlassAutoDisableMobile,
        isDarkMode,
        toggleDarkMode,
        setDarkMode
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
} 