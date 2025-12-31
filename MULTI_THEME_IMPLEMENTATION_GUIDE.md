# Multi-Theme Implementation Guide

## Overview
Add support for multiple color themes (Solarized, Gruvbox, Nord, Dracula, etc.) while maintaining the semantic CSS variable system we've built.

## Current State ✅
- All components use semantic CSS variables
- Zero hardcoded colors remaining
- ThemeProvider manages light/dark mode
- Theme preference persisted in localStorage

## Implementation Steps

### Phase 1: Define Theme System (2-3 hours)

#### 1.1 Create Theme Types & Configuration
**File**: `lib/themes.ts` (NEW)

```typescript
export type ThemeMode = 'light' | 'dark';
export type ThemeId = 
  | 'solarized-light' 
  | 'solarized-dark' 
  | 'gruvbox-light'
  | 'gruvbox-dark'
  | 'nord'
  | 'dracula'
  | 'catppuccin-mocha'
  | 'tokyo-night';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  mode: ThemeMode;
  description: string;
  author?: string;
  preview: {
    background: string;
    foreground: string;
    primary: string;
    secondary: string;
  };
}

export const themes: Record<ThemeId, ThemeConfig> = {
  'solarized-light': {
    id: 'solarized-light',
    name: 'Solarized Light',
    mode: 'light',
    description: 'Clean, warm light theme by Ethan Schoonover',
    author: 'Ethan Schoonover',
    preview: {
      background: '#fdf6e3',
      foreground: '#002b36',
      primary: '#268bd2',
      secondary: '#eee8d5',
    },
  },
  'solarized-dark': {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    mode: 'dark',
    description: 'Clean, warm dark theme by Ethan Schoonover',
    author: 'Ethan Schoonover',
    preview: {
      background: '#002b36',
      foreground: '#93a1a1',
      primary: '#268bd2',
      secondary: '#073642',
    },
  },
  'gruvbox-light': {
    id: 'gruvbox-light',
    name: 'Gruvbox Light',
    mode: 'light',
    description: 'Retro groove warm light theme',
    author: 'Pavel Pertsev',
    preview: {
      background: '#fbf1c7',
      foreground: '#3c3836',
      primary: '#d79921',
      secondary: '#ebdbb2',
    },
  },
  'gruvbox-dark': {
    id: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    mode: 'dark',
    description: 'Retro groove warm dark theme',
    author: 'Pavel Pertsev',
    preview: {
      background: '#282828',
      foreground: '#ebdbb2',
      primary: '#fabd2f',
      secondary: '#3c3836',
    },
  },
  'nord': {
    id: 'nord',
    name: 'Nord',
    mode: 'dark',
    description: 'Arctic, north-bluish color palette',
    author: 'Arctic Ice Studio',
    preview: {
      background: '#2e3440',
      foreground: '#d8dee9',
      primary: '#88c0d0',
      secondary: '#3b4252',
    },
  },
  'dracula': {
    id: 'dracula',
    name: 'Dracula',
    mode: 'dark',
    description: 'Dark theme with vibrant colors',
    author: 'Zeno Rocha',
    preview: {
      background: '#282a36',
      foreground: '#f8f8f2',
      primary: '#bd93f9',
      secondary: '#44475a',
    },
  },
  'catppuccin-mocha': {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    mode: 'dark',
    description: 'Soothing pastel theme for coders',
    author: 'Catppuccin',
    preview: {
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      primary: '#89b4fa',
      secondary: '#313244',
    },
  },
  'tokyo-night': {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    mode: 'dark',
    description: 'Clean, dark theme inspired by Tokyo at night',
    author: 'Enkia',
    preview: {
      background: '#1a1b26',
      foreground: '#a9b1d6',
      primary: '#7aa2f7',
      secondary: '#24283b',
    },
  },
};

// Helper functions
export const getThemeById = (id: ThemeId): ThemeConfig => themes[id];
export const getLightThemes = (): ThemeConfig[] => 
  Object.values(themes).filter(t => t.mode === 'light');
export const getDarkThemes = (): ThemeConfig[] => 
  Object.values(themes).filter(t => t.mode === 'dark');
export const getDefaultTheme = (): ThemeId => 'solarized-dark';
```

#### 1.2 Define Theme Color Values
**File**: `app/globals.css` (UPDATE)

Add theme definitions after the existing `.dark` section:

