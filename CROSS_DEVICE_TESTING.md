# Cross-Device Testing Guide

## Overview
This document outlines the comprehensive cross-device testing strategy for the MindShifting PWA. Testing on real devices is critical for validating mobile-first design, touch interactions, and progressive web app functionality.

## Testing Matrix

### Mobile Devices

#### iPhone SE (375×667px) - Smallest Modern iPhone
**Viewport**: 375px wide
**Importance**: Critical baseline - if it works here, it works everywhere
**Safari Version**: iOS 15+

**Test Cases**:
- [ ] All text is readable without horizontal scroll
- [ ] Touch targets are minimum 44×44px
- [ ] Bottom navigation doesn't overlap content
- [ ] Safe area insets work correctly (notch avoidance)
- [ ] Pull-to-refresh gesture works smoothly
- [ ] Form inputs are fully visible when keyboard appears
- [ ] Modals/sheets don't exceed viewport height
- [ ] Images scale appropriately
- [ ] Cards use compact variant (p-3)
- [ ] Two-column grids stack to single column

**Known Constraints**:
- Limited vertical space (667px)
- Keyboard takes ~50% of screen
- Need extra attention to sticky footers

#### iPhone 12/13/14 (390×844px) - Most Common
**Viewport**: 390px wide
**Importance**: Primary target device
**Safari Version**: iOS 15+

**Test Cases**:
- [ ] Safe areas work with notch (status bar)
- [ ] Dynamic Island doesn't interfere (iPhone 14 Pro)
- [ ] Face ID animation doesn't cause layout shift
- [ ] Landscape mode works for critical flows
- [ ] Screenshots look good for App Store
- [ ] Haptic feedback feels natural
- [ ] Gesture conflicts with iOS (swipe back)
- [ ] PWA install banner appears
- [ ] Add to Home Screen flow works
- [ ] Standalone mode (no Safari chrome)

**Optimal Experience**:
- Most spacing looks balanced here
- Good reference for visual design
- Common user base

#### iPhone 14 Pro Max (430×932px) - Large iPhone
**Viewport**: 430px wide (largest iPhone)
**Importance**: Test layout doesn't look sparse
**Safari Version**: iOS 16+

**Test Cases**:
- [ ] Content doesn't look stretched
- [ ] Two-column grids display properly
- [ ] Images maintain aspect ratios
- [ ] Text doesn't become too large
- [ ] Landscape mode is usable
- [ ] Always-on display compatibility
- [ ] Dynamic Island interactions
- [ ] Larger hit targets feel responsive
- [ ] Tablet breakpoint doesn't trigger (stays mobile)
- [ ] Videos play inline

**Layout Concerns**:
- Avoid too much whitespace
- Use `max-w-2xl` containers
- Consider showing more content

#### Android Small (360×640px) - Budget Devices
**Viewport**: 360px wide
**Importance**: High - many users worldwide
**Chrome Version**: Latest

**Test Cases**:
- [ ] Minimum width constraints respected
- [ ] Material Design patterns feel native
- [ ] Back button behavior correct
- [ ] Chrome PWA install prompt
- [ ] WebAPK generation works
- [ ] Notifications permission flow
- [ ] TalkBack screen reader works
- [ ] Low-end device performance acceptable
- [ ] Animations don't lag
- [ ] Images load progressively

**Performance Priority**:
- Often slower hardware
- May have limited RAM
- Test on actual budget device

#### Android Medium (393×851px) - Pixel Phones
**Viewport**: 393px wide
**Importance**: Reference Android device
**Chrome Version**: Latest

**Test Cases**:
- [ ] Gesture navigation (swipe from edges)
- [ ] Notification shade doesn't interfere
- [ ] Quick settings accessible
- [ ] Split screen mode (if supported)
- [ ] Picture-in-picture for videos
- [ ] Autofill works correctly
- [ ] Biometric authentication
- [ ] Share sheet integration
- [ ] App shortcuts work
- [ ] Material You theming (Android 12+)

**Android-Specific**:
- System-wide dark mode
- Gesture navigation bar
- Chrome flags for PWA features

#### Tablet - iPad (768×1024px)
**Viewport**: 768px (md: breakpoint)
**Importance**: Medium - different layout paradigm
**Safari Version**: iPadOS 15+

**Test Cases**:
- [ ] Switches to desktop layout appropriately
- [ ] Bottom nav hides, sidebar shows
- [ ] Touch targets still large enough
- [ ] Landscape orientation primary
- [ ] Split View / Slide Over support
- [ ] Keyboard shortcuts work
- [ ] Apple Pencil interactions (if applicable)
- [ ] Multitasking doesn't break layout
- [ ] Hover states work (with trackpad)
- [ ] Print layout (Safari print)

**Tablet Considerations**:
- Desktop components on touch device
- Hybrid interaction patterns
- More screen real estate

## Testing Procedures

