# Mobile-First PWA Implementation Checklist - PASS 2

**Document Version:** 1.1 - Pass 2  
**Last Updated:** December 19, 2025  
**Prerequisite:** Pass 1 (Phase 0-2.2) should be completed

---

## 📱 Phase 2: Native Mobile Layout (Continued)

### 2.3 Create Mobile Bottom Navigation Component

**Estimated Time:** 1.5-2 hours  
**Goal:** Build iOS/Android-style bottom tab bar for mobile navigation

#### 2.3.1 Create Bottom Navigation Component File

**New File:** `components/layout/MobileBottomNav.tsx`

- [ ] **Step 2.3.1.1:** Create new file
  ```bash
  mkdir -p components/layout
  touch components/layout/MobileBottomNav.tsx
  ```

- [ ] **Step 2.3.1.2:** Add component implementation
  - [ ] Open `components/layout/MobileBottomNav.tsx`
  - [ ] Add 'use client' directive at top
  - [ ] Import required dependencies:
    - `usePathname`, `useRouter` from next/navigation
    - Icons: `Home`, `Target`, `Calendar`, `Users`, `Settings` from lucide-react
  - [ ] Define navItems array with 5 main sections:
    ```typescript
    const navItems = [
      { icon: Home, label: 'Home', href: '/dashboard' },
      { icon: Target, label: 'Goals', href: '/dashboard/goals' },
      { icon: Calendar, label: 'Sessions', href: '/dashboard/sessions' },
      { icon: Users, label: 'Clients', href: '/dashboard/team' },
      { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
    ];
    ```

- [ ] **Step 2.3.1.3:** Build component structure
  - [ ] Create functional component `MobileBottomNav`
  - [ ] Use `usePathname()` to get current route
  - [ ] Use `useRouter()` for navigation
  - [ ] Return nav element with:
    - Fixed positioning: `fixed bottom-0 left-0 right-0 z-50`
    - Background: `bg-white dark:bg-gray-900`
    - Border top: `border-t border-gray-200 dark:border-gray-800`
    - Safe area padding: `pb-safe` (for iPhone home indicator)
  - [ ] Map over navItems to create buttons

- [ ] **Step 2.3.1.4:** Style nav buttons
  - [ ] Each button should:
    - Be flex column layout: `flex flex-col items-center justify-center`
    - Take equal space: `flex-1`
    - Have full height: `h-full`
    - Show active state with color: `text-indigo-600` when active
    - Show inactive state: `text-gray-600 dark:text-gray-400`
    - Include transition: `transition-colors duration-200`
  - [ ] Icon should:
    - Be 24x24: `h-6 w-6`
    - Have small margin: `mb-1`
    - Scale slightly when active: `scale-110` with `transition-transform`
  - [ ] Label should:
    - Be extra small: `text-xs`
    - Be bold when active: `font-semibold`
    - Be normal when inactive: `font-normal`

- [ ] **Step 2.3.1.5:** Add active state logic
  - [ ] Check if current pathname matches button href
  - [ ] For non-dashboard routes, use `startsWith` for partial match
  - [ ] Dashboard exact match to prevent all items being active
  - [ ] Apply active styles conditionally

- [ ] **Step 2.3.1.6:** Add accessibility attributes
  - [ ] Each button needs:
    - `aria-label={item.label}`
    - `aria-current={isActive ? 'page' : undefined}`
    - `role="tab"` (optional, for tab-like behavior)
  - [ ] Nav element needs:
    - `role="navigation"`
    - `aria-label="Main navigation"`

- [ ] **Step 2.3.1.7:** Save and export component
  - [ ] Add default export
  - [ ] Save file

#### 2.3.2 Test Bottom Navigation Component

- [ ] **Step 2.3.2.1:** Create test page to preview component
  - [ ] Temporarily add to `app/dashboard/page.tsx`:
    ```typescript
    import MobileBottomNav from '@/components/layout/MobileBottomNav';
    
    // At bottom of return statement (after closing main div)
    <MobileBottomNav />
    ```