```css
/* Solarized Light */
[data-theme="solarized-light"] {
  --background: 44 11% 93%;        /* base3: #fdf6e3 */
  --foreground: 192 100% 11%;      /* base03: #002b36 */
  --card: 44 87% 94%;              /* base2: #eee8d5 */
  --card-foreground: 192 100% 11%; /* base03: #002b36 */
  --popover: 44 87% 94%;           /* base2: #eee8d5 */
  --popover-foreground: 192 100% 11%; /* base03: #002b36 */
  --primary: 205 69% 67%;          /* blue: #268bd2 */
  --primary-foreground: 44 11% 93%; /* base3: #fdf6e3 */
  --secondary: 44 11% 93%;         /* base3: #fdf6e3 */
  --secondary-foreground: 192 100% 11%; /* base03: #002b36 */
  --muted: 192 81% 27%;            /* base01: #586e75 */
  --muted-foreground: 44 87% 94%;  /* base2: #eee8d5 */
  --accent: 68 100% 30%;           /* green: #859900 */
  --accent-foreground: 44 11% 93%; /* base3: #fdf6e3 */
  --destructive: 1 71% 52%;        /* red: #dc322f */
  --destructive-foreground: 44 11% 93%; /* base3: #fdf6e3 */
  --border: 192 81% 27%;           /* base01: #586e75 */
  --input: 192 81% 27%;            /* base01: #586e75 */
  --ring: 205 69% 67%;             /* blue: #268bd2 */
}

/* Solarized Dark (current .dark - keep as is but duplicate with data-theme) */
[data-theme="solarized-dark"],
.dark {
  /* Keep existing Solarized Dark values */
}

/* Gruvbox Light */
[data-theme="gruvbox-light"] {
  --background: 48 87% 94%;        /* #fbf1c7 */
  --foreground: 25 18% 14%;        /* #282828 */
  --card: 36 65% 90%;              /* #ebdbb2 */
  --card-foreground: 25 18% 14%;   
  --primary: 39 83% 49%;           /* #d79921 */
  --primary-foreground: 48 87% 94%;
  --secondary: 36 65% 90%;         /* #ebdbb2 */
  --secondary-foreground: 25 18% 14%;
  --muted: 36 46% 76%;             /* #d5c4a1 */
  --muted-foreground: 25 43% 35%;  /* #504945 */
  --accent: 142 60% 40%;           /* #98971a */
  --accent-foreground: 48 87% 94%;
  --destructive: 4 69% 55%;        /* #cc241d */
  --destructive-foreground: 48 87% 94%;
  --border: 36 46% 76%;
  --input: 36 46% 76%;
  --ring: 39 83% 49%;
}

/* Gruvbox Dark */
[data-theme="gruvbox-dark"] {
  --background: 25 18% 14%;        /* #282828 */
  --foreground: 36 65% 90%;        /* #ebdbb2 */
  --card: 25 43% 20%;              /* #3c3836 */
  --card-foreground: 36 65% 90%;
  --primary: 39 100% 58%;          /* #fabd2f */
  --primary-foreground: 25 18% 14%;
  --secondary: 25 43% 20%;         /* #3c3836 */
  --secondary-foreground: 36 65% 90%;
  --muted: 25 43% 35%;             /* #504945 */
  --muted-foreground: 36 46% 76%;  /* #d5c4a1 */
  --accent: 142 60% 40%;           /* #98971a */
  --accent-foreground: 25 18% 14%;
  --destructive: 4 90% 58%;        /* #fb4934 */
  --destructive-foreground: 36 65% 90%;
  --border: 25 43% 35%;
  --input: 25 43% 35%;
  --ring: 39 100% 58%;
}

/* Nord */
[data-theme="nord"] {
  --background: 220 16% 22%;       /* #2e3440 */
  --foreground: 219 28% 88%;       /* #d8dee9 */
  --card: 220 17% 28%;             /* #3b4252 */
  --card-foreground: 219 28% 88%;
  --primary: 193 43% 67%;          /* #88c0d0 */
  --primary-foreground: 220 16% 22%;
  --secondary: 220 17% 28%;        /* #3b4252 */
  --secondary-foreground: 219 28% 88%;
  --muted: 220 16% 36%;            /* #434c5e */
  --muted-foreground: 218 27% 92%; /* #eceff4 */
  --accent: 179 25% 65%;           /* #8fbcbb */
  --accent-foreground: 220 16% 22%;
  --destructive: 354 42% 56%;      /* #bf616a */
  --destructive-foreground: 219 28% 88%;
  --border: 220 16% 36%;
  --input: 220 16% 36%;
  --ring: 193 43% 67%;
}

/* Dracula */
[data-theme="dracula"] {
  --background: 231 15% 18%;       /* #282a36 */
  --foreground: 60 30% 96%;        /* #f8f8f2 */
  --card: 232 14% 31%;             /* #44475a */
  --card-foreground: 60 30% 96%;
  --primary: 265 89% 78%;          /* #bd93f9 */
  --primary-foreground: 231 15% 18%;
  --secondary: 232 14% 31%;        /* #44475a */
  --secondary-foreground: 60 30% 96%;
  --muted: 230 15% 36%;            /* #6272a4 */
  --muted-foreground: 60 30% 96%;
  --accent: 135 94% 65%;           /* #50fa7b */
  --accent-foreground: 231 15% 18%;
  --destructive: 0 100% 67%;       /* #ff5555 */
  --destructive-foreground: 60 30% 96%;
  --border: 230 15% 36%;
  --input: 230 15% 36%;
  --ring: 265 89% 78%;
}

/* Catppuccin Mocha */
[data-theme="catppuccin-mocha"] {
  --background: 240 21% 15%;       /* #1e1e2e */
  --foreground: 226 64% 88%;       /* #cdd6f4 */
  --card: 237 16% 23%;             /* #313244 */
  --card-foreground: 226 64% 88%;
  --primary: 217 92% 76%;          /* #89b4fa */
  --primary-foreground: 240 21% 15%;
  --secondary: 237 16% 23%;        /* #313244 */
  --secondary-foreground: 226 64% 88%;
  --muted: 233 12% 39%;            /* #585b70 */
  --muted-foreground: 227 68% 88%; /* #bac2de */
  --accent: 189 71% 73%;           /* #89dceb */
  --accent-foreground: 240 21% 15%;
  --destructive: 343 81% 75%;      /* #f38ba8 */
  --destructive-foreground: 240 21% 15%;
  --border: 233 12% 39%;
  --input: 233 12% 39%;
  --ring: 217 92% 76%;
}

/* Tokyo Night */
[data-theme="tokyo-night"] {
  --background: 235 18% 13%;       /* #1a1b26 */
  --foreground: 224 16% 74%;       /* #a9b1d6 */
  --card: 235 23% 21%;             /* #24283b */
  --card-foreground: 224 16% 74%;
  --primary: 217 92% 76%;          /* #7aa2f7 */
  --primary-foreground: 235 18% 13%;
  --secondary: 235 23% 21%;        /* #24283b */
  --secondary-foreground: 224 16% 74%;
  --muted: 235 18% 24%;            /* #292e42 */
  --muted-foreground: 223 18% 85%; /* #c0caf5 */
  --accent: 172 67% 60%;           /* #7dcfff */
  --accent-foreground: 235 18% 13%;
  --destructive: 3 87% 67%;        /* #f7768e */
  --destructive-foreground: 235 18% 13%;
  --border: 235 18% 24%;
  --input: 235 18% 24%;
  --ring: 217 92% 76%;
}
```