### 1. Visual Testing
**Goal**: Verify layout, spacing, and design

**Process**:
1. Open app in device browser
2. Navigate through all pages
3. Test in portrait and landscape
4. Toggle dark mode
5. Capture screenshots
6. Compare against designs

**Checklist**:
- [ ] No horizontal scroll
- [ ] No layout shifts
- [ ] Consistent spacing
- [ ] Readable typography
- [ ] Visible focus indicators
- [ ] Proper color contrast
- [ ] Icons render correctly
- [ ] Images load and scale

### 2. Interaction Testing
**Goal**: Verify touch, gestures, and haptics

**Process**:
1. Test all touch targets (minimum 44×44px)
2. Verify swipe gestures (cards, sheets)
3. Test pull-to-refresh
4. Check button feedback
5. Validate form interactions
6. Test modal/sheet behavior

**Checklist**:
- [ ] Touch targets are large enough
- [ ] Gestures feel natural
- [ ] Haptics provide feedback
- [ ] Buttons have active states
- [ ] Forms work with keyboard
- [ ] Modals trap focus
- [ ] Sheets are dismissible

### 3. PWA Installation Testing
**Goal**: Verify installability and standalone mode

**iOS Safari Process**:
1. Open app in Safari
2. Tap Share button
3. Select "Add to Home Screen"
4. Verify app icon appears
5. Launch from home screen
6. Confirm standalone mode (no Safari UI)
7. Test deep linking

**Android Chrome Process**:
1. Open app in Chrome
2. Wait for install banner
3. Tap "Install" or menu > "Add to Home screen"
4. Verify WebAPK generation
5. Launch from app drawer
6. Confirm TWA mode
7. Test app shortcuts

**Verification**:
- [ ] Install prompt appears
- [ ] Icon shows on home screen
- [ ] Splash screen displays
- [ ] No browser chrome in standalone
- [ ] Navigation works in standalone
- [ ] Deep links open in app
- [ ] Updates work correctly

### 4. Performance Testing
**Goal**: Ensure smooth experience on all devices

**Metrics to Check**:
- First Contentful Paint (FCP): < 1.8s
- Largest Contentful Paint (LCP): < 2.5s
- First Input Delay (FID): < 100ms
- Cumulative Layout Shift (CLS): < 0.1
- Time to Interactive (TTI): < 3.8s

**Device-Specific**:
- Budget Android: 3G throttling test
- iPhone SE: No animation lag
- All devices: Smooth scrolling (60fps)

**Tools**:
- Chrome DevTools > Performance
- Lighthouse mobile audit
- WebPageTest (mobile)
- Real device testing

### 5. Offline Testing
**Goal**: Verify service worker and offline functionality

**Process**:
1. Install PWA
2. Visit all major routes (cache them)
3. Enable airplane mode
4. Attempt to use app
5. Verify offline page appears for uncached routes
6. Check cached content loads
7. Test background sync (if implemented)

**Checklist**:
- [ ] Offline page shows when no connection
- [ ] Cached pages load instantly
- [ ] Images are cached
- [ ] API calls fail gracefully
- [ ] User sees helpful messaging
- [ ] Queue actions for when online

### 6. Form Testing on Mobile
**Goal**: Verify form usability with mobile keyboards

**Process**:
1. Fill out all forms on device
2. Test with iOS/Android keyboard
3. Verify autocomplete works
4. Check keyboard doesn't hide inputs
5. Test validation messages
6. Submit forms

**Checklist**:
- [ ] Correct `inputmode` for field types
- [ ] Keyboard has appropriate keys (@ for email, numbers for tel)
- [ ] Inputs remain visible above keyboard
- [ ] Autocomplete suggests values
- [ ] Validation errors are visible
- [ ] Submit button accessible
- [ ] Can dismiss keyboard

### 7. Accessibility Testing
**Goal**: Verify screen reader and assistive tech compatibility

**VoiceOver (iOS)**:
1. Enable VoiceOver in Settings
2. Navigate app with swipe gestures
3. Verify all content is announced
4. Test interactive elements
5. Check focus management in modals

**TalkBack (Android)**:
1. Enable TalkBack in Settings
2. Navigate with swipe gestures
3. Verify content announcements
4. Test buttons and links
5. Check modal focus trap

**Checklist**:
- [ ] All content is announced
- [ ] Images have alt text
- [ ] Buttons have labels
- [ ] Form fields have labels
- [ ] Error messages are announced
- [ ] Loading states are announced
- [ ] Modals trap focus correctly

## Test Scenarios by Feature

### Dashboard
- [ ] Cards display in grid (2 cols on tablet, 1 on mobile)
- [ ] Pull-to-refresh refreshes content
- [ ] Bottom nav is visible and responsive
- [ ] Empty state shows when no data
- [ ] Loading skeleton appears during fetch

