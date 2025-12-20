# Mobile PWA Screenshots

## Overview
This directory contains before/after screenshots demonstrating the mobile-first transformation of the MindShifting PWA.

## Screenshot Naming Convention

```
[page-name]_[device]_[state]_[variant].png

Examples:
- dashboard_iphone-se_before_light.png
- dashboard_iphone-se_after_light.png
- dashboard_iphone-se_after_dark.png
- treatments_pixel-7_after_light.png
- profile_ipad_after_landscape.png
```

### Components:
- **page-name**: dashboard, treatments, profile, settings, etc.
- **device**: iphone-se, iphone-14, pixel-7, ipad
- **state**: before, after
- **variant**: light, dark, landscape (optional)

## Required Screenshots

### Priority 1: Core Pages (Before/After Comparison)

#### Dashboard
- [ ] `dashboard_iphone-se_before_light.png` (375×667px)
- [ ] `dashboard_iphone-se_after_light.png` (375×667px)
- [ ] `dashboard_iphone-se_after_dark.png` (375×667px)
- [ ] `dashboard_iphone-14_after_light.png` (390×844px)
- [ ] `dashboard_pixel-7_after_light.png` (412×915px)
- [ ] `dashboard_ipad_after_light.png` (768×1024px)

#### Treatments Page
- [ ] `treatments_iphone-se_before_light.png`
- [ ] `treatments_iphone-se_after_light.png`
- [ ] `treatments_iphone-se_after_dark.png`
- [ ] `treatments_pixel-7_after_light.png`

#### Profile Page
- [ ] `profile_iphone-se_before_light.png`
- [ ] `profile_iphone-se_after_light.png`
- [ ] `profile_iphone-se_after_dark.png`

#### Settings Page
- [ ] `settings_iphone-se_before_light.png`
- [ ] `settings_iphone-se_after_light.png`
- [ ] `settings_iphone-se_after_dark.png`

### Priority 2: Mobile Features

#### PWA Installation
- [ ] `pwa_ios-install-prompt.png` - Safari share menu
- [ ] `pwa_ios-home-screen.png` - App icon on iOS home screen
- [ ] `pwa_android-install-banner.png` - Chrome install prompt
- [ ] `pwa_android-home-screen.png` - App icon on Android
- [ ] `pwa_standalone-mode.png` - App running without browser chrome

#### Gestures & Interactions
- [ ] `gesture_pull-to-refresh_start.png` - Pull indicator visible
- [ ] `gesture_pull-to-refresh_threshold.png` - At 80px threshold
- [ ] `gesture_pull-to-refresh_refreshing.png` - Loading state
- [ ] `gesture_swipe-card_left.png` - Card swiped left (delete action)
- [ ] `gesture_swipe-card_right.png` - Card swiped right (archive action)
- [ ] `gesture_bottom-sheet_collapsed.png` - Sheet at 30% height
- [ ] `gesture_bottom-sheet_half.png` - Sheet at 60% height
- [ ] `gesture_bottom-sheet_full.png` - Sheet at 100% height

#### Navigation
- [ ] `nav_bottom-nav_light.png` - Bottom navigation bar
- [ ] `nav_bottom-nav_dark.png` - Bottom nav in dark mode
- [ ] `nav_mobile-header.png` - Header with back button
- [ ] `nav_safe-areas.png` - Notch/home indicator spacing

#### Forms
- [ ] `form_mobile-input_empty.png` - Empty input with label
- [ ] `form_mobile-input_filled.png` - Filled input
- [ ] `form_mobile-input_error.png` - Input with validation error
- [ ] `form_mobile-select_native.png` - Native iOS/Android select picker
- [ ] `form_date-picker.png` - Native date picker
- [ ] `form_keyboard-email.png` - Email keyboard layout
- [ ] `form_keyboard-phone.png` - Phone number keyboard

#### Feedback Components
- [ ] `feedback_toast-success.png` - Success toast notification
- [ ] `feedback_toast-error.png` - Error toast notification
- [ ] `feedback_action-sheet.png` - Action sheet menu
- [ ] `feedback_loading-skeleton.png` - Skeleton loading state
- [ ] `feedback_empty-state.png` - Empty state component

#### Accessibility
- [ ] `a11y_skip-link_focused.png` - Skip navigation link visible
- [ ] `a11y_focus-indicator.png` - Focus ring on button
- [ ] `a11y_voiceover_running.png` - VoiceOver highlighting element
- [ ] `a11y_color-contrast.png` - Contrast checker overlay