### Phase 2: Update Theme Provider (1-2 hours)

#### 2.1 Update ThemeProvider Component
**File**: `lib/theme-provider.tsx` (UPDATE)

```typescript
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeId, getDefaultTheme, getThemeById } from '@/lib/themes';

interface ThemeContextType {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  // Legacy compatibility for components that check mode
  mode: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(getDefaultTheme());
  const [mounted, setMounted] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('theme') as ThemeId;
    if (savedTheme && getThemeById(savedTheme)) {
      setThemeState(savedTheme);
    }
  }, []);

  // Apply theme when it changes
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    const themeConfig = getThemeById(theme);

    // Remove all theme attributes
    root.removeAttribute('data-theme');
    root.classList.remove('light', 'dark');

    // Set new theme
    root.setAttribute('data-theme', theme);
    root.classList.add(themeConfig.mode);

    // Save to localStorage
    localStorage.setItem('theme', theme);
  }, [theme, mounted]);

  const setTheme = (newTheme: ThemeId) => {
    setThemeState(newTheme);
  };

  const mode = getThemeById(theme).mode;

  // Prevent flash of unstyled content
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, mode }}>
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
```

### Phase 3: Create UI Components (3-4 hours)

#### 3.1 Theme Dropdown Component
**File**: `components/theme/ThemeDropdown.tsx` (NEW)

