# Liquid Glass Theme Implementation Plan

> **Status**: Phase 1-3 Core Complete, Ready for Testing  
> **Created**: January 5, 2026  
> **Architecture Decision**: Glass as an orthogonal style layer (not a separate theme)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Decision](#architecture-decision)
3. [How It Works](#how-it-works)
4. [Phase 1: Foundation](#phase-1-foundation)
5. [Phase 2: Component Integration](#phase-2-component-integration)
6. [Phase 3: Polish & Advanced Effects](#phase-3-polish--advanced-effects)
7. [Theme-Specific Glass Variables](#theme-specific-glass-variables)
8. [Accessibility Considerations](#accessibility-considerations)
9. [Performance Notes](#performance-notes)
10. [Mobile-First & PWA Responsive Design](#mobile-first--pwa-responsive-design)
11. [Future Enhancements](#future-enhancements)

---

## Overview

This document outlines the implementation of Apple-inspired "Liquid Glass" visual effects for MindShifting. The glass aesthetic includes:

- **Frosted glass blur** — Translucent surfaces that blur content behind them
- **Specular highlights** — Subtle light reflections on edges
- **Ambient glow** — Soft colored glow matching theme accent
- **Depth layering** — Multiple blur intensities based on z-depth
- **Smooth transitions** — Fluid animations between states

### Design Inspiration

Apple's Liquid Glass (WWDC 2025) creates depth through:
- Variable transparency and blur
- Light-responsive surfaces
- Layered, floating UI elements
- Subtle motion and morphing

---

## Architecture Decision

### ✅ Chosen Approach: Glass as Orthogonal Layer

Glass effects are **independent of color themes**. Users can combine any existing theme with glass effects.

```
┌─────────────────────────────────────────────────────┐
│                    User Settings                     │
├─────────────────────────────────────────────────────┤
│  Color Theme: [Solarized Dark ▼]                    │
│  Glass Effects: [● Enabled  ○ Disabled]             │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│              Resulting Visual Style                  │
│                                                      │
│   "Solarized Dark" colors + Glass UI treatment      │
└─────────────────────────────────────────────────────┘
```

### Why This Approach?

| Benefit | Description |
|---------|-------------|
| **User flexibility** | Users keep their favorite color palettes AND get modern aesthetics |
| **No theme explosion** | Don't need to create 16 themes (8 regular + 8 glass variants) |
| **Easier maintenance** | Glass CSS is centralized, not duplicated per theme |
| **Graceful fallback** | Users who prefer solid UI can disable glass |
| **Progressive enhancement** | Can ship as opt-in, make default later |

### Rejected Alternative

**Glass as a separate theme** — Would force users to choose between color preferences and glass aesthetics. Not recommended.

---

## How It Works

### State Management

The existing `ThemeContext` in `lib/theme.tsx` will be extended:

```typescript
interface ThemeContextType {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  mode: 'light' | 'dark';
  // NEW: Glass effect toggle
  glassEnabled: boolean;
  setGlassEnabled: (enabled: boolean) => void;
  // Legacy compatibility
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
}
```

### CSS Class Application

When glass is enabled, add class to document root:

```typescript
// In ThemeProvider useEffect
if (glassEnabled) {
  document.documentElement.classList.add('glass-enabled');
} else {
  document.documentElement.classList.remove('glass-enabled');
}
```

### CSS Variable Hierarchy

```css
/* Base glass variables (defaults) */
:root {
  --glass-blur: 12px;
  --glass-blur-strong: 20px;
  --glass-blur-subtle: 6px;
  --glass-opacity: 0.7;
  --glass-border-opacity: 0.2;
  --glass-tint: 0 0% 100%;        /* Will be overridden per theme */
  --glass-glow: 0 0% 100%;        /* Will be overridden per theme */
  --glass-highlight: 0 0% 100%;   /* Specular highlight color */
}

/* Each theme overrides glass tint/glow */
[data-theme="nord"] {
  --glass-tint: 193 43% 67%;      /* Nord frost blue */
  --glass-glow: 193 43% 67%;
}

[data-theme="dracula"] {
  --glass-tint: 265 89% 78%;      /* Dracula purple */
  --glass-glow: 265 89% 78%;
}
/* ... etc for each theme */
```

---

## Phase 1: Foundation

**Goal**: Add CSS infrastructure and basic glass utility classes.

### 1.1 Add Glass Variables to `globals.css`

Add after the existing theme definitions:

```css
/* ===============================================
 * LIQUID GLASS SYSTEM
 * =============================================== */

:root {
  /* Glass blur intensities */
  --glass-blur-subtle: 6px;
  --glass-blur: 12px;
  --glass-blur-strong: 20px;
  
  /* Glass surface properties */
  --glass-opacity: 0.75;
  --glass-opacity-subtle: 0.85;
  --glass-opacity-strong: 0.6;
  
  /* Glass border */
  --glass-border-width: 1px;
  --glass-border-opacity: 0.2;
  
  /* Specular highlight */
  --glass-highlight-opacity: 0.1;
  --glass-highlight-size: 50%;
  
  /* Glow effect */
  --glass-glow-opacity: 0.15;
  --glass-glow-spread: 20px;
  
  /* Default tint (overridden per theme) */
  --glass-tint: 0 0% 50%;
  --glass-glow-color: 0 0% 50%;
}
```

### 1.2 Add Per-Theme Glass Colors

Each theme needs its glass tint defined. Add to each `[data-theme="..."]` block:

```css
/* Solarized Dark */
[data-theme="solarized-dark"] {
  /* ... existing variables ... */
  --glass-tint: 205 69% 67%;        /* Blue accent */
  --glass-glow-color: 205 69% 67%;
}

/* Nord */
[data-theme="nord"] {
  /* ... existing variables ... */
  --glass-tint: 193 43% 67%;        /* Frost blue */
  --glass-glow-color: 179 25% 65%;  /* Teal accent */
}

/* Dracula */
[data-theme="dracula"] {
  /* ... existing variables ... */
  --glass-tint: 265 89% 78%;        /* Purple */
  --glass-glow-color: 265 89% 78%;
}

/* Catppuccin Mocha */
[data-theme="catppuccin-mocha"] {
  /* ... existing variables ... */
  --glass-tint: 217 92% 76%;        /* Blue */
  --glass-glow-color: 189 71% 73%;  /* Teal */
}

/* Tokyo Night */
[data-theme="tokyo-night"] {
  /* ... existing variables ... */
  --glass-tint: 217 92% 76%;        /* Blue */
  --glass-glow-color: 172 67% 60%;  /* Cyan */
}

/* Gruvbox Dark */
[data-theme="gruvbox-dark"] {
  /* ... existing variables ... */
  --glass-tint: 39 100% 58%;        /* Yellow/Orange */
  --glass-glow-color: 39 100% 58%;
}

/* Solarized Light */
[data-theme="solarized-light"] {
  /* ... existing variables ... */
  --glass-tint: 205 69% 67%;        /* Blue */
  --glass-glow-color: 205 69% 67%;
  --glass-opacity: 0.85;            /* Higher opacity for light themes */
}

/* Gruvbox Light */
[data-theme="gruvbox-light"] {
  /* ... existing variables ... */
  --glass-tint: 39 83% 49%;         /* Orange */
  --glass-glow-color: 39 83% 49%;
  --glass-opacity: 0.85;
}
```

### 1.3 Add Glass Utility Classes

```css
/* Glass utilities - only active when glass is enabled */
.glass-enabled .glass {
  background: hsla(var(--glass-tint) / var(--glass-opacity));
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: var(--glass-border-width) solid hsla(var(--glass-tint) / var(--glass-border-opacity));
}

.glass-enabled .glass-subtle {
  background: hsla(var(--glass-tint) / var(--glass-opacity-subtle));
  backdrop-filter: blur(var(--glass-blur-subtle));
  -webkit-backdrop-filter: blur(var(--glass-blur-subtle));
  border: var(--glass-border-width) solid hsla(var(--glass-tint) / calc(var(--glass-border-opacity) * 0.5));
}

.glass-enabled .glass-strong {
  background: hsla(var(--glass-tint) / var(--glass-opacity-strong));
  backdrop-filter: blur(var(--glass-blur-strong));
  -webkit-backdrop-filter: blur(var(--glass-blur-strong));
  border: var(--glass-border-width) solid hsla(var(--glass-tint) / calc(var(--glass-border-opacity) * 1.5));
}

/* Specular highlight (top edge) */
.glass-enabled .glass-highlight::before {
  content: '';
  position: absolute;
  top: 0;
  left: 10%;
  right: 10%;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    hsla(var(--glass-highlight) / var(--glass-highlight-opacity)),
    transparent
  );
  pointer-events: none;
}

/* Ambient glow */
.glass-enabled .glass-glow {
  box-shadow: 
    0 0 var(--glass-glow-spread) hsla(var(--glass-glow-color) / var(--glass-glow-opacity)),
    0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

/* Combined glass with all effects */
.glass-enabled .glass-full {
  background: hsla(var(--glass-tint) / var(--glass-opacity));
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: var(--glass-border-width) solid hsla(var(--glass-tint) / var(--glass-border-opacity));
  box-shadow: 
    0 0 var(--glass-glow-spread) hsla(var(--glass-glow-color) / var(--glass-glow-opacity)),
    0 8px 32px rgba(0, 0, 0, 0.12);
  position: relative;
}

.glass-enabled .glass-full::before {
  content: '';
  position: absolute;
  top: 0;
  left: 5%;
  right: 5%;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    hsla(0 0% 100% / 0.2),
    transparent
  );
  border-radius: inherit;
  pointer-events: none;
}

/* Fallback: When glass disabled, elements look normal */
.glass,
.glass-subtle,
.glass-strong,
.glass-full {
  /* These are no-ops when .glass-enabled is not present */
  /* Components should still have bg-card or similar as base */
}
```

### 1.4 Update Theme Context (`lib/theme.tsx`)

```typescript
// Add to ThemeContextType interface
glassEnabled: boolean;
setGlassEnabled: (enabled: boolean) => void;

// Add state in ThemeProvider
const [glassEnabled, setGlassEnabledState] = useState(false);

// Load from localStorage
useEffect(() => {
  const savedGlass = localStorage.getItem('glassEnabled');
  if (savedGlass !== null) {
    setGlassEnabledState(savedGlass === 'true');
  }
}, []);

// Apply glass class when it changes
useEffect(() => {
  if (!mounted) return;
  
  if (glassEnabled) {
    document.documentElement.classList.add('glass-enabled');
  } else {
    document.documentElement.classList.remove('glass-enabled');
  }
  
  localStorage.setItem('glassEnabled', String(glassEnabled));
}, [glassEnabled, mounted]);

// Expose in context value
const setGlassEnabled = (enabled: boolean) => {
  setGlassEnabledState(enabled);
};
```

### 1.5 Files to Modify (Phase 1)

| File | Changes |
|------|---------|
| `lib/theme.tsx` | Add `glassEnabled` state, localStorage, class toggle |
| `app/globals.css` | Add glass variables and utility classes |
| `lib/themes.ts` | Add `glassColors` to `ThemeConfig` interface (optional, for preview) |

---

## Phase 2: Component Integration

**Goal**: Add glass variants to UI components and settings toggle.

### 2.1 Card Component Glass Variant

Update `components/ui/card.tsx`:

```typescript
const cardVariants = cva(
  "rounded-xl border bg-card text-card-foreground shadow",
  {
    variants: {
      variant: {
        default: "",
        compact: "",
        glass: "glass-full bg-card/80",        // NEW
        glassSubtle: "glass-subtle bg-card/90", // NEW
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)
```

Usage:
```tsx
<Card variant="glass">
  <CardContent>Glass card content</CardContent>
</Card>
```

### 2.2 Button Glass Variant

Update `components/ui/button.tsx`:

```typescript
// Add to variants
glass: "glass bg-primary/80 text-primary-foreground hover:bg-primary/90",
glassSecondary: "glass-subtle bg-secondary/80 text-secondary-foreground",
```

### 2.3 Settings Toggle UI

Add to settings page or theme dropdown:

```tsx
// In ThemeDropdown.tsx or Settings page
const { glassEnabled, setGlassEnabled } = useTheme();

<div className="flex items-center justify-between">
  <div>
    <Label htmlFor="glass-toggle">Glass Effects</Label>
    <p className="text-sm text-muted-foreground">
      Enable frosted glass UI style
    </p>
  </div>
  <Switch
    id="glass-toggle"
    checked={glassEnabled}
    onCheckedChange={setGlassEnabled}
  />
</div>
```

### 2.4 Auto-Apply Glass to Key Surfaces

For a more immersive experience, apply glass to structural elements when enabled:

```css
/* Navigation/Header */
.glass-enabled [data-slot="nav"],
.glass-enabled .nav-glass {
  @apply glass-subtle;
}

/* Sidebar */
.glass-enabled [data-slot="sidebar"],
.glass-enabled .sidebar-glass {
  @apply glass;
}

/* Modal/Dialog backdrop */
.glass-enabled [data-slot="dialog-content"] {
  @apply glass-full;
}

/* Floating action buttons */
.glass-enabled .fab-glass {
  @apply glass-strong glass-glow;
}
```

### 2.5 Files to Modify (Phase 2)

| File | Changes |
|------|---------|
| `components/ui/card.tsx` | Add `glass` and `glassSubtle` variants |
| `components/ui/button.tsx` | Add glass button variants |
| `components/theme/ThemeDropdown.tsx` | Add glass toggle switch |
| `app/dashboard/settings/page.tsx` | Add glass toggle in appearance section |

---

## Phase 3: Polish & Advanced Effects

**Goal**: Add sophisticated visual details for premium feel.

### 3.1 Specular Edge Highlights

Adds a subtle light reflection on top edges:

```css
.glass-enabled .glass-specular {
  position: relative;
  overflow: hidden;
}

.glass-enabled .glass-specular::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(
    180deg,
    hsla(0 0% 100% / 0.08) 0%,
    transparent 100%
  );
  pointer-events: none;
  border-radius: inherit;
}

.glass-enabled .glass-specular::after {
  content: '';
  position: absolute;
  top: 0;
  left: 20%;
  right: 20%;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    hsla(0 0% 100% / 0.3) 50%,
    transparent 100%
  );
  pointer-events: none;
}
```

### 3.2 Depth-Aware Blur

Different blur intensities based on z-index layer:

```css
/* Layer system for depth */
.glass-enabled .glass-layer-1 {
  --glass-blur: 8px;
  --glass-opacity: 0.8;
}

.glass-enabled .glass-layer-2 {
  --glass-blur: 12px;
  --glass-opacity: 0.75;
}

.glass-enabled .glass-layer-3 {
  --glass-blur: 16px;
  --glass-opacity: 0.7;
}

.glass-enabled .glass-layer-4 {
  --glass-blur: 24px;
  --glass-opacity: 0.6;
}
```

### 3.3 Interactive Glow on Hover/Focus

```css
.glass-enabled .glass-interactive {
  transition: 
    box-shadow 0.3s ease,
    transform 0.2s ease,
    background 0.2s ease;
}

.glass-enabled .glass-interactive:hover {
  box-shadow: 
    0 0 calc(var(--glass-glow-spread) * 1.5) hsla(var(--glass-glow-color) / calc(var(--glass-glow-opacity) * 1.5)),
    0 12px 40px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.glass-enabled .glass-interactive:focus-visible {
  box-shadow: 
    0 0 0 2px hsl(var(--background)),
    0 0 0 4px hsl(var(--ring)),
    0 0 calc(var(--glass-glow-spread) * 2) hsla(var(--glass-glow-color) / calc(var(--glass-glow-opacity) * 2));
}

.glass-enabled .glass-interactive:active {
  transform: translateY(0);
  box-shadow: 
    0 0 var(--glass-glow-spread) hsla(var(--glass-glow-color) / var(--glass-glow-opacity)),
    0 4px 20px rgba(0, 0, 0, 0.1);
}
```

### 3.4 Animated Glass Shimmer (Optional)

Subtle moving highlight for special elements:

```css
@keyframes glass-shimmer {
  0% {
    background-position: -200% center;
  }
  100% {
    background-position: 200% center;
  }
}

.glass-enabled .glass-shimmer {
  position: relative;
  overflow: hidden;
}

.glass-enabled .glass-shimmer::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    hsla(0 0% 100% / 0.05) 50%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: glass-shimmer 3s ease-in-out infinite;
  pointer-events: none;
}
```

### 3.5 Dynamic Light Response (Advanced - Optional)

For hero sections or special UI, track mouse position for light effect:

```typescript
// hooks/useGlassLight.ts
export function useGlassLight(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      element.style.setProperty('--light-x', `${x}%`);
      element.style.setProperty('--light-y', `${y}%`);
    };

    element.addEventListener('mousemove', handleMouseMove);
    return () => element.removeEventListener('mousemove', handleMouseMove);
  }, [ref]);
}
```

```css
.glass-enabled .glass-dynamic-light {
  --light-x: 50%;
  --light-y: 0%;
}

.glass-enabled .glass-dynamic-light::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(
    circle at var(--light-x) var(--light-y),
    hsla(0 0% 100% / 0.15) 0%,
    transparent 50%
  );
  pointer-events: none;
  border-radius: inherit;
}
```

---

## Theme-Specific Glass Variables

Complete reference for all themes:

| Theme | Glass Tint | Glow Color | Notes |
|-------|-----------|------------|-------|
| Solarized Dark | `205 69% 67%` (Blue) | `205 69% 67%` | Cool, professional |
| Solarized Light | `205 69% 67%` (Blue) | `205 69% 67%` | Higher opacity (0.85) |
| Nord | `193 43% 67%` (Frost) | `179 25% 65%` (Teal) | Arctic feel |
| Dracula | `265 89% 78%` (Purple) | `265 89% 78%` | Vibrant, energetic |
| Catppuccin Mocha | `217 92% 76%` (Blue) | `189 71% 73%` (Sky) | Soft, pastel |
| Tokyo Night | `217 92% 76%` (Blue) | `172 67% 60%` (Cyan) | Neon city vibe |
| Gruvbox Dark | `39 100% 58%` (Yellow) | `39 100% 58%` | Warm, retro |
| Gruvbox Light | `39 83% 49%` (Orange) | `39 83% 49%` | Higher opacity (0.85) |

---

## Accessibility Considerations

### Contrast Ratios

Glass effects reduce contrast. Mitigations:

```css
/* Ensure text remains readable */
.glass-enabled .glass {
  /* Fallback solid background for high contrast mode */
}

.high-contrast .glass,
.high-contrast .glass-subtle,
.high-contrast .glass-strong {
  background: hsl(var(--card)) !important;
  backdrop-filter: none !important;
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .glass-shimmer::after {
    animation: none !important;
  }
  
  .glass-interactive {
    transition: none !important;
  }
}
```

### User Preference

The glass toggle allows users who find transparency distracting to disable it entirely.

### Focus Indicators

Glass elements must maintain visible focus states:

```css
.glass-enabled .glass:focus-visible,
.glass-enabled .glass-full:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
```

---

## Performance Notes

### Backdrop Filter Impact

`backdrop-filter: blur()` can be expensive. Mitigations:

1. **Limit glass surfaces** — Don't apply to every element
2. **Use `will-change`** — For animated glass elements
3. **Reduce blur radius** — Lower values are faster
4. **Avoid nested glass** — Compounding blur is very expensive

```css
/* Performance optimization for glass elements */
.glass-enabled .glass,
.glass-enabled .glass-full {
  will-change: transform;
  transform: translateZ(0); /* Force GPU layer */
}
```

### Feature Detection

```css
/* Only apply if browser supports backdrop-filter */
@supports (backdrop-filter: blur(10px)) or (-webkit-backdrop-filter: blur(10px)) {
  .glass-enabled .glass {
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
  }
}

@supports not ((backdrop-filter: blur(10px)) or (-webkit-backdrop-filter: blur(10px))) {
  /* Fallback: slightly more opaque background */
  .glass-enabled .glass {
    background: hsla(var(--glass-tint) / 0.95);
  }
}
```

### Mobile Considerations

Mobile devices may struggle with heavy blur. Consider:

```css
@media (max-width: 768px) {
  :root {
    --glass-blur: 8px;        /* Reduced blur */
    --glass-blur-strong: 12px;
    --glass-opacity: 0.85;    /* More opaque = less processing */
  }
}
```

---

## Mobile-First & PWA Responsive Design

> **Primary Target**: PWA on mobile devices  
> **Secondary Target**: Desktop browsers

Since MindShifting is primarily used as a PWA, glass effects are designed **mobile-first** with progressive enhancement for larger screens.

### Design Philosophy

```
┌─────────────────────────────────────────────────────────────┐
│                    MOBILE-FIRST APPROACH                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Mobile (default)     Tablet (md:)        Desktop (lg:)    │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│   │ Lighter blur │    │ Medium blur  │    │ Full blur    │  │
│   │ Higher opac. │ -> │ Medium opac. │ -> │ Lower opac.  │  │
│   │ No glow      │    │ Subtle glow  │    │ Full glow    │  │
│   │ Touch-first  │    │ Touch+hover  │    │ Hover+click  │  │
│   └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Mobile-First CSS Variables

Replace the `:root` variables with mobile-first defaults:

```css
/* ===============================================
 * LIQUID GLASS SYSTEM - MOBILE-FIRST
 * =============================================== */

:root {
  /* === MOBILE DEFAULTS (base) === */
  
  /* Lighter blur for mobile performance */
  --glass-blur-subtle: 4px;
  --glass-blur: 8px;
  --glass-blur-strong: 12px;
  
  /* Higher opacity = better performance + readability on small screens */
  --glass-opacity: 0.85;
  --glass-opacity-subtle: 0.9;
  --glass-opacity-strong: 0.75;
  
  /* Reduced glow for battery life */
  --glass-glow-opacity: 0.08;
  --glass-glow-spread: 10px;
  
  /* Touch-friendly borders (more visible) */
  --glass-border-width: 1px;
  --glass-border-opacity: 0.25;
  
  /* Reduced specular for simplicity */
  --glass-highlight-opacity: 0.05;
  
  /* Tint colors (unchanged across breakpoints) */
  --glass-tint: 0 0% 50%;
  --glass-glow-color: 0 0% 50%;
}

/* === TABLET ENHANCEMENT (640px+) === */
@media (min-width: 640px) {
  :root {
    --glass-blur-subtle: 6px;
    --glass-blur: 10px;
    --glass-blur-strong: 16px;
    
    --glass-opacity: 0.8;
    --glass-opacity-subtle: 0.88;
    --glass-opacity-strong: 0.7;
    
    --glass-glow-opacity: 0.12;
    --glass-glow-spread: 15px;
    
    --glass-highlight-opacity: 0.08;
  }
}

/* === DESKTOP ENHANCEMENT (1024px+) === */
@media (min-width: 1024px) {
  :root {
    --glass-blur-subtle: 8px;
    --glass-blur: 12px;
    --glass-blur-strong: 20px;
    
    --glass-opacity: 0.75;
    --glass-opacity-subtle: 0.85;
    --glass-opacity-strong: 0.6;
    
    --glass-glow-opacity: 0.15;
    --glass-glow-spread: 20px;
    
    --glass-highlight-opacity: 0.1;
  }
}

/* === LARGE DESKTOP (1280px+) === */
@media (min-width: 1280px) {
  :root {
    --glass-blur-strong: 24px;
    --glass-glow-spread: 25px;
  }
}
```

### PWA-Specific Considerations

#### Standalone Mode Detection

When running as installed PWA, we can be more aggressive with glass:

```css
/* Detect PWA standalone mode */
@media (display-mode: standalone) {
  :root {
    /* PWA users expect app-like experience */
    --glass-blur: calc(var(--glass-blur) * 1.1);
    --glass-glow-opacity: calc(var(--glass-glow-opacity) * 1.2);
  }
}

/* Also detect fullscreen mode */
@media (display-mode: fullscreen) {
  :root {
    --glass-blur: calc(var(--glass-blur) * 1.1);
  }
}
```

#### Safe Area Integration

Glass elements near edges must respect safe areas (notches, home indicators):

```css
/* Glass navigation respects safe areas */
.glass-enabled .glass-nav {
  padding-top: env(safe-area-inset-top);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

/* Glass bottom bar respects home indicator */
.glass-enabled .glass-bottom-bar {
  padding-bottom: calc(env(safe-area-inset-bottom) + 8px);
}

/* Full-bleed glass modal */
.glass-enabled .glass-modal-fullscreen {
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}
```

#### iOS PWA Rubber-band Overscroll

Glass headers should handle iOS overscroll gracefully:

```css
/* Extend glass background for overscroll */
.glass-enabled .glass-header-ios {
  /* Extend upward for rubber-band effect */
  margin-top: -100px;
  padding-top: calc(100px + env(safe-area-inset-top));
}
```

### Touch-Friendly Glass Interactions

Mobile glass elements need larger touch targets and appropriate feedback:

```css
/* === TOUCH TARGETS === */
.glass-enabled .glass-touchable {
  /* Minimum 44x44px touch target (Apple HIG) */
  min-height: 44px;
  min-width: 44px;
  
  /* Remove hover transforms on touch devices */
  -webkit-tap-highlight-color: transparent;
}

/* === TOUCH FEEDBACK (instead of hover) === */
.glass-enabled .glass-touchable:active {
  transform: scale(0.98);
  background: hsla(var(--glass-tint) / calc(var(--glass-opacity) + 0.1));
  transition: transform 0.1s ease, background 0.1s ease;
}

/* === HOVER ONLY ON NON-TOUCH === */
@media (hover: hover) and (pointer: fine) {
  .glass-enabled .glass-interactive:hover {
    box-shadow: 
      0 0 calc(var(--glass-glow-spread) * 1.5) hsla(var(--glass-glow-color) / calc(var(--glass-glow-opacity) * 1.5)),
      0 12px 40px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }
}

/* === TOUCH DEVICES: simpler interaction === */
@media (hover: none) {
  .glass-enabled .glass-interactive {
    /* No hover effect */
    transition: transform 0.15s ease, background 0.15s ease;
  }
  
  .glass-enabled .glass-interactive:active {
    transform: scale(0.97);
    background: hsla(var(--glass-tint) / calc(var(--glass-opacity) + 0.15));
  }
}
```

### Responsive Glass Components

#### Cards

```css
/* Glass card - responsive padding and effects */
.glass-enabled .glass-card {
  /* Mobile: compact */
  padding: 12px;
  border-radius: 12px;
}

@media (min-width: 640px) {
  .glass-enabled .glass-card {
    padding: 16px;
    border-radius: 16px;
  }
}

@media (min-width: 1024px) {
  .glass-enabled .glass-card {
    padding: 20px;
    border-radius: 20px;
  }
}
```

#### Bottom Navigation (PWA)

```css
/* Glass bottom nav for PWA */
.glass-enabled .glass-bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  
  /* Glass effect */
  background: hsla(var(--glass-tint) / var(--glass-opacity));
  backdrop-filter: blur(var(--glass-blur-strong));
  -webkit-backdrop-filter: blur(var(--glass-blur-strong));
  
  /* Safe area */
  padding-bottom: env(safe-area-inset-bottom);
  
  /* Border on top only */
  border-top: var(--glass-border-width) solid hsla(var(--glass-tint) / var(--glass-border-opacity));
  
  /* Ensure it's above content */
  z-index: var(--z-mobile-bottom-nav, 40);
}

/* Hide on desktop where we use sidebar */
@media (min-width: 1024px) {
  .glass-enabled .glass-bottom-nav {
    display: none;
  }
}
```

#### Modal/Sheet

```css
/* Glass bottom sheet (mobile) vs centered modal (desktop) */
.glass-enabled .glass-sheet {
  /* Mobile: bottom sheet */
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-height: 90vh;
  border-radius: 20px 20px 0 0;
  padding-bottom: env(safe-area-inset-bottom);
  
  /* Glass */
  background: hsla(var(--glass-tint) / var(--glass-opacity));
  backdrop-filter: blur(var(--glass-blur-strong));
  -webkit-backdrop-filter: blur(var(--glass-blur-strong));
}

@media (min-width: 640px) {
  .glass-enabled .glass-sheet {
    /* Tablet+: centered modal */
    bottom: auto;
    top: 50%;
    left: 50%;
    right: auto;
    transform: translate(-50%, -50%);
    max-width: 500px;
    width: calc(100% - 32px);
    max-height: 85vh;
    border-radius: 20px;
    padding-bottom: 0;
  }
}
```

### Battery & Performance Awareness

#### Automatic Quality Reduction

Detect when to reduce glass quality for battery life:

```typescript
// lib/useGlassPerformance.ts
export function useGlassPerformance() {
  const [performanceMode, setPerformanceMode] = useState<'full' | 'reduced' | 'minimal'>('full');
  
  useEffect(() => {
    // Check for battery API
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        const updateMode = () => {
          if (battery.level < 0.2 && !battery.charging) {
            setPerformanceMode('minimal');
          } else if (battery.level < 0.4 && !battery.charging) {
            setPerformanceMode('reduced');
          } else {
            setPerformanceMode('full');
          }
        };
        
        updateMode();
        battery.addEventListener('levelchange', updateMode);
        battery.addEventListener('chargingchange', updateMode);
        
        return () => {
          battery.removeEventListener('levelchange', updateMode);
          battery.removeEventListener('chargingchange', updateMode);
        };
      });
    }
    
    // Check for data saver mode
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      if (conn?.saveData) {
        setPerformanceMode('minimal');
      }
    }
  }, []);
  
  return performanceMode;
}
```

Apply performance modes via CSS classes:

```css
/* Reduced glass mode (low battery) */
.glass-performance-reduced {
  --glass-blur: 6px;
  --glass-blur-strong: 10px;
  --glass-glow-opacity: 0.05;
  --glass-opacity: 0.9;
}

/* Minimal glass mode (very low battery / data saver) */
.glass-performance-minimal {
  --glass-blur: 4px;
  --glass-blur-strong: 6px;
  --glass-glow-opacity: 0;
  --glass-glow-spread: 0;
  --glass-opacity: 0.95;
  --glass-highlight-opacity: 0;
}

/* Completely disable blur in minimal mode */
.glass-performance-minimal .glass,
.glass-performance-minimal .glass-subtle,
.glass-performance-minimal .glass-strong,
.glass-performance-minimal .glass-full {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
```

#### Respect System Preferences

```css
/* Reduce transparency preference (macOS/iOS accessibility setting) */
@media (prefers-reduced-transparency: reduce) {
  .glass-enabled .glass,
  .glass-enabled .glass-subtle,
  .glass-enabled .glass-strong,
  .glass-enabled .glass-full {
    background: hsl(var(--card)) !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
}

/* Reduced motion also simplifies glass */
@media (prefers-reduced-motion: reduce) {
  .glass-enabled .glass-interactive {
    transition: none !important;
    transform: none !important;
  }
  
  .glass-enabled .glass-shimmer::after {
    animation: none !important;
  }
}
```

### Auto-Disable Glass Option

Allow users to auto-disable glass on mobile for performance:

```typescript
// In ThemeContext
interface ThemeContextType {
  // ... existing ...
  glassEnabled: boolean;
  setGlassEnabled: (enabled: boolean) => void;
  glassAutoDisableMobile: boolean;  // NEW
  setGlassAutoDisableMobile: (auto: boolean) => void;  // NEW
}

// In ThemeProvider
const [glassAutoDisableMobile, setGlassAutoDisableMobile] = useState(false);

// Compute effective glass state
const effectiveGlassEnabled = useMemo(() => {
  if (!glassEnabled) return false;
  if (glassAutoDisableMobile && isMobileDevice()) return false;
  return true;
}, [glassEnabled, glassAutoDisableMobile]);

function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 640 || 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
```

Settings UI:

```tsx
<div className="space-y-4">
  <div className="flex items-center justify-between">
    <div>
      <Label>Glass Effects</Label>
      <p className="text-sm text-muted-foreground">Enable frosted glass UI</p>
    </div>
    <Switch checked={glassEnabled} onCheckedChange={setGlassEnabled} />
  </div>
  
  {glassEnabled && (
    <div className="flex items-center justify-between pl-4 border-l-2 border-border">
      <div>
        <Label>Auto-disable on mobile</Label>
        <p className="text-sm text-muted-foreground">Save battery on phones</p>
      </div>
      <Switch 
        checked={glassAutoDisableMobile} 
        onCheckedChange={setGlassAutoDisableMobile} 
      />
    </div>
  )}
</div>
```

### Orientation Handling

```css
/* Landscape on mobile: reduce glass to save screen real estate */
@media (max-width: 640px) and (orientation: landscape) {
  :root {
    --glass-blur: 6px;
    --glass-opacity: 0.9;
  }
  
  /* Collapse glass headers in landscape */
  .glass-enabled .glass-header-collapsible {
    padding-top: 8px;
    padding-bottom: 8px;
  }
}
```

### PWA Install Prompt with Glass

```css
/* Glass install banner */
.glass-enabled .glass-install-banner {
  position: fixed;
  bottom: calc(env(safe-area-inset-bottom) + 16px);
  left: 16px;
  right: 16px;
  
  padding: 16px;
  border-radius: 16px;
  
  background: hsla(var(--glass-tint) / var(--glass-opacity-strong));
  backdrop-filter: blur(var(--glass-blur-strong));
  -webkit-backdrop-filter: blur(var(--glass-blur-strong));
  border: var(--glass-border-width) solid hsla(var(--glass-tint) / var(--glass-border-opacity));
  
  box-shadow: 
    0 0 var(--glass-glow-spread) hsla(var(--glass-glow-color) / var(--glass-glow-opacity)),
    0 10px 40px rgba(0, 0, 0, 0.2);
  
  z-index: 50;
}

@media (min-width: 640px) {
  .glass-enabled .glass-install-banner {
    left: auto;
    right: 24px;
    bottom: 24px;
    max-width: 360px;
  }
}
```

### Responsive Implementation Checklist

Add to Phase 1 checklist:

- [ ] Update CSS variables to be mobile-first (base = mobile)
- [ ] Add tablet breakpoint enhancements (640px)
- [ ] Add desktop breakpoint enhancements (1024px)
- [ ] Add large desktop enhancements (1280px)

Add to Phase 2 checklist:

- [ ] Add safe area padding to glass navigation elements
- [ ] Implement touch-friendly glass interactions
- [ ] Add `glass-bottom-nav` component for PWA
- [ ] Add `glass-sheet` responsive modal/sheet

Add to Phase 3 checklist:

- [ ] Implement `useGlassPerformance` hook for battery awareness
- [ ] Add performance mode CSS classes
- [ ] Add auto-disable on mobile option to settings
- [ ] Test on iOS Safari (notch, home indicator)
- [ ] Test on Android Chrome PWA mode
- [ ] Test landscape orientation handling

### Testing Matrix

| Device/Mode | Glass Blur | Glow | Touch Feedback | Notes |
|------------|-----------|------|----------------|-------|
| iPhone SE (small) | 8px | Minimal | Active state | Test safe areas |
| iPhone 14 Pro (notch) | 8px | Minimal | Active state | Test Dynamic Island |
| iPad | 10px | Subtle | Hover + Active | Test split view |
| Android Phone | 8px | Minimal | Active state | Test nav gestures |
| Desktop Chrome | 12px | Full | Hover states | Full effects |
| PWA Standalone | 10px | Medium | Active state | More app-like |
| Low Battery Mode | 4-6px | None | Minimal | Auto-detected |

---

## Future Enhancements

### Potential Phase 4+

1. **Preset glass styles** — "Subtle", "Standard", "Dramatic" intensity options
2. **Custom glass tint** — Let users pick their own accent color for glass
3. **Animated backgrounds** — Gradient meshes that move behind glass (like macOS)
4. **Glass intensity slider** — Fine-tune blur and opacity
5. **Per-component glass** — Enable glass only for specific UI areas

### Integration Points

- Treatment session cards could use glass for a calming effect
- Dashboard header could become glass on scroll
- Modal dialogs benefit greatly from glass backdrop
- Success/completion screens could use celebratory glass effects

---

## Implementation Checklist

### Phase 1 — Foundation
- [x] Add glass CSS variables to `:root` in `globals.css` (mobile-first defaults)
- [x] Add tablet breakpoint enhancements (640px+)
- [x] Add desktop breakpoint enhancements (1024px+)
- [x] Add large desktop enhancements (1280px+)
- [x] Add glass tint/glow variables to each `[data-theme="..."]` block
- [x] Add glass utility classes (`.glass`, `.glass-subtle`, `.glass-strong`, `.glass-full`)
- [x] Update `ThemeContextType` interface in `lib/theme.tsx`
- [x] Add `glassEnabled` state to `ThemeProvider`
- [x] Add localStorage persistence for glass preference
- [x] Add `glass-enabled` class toggle on document root

### Phase 2 — Component Integration
- [x] Add `glass` variant to Card component
- [x] Add glass button variants
- [x] Add glass toggle to Settings page (Appearance section)
- [x] Add glass toggle to ThemeDropdown (optional, for quick access)
- [ ] Update ThemePreviewCard to show glass preview when enabled
- [x] Add safe area padding to glass navigation elements
- [x] Implement touch-friendly glass interactions (`.glass-touchable`)
- [x] Add `glass-bottom-nav` component for PWA
- [ ] Add `glass-sheet` responsive modal/sheet component

### Phase 3 — Polish
- [x] Add specular highlight classes
- [ ] Add depth layer system
- [x] Add interactive hover/focus glow (desktop only via `@media (hover: hover)`)
- [x] Add touch feedback for mobile (`:active` states)
- [x] Add shimmer animation (`.glass-shimmer`, `.glass-shimmer-hover`, `.glass-pulse`)
- [x] Add high contrast mode fallback
- [x] Add reduced motion support
- [x] Add reduced transparency support (`prefers-reduced-transparency`)
- [x] Implement `useGlassPerformance` hook for battery awareness
- [x] Add performance mode CSS classes (`.glass-performance-reduced`, `.glass-performance-minimal`)
- [x] Add auto-disable on mobile option to settings
- [x] Add PWA standalone mode detection enhancements

### Testing — Cross-Platform
- [ ] Test all 8 themes with glass enabled
- [ ] Test glass disabled fallback
- [ ] Test high contrast mode
- [ ] Test reduced motion preference
- [ ] Test backdrop-filter fallback (older browsers)
- [ ] Verify focus indicators are visible

### Testing — Mobile/PWA
- [ ] Test on iPhone SE (small screen, safe areas)
- [ ] Test on iPhone with notch/Dynamic Island
- [ ] Test on iPad (tablet breakpoint, split view)
- [ ] Test on Android phone (various sizes)
- [ ] Test PWA standalone mode (installed app)
- [ ] Test landscape orientation
- [ ] Test with low battery (if battery API available)
- [ ] Test with Data Saver mode enabled
- [ ] Test touch interactions (active states, no hover jank)
- [ ] Test glass bottom navigation with home indicator
- [ ] Test glass sheets/modals with safe areas

---

## Quick Reference: Class Usage

```tsx
// Basic glass card
<Card className="glass">...</Card>

// Full glass with all effects
<div className="glass-full rounded-xl p-4">...</div>

// Subtle glass for backgrounds
<nav className="glass-subtle">...</nav>

// Strong glass for overlays
<div className="glass-strong">...</div>

// Interactive glass (hover/focus effects)
<button className="glass glass-interactive">...</button>

// Glass with specular highlight
<div className="glass-full glass-specular">...</div>

// Glass with shimmer animation
<div className="glass glass-shimmer">...</div>
```

---

## Files Summary

Complete list of files to create or modify:

| File | Action | Phase |
|------|--------|-------|
| `app/globals.css` | Modify | 1, 2, 3 |
| `lib/theme.tsx` | Modify | 1 |
| `lib/themes.ts` | Modify (optional) | 1 |
| `hooks/useGlassPerformance.ts` | Create | 3 |
| `components/ui/card.tsx` | Modify | 2 |
| `components/ui/button.tsx` | Modify | 2 |
| `components/theme/ThemeDropdown.tsx` | Modify | 2 |
| `components/theme/ThemePreviewCard.tsx` | Modify | 2 |
| `app/dashboard/settings/page.tsx` | Modify | 2 |
| `hooks/useGlassLight.ts` | Create (optional) | 3 |

---

*Document version: 1.1*  
*Last updated: January 5, 2026*  
*Added: Mobile-first & PWA responsive design section*