### Treatments
- [ ] Treatment cards are tappable (minimum 44px)
- [ ] Swipe gestures work (if implemented)
- [ ] Filter/sort works on mobile
- [ ] Modal sheets open smoothly
- [ ] Treatment details are readable

### Forms
- [ ] Native select on mobile devices
- [ ] Date/time pickers use native inputs
- [ ] Validation shows on blur
- [ ] Error messages are clear
- [ ] Submit button accessible with keyboard
- [ ] Sticky footer doesn't hide fields

### Profile
- [ ] Avatar upload works on mobile
- [ ] Form fields are full-width on mobile
- [ ] Save button in sticky footer
- [ ] Success toast appears after save
- [ ] Dark mode toggle works

### Settings
- [ ] Settings grouped in sections
- [ ] Toggle switches work
- [ ] Logout confirmation modal
- [ ] Navigation back works
- [ ] Changes persist after reload

## Browser Testing Matrix

### iOS Browsers
- **Safari (Primary)**: Latest iOS version
- **Chrome iOS**: Uses Safari engine, test anyway
- **Firefox iOS**: Uses Safari engine
- **Edge iOS**: Uses Safari engine

**Note**: All iOS browsers use WebKit, so Safari testing is comprehensive.

### Android Browsers
- **Chrome (Primary)**: Latest version
- **Firefox**: Latest version
- **Samsung Internet**: If available
- **Edge**: Chromium-based

**Note**: Chrome is most important for PWA features.

## Recording Test Results

### Test Result Template

```markdown
## Device: [Device Name]
**Date**: [Date]
**Tester**: [Name]
**Browser**: [Browser & Version]

### Visual
- [ ] No horizontal scroll
- [ ] Proper spacing
- [ ] Dark mode works
- [ ] Images load correctly

### Interaction
- [ ] Touch targets adequate
- [ ] Gestures work
- [ ] Haptics function
- [ ] Forms usable

### PWA
- [ ] Install works
- [ ] Standalone mode
- [ ] Icon appears
- [ ] Offline capability

### Performance
- FCP: [time]
- LCP: [time]
- CLS: [score]

### Issues Found
1. [Description of issue]
   - Severity: Critical / High / Medium / Low
   - Steps to reproduce
   - Expected vs Actual

### Screenshots
[Attach screenshots]
```

## Common Issues & Solutions

### Issue: Content Cut Off by iPhone Notch
**Solution**: Ensure `viewport-fit=cover` meta tag and use safe-area-inset CSS variables

### Issue: Keyboard Hides Input Fields
**Solution**: Use `scrollIntoView()` when input focused, or sticky footer approach

### Issue: PWA Install Prompt Doesn't Appear
**Solution**: Check manifest.json validity, ensure HTTPS, verify service worker registered

### Issue: Gestures Conflict with Browser
**Solution**: Use `touch-action` CSS, handle `preventDefault()` carefully

### Issue: Poor Performance on Budget Android
**Solution**: Reduce animations, optimize images, code split heavy components

### Issue: Dark Mode Flicker on Load
**Solution**: Inline theme script before React hydration, use `suppressHydrationWarning`

## Automated Testing Tools

### BrowserStack
- Test on real devices remotely
- iOS, Android, tablets
- Record sessions
- Debug tools available

### LambdaTest
- Real device cloud
- Screenshot comparison
- Performance testing
- Geolocation testing

### Chrome DevTools Device Mode
- Emulate different screen sizes
- Throttle network/CPU
- Lighthouse audits
- Touch simulation

**Note**: Always validate on real devices for final sign-off.

## Sign-Off Checklist

Before merging to production:

- [ ] Tested on iPhone SE (smallest)
- [ ] Tested on common Android (360-393px)
- [ ] Tested on tablet (iPad)
- [ ] PWA installs on iOS and Android
- [ ] Lighthouse scores: 90+ all categories
- [ ] No critical accessibility issues
- [ ] Smooth performance on budget devices
- [ ] Offline mode works
- [ ] Forms usable with mobile keyboard
- [ ] Screen readers work correctly
- [ ] Dark mode has no issues
- [ ] All gestures feel natural
- [ ] No horizontal scroll anywhere
- [ ] Safe areas respected

## Continuous Testing

### Post-Launch Monitoring
- Real User Monitoring (RUM)
- Core Web Vitals tracking
- Error tracking (Sentry)
- Analytics for device distribution
- A/B test mobile features
- User feedback collection

### Regular Testing Schedule
- **Weekly**: Smoke tests on key devices
- **Monthly**: Full regression on all devices
- **After Major Updates**: Complete test suite
- **New iOS/Android Release**: Compatibility check

## Resources

- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Material Design for Android](https://material.io/design)
- [PWA Checklist](https://web.dev/pwa-checklist/)
- [Mobile Testing Best Practices](https://web.dev/mobile/)
- [WebAIM Mobile Accessibility](https://webaim.org/articles/mobile/)