```typescript
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/lib/theme-provider';
import { themes, ThemeId } from '@/lib/themes';
import { Sun, Moon, Palette, Check, Settings } from 'lucide-react';
import Link from 'next/link';

export function ThemeDropdown() {
  const { theme, setTheme, mode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleThemeSelect = (themeId: ThemeId) => {
    setTheme(themeId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-accent transition-colors"
        aria-label="Change theme"
        aria-expanded={isOpen}
      >
        {mode === 'dark' ? (
          <Moon className="h-5 w-5 text-foreground" />
        ) : (
          <Sun className="h-5 w-5 text-foreground" />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-card border border-border rounded-lg shadow-xl overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border bg-secondary/20">
            <div className="flex items-center space-x-2">
              <Palette className="h-4 w-4 text-primary" />
              <span className="font-semibold text-foreground">Select Theme</span>
            </div>
          </div>

          {/* Theme List */}
          <div className="max-h-96 overflow-y-auto">
            {Object.values(themes).map((themeOption) => (
              <button
                key={themeOption.id}
                onClick={() => handleThemeSelect(themeOption.id)}
                className={`w-full px-4 py-3 flex items-center justify-between hover:bg-accent transition-colors ${
                  theme === themeOption.id ? 'bg-accent/50' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  {/* Theme Icon */}
                  <div className="flex items-center justify-center w-8 h-8 rounded">
                    {themeOption.mode === 'dark' ? (
                      <Moon className="h-4 w-4" />
                    ) : (
                      <Sun className="h-4 w-4" />
                    )}
                  </div>

                  {/* Theme Info */}
                  <div className="text-left">
                    <div className="font-medium text-foreground text-sm">
                      {themeOption.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {themeOption.description}
                    </div>
                  </div>
                </div>

                {/* Color Preview + Check */}
                <div className="flex items-center space-x-2">
                  {/* Color Dots */}
                  <div className="flex space-x-1">
                    <div
                      className="w-3 h-3 rounded-full border border-border"
                      style={{ backgroundColor: themeOption.preview.primary }}
                    />
                    <div
                      className="w-3 h-3 rounded-full border border-border"
                      style={{ backgroundColor: themeOption.preview.background }}
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
```

#### 3.2 Theme Preview Cards (Settings Page)
**File**: `components/theme/ThemePreviewCard.tsx` (NEW)

```typescript
'use client';

import React from 'react';
import { ThemeConfig } from '@/lib/themes';
import { Check } from 'lucide-react';

interface ThemePreviewCardProps {
  theme: ThemeConfig;
  isSelected: boolean;
  onSelect: () => void;
}

export function ThemePreviewCard({ theme, isSelected, onSelect }: ThemePreviewCardProps) {
  return (
    <button
      onClick={onSelect}
      className={`relative group w-full text-left rounded-lg border-2 transition-all overflow-hidden ${
        isSelected
          ? 'border-primary shadow-lg'
          : 'border-border hover:border-primary/50 hover:shadow-md'
      }`}
    >
      {/* Color Preview */}
      <div className="h-24 grid grid-cols-4 gap-0">
        <div
          className="col-span-3"
          style={{ backgroundColor: theme.preview.background }}
        />
        <div
          className="col-span-1"
          style={{ backgroundColor: theme.preview.secondary }}
        />
      </div>

      {/* Accent Bar */}
      <div
        className="h-1"
        style={{ backgroundColor: theme.preview.primary }}
      />

      {/* Theme Info */}
      <div className="p-4 bg-card">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground mb-1 flex items-center">
              {theme.name}
              {isSelected && (
                <Check className="ml-2 h-4 w-4 text-primary" />
              )}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {theme.description}
            </p>
            {theme.author && (
              <p className="text-xs text-muted-foreground mt-2">
                by {theme.author}
              </p>
            )}
          </div>
        </div>

        {/* Color Swatches */}
        <div className="flex space-x-2 mt-3">
          <div
            className="w-6 h-6 rounded border border-border"
            style={{ backgroundColor: theme.preview.background }}
            title="Background"
          />
          <div
            className="w-6 h-6 rounded border border-border"
            style={{ backgroundColor: theme.preview.foreground }}
            title="Foreground"
          />
          <div
            className="w-6 h-6 rounded border border-border"
            style={{ backgroundColor: theme.preview.primary }}
            title="Primary"
          />
          <div
            className="w-6 h-6 rounded border border-border"
            style={{ backgroundColor: theme.preview.secondary }}
            title="Secondary"
          />
        </div>
      </div>
    </button>
  );
}
```

### Phase 4: Update Existing Components (30 min)

#### 4.1 Update Settings Page
**File**: `app/dashboard/settings/page.tsx` (ADD SECTION)

Add after the Dark Mode toggle section:

```typescript
import { useTheme } from '@/lib/theme-provider';
import { themes } from '@/lib/themes';
import { ThemePreviewCard } from '@/components/theme/ThemePreviewCard';

// In component:
const { theme, setTheme } = useTheme();

// Add UI section:
<div className="bg-card rounded-lg shadow-sm border p-6">
  <h2 className="text-xl font-semibold text-foreground mb-2">Color Theme</h2>
  <p className="text-muted-foreground mb-6">
    Choose your preferred color scheme
  </p>
  
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {Object.values(themes).map((themeOption) => (
      <ThemePreviewCard
        key={themeOption.id}
        theme={themeOption}
        isSelected={theme === themeOption.id}
        onSelect={() => setTheme(themeOption.id)}
      />
    ))}
  </div>
</div>
```

#### 4.2 Replace Current Theme Toggle
**File**: `app/dashboard/layout.tsx` or wherever theme toggle lives (UPDATE)

Replace the old Sun/Moon toggle with:

```typescript
import { ThemeDropdown } from '@/components/theme/ThemeDropdown';

// Replace old toggle with:
<ThemeDropdown />
```

### Phase 5: Testing & Polish (1-2 hours)

#### 5.1 Test Checklist
- [ ] All themes load correctly
- [ ] Theme persists on page refresh
- [ ] Theme changes apply instantly without flicker
- [ ] Dropdown closes on outside click
- [ ] Settings page theme cards display correctly
- [ ] Mobile responsive (dropdown, preview cards)
- [ ] All semantic colors work in each theme
- [ ] No hardcoded colors appear
- [ ] Keyboard navigation works
- [ ] ARIA labels correct

#### 5.2 Performance Check
- [ ] No layout shift on theme change
- [ ] CSS variables update smoothly
- [ ] No JavaScript errors in console
- [ ] localStorage working correctly

### Phase 6: Documentation (30 min)

#### 6.1 Update README
Add section about theming system and available themes

#### 6.2 Create Theme Contributor Guide
**File**: `THEME_CONTRIBUTION_GUIDE.md` (NEW)
- How to add new themes
- Color palette requirements
- Testing guidelines

## File Structure
```
/workspace/
├── lib/
│   ├── themes.ts                          (NEW)
│   └── theme-provider.tsx                 (UPDATE)
├── components/
│   └── theme/
│       ├── ThemeDropdown.tsx              (NEW)
│       └── ThemePreviewCard.tsx           (NEW)
├── app/
│   ├── globals.css                        (UPDATE - add theme CSS)
│   └── dashboard/
│       ├── layout.tsx                     (UPDATE - use ThemeDropdown)
│       └── settings/page.tsx              (UPDATE - add theme section)
├── MULTI_THEME_IMPLEMENTATION_GUIDE.md    (THIS FILE)
└── THEME_CONTRIBUTION_GUIDE.md            (NEW)
```

## Total Time Estimate
- **Minimum**: 8-10 hours (basic implementation, 4-5 themes)
- **Recommended**: 12-15 hours (polished UI, 8 themes, testing)
- **With documentation**: 15-18 hours

## Success Criteria
- ✅ Users can switch between at least 6 themes
- ✅ Theme choice persists across sessions
- ✅ All UI components respect theme colors
- ✅ Mobile-friendly theme selector
- ✅ Zero hardcoded colors in components
- ✅ Smooth transitions between themes
- ✅ Clear preview of theme colors before selection

## Notes
- All themes use the same semantic variable names
- No component changes needed (thanks to our refactor!)
- Easy to add more themes in the future
- System respects user's preference
- Can be extended with user-uploaded themes later

## Questions for Implementation
1. **Dropdown vs Settings-only**: Use ThemeDropdown in header? (Recommended: Yes)
2. **Default theme**: Keep Solarized Dark? (Recommended: Yes)
3. **Theme categories**: Group by light/dark in dropdown? (Recommended: Yes)
4. **Preview animations**: Add smooth color transitions? (Recommended: Yes, 0.3s)
5. **Analytics**: Track theme preferences? (Optional)
