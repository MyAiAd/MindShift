# Accessibility Testing Guide

## Overview
This guide provides comprehensive accessibility testing procedures for the MindShifting PWA, focusing on mobile-first experiences with keyboard navigation and screen reader support.

## Testing Tools & Screen Readers

### iOS Testing
- **VoiceOver**: Built-in iOS screen reader
  - Enable: Settings > Accessibility > VoiceOver
  - Gestures:
    - Swipe right: Next element
    - Swipe left: Previous element
    - Double tap: Activate
    - Two-finger swipe up/down: Read from current position
    - Rotor: Rotate two fingers to change navigation mode

### Android Testing
- **TalkBack**: Built-in Android screen reader
  - Enable: Settings > Accessibility > TalkBack
  - Gestures:
    - Swipe right: Next element
    - Swipe left: Previous element
    - Double tap: Activate
    - Swipe down then up: First item
    - Swipe up then down: Last item

### Desktop Testing
- **NVDA** (Windows): Free, open-source
- **JAWS** (Windows): Industry standard (paid)
- **VoiceOver** (macOS): Built-in (Cmd + F5)

### Browser DevTools
- **Chrome Lighthouse**:
  - DevTools > Lighthouse > Accessibility audit
  - Target score: 95+ for PWA
  
- **axe DevTools**:
  - Browser extension for automated accessibility testing
  - Identifies WCAG 2.1 violations

## Component Testing Checklist

### ✅ Navigation Components

#### MobileNav (Bottom Navigation)
- [ ] All 4 tabs are keyboard accessible (Tab key)
- [ ] aria-label announces tab name ("Home", "Treatments", etc.)
- [ ] aria-current="page" identifies active tab
- [ ] Icons are aria-hidden="true" (decorative)
- [ ] Touch targets are minimum 44x44px
- [ ] Active state has sufficient color contrast (4.5:1 minimum)

#### MobileHeader
- [ ] Back button has aria-label="Go back"
- [ ] Actions button has aria-label="More options"
- [ ] Heading is announced as heading (h1)
- [ ] Focus order follows visual order (back → title → actions)

#### SkipNavigation & SkipToContent
- [ ] Skip link appears on first Tab press
- [ ] Skip link is visually prominent when focused
- [ ] Activating skip link moves focus to main content
- [ ] Main content has id="main-content" or matching target

### ✅ Interactive Components

#### SwipeableSheet (Bottom Sheet Modal)
- [ ] Focus is trapped within modal when open
- [ ] Escape key closes modal
- [ ] Focus returns to trigger element on close
- [ ] role="dialog" is present
- [ ] aria-modal="true" is set
- [ ] Drag handle has aria-label="Drag to resize"
- [ ] Backdrop is aria-hidden="true"

#### PullToRefresh
- [ ] Container has aria-label="Pull down to refresh"
- [ ] Indicator has role="status" and aria-live="polite"
- [ ] State changes are announced ("Refreshing content", "Release to refresh")
- [ ] Does not interfere with screen reader gestures

#### Button Components
- [ ] All buttons have visible focus indicators (ring, outline)
- [ ] Icon-only buttons have aria-label
- [ ] Button text is clear and descriptive
- [ ] Disabled state is announced (disabled attribute or aria-disabled)

### ✅ State Components

#### LoadingState
- [ ] role="status" is present
- [ ] aria-live="polite" announces loading
- [ ] aria-label="Loading content" provides context
- [ ] Screen reader announces when loading completes

#### EmptyState
- [ ] role="status" is present
- [ ] aria-live="polite" announces empty state
- [ ] Icon is aria-hidden="true" (decorative)
- [ ] Title and description are read correctly
- [ ] Action buttons are keyboard accessible

### ✅ Form Components

#### Input Fields
- [ ] All inputs have associated <label> elements
- [ ] Labels use htmlFor matching input id
- [ ] Placeholder text does not replace labels
- [ ] Error messages have aria-describedby linking to input
- [ ] Required fields marked with aria-required="true" or required attribute

#### Dialogs & Alerts
- [ ] Dialog has role="dialog" or role="alertdialog"
- [ ] Dialog has aria-modal="true"
- [ ] Dialog has aria-labelledby pointing to title
- [ ] Dialog has aria-describedby pointing to description
- [ ] Focus is managed (trapped, returned on close)

## Testing Procedures

### 1. Keyboard Navigation Test
**Goal**: Ensure all functionality is accessible via keyboard only

