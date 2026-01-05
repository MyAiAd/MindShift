'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/lib/theme';
import { themes, ThemeId } from '@/lib/themes';
import { Sun, Moon, Palette, Check, Settings, Sparkles } from 'lucide-react';
import Link from 'next/link';

export function ThemeDropdown() {
  const { theme, setTheme, mode, glassEnabled, setGlassEnabled } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleThemeSelect = (themeId: ThemeId) => {
    setTheme(themeId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-accent transition-colors touch-target"
        aria-label="Change theme"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {mode === 'dark' ? (
          <Moon className="h-5 w-5 text-foreground" />
        ) : (
          <Sun className="h-5 w-5 text-foreground" />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-72 bg-card border border-border rounded-lg shadow-xl overflow-hidden z-50"
          role="menu"
          aria-orientation="vertical"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-border bg-secondary/20">
            <div className="flex items-center space-x-2">
              <Palette className="h-4 w-4 text-primary" />
              <span className="font-semibold text-foreground">Select Theme</span>
            </div>
          </div>

          {/* Glass Effects Toggle */}
          <div className="px-4 py-3 border-b border-border">
            <button
              onClick={() => setGlassEnabled(!glassEnabled)}
              className="w-full flex items-center justify-between hover:bg-accent/50 -mx-2 px-2 py-1.5 rounded-md transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-8 h-8 rounded">
                  <Sparkles className={`h-4 w-4 ${glassEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="text-left">
                  <div className="font-medium text-foreground text-sm">Glass Effects</div>
                  <div className="text-xs text-muted-foreground">Frosted blur & glow</div>
                </div>
              </div>
              <div className={`w-9 h-5 rounded-full transition-colors relative ${
                glassEnabled ? 'bg-primary' : 'bg-secondary'
              }`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  glassEnabled ? 'translate-x-4' : 'translate-x-0.5'
                }`} />
              </div>
            </button>
          </div>

          {/* Theme List */}
          <div className="max-h-96 overflow-y-auto">
            {Object.values(themes).map((themeOption) => (
              <button
                key={themeOption.id}
                onClick={() => handleThemeSelect(themeOption.id)}
                className={`w-full px-4 py-3 flex items-center justify-between hover:bg-accent transition-colors text-left ${
                  theme === themeOption.id ? 'bg-accent/50' : ''
                }`}
                role="menuitem"
              >
                <div className="flex items-center space-x-3">
                  {/* Theme Icon */}
                  <div className="flex items-center justify-center w-8 h-8 rounded">
                    {themeOption.mode === 'dark' ? (
                      <Moon className="h-4 w-4 text-foreground" />
                    ) : (
                      <Sun className="h-4 w-4 text-foreground" />
                    )}
                  </div>

                  {/* Theme Info */}
                  <div className="text-left flex-1 min-w-0">
                    <div className="font-medium text-foreground text-sm">
                      {themeOption.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {themeOption.description}
                    </div>
                  </div>
                </div>

                {/* Color Preview + Check */}
                <div className="flex items-center space-x-2 flex-shrink-0">
                  {/* Color Dots */}
                  <div className="flex space-x-1">
                    <div
                      className="w-3 h-3 rounded-full border border-border"
                      style={{ backgroundColor: themeOption.preview.primary }}
                      title="Primary color"
                    />
                    <div
                      className="w-3 h-3 rounded-full border border-border"
                      style={{ backgroundColor: themeOption.preview.background }}
                      title="Background color"
                    />
                  </div>

                  {/* Check Mark */}
                  {theme === themeOption.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Footer - Link to Settings */}
          <div className="px-4 py-3 border-t border-border bg-secondary/20">
            <Link
              href="/dashboard/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings className="h-4 w-4" />
              <span>More theme options</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