### Priority 3: Performance & Quality

#### Lighthouse Audits
- [ ] `lighthouse_before_mobile.png` - Pre-transformation scores
- [ ] `lighthouse_after_mobile.png` - Post-transformation scores (90+)
- [ ] `lighthouse_performance_metrics.png` - Core Web Vitals
- [ ] `lighthouse_accessibility_100.png` - Accessibility score
- [ ] `lighthouse_pwa_checks.png` - PWA installability checks

#### DevTools
- [ ] `devtools_network_waterfall.png` - Network performance
- [ ] `devtools_coverage.png` - Code coverage analysis
- [ ] `devtools_bundle-size.png` - Bundle analyzer output
- [ ] `devtools_service-worker.png` - Service worker registered

### Priority 4: Responsive Breakpoints

#### Breakpoint Comparison (Same Page)
- [ ] `responsive_dashboard_375px.png` - iPhone SE
- [ ] `responsive_dashboard_390px.png` - iPhone 14
- [ ] `responsive_dashboard_768px.png` - iPad portrait
- [ ] `responsive_dashboard_1024px.png` - iPad landscape
- [ ] `responsive_dashboard_1440px.png` - Desktop

## Screenshot Capture Methods

### 1. Chrome DevTools Device Emulation
**Best for**: Quick screenshots, consistent sizing

**Steps**:
1. Open Chrome DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select device (iPhone SE, Pixel 7, etc.)
4. Capture screenshot (Ctrl+Shift+P → "Capture screenshot")

**Devices**:
- iPhone SE (375×667px)
- iPhone 14 (390×844px)
- Pixel 7 (412×915px)
- iPad (768×1024px)

### 2. Real Device Screenshots
**Best for**: PWA installation, native gestures, authentic look

**iOS**:
1. Power + Volume Up = Screenshot
2. AirDrop to Mac or use iCloud Photos
3. Trim in Preview if needed

**Android**:
1. Power + Volume Down = Screenshot
2. Transfer via USB or Google Photos
3. Crop if needed

### 3. Browser Extensions
**Best for**: Full-page screenshots, annotations

**Recommended**:
- **Awesome Screenshot** - Full page, annotations, blur
- **Nimbus Screenshot** - Video recording, scrolling capture
- **Fireshot** - PDF export, auto-scroll

### 4. Automated Screenshot Tools
**Best for**: Regression testing, CI/CD

```bash
# Using Playwright
npx playwright test --project=chromium --headed

# Using Puppeteer
node scripts/capture-screenshots.js
```

## Screenshot Guidelines

### Technical Requirements
- **Format**: PNG (lossless)
- **Resolution**: Actual device pixels (2x/3x for Retina)
- **File size**: < 500KB per screenshot (use compression if needed)
- **Dimensions**: Match device viewport exactly

### Visual Standards
- ✅ Clean browser chrome (or none for PWA standalone)
- ✅ Realistic content (no Lorem ipsum)
- ✅ Proper light/dark mode
- ✅ No personal data visible
- ✅ Focused on feature being demonstrated
- ❌ No blurry or low-quality images
- ❌ No inconsistent UI states
- ❌ No debug tools visible (unless demonstrating DevTools)

### Content Standards
- Use realistic but generic data
- Consistent user info across screenshots
- Proper dates/times (not default values)
- Complete workflows (not mid-action unless showing gesture)

### Annotation Guidelines
When annotating screenshots:
- Use red arrows/boxes for key features
- Add text labels in sans-serif font
- Keep annotations minimal and clear
- Save original + annotated versions

## Screenshot Organization

```
docs/screenshots/
├── README.md (this file)
├── before/
│   ├── dashboard_iphone-se_light.png
│   ├── treatments_iphone-se_light.png
│   └── ...
├── after/
│   ├── dashboard_iphone-se_light.png
│   ├── dashboard_iphone-se_dark.png
│   └── ...
├── features/
│   ├── pwa/
│   │   ├── ios-install.png
│   │   └── android-install.png
│   ├── gestures/
│   │   ├── pull-to-refresh.png
│   │   └── swipe-cards.png
│   ├── forms/
│   │   ├── mobile-input.png
│   │   └── native-select.png
│   └── navigation/
│       ├── bottom-nav.png
│       └── mobile-header.png
├── lighthouse/
│   ├── before-audit.png
│   ├── after-audit.png
│   └── metrics.png
├── responsive/
│   ├── 375px/
│   ├── 768px/
│   └── 1440px/
└── comparison/
    ├── dashboard_comparison.png (side-by-side)
    └── treatments_comparison.png
```