- [ ] **Step 2.3.2.2:** Run dev server and test
  ```bash
  npm run dev
  ```
  - [ ] Open http://localhost:3000/dashboard
  - [ ] Open DevTools mobile view (iPhone SE)
  - [ ] Verify bottom nav appears
  - [ ] Verify 5 tabs are visible
  - [ ] Check spacing is even

- [ ] **Step 2.3.2.3:** Test navigation
  - [ ] Click each tab
  - [ ] Verify correct page loads
  - [ ] Verify active state highlights correctly
  - [ ] Check dark mode styling
  - [ ] Test on actual iPhone (if available)

- [ ] **Step 2.3.2.4:** Test safe area on iPhone X+
  - [ ] Use DevTools → iPhone 12 Pro or newer
  - [ ] Verify bottom padding accounts for home indicator
  - [ ] Nav items should not overlap gesture area

- [ ] **Step 2.3.2.5:** Remove temporary import
  - [ ] Remove MobileBottomNav from dashboard/page.tsx
  - [ ] We'll add it properly in layout component next

- [ ] **Step 2.3.2.6:** Commit bottom navigation component
  ```bash
  git add components/layout/MobileBottomNav.tsx
  git commit -m "Feature: iOS-style bottom navigation for mobile"
  ```

**Verification Checklist:**
- [ ] Bottom nav displays at bottom of screen
- [ ] 5 tabs visible with icons and labels
- [ ] Active tab highlighted in indigo
- [ ] Clicking tabs navigates correctly
- [ ] Works in dark mode
- [ ] Safe area padding on iPhone X+

---

### 2.4 Create Mobile Header Component

**Estimated Time:** 1 hour  
**Goal:** Build iOS-style compact header with user info and notifications

#### 2.4.1 Create Mobile Header Component File

**New File:** `components/layout/MobileHeader.tsx`

- [ ] **Step 2.4.1.1:** Create new file
  ```bash
  touch components/layout/MobileHeader.tsx
  ```

- [ ] **Step 2.4.1.2:** Add component implementation
  - [ ] Open `components/layout/MobileHeader.tsx`
  - [ ] Add 'use client' directive
  - [ ] Import dependencies:
    - `useAuth` from @/lib/auth
    - `Bell` icon from lucide-react
    - `useState` from react

- [ ] **Step 2.4.1.3:** Build header structure
  - [ ] Create functional component `MobileHeader`
  - [ ] Use `useAuth()` to get user profile
  - [ ] Create header element with:
    - Sticky positioning: `sticky top-0 z-40`
    - Backdrop blur: `bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg`
    - Border bottom: `border-b border-gray-200 dark:border-gray-800`
    - Safe area top padding: `pt-safe`
    - Inner container: `px-4 h-14 flex items-center justify-between`

- [ ] **Step 2.4.1.4:** Add left side (user info)
  - [ ] Display user's first name in bold
  - [ ] Display current date below name
  - [ ] Use format: "Thursday, Dec 19"
  - [ ] Styling:
    - Name: `text-lg font-bold text-gray-900 dark:text-white`
    - Date: `text-xs text-gray-500 dark:text-gray-400`

- [ ] **Step 2.4.1.5:** Add right side (notifications button)
  - [ ] Create button with Bell icon
  - [ ] Styling:
    - Round button: `p-2 rounded-full`
    - Background: `bg-gray-100 dark:bg-gray-800`
    - Icon: `h-5 w-5 text-gray-600 dark:text-gray-400`
  - [ ] Add onClick handler (can be placeholder for now)
  - [ ] Add accessibility: `aria-label="Notifications"`

- [ ] **Step 2.4.1.6:** Optional: Add notification badge
  - [ ] Add small red dot for unread notifications
  - [ ] Positioning: `absolute top-0 right-0`
  - [ ] Styling: `h-2 w-2 bg-red-500 rounded-full`
  - [ ] Can use state: `const [hasNotifications, setHasNotifications] = useState(false)`

- [ ] **Step 2.4.1.7:** Save and export component
  - [ ] Add default export
  - [ ] Save file

#### 2.4.2 Test Mobile Header Component

