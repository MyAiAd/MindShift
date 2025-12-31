# Authentication Components

## MobileAuthControl

A compact, mobile-optimized authentication control component that saves space on small screens while maintaining excellent UX.

### Features

- **3-State Toggle Design**: Collapsed → Sign In → Sign Up
- **Space-Efficient**: Starts as a compact "Auth" button (minimal space)
- **Expandable**: Taps to reveal Sign In and Sign Up options
- **Collapsible**: X button to return to compact state
- **Responsive**: Only shows on mobile; desktop uses traditional buttons
- **Accessible**: Proper ARIA labels and keyboard navigation

### Usage

```tsx
import MobileAuthControl from '@/components/auth/MobileAuthControl'

// In your header component
<div className="flex items-center">
  {/* Mobile: Compact auth control */}
  <div className="md:hidden">
    <MobileAuthControl />
  </div>
  {/* Desktop: Traditional buttons */}
  <div className="hidden md:flex space-x-4">
    <Link href="/auth">Sign In</Link>
    <Link href="/auth">Get Started</Link>
  </div>
</div>
```

### States

1. **Collapsed (Default)**: Shows compact "Auth" button with login icon
2. **Sign In Selected**: Expands to show "Sign In | Sign Up | X"
3. **Sign Up Selected**: Same expanded view, highlights Sign Up

### Design Rationale

On mobile devices, having two separate buttons ("Sign In" and "Get Started") takes up valuable header space. This component solves that by:

- Starting in a collapsed state using minimal space
- Expanding on demand to show both options
- Using visual segmentation to clearly distinguish options
- Providing easy collapse functionality

### Styling

The component uses Tailwind CSS and follows the app's indigo color scheme:
- Border: `border-indigo-600`
- Active state: `bg-indigo-600 text-white`
- Hover states: `hover:bg-indigo-50`
- Compact design with proper touch targets for mobile

### Implementation Notes

- Uses React hooks (`useState`) for state management
- Client-side component (marked with `'use client'`)
- Links navigate to `/auth` with optional `?mode=signin` or `?mode=signup` query params
- Icons from `lucide-react`

---

## IconAuthButton

An ultra-compact icon-only authentication button for extreme space constraints.

### Features

- **Minimal Footprint**: Only 36x36px circular button
- **Simple & Direct**: Single tap goes directly to auth page
- **No Intermediate Steps**: Perfect for very small headers
- **Accessible**: Proper ARIA label for screen readers

### Usage

```tsx
import IconAuthButton from '@/components/auth/IconAuthButton'

// For extremely compact headers
<div className="flex items-center">
  <IconAuthButton />
</div>
```

### When to Use

Use `IconAuthButton` when:
- Space is extremely limited (e.g., narrow mobile headers)
- You need the absolute smallest authentication control
- User is already familiar with icon-only buttons
- Simplicity is more important than options

Use `MobileAuthControl` when:
- You want to differentiate between sign-in and sign-up
- You have slightly more space available
- Better UX with explicit labels is desired
- Progressive disclosure pattern fits your design

### Comparison

| Feature | MobileAuthControl | IconAuthButton |
|---------|-------------------|----------------|
| Width (collapsed) | ~70px | 36px |
| States | 3 (collapsed, signin, signup) | 1 (direct link) |
| User Choice | Yes | No (goes to auth page) |
| Best For | Standard mobile headers | Ultra-compact spaces |

