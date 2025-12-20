# Screenshot Capture Automation

This directory contains scripts for automated screenshot capture during development and testing.

## Available Scripts

### capture-screenshots.js
Automated screenshot capture using Puppeteer for consistent device testing.

### lighthouse-screenshots.js
Capture Lighthouse audit results as images for documentation.

### comparison-generator.js
Generate side-by-side before/after comparison images.

## Usage

```bash
# Install dependencies (if not already installed)
npm install --save-dev puppeteer

# Capture all screenshots
node scripts/capture-screenshots.js

# Capture specific page
node scripts/capture-screenshots.js --page=dashboard

# Capture specific device
node scripts/capture-screenshots.js --device=iphone-se

# Capture dark mode
node scripts/capture-screenshots.js --theme=dark
```

## Manual Screenshot Instructions

### Chrome DevTools Method (Recommended for Development)

1. **Open DevTools**
   - Press `F12` or `Ctrl+Shift+I` (Linux)
   - Or right-click → Inspect

2. **Enable Device Toolbar**
   - Click device icon or press `Ctrl+Shift+M`
   - Select device from dropdown (iPhone SE, Pixel 7, etc.)

3. **Navigate to Page**
   - Go to the page you want to screenshot
   - Ensure proper state (logged in, data loaded, etc.)

4. **Capture Screenshot**
   - Open Command Palette: `Ctrl+Shift+P`
   - Type "screenshot"
   - Select "Capture screenshot" (visible area) or "Capture full size screenshot"
   - File saves to Downloads folder

5. **Rename and Move**
   - Follow naming convention: `[page]_[device]_[state]_[variant].png`
   - Move to appropriate directory in `docs/screenshots/`

### Real Device Method (For PWA and Native Features)

#### iOS (iPhone/iPad)
1. **Prepare Device**
   - Connect to same WiFi as development machine
   - Open Safari
   - Navigate to `http://[YOUR-IP]:3000`

2. **Capture Screenshot**
   - Press **Power + Volume Up** simultaneously
   - Screenshot saves to Photos app

3. **Transfer to Computer**
   - AirDrop to Mac
   - Or use iCloud Photos
   - Or USB cable → Image Capture app

4. **For PWA Installation Screenshots**
   - Tap Share button → Add to Home Screen
   - Screenshot the prompt
   - Screenshot home screen with icon
   - Open PWA, screenshot standalone mode

#### Android (Phone/Tablet)
1. **Prepare Device**
   - Enable USB debugging in Developer Options
   - Connect to same WiFi as development machine
   - Open Chrome
   - Navigate to `http://[YOUR-IP]:3000`

2. **Capture Screenshot**
   - Press **Power + Volume Down** simultaneously
   - Or use gesture (varies by manufacturer)
   - Screenshot saves to Photos/Gallery

3. **Transfer to Computer**
   - USB cable → File transfer
   - Or Google Photos
   - Or AirDroid app

4. **For PWA Installation Screenshots**
   - Wait for install banner (or use menu → Install app)
   - Screenshot the prompt
   - Screenshot home screen with icon
   - Open PWA, screenshot app mode

### Lighthouse Audit Screenshots

1. **Run Lighthouse**
   - Open DevTools → Lighthouse tab
   - Select "Mobile" device
   - Check all categories
   - Click "Analyze page load"

2. **Capture Results**
   - Wait for audit to complete
   - Scroll to top (show all scores)
   - Open Command Palette: `Ctrl+Shift+P`
   - "Capture screenshot"
   - Save as `lighthouse_after_mobile.png`

3. **Capture Metrics**
   - Scroll to Performance section
   - Expand Core Web Vitals
   - Capture screenshot of metrics
   - Save as `lighthouse_performance_metrics.png`

### Browser Extension Method

#### Using Awesome Screenshot

1. **Install Extension**
   - Chrome Web Store → Awesome Screenshot
   - Click "Add to Chrome"

2. **Capture Screenshot**
   - Click extension icon
   - Select "Capture visible part of page"
   - Or "Capture entire page" for full scroll

3. **Annotate (Optional)**
   - Add arrows, text, blur sensitive data
   - Save annotations

4. **Download**
   - Click "Done"
   - Save to `docs/screenshots/`

## Screenshot Specifications

### File Formats
- **Primary**: PNG (lossless, supports transparency)
- **Alternative**: JPEG (for photos, smaller file size)
- **Avoid**: WebP (not universally supported in docs)

### Resolutions