- [ ] **Step 2.4.2.1:** Temporarily add to dashboard page
  - [ ] Import in `app/dashboard/page.tsx`
  - [ ] Add at top of return (before page content)

- [ ] **Step 2.4.2.2:** Test rendering
  - [ ] Verify user name displays
  - [ ] Verify date is current
  - [ ] Verify notification button appears
  - [ ] Test sticky behavior (scroll down, header stays)
  - [ ] Test dark mode

- [ ] **Step 2.4.2.3:** Remove temporary import
  - [ ] Will add properly in mobile layout next

- [ ] **Step 2.4.2.4:** Commit mobile header
  ```bash
  git add components/layout/MobileHeader.tsx
  git commit -m "Feature: iOS-style mobile header component"
  ```

**Verification Checklist:**
- [ ] Header displays user's first name
- [ ] Current date shows below name
- [ ] Notification button visible
- [ ] Header sticks to top when scrolling
- [ ] Backdrop blur effect works
- [ ] Works in dark mode
- [ ] Safe area respected on iPhone with notch

---

### 2.5 Create Mobile Layout Component

**Estimated Time:** 2-3 hours  
**Goal:** Build complete mobile-specific layout structure

#### 2.5.1 Create Mobile Layout File

**New File:** `app/dashboard/layout.mobile.tsx`

- [ ] **Step 2.5.1.1:** Create new file
  ```bash
  touch app/dashboard/layout.mobile.tsx
  ```

- [ ] **Step 2.5.1.2:** Add imports and setup
  - [ ] Open `app/dashboard/layout.mobile.tsx`
  - [ ] Add 'use client' directive
  - [ ] Import dependencies:
    - `useAuth` from @/lib/auth
    - `ThemeProvider` from @/lib/theme
    - `MobileBottomNav` from @/components/layout/MobileBottomNav
    - `MobileHeader` from @/components/layout/MobileHeader
    - `V4AudioPreloader` from @/components/treatment/v4/V4AudioPreloader
    - `useRouter` from next/navigation
    - `useEffect` from react

- [ ] **Step 2.5.1.3:** Create component structure
  - [ ] Create functional component `MobileDashboardLayout`
  - [ ] Accept props: `{ children: React.ReactNode }`
  - [ ] Use `useAuth()` hook for user/profile/loading
  - [ ] Use `useRouter()` for redirects

- [ ] **Step 2.5.1.4:** Add auth checking logic
  - [ ] Show loading spinner while auth loading
  - [ ] Redirect to /auth if no user
  - [ ] Allow super_admin without tenant
  - [ ] Same logic as desktop layout

- [ ] **Step 2.5.1.5:** Build mobile layout structure
  - [ ] Wrap everything in `<ThemeProvider>`
  - [ ] Add `<V4AudioPreloader />` at top level
  - [ ] Create main container:
    ```typescript
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-16 pt-safe">
    ```
  - [ ] Add `<MobileHeader />`
  - [ ] Add main content area:
    ```typescript
    <main className="min-h-[calc(100vh-8rem)]">
      {children}
    </main>
    ```
  - [ ] Add `<MobileBottomNav />` at bottom

- [ ] **Step 2.5.1.6:** Add page transition effect (optional)
  - [ ] Install framer-motion: `npm install framer-motion`
  - [ ] Wrap children in motion.div
  - [ ] Add fade in animation
  - [ ] This is OPTIONAL - skip if you prefer simplicity

- [ ] **Step 2.5.1.7:** Add scroll restoration
  - [ ] Use useEffect to scroll to top on route change
  - [ ] Listen to pathname changes
  - [ ] Call `window.scrollTo(0, 0)` on change

- [ ] **Step 2.5.1.8:** Save and export component
  - [ ] Export as default
  - [ ] Save file

#### 2.5.2 Rename Current Desktop Layout

**Goal:** Separate mobile and desktop layouts clearly

- [ ] **Step 2.5.2.1:** Rename existing layout file
  ```bash
  mv app/dashboard/layout.tsx app/dashboard/layout.desktop.tsx
  ```