**Steps**:
1. Disconnect mouse/trackpad
2. Navigate entire app using only:
   - Tab: Move forward
   - Shift+Tab: Move backward
   - Enter/Space: Activate buttons/links
   - Arrow keys: Navigate within components (menus, radio groups)
   - Escape: Close modals/dialogs
3. Verify:
   - All interactive elements are reachable
   - Focus indicator is always visible
   - Focus order follows logical reading order
   - No keyboard traps (can always exit components)
   - Skip links allow bypassing navigation

**Pass Criteria**:
- ✅ 100% of features accessible via keyboard
- ✅ No focus loss or traps
- ✅ Visible focus indicator at all times

### 2. Screen Reader Test (VoiceOver on iOS)
**Goal**: Verify screen reader announces all content meaningfully

**Setup**:
1. Enable VoiceOver: Settings > Accessibility > VoiceOver
2. Practice basic gestures on home screen first
3. Open MindShifting PWA in Safari

**Test Flow**:
1. **Landing Page**:
   - [ ] Logo alt text is read
   - [ ] Heading hierarchy is correct (h1, h2, h3)
   - [ ] CTA buttons are identified as buttons
   - [ ] Link text is descriptive (not "click here")

2. **Dashboard**:
   - [ ] Skip link appears first
   - [ ] Main heading is announced
   - [ ] Bottom navigation tabs are grouped as navigation
   - [ ] Active tab is identified with "selected"
   - [ ] Cards are read in logical order

3. **Treatments Page**:
   - [ ] Treatment cards include all key info (title, description, status)
   - [ ] "Start Treatment" buttons have context
   - [ ] Empty state is announced if no treatments

4. **Modal Interactions**:
   - [ ] Opening modal announces dialog role
   - [ ] Modal title is read first
   - [ ] Focus moves into modal
   - [ ] Swipe left/right navigates within modal only
   - [ ] Close button is findable and labeled
   - [ ] Closing modal returns focus to trigger

5. **Pull-to-Refresh**:
   - [ ] "Pull down to refresh" is announced when scrolled to top
   - [ ] "Release to refresh" when threshold reached
   - [ ] "Refreshing content" during refresh
   - [ ] Does not conflict with VoiceOver gestures

**Pass Criteria**:
- ✅ All content is announced
- ✅ Element roles are correct (button, link, heading, navigation)
- ✅ Interactive elements have clear labels
- ✅ State changes are announced (loading, errors, success)
- ✅ No confusing or redundant announcements

### 3. Screen Reader Test (TalkBack on Android)
**Goal**: Verify accessibility on Android devices

**Setup**:
1. Enable TalkBack: Settings > Accessibility > TalkBack
2. Configure TalkBack settings (verbosity, reading order)
3. Open MindShifting PWA in Chrome

**Test Flow**: (Same as iOS VoiceOver test above)

**Pass Criteria**:
- ✅ Same as VoiceOver criteria
- ✅ Material Design patterns are recognized
- ✅ Custom gestures don't conflict with TalkBack

### 4. Automated Lighthouse Audit
**Goal**: Get objective accessibility score

**Steps**:
1. Open PWA in Chrome
2. Open DevTools (F12)
3. Navigate to Lighthouse tab
4. Select:
   - Categories: Accessibility
   - Device: Mobile
5. Click "Analyze page load"

**Pass Criteria**:
- ✅ Accessibility score: 95+
- ✅ No critical violations
- ✅ Color contrast passes WCAG AA (4.5:1)
- ✅ All images have alt text
- ✅ Form elements have labels

### 5. Color Contrast Test
**Goal**: Ensure text is readable in light and dark modes

**Tools**:
- Chrome DevTools > Accessibility pane
- WebAIM Contrast Checker
- Lighthouse color contrast audit

**Test Cases**:
- [ ] Body text on backgrounds: 4.5:1 minimum (WCAG AA)
- [ ] Large text (18pt+): 3:1 minimum
- [ ] Interactive elements (buttons, links): 4.5:1
- [ ] Focus indicators: 3:1 against background
- [ ] Dark mode: Same contrast ratios
- [ ] Error text: Distinguishable by more than color alone

**Pass Criteria**:
- ✅ All text passes WCAG AA contrast (4.5:1)
- ✅ Large text passes WCAG AAA (7:1) ideally
- ✅ Dark mode maintains contrast ratios

### 6. Focus Indicator Test
**Goal**: Verify focus is always visible