| Device | Width | Height | Scale | Purpose |
|--------|-------|--------|-------|---------|
| iPhone SE | 375px | 667px | 2x | Smallest iPhone |
| iPhone 14 | 390px | 844px | 3x | Current iPhone |
| iPhone 14 Pro Max | 430px | 932px | 3x | Largest iPhone |
| Pixel 7 | 412px | 915px | 2.625x | Android reference |
| iPad | 768px | 1024px | 2x | Tablet |
| Desktop | 1440px | 900px | 1x | Desktop view |

### Compression

Before committing, compress screenshots:

```bash
# Using TinyPNG CLI (install: npm install -g tinypng-cli)
tinypng docs/screenshots/after/*.png

# Using ImageMagick
convert input.png -quality 85 output.png

# Using pngquant
pngquant --quality=65-80 input.png
```

Target: < 500KB per screenshot

## Screenshot Scenarios

### 1. Before/After Comparisons
**Purpose**: Show improvement from transformation

**Required**:
- Same page
- Same device
- Same content
- Same scroll position
- Light mode for both

**Capture**:
1. Checkout `main` branch (before)
2. Run dev server
3. Capture screenshots
4. Save to `docs/screenshots/before/`
5. Checkout `mobile-first-transformation` branch (after)
6. Run dev server
7. Capture same pages
8. Save to `docs/screenshots/after/`

### 2. Gesture Demonstrations
**Purpose**: Show interactive features

**Technique**:
- Use video recording → extract frames
- Or capture multiple states (start, middle, end)

**Example: Pull-to-Refresh**
1. Start: Normal state (scroll at top)
2. Middle: Pulled down 40px (spinner visible)
3. Threshold: Pulled 80px (ready to release)
4. Refreshing: Loading spinner rotating

### 3. Dark Mode Showcase
**Purpose**: Demonstrate theme support

**Capture**:
1. Toggle dark mode in app
2. Screenshot same pages as light mode
3. Save with `_dark` suffix

### 4. Responsive Breakpoints
**Purpose**: Show layout adapts to screen sizes

**Capture**:
1. Same page at multiple widths
2. Save in `docs/screenshots/responsive/`
3. Create comparison image

## Common Issues

### Blurry Screenshots
**Cause**: Wrong device scale factor  
**Fix**: Set `deviceScaleFactor: 2` (or 3 for iPhone 14+)

### Inconsistent Colors
**Cause**: Color profile differences  
**Fix**: Use sRGB color profile, screenshot in same browser

### File Too Large
**Cause**: Uncompressed PNG  
**Fix**: Use TinyPNG or pngquant

### Missing Content
**Cause**: Page not fully loaded  
**Fix**: Add wait in Puppeteer: `await page.waitForSelector('.content')`

### Wrong Theme
**Cause**: Dark mode persisted in localStorage  
**Fix**: Clear localStorage before screenshot or set theme explicitly

## Accessibility Screenshots

### VoiceOver (iOS)
1. Enable VoiceOver: Settings → Accessibility → VoiceOver
2. Navigate to element
3. Screenshot (element will be highlighted)
4. Disable VoiceOver

### TalkBack (Android)
1. Enable TalkBack: Settings → Accessibility → TalkBack
2. Navigate to element
3. Screenshot (green highlight visible)
4. Disable TalkBack

### Contrast Checker
1. Install browser extension (e.g., WCAG Color Contrast Checker)
2. Activate overlay
3. Screenshot showing contrast ratios
4. Save as `a11y_color-contrast.png`

## Quality Checklist

Before committing screenshots:
- [ ] Correct dimensions for device
- [ ] Compressed (< 500KB)
- [ ] No personal/test data visible
- [ ] Clean browser chrome (or standalone PWA)
- [ ] Proper light/dark mode
- [ ] Content loaded completely
- [ ] No loading spinners (unless demonstrating loading state)
- [ ] Following naming convention
- [ ] In correct directory
- [ ] README.md updated

## Resources

### Tools
- **Puppeteer**: https://pptr.dev
- **Playwright**: https://playwright.dev
- **TinyPNG**: https://tinypng.com
- **Squoosh**: https://squoosh.app

### Extensions
- **Awesome Screenshot**: Chrome Web Store
- **Nimbus Screenshot**: Chrome Web Store
- **Full Page Screen Capture**: Chrome Web Store

### Device Info
- **iOS**: https://www.ios-resolution.com
- **Android**: https://screensiz.es
- **Viewport**: https://viewportsizer.com

---

**Note**: Actual screenshot capture requires manual effort or running automation scripts. This structure provides organization and guidelines for consistent screenshot documentation.