- [ ] **Step 2.5.2.2:** Update export in desktop layout
  - [ ] Open `app/dashboard/layout.desktop.tsx`
  - [ ] Change export name to `DesktopDashboardLayout`
  - [ ] Keep all existing code the same
  - [ ] Save file

- [ ] **Step 2.5.2.3:** Commit desktop layout rename
  ```bash
  git add app/dashboard/layout.desktop.tsx
  git commit -m "Refactor: Rename layout to layout.desktop for clarity"
  ```

---

### 2.6 Create Adaptive Layout Switcher

**Estimated Time:** 1 hour  
**Goal:** Automatically switch between mobile and desktop layouts

#### 2.6.1 Create Main Layout Switcher

**New File:** `app/dashboard/layout.tsx`

- [ ] **Step 2.6.1.1:** Create new layout file
  ```bash
  touch app/dashboard/layout.tsx
  ```

- [ ] **Step 2.6.1.2:** Add layout switcher logic
  - [ ] Open `app/dashboard/layout.tsx`
  - [ ] Add 'use client' directive
  - [ ] Import both layouts:
    - `DesktopDashboardLayout` from ./layout.desktop
    - `MobileDashboardLayout` from ./layout.mobile
  - [ ] Import hooks: `useEffect`, `useState` from react

- [ ] **Step 2.6.1.3:** Implement detection logic
  - [ ] Create state: `const [isMobile, setIsMobile] = useState(false)`
  - [ ] Create state: `const [isClient, setIsClient] = useState(false)`
  - [ ] Use useEffect to detect screen size:
    ```typescript
    useEffect(() => {
      setIsClient(true);
      const checkMobile = () => {
        setIsMobile(window.innerWidth < 768);
      };
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }, []);
    ```

- [ ] **Step 2.6.1.4:** Render appropriate layout
  - [ ] Show loading/skeleton if not client-side yet (prevent hydration)
  - [ ] If isMobile: render `<MobileDashboardLayout>`
  - [ ] If desktop: render `<DesktopDashboardLayout>`
  - [ ] Pass children to both

- [ ] **Step 2.6.1.5:** Handle SSR gracefully
  - [ ] During SSR, render neutral skeleton
  - [ ] Once client renders, show correct layout
  - [ ] Prevents flash of wrong layout

- [ ] **Step 2.6.1.6:** Save component
  - [ ] Export as default
  - [ ] Save file

#### 2.6.2 Test Layout Switcher

- [ ] **Step 2.6.2.1:** Test automatic switching
  ```bash
  npm run dev
  ```
  - [ ] Open http://localhost:3000/dashboard
  - [ ] Desktop view should show sidebar layout
  - [ ] Toggle DevTools mobile view
  - [ ] Should switch to bottom nav layout
  - [ ] Resize browser window
  - [ ] Should switch at 768px breakpoint

- [ ] **Step 2.6.2.2:** Test all pages in mobile mode
  - [ ] Dashboard: /dashboard
  - [ ] Goals: /dashboard/goals
  - [ ] Sessions: /dashboard/sessions
  - [ ] Clients: /dashboard/team
  - [ ] Settings: /dashboard/settings
  - [ ] Verify header and bottom nav on all pages
  - [ ] Verify content doesn't overlap nav

- [ ] **Step 2.6.2.3:** Test all pages in desktop mode
  - [ ] Same pages as above
  - [ ] Verify sidebar appears
  - [ ] Verify no bottom nav
  - [ ] Verify hamburger menu works

- [ ] **Step 2.6.2.4:** Test transitions
  - [ ] Start in desktop
  - [ ] Resize to mobile
  - [ ] Should switch smoothly
  - [ ] No console errors

- [ ] **Step 2.6.2.5:** Commit layout switcher
  ```bash
  git add app/dashboard/layout.tsx app/dashboard/layout.mobile.tsx
  git commit -m "Feature: Adaptive layout switcher for mobile/desktop"
  ```

**Verification Checklist:**
- [ ] Desktop (≥768px) shows sidebar layout
- [ ] Mobile (<768px) shows bottom nav layout
- [ ] Switching works smoothly when resizing
- [ ] All dashboard pages work in both modes
- [ ] No hydration errors in console
- [ ] Auth checking works in both layouts