## Creating Comparison Images

### Side-by-Side Comparisons
Use image editing tool (Figma, Photoshop, GIMP):

1. Create canvas: 1600×1200px
2. Add "Before" label (left)
3. Add "After" label (right)
4. Place screenshots side-by-side
5. Add divider line between
6. Optional: Highlight differences with arrows

### Before/After Sliders
For documentation sites with interactive comparisons:
- Use Twenty20 library
- Or img-comparison-slider web component

## Usage in Documentation

### Markdown
```markdown
## Dashboard - Mobile View

### Before Transformation
![Dashboard Before](./screenshots/before/dashboard_iphone-se_light.png)

### After Transformation
![Dashboard After](./screenshots/after/dashboard_iphone-se_light.png)

### Dark Mode
![Dashboard Dark](./screenshots/after/dashboard_iphone-se_dark.png)
```

### HTML with Captions
```html
<figure>
  <img src="./screenshots/after/gesture_pull-to-refresh.png" 
       alt="Pull-to-refresh gesture"
       width="375">
  <figcaption>Pull-to-refresh on iPhone SE (375px)</figcaption>
</figure>
```

## Screenshot Checklist

Before committing screenshots:
- [ ] File naming follows convention
- [ ] Images are properly compressed
- [ ] No personal/sensitive data visible
- [ ] Device/browser chrome is clean
- [ ] Light/dark mode is correct
- [ ] Screenshot demonstrates feature clearly
- [ ] Resolution matches device specs
- [ ] File is in correct directory
- [ ] README.md is updated with new screenshots

## Tools & Resources

### Image Compression
- **TinyPNG** - https://tinypng.com (PNG compression)
- **Squoosh** - https://squoosh.app (Google's image optimizer)
- **ImageOptim** - https://imageoptim.com (Mac app)

### Image Editing
- **Figma** - Free, web-based, great for comparisons
- **GIMP** - Free, desktop, full-featured
- **Photoshop** - Professional, paid

### Device Mockups
- **Screely** - https://www.screely.com (browser mockups)
- **Mockuuups** - https://mockuuups.studio (device frames)
- **Shotsnapp** - https://shotsnapp.com (device mockups)

### Screenshot Browser Extensions
- **Awesome Screenshot** - Chrome/Firefox
- **Nimbus Screenshot** - Chrome
- **Fireshot** - Chrome/Firefox

## Automation Script Example

```javascript
// scripts/capture-screenshots.js
const puppeteer = require('puppeteer');

const devices = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-14', width: 390, height: 844 },
  { name: 'pixel-7', width: 412, height: 915 }
];

const pages = [
  { path: '/dashboard', name: 'dashboard' },
  { path: '/dashboard/treatments', name: 'treatments' },
  { path: '/dashboard/profile', name: 'profile' }
];

async function captureScreenshots() {
  const browser = await puppeteer.launch();

  for (const device of devices) {
    for (const page of pages) {
      const browserPage = await browser.newPage();
      await browserPage.setViewport({
        width: device.width,
        height: device.height,
        deviceScaleFactor: 2
      });

      await browserPage.goto(`http://localhost:3000${page.path}`);
      await browserPage.screenshot({
        path: `docs/screenshots/after/${page.name}_${device.name}_light.png`
      });

      await browserPage.close();
    }
  }

  await browser.close();
}

captureScreenshots();
```

## Future Enhancements

Planned screenshot additions:
- [ ] Video recordings of gesture interactions
- [ ] GIF animations of loading states
- [ ] Screen recording of PWA installation flow
- [ ] Accessibility contrast overlays
- [ ] Performance waterfall charts
- [ ] Bundle size comparison charts

## Contributors

When adding screenshots:
1. Follow naming convention
2. Compress images before committing
3. Update this README with new screenshots
4. Add descriptive alt text in documentation
5. Test images load correctly in docs

---

**Last Updated**: Mobile-first transformation phase  
**Total Screenshots**: 0 (structure created, screenshots pending)  
**Maintained By**: Development team