**Steps**:
1. Navigate app with keyboard only
2. Tab through all interactive elements
3. Check each element has visible focus

**Pass Criteria**:
- ✅ Default focus ring is visible (outline or custom ring)
- ✅ Focus ring has 3:1 contrast against background
- ✅ Focus ring is not removed by CSS (outline: none)
- ✅ Custom focus styles match brand (e.g., indigo ring)

### 7. Haptic Feedback Test (Accessibility Impact)
**Goal**: Ensure haptic feedback doesn't interfere with assistive tech

**Test Cases**:
- [ ] Haptics work with VoiceOver enabled
- [ ] Haptics don't trigger unexpectedly during screen reader navigation
- [ ] Haptics are optional (user can disable if needed)
- [ ] Haptics supplement, not replace, visual/audio feedback

**Pass Criteria**:
- ✅ Haptics enhance, don't hinder, accessibility
- ✅ All haptic actions have visual equivalents
- ✅ No conflicts with screen reader gestures

## Common Issues & Fixes

### Issue: Focus Lost After Modal Close
**Fix**: Add `returnFocusOnDeactivate: true` to FocusTrap options

### Issue: Screen Reader Reads Icon Text Twice
**Fix**: Add `aria-hidden="true"` to decorative icons

### Issue: Button Has No Accessible Name
**Fix**: Add `aria-label` to icon-only buttons

### Issue: Form Input Has No Label
**Fix**: Add `<label htmlFor="inputId">` or `aria-label` to input

### Issue: Color Contrast Failure
**Fix**: Darken text or lighten background to achieve 4.5:1 ratio

### Issue: Keyboard Trap in Modal
**Fix**: Use FocusTrap library with proper escape handling

### Issue: Skip Link Not Visible on Focus
**Fix**: Use `sr-only focus:not-sr-only` with fixed positioning

## WCAG 2.1 AA Compliance Checklist

### Perceivable
- [x] Text alternatives for images (alt text)
- [x] Color is not the only visual means of conveying information
- [x] Contrast ratio of at least 4.5:1 for normal text
- [x] Text can be resized up to 200% without loss of content
- [x] Images of text are avoided (use real text)

### Operable
- [x] All functionality available via keyboard
- [x] No keyboard traps
- [x] Sufficient time to read and use content
- [x] No flashing content (seizure risk)
- [x] Skip links to bypass repeated content
- [x] Page titles are descriptive
- [x] Focus order follows reading order
- [x] Link purpose is clear from text
- [x] Multiple ways to locate pages (nav, search, sitemap)
- [x] Visible focus indicator

### Understandable
- [x] Language of page is identified (lang="en")
- [x] Navigation is consistent across pages
- [x] Components are identified consistently
- [x] Error messages are clear and helpful
- [x] Labels and instructions for form inputs
- [x] Error prevention for critical actions (confirmations)

### Robust
- [x] Valid HTML (no parsing errors)
- [x] Name, role, value available for all components
- [x] Status messages use role="status" or aria-live

## Testing Schedule

### During Development
- Run Lighthouse audit on every new component
- Test keyboard navigation for each new interactive element
- Verify ARIA attributes with browser DevTools

### Before Each Commit
- Quick keyboard navigation test
- Check focus indicators on modified components
- Verify screen reader labels for new buttons/links

### Before Merge to Main
- Full VoiceOver test on iOS device
- Full TalkBack test on Android device
- Complete Lighthouse audit (95+ score)
- Manual keyboard navigation of entire app
- Color contrast verification (light + dark mode)

### Production Monitoring
- Monthly accessibility audits
- User feedback on accessibility issues
- Regular testing with new OS versions (iOS/Android updates)

## Resources

- [WebAIM](https://webaim.org/): Articles and testing tools
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [The A11Y Project](https://www.a11yproject.com/): Accessibility checklist
- [axe DevTools](https://www.deque.com/axe/devtools/): Browser extension
- [NVDA Screen Reader](https://www.nvaccess.org/): Free Windows screen reader

## Accessibility Statement

MindShifting is committed to ensuring digital accessibility for people with disabilities. We are continually improving the user experience for everyone and applying relevant accessibility standards.

**Conformance Status**: WCAG 2.1 Level AA Compliant

**Feedback**: If you encounter accessibility barriers, please contact us at [accessibility@mindshifting.com]

**Last Reviewed**: [Current Date] - Steps 50-54 Accessibility Improvements