---

## 🎨 Phase 3: Enhanced Mobile Interactions (Week 2, Days 1-3)

**Estimated Time:** 8-10 hours  
**Goal:** Add native-feeling interactions and polish

### 3.1 Improve Mobile Menu & Navigation

**Estimated Time:** 2 hours

#### 3.1.1 Add Auto-Close Sidebar on Route Change

**File:** `app/dashboard/layout.desktop.tsx`

- [ ] **Step 3.1.1.1:** Add route change listener
  - [ ] Open `app/dashboard/layout.desktop.tsx`
  - [ ] Import `usePathname` (if not already imported)
  - [ ] Add useEffect watching pathname:
    ```typescript
    useEffect(() => {
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      if (isMobile) {
        setSidebarOpen(false);
      }
    }, [pathname]);
    ```

- [ ] **Step 3.1.1.2:** Add body scroll lock
  - [ ] Add useEffect watching sidebarOpen:
    ```typescript
    useEffect(() => {
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      if (isMobile && sidebarOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
      return () => {
        document.body.style.overflow = '';
      };
    }, [sidebarOpen]);
    ```

- [ ] **Step 3.1.1.3:** Test auto-close behavior
  - [ ] Open sidebar on mobile
  - [ ] Click a nav link
  - [ ] Sidebar should close automatically
  - [ ] Background should become scrollable again

#### 3.1.2 Improve Backdrop Transitions

**File:** `app/dashboard/layout.desktop.tsx`

- [ ] **Step 3.1.2.1:** Add smooth backdrop transition
  - [ ] Find mobile sidebar section (around line 127)
  - [ ] Update backdrop div:
    ```typescript
    <div 
      className="fixed inset-0 bg-gray-600 transition-opacity duration-300"
      style={{ opacity: sidebarOpen ? 0.75 : 0 }}
      onClick={() => setSidebarOpen(false)} 
    />
    ```

- [ ] **Step 3.1.2.2:** Add sidebar slide animation
  - [ ] Update sidebar container:
    ```typescript
    <div className={`relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-gray-800 transform transition-transform duration-300 ${
      sidebarOpen ? 'translate-x-0' : '-translate-x-full'
    }`}>
    ```

- [ ] **Step 3.1.2.3:** Update outer container visibility
  - [ ] Change container div:
    ```typescript
    <div className={`fixed inset-0 flex z-40 md:hidden transition-opacity duration-300 ${
      sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
    }`}>
    ```

- [ ] **Step 3.1.2.4:** Test smooth transitions
  - [ ] Open/close sidebar
  - [ ] Should slide smoothly (300ms)
  - [ ] Backdrop should fade in/out
  - [ ] No jarring jumps

#### 3.1.3 Improve Hamburger Button

**File:** `app/dashboard/layout.desktop.tsx`

- [ ] **Step 3.1.3.1:** Enhance button styling
  - [ ] Find hamburger button (around line 121)
  - [ ] Update classes:
    ```typescript
    className="fixed top-3 left-3 z-50 h-12 w-12 inline-flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 shadow-lg md:top-4 md:left-4"
    ```

- [ ] **Step 3.1.3.2:** Add accessibility attributes
  - [ ] Add aria attributes:
    ```typescript
    aria-label={sidebarOpen ? "Close menu" : "Open menu"}
    aria-expanded={sidebarOpen}
    ```

- [ ] **Step 3.1.3.3:** Test button
  - [ ] Should have hover effect
  - [ ] Should have active/pressed state
  - [ ] Should announce state to screen readers

- [ ] **Step 3.1.3.4:** Commit menu improvements
  ```bash
  git add app/dashboard/layout.desktop.tsx
  git commit -m "Improve: Mobile menu transitions and interactions"
  ```

**Verification Checklist:**
- [ ] Sidebar auto-closes when clicking nav link
- [ ] Body scroll locks when sidebar open
- [ ] Backdrop fades in/out smoothly
- [ ] Sidebar slides in/out (not instant)
- [ ] Button has proper hover/active states
- [ ] Accessible to screen readers

---

### 3.2 Add Loading Skeletons

**Estimated Time:** 2-3 hours  
**Goal:** Replace spinners with modern skeleton loaders

#### 3.2.1 Create Skeleton Components

**New File:** `components/ui/skeleton.tsx`

- [ ] **Step 3.2.1.1:** Create skeleton file
  ```bash
  touch components/ui/skeleton.tsx
  ```

- [ ] **Step 3.2.1.2:** Create base Skeleton component
  - [ ] Open `components/ui/skeleton.tsx`
  - [ ] Create simple animated skeleton div
  - [ ] Use: `bg-gray-200 dark:bg-gray-700 rounded animate-pulse`

- [ ] **Step 3.2.1.3:** Create SkeletonCard component
  - [ ] Card-shaped skeleton with title and text lines
  - [ ] Used for stats cards, activity feed, etc.

- [ ] **Step 3.2.1.4:** Create SkeletonList component
  - [ ] Multiple rows for list views
  - [ ] Used for client lists, goal lists, etc.

- [ ] **Step 3.2.1.5:** Create SkeletonHeader component
  - [ ] Title and subtitle skeleton
  - [ ] Used for page headers

- [ ] **Step 3.2.1.6:** Export all skeleton components
  - [ ] Export as named exports
  - [ ] Save file

#### 3.2.2 Apply Skeletons to Dashboard

**File:** `app/dashboard/page.tsx`

- [ ] **Step 3.2.2.1:** Import skeleton components
  - [ ] Import from @/components/ui/skeleton

- [ ] **Step 3.2.2.2:** Replace stats loading spinner
  - [ ] Find stats grid loading state (around line 196)
  - [ ] Replace with SkeletonCard components
  - [ ] Should show 4 skeleton cards in grid

- [ ] **Step 3.2.2.3:** Replace activity feed loading
  - [ ] Find activity section loading state
  - [ ] Replace with SkeletonList component

- [ ] **Step 3.2.2.4:** Test skeleton loading
  - [ ] Add artificial delay to test:
    ```typescript
    await new Promise(resolve => setTimeout(resolve, 2000));
    ```
  - [ ] Verify skeletons appear
  - [ ] Verify smooth transition to real content
  - [ ] Remove artificial delay

- [ ] **Step 3.2.2.5:** Commit skeleton components
  ```bash
  git add components/ui/skeleton.tsx app/dashboard/page.tsx
  git commit -m "Feature: Loading skeletons for better UX"
  ```

**Verification Checklist:**
- [ ] Skeletons appear during loading
- [ ] Skeletons match layout of actual content
- [ ] Smooth transition when data loads
- [ ] Works in dark mode
- [ ] No layout shift when content appears

---

### 3.3 Add Pull-to-Refresh

**Estimated Time:** 2-3 hours  
**Goal:** Native pull-to-refresh gesture on mobile lists

#### 3.3.1 Create Pull-to-Refresh Component

**New File:** `components/mobile/PullToRefresh.tsx`

- [ ] **Step 3.3.1.1:** Create directory and file
  ```bash
  mkdir -p components/mobile
  touch components/mobile/PullToRefresh.tsx
  ```

- [ ] **Step 3.3.1.2:** Implement pull-to-refresh logic
  - [ ] Open `components/mobile/PullToRefresh.tsx`
  - [ ] Add 'use client' directive
  - [ ] Import useState, useEffect, useRef
  - [ ] Import RefreshCw icon from lucide-react
  - [ ] Define props interface:
    ```typescript
    interface PullToRefreshProps {
      onRefresh: () => Promise<void>;
      children: React.ReactNode;
    }
    ```

- [ ] **Step 3.3.1.3:** Add touch event handlers
  - [ ] Track touch start Y position
  - [ ] Track pull distance during move
  - [ ] Trigger refresh when released past threshold (60px)
  - [ ] Show spinning icon during refresh
  - [ ] Use requestAnimationFrame for smooth animation

- [ ] **Step 3.3.1.4:** Add visual feedback
  - [ ] Show RefreshCw icon that moves with pull
  - [ ] Icon should rotate when refreshing
  - [ ] Fade in as user pulls down
  - [ ] Position: fixed at top, centered

- [ ] **Step 3.3.1.5:** Prevent default scroll
  - [ ] Only prevent when at top of scroll (window.scrollY === 0)
  - [ ] Use { passive: false } for touchmove listener
  - [ ] Clean up event listeners on unmount

- [ ] **Step 3.3.1.6:** Save component
  - [ ] Export as default
  - [ ] Save file

#### 3.3.2 Apply Pull-to-Refresh to Pages

**File:** `app/dashboard/page.tsx`

- [ ] **Step 3.3.2.1:** Import PullToRefresh
  - [ ] Add import from @/components/mobile/PullToRefresh

- [ ] **Step 3.3.2.2:** Wrap content in PullToRefresh
  - [ ] Wrap entire return content
  - [ ] Pass refresh function that re-fetches data
  - [ ] Example:
    ```typescript
    <PullToRefresh onRefresh={async () => {
      await fetchDashboardData();
    }}>
      {/* existing content */}
    </PullToRefresh>
    ```

- [ ] **Step 3.3.2.3:** Test pull-to-refresh
  - [ ] Open on mobile device or DevTools mobile view
  - [ ] Scroll to top of page
  - [ ] Pull down from top
  - [ ] Should see refresh icon
  - [ ] Release after pulling >60px
  - [ ] Should trigger refresh
  - [ ] Icon should spin during refresh

- [ ] **Step 3.3.2.4:** Apply to other list pages
  - [ ] Goals page: /dashboard/goals/page.tsx
  - [ ] Clients page: /dashboard/team/page.tsx
  - [ ] Sessions page: /dashboard/sessions/page.tsx
  - [ ] Wrap each in PullToRefresh with appropriate refresh function

- [ ] **Step 3.3.2.5:** Commit pull-to-refresh
  ```bash
  git add components/mobile/PullToRefresh.tsx app/dashboard/page.tsx app/dashboard/goals/page.tsx app/dashboard/team/page.tsx app/dashboard/sessions/page.tsx
  git commit -m "Feature: Pull-to-refresh gesture for mobile lists"
  ```

**Verification Checklist:**
- [ ] Pull gesture works on mobile
- [ ] Refresh icon appears when pulling
- [ ] Icon rotates during refresh
- [ ] Data reloads when refresh triggered
- [ ] Doesn't interfere with normal scrolling
- [ ] Works only when at top of page

---

### 3.4 Add Haptic Feedback

**Estimated Time:** 1 hour  
**Goal:** Subtle vibration feedback for interactions

#### 3.4.1 Create Haptics Utility

**New File:** `lib/haptics.ts`

- [ ] **Step 3.4.1.1:** Create haptics file
  ```bash
  touch lib/haptics.ts
  ```

- [ ] **Step 3.4.1.2:** Implement haptic patterns
  - [ ] Open `lib/haptics.ts`
  - [ ] Create haptics object with methods:
    - `light()` - 10ms vibration (for taps)
    - `medium()` - 20ms vibration (for switches)
    - `heavy()` - pattern [10, 20, 10] (for important actions)
    - `success()` - pattern [10, 50, 10] (for confirmations)
    - `error()` - pattern [50, 100, 50] (for errors)
  - [ ] Check if `navigator.vibrate` exists before calling
  - [ ] Export haptics object

- [ ] **Step 3.4.1.3:** Save haptics utility
  - [ ] Export as named export
  - [ ] Save file

#### 3.4.2 Apply Haptics to Interactions

**File:** `components/layout/MobileBottomNav.tsx`

- [ ] **Step 3.4.2.1:** Import haptics
  - [ ] Add import: `import { haptics } from '@/lib/haptics'`

- [ ] **Step 3.4.2.2:** Add to tab clicks
  - [ ] In button onClick, add:
    ```typescript
    onClick={() => {
      haptics.light();
      router.push(item.href);
    }}
    ```

**File:** `app/dashboard/settings/page.tsx`

- [ ] **Step 3.4.2.3:** Add to toggle switches
  - [ ] Import haptics
  - [ ] Add to dark mode toggle
  - [ ] Add to other setting toggles
  - [ ] Use `haptics.medium()` for toggles

**File:** `components/ui/button.tsx`

- [ ] **Step 3.4.2.4:** Optional: Add to all buttons
  - [ ] Can add haptics to button component
  - [ ] Only if variant is not "ghost" or "link"
  - [ ] Use `haptics.light()` on click

- [ ] **Step 3.4.2.5:** Test haptic feedback
  - [ ] Test on actual mobile device (emulator won't vibrate)
  - [ ] Click bottom nav tabs - should feel light vibration
  - [ ] Toggle settings - should feel slightly longer
  - [ ] Verify doesn't annoy (should be subtle)

- [ ] **Step 3.4.2.6:** Commit haptic feedback
  ```bash
  git add lib/haptics.ts components/layout/MobileBottomNav.tsx app/dashboard/settings/page.tsx
  git commit -m "Feature: Haptic feedback for mobile interactions"
  ```

**Verification Checklist:**
- [ ] Light vibration on tab navigation
- [ ] Medium vibration on toggle switches
- [ ] Only works on devices that support vibration
- [ ] Doesn't crash on devices without vibration API
- [ ] Feels natural and subtle (not annoying)

---

## ⏭️ Next Pass (Pass 3)

### Pass 3 Will Cover:
- Phase 4: V4 Treatment Migration & Loading States
  - Audio preload progress indicator
  - Treatment session quick access
  - Remove from Labs section
- Phase 5: PWA Offline Support
  - Service worker configuration
  - Cache strategies
  - Offline fallback pages
- Phase 6: Final Polish & Comprehensive Testing
  - All pages responsive check
  - Performance optimization
  - Production deployment checklist

---

## 🎯 Current Progress Tracker

**Phase 0: Preparation** ✅
- [x] Complete

**Phase 1: Foundation & Critical Fixes** 
- [ ] 1.1 Dark Mode Fix
- [ ] 1.2 Horizontal Scrolling Fix
- [ ] 1.3 Compact Mobile Layouts

**Phase 2: Native Mobile Layout**
- [ ] 2.1 PWA Manifest ✅
- [ ] 2.2 iOS Meta Tags ✅
- [ ] 2.3 Bottom Navigation
- [ ] 2.4 Mobile Header
- [ ] 2.5 Mobile Layout Component
- [ ] 2.6 Layout Switcher

**Phase 3: Enhanced Mobile Interactions**
- [ ] 3.1 Mobile Menu Improvements
- [ ] 3.2 Loading Skeletons
- [ ] 3.3 Pull-to-Refresh
- [ ] 3.4 Haptic Feedback

**Phase 4-6:** (Pass 3)
- [ ] To be detailed

---

## 📝 Testing Notes

### Critical Testing Points for Pass 2:

After completing Phase 2:
- [ ] Test on iPhone SE (375px) - smallest modern iPhone
- [ ] Test on iPhone 12/13 (390px) - most common
- [ ] Test on Pixel 5 (393px) - Android reference
- [ ] Test on iPad (768px) - should show desktop layout
- [ ] Test layout switching by resizing browser
- [ ] Test all 5 main pages in both layouts
- [ ] Test dark mode in both layouts
- [ ] Test with real touch device (not just DevTools)

### Common Issues to Watch:

- **Layout not switching:** Check breakpoint is exactly 768px
- **Hydration errors:** Ensure isClient state prevents SSR mismatch
- **Bottom nav covered by content:** Check pb-16 on container
- **Safe area not working:** Verify pt-safe and pb-safe classes in globals.css
- **Icons not loading:** Check lucide-react imports are correct
- **Dark mode broken in mobile:** Verify ThemeProvider wraps mobile layout

---

**Document Version:** 1.1 - Pass 2 Complete  
**Last Updated:** December 19, 2025  
**Next:** Request Pass 3 for Phases 4-6
