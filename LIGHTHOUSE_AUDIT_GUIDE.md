# Lighthouse Audit Guide

## Overview
Google Lighthouse is an automated tool for improving the quality of web pages. This guide provides comprehensive instructions for running mobile audits, interpreting results, and achieving optimal scores for the MindShifting PWA.

## Target Scores

### Production Goals
- **Performance**: 90+ (Green)
- **Accessibility**: 95+ (Green)
- **Best Practices**: 95+ (Green)
- **SEO**: 95+ (Green)
- **PWA**: Pass all checks

### Current Baseline
_To be filled after first audit_
- Performance: __
- Accessibility: __
- Best Practices: __
- SEO: __
- PWA: __

## Running Lighthouse Audits

### Method 1: Chrome DevTools (Recommended)
1. Open Chrome/Edge browser
2. Navigate to your PWA (localhost or deployed)
3. Open DevTools (F12 or Cmd+Option+I)
4. Click "Lighthouse" tab
5. Select categories: All
6. Select device: Mobile
7. Click "Analyze page load"
8. Wait for results (30-60 seconds)
9. Review report

**Settings**:
- Mode: Navigation (default)
- Device: Mobile
- Categories: All checked
- Throttling: Simulated (default)

### Method 2: Lighthouse CLI
```bash
# Install globally
npm install -g lighthouse

# Run audit
lighthouse https://your-app.com \
  --only-categories=performance,accessibility,best-practices,seo,pwa \
  --form-factor=mobile \
  --screenEmulation.mobile=true \
  --throttling.cpuSlowdownMultiplier=4 \
  --output=html \
  --output-path=./lighthouse-report.html

# Open report
open lighthouse-report.html
```

### Method 3: PageSpeed Insights
1. Go to [PageSpeed Insights](https://pagespeed.web.dev/)
2. Enter your URL
3. Click "Analyze"
4. View Mobile results
5. Download report

**Advantage**: Tests from Google's servers (real-world network)

### Method 4: CI/CD Integration
```yaml
# GitHub Actions example
name: Lighthouse CI
on: [pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            https://your-preview-url.com
          uploadArtifacts: true
          temporaryPublicStorage: true
```

## Performance Category (90+ Target)

### Key Metrics

#### 1. First Contentful Paint (FCP)
**Target**: < 1.8 seconds
**Current**: __

**What it measures**: Time until first text/image renders

**Optimization Strategies**:
- [ ] Inline critical CSS
- [ ] Preload key resources
- [ ] Minimize render-blocking JavaScript
- [ ] Use font-display: swap
- [ ] Optimize server response time

**Our Implementation**:
- Theme script inlined in `app/layout.tsx`
- Next.js optimized fonts
- No blocking third-party scripts

#### 2. Largest Contentful Paint (LCP)
**Target**: < 2.5 seconds
**Current**: __

**What it measures**: Time until largest visible element renders

**Optimization Strategies**:
- [ ] Optimize images (Next.js Image component)
- [ ] Preload LCP resources
- [ ] Use CDN for static assets
- [ ] Remove render-blocking resources
- [ ] Minimize CSS/JS bundle size

**Our Implementation**:
- Next.js Image with priority on hero images
- Static assets optimized
- Code splitting with dynamic imports

#### 3. Total Blocking Time (TBT)
**Target**: < 200 milliseconds
**Current**: __

**What it measures**: Time main thread is blocked

**Optimization Strategies**:
- [ ] Break up long tasks (> 50ms)
- [ ] Defer non-critical JavaScript
- [ ] Use web workers for heavy computation
- [ ] Optimize third-party scripts
- [ ] Code split large bundles

**Our Implementation**:
- Dynamic imports for heavy components
- V4AudioPreloader lazy loaded
- No heavy synchronous operations

#### 4. Cumulative Layout Shift (CLS)
**Target**: < 0.1
**Current**: __

**What it measures**: Visual stability during load

**Optimization Strategies**:
- [ ] Set width/height on images
- [ ] Reserve space for dynamic content
- [ ] Avoid inserting content above existing
- [ ] Use CSS aspect-ratio for responsive media
- [ ] Avoid FOIT (Flash of Invisible Text)

**Our Implementation**:
- suppressHydrationWarning prevents dark mode shift
- Images have explicit dimensions
- Skeleton loaders reserve space

#### 5. Speed Index
**Target**: < 3.4 seconds
**Current**: __

**What it measures**: How quickly content is visually populated

**Optimization Strategies**:
- [ ] Prioritize above-the-fold content
- [ ] Lazy load below-the-fold images
- [ ] Minimize main thread work
- [ ] Reduce JavaScript execution time
- [ ] Optimize web fonts

### Performance Opportunities

Common issues and fixes:

#### Opportunity: Eliminate Render-Blocking Resources
**Fix**:
```tsx
// In next.config.js
experimental: {
  optimizeCss: true,
  optimizePackageImports: ['lucide-react', '@radix-ui'],
}
```

#### Opportunity: Properly Size Images
**Fix**:
```tsx
// Use Next.js Image with proper sizes
<Image
  src="/logo.jpg"
  width={120}
  height={120}
  sizes="(max-width: 768px) 100vw, 120px"
  alt="Logo"
/>
```

#### Opportunity: Minify JavaScript
**Fix**: Next.js handles automatically in production

#### Opportunity: Enable Text Compression
**Fix**: Ensure server sends `Content-Encoding: gzip` or `br`

#### Opportunity: Reduce Unused JavaScript
**Fix**:
- Remove unused dependencies
- Tree-shake libraries
- Dynamic import heavy features

## Accessibility Category (95+ Target)

### Critical Checks

#### 1. Color Contrast
**Requirement**: 4.5:1 for normal text, 3:1 for large text

**Our Implementation**:
- [ ] Body text: Check ratio
- [ ] Links: Check ratio
- [ ] Buttons: Check ratio
- [ ] Error messages: Check ratio in both modes

**Tool**: Chrome DevTools > Elements > Styles > Color picker

#### 2. ARIA Attributes
**Requirements**:
- [ ] Valid ARIA roles
- [ ] Required ARIA attributes present
- [ ] ARIA IDs are unique
- [ ] No conflicting ARIA roles

**Our Implementation**:
- MobileNav has `role="navigation"` and `aria-label`
- Buttons have `aria-label` when icon-only
- Modals have `role="dialog"` and `aria-modal="true"`
- Live regions use `aria-live="polite"`

#### 3. Form Elements
**Requirements**:
- [ ] All inputs have labels
- [ ] Labels use `htmlFor` matching input `id`
- [ ] Error messages linked with `aria-describedby`
- [ ] Required fields marked with `aria-required` or `required`

**Our Implementation**:
- MobileInput auto-generates IDs
- Labels always present
- Error messages use role="alert"
- Required fields marked with *

#### 4. Interactive Elements
**Requirements**:
- [ ] Links have discernible text
- [ ] Buttons have accessible names
- [ ] Focus indicators visible
- [ ] Touch targets minimum 44×44px

**Our Implementation**:
- All buttons have text or aria-label
- Custom focus rings (2px indigo)
- touch-target class ensures 44px minimum
- Skip links for keyboard users

#### 5. Heading Structure
**Requirements**:
- [ ] Headings in logical order (h1 → h2 → h3)
- [ ] No skipped heading levels
- [ ] Page has h1

**Our Implementation**:
- Each page has single h1
- Sections use h2, h3 appropriately
- No skipped levels

### Common Accessibility Issues

#### Issue: Image Missing Alt Text
**Fix**:
```tsx
<Image src="/logo.png" alt="MindShifting logo" />
```

#### Issue: Insufficient Color Contrast
**Fix**: Use Tailwind's color palette with tested ratios
```tsx
// Good: text-gray-900 on bg-white (21:1 ratio)
// Good: text-gray-100 on bg-gray-900 (18.4:1 ratio)
```

#### Issue: Links Not Distinguishable
**Fix**: Add underline or distinct color
```tsx
<a className="text-indigo-600 underline hover:text-indigo-700">
```

## Best Practices Category (95+ Target)

### Checks

#### 1. HTTPS
**Requirement**: All resources loaded over HTTPS

**Our Implementation**:
- [ ] Production uses HTTPS
- [ ] No mixed content warnings
- [ ] Service worker requires HTTPS

#### 2. No Console Errors
**Requirement**: No errors logged to browser console

**Our Implementation**:
- [ ] Remove all console.log in production
- [ ] Fix TypeScript errors
- [ ] Handle promise rejections
- [ ] Catch API errors gracefully

#### 3. Images Have Correct Aspect Ratio
**Requirement**: Displayed size matches natural size

**Our Implementation**:
- Next.js Image handles automatically
- Set explicit width/height props

#### 4. No Deprecated APIs
**Requirement**: Don't use deprecated web platform APIs

**Our Implementation**:
- Use Vibration API (not deprecated)
- Avoid WebSQL, AppCache
- Use modern JavaScript (ES2020+)

#### 5. CSP (Content Security Policy)
**Recommendation**: Set strict CSP headers

**Implementation**:
```tsx
// In next.config.js
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
        }
      ]
    }
  ];
}
```

## SEO Category (95+ Target)

### Checks

#### 1. Meta Description
**Requirement**: Page has meta description

**Implementation**:
```tsx
// In app/layout.tsx or page metadata
export const metadata = {
  description: 'Transform your mindset with MindShifting - Your personal growth coaching platform',
  keywords: ['mindset', 'coaching', 'personal growth'],
}
```

#### 2. Title Tag
**Requirement**: Document has title element

**Implementation**:
```tsx
export const metadata = {
  title: 'MindShifting - Personal Growth & Coaching',
}
```

#### 3. Crawlable Links
**Requirement**: Links have href attribute

**Implementation**:
```tsx
// Use Next.js Link with href
<Link href="/dashboard">Dashboard</Link>
```

#### 4. robots.txt
**Requirement**: robots.txt is valid

**Implementation**:
```txt
# public/robots.txt
User-agent: *
Allow: /
Sitemap: https://your-domain.com/sitemap.xml
```

#### 5. Structured Data
**Recommendation**: Include JSON-LD for rich results

**Implementation**:
```tsx
// In page component
<script type="application/ld+json">
  {JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "MindShifting",
    "applicationCategory": "HealthApplication",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  })}
</script>
```

## PWA Category (All Checks Pass)

### Installability

#### 1. Valid Manifest
**Requirements**:
- [ ] manifest.json exists and is valid
- [ ] Has name or short_name
- [ ] Has icons (192px and 512px minimum)
- [ ] Has start_url
- [ ] Has display property

**Our Implementation**: ✅ `public/manifest.json`

#### 2. Service Worker
**Requirements**:
- [ ] Registers a service worker
- [ ] Service worker responds to fetch events
- [ ] Page loads offline

**Our Implementation**: ✅ next-pwa configured

#### 3. Icons
**Requirements**:
- [ ] Has maskable icon
- [ ] Icons are at least 192×192px and 512×512px
- [ ] Icons declared in manifest

**Our Implementation**: ✅ Icons in public directory

### Fast & Reliable

#### 1. Offline Support
**Requirement**: Page works offline

**Test**:
1. Visit page
2. Enable airplane mode
3. Refresh page
4. Should show cached content or offline page

**Our Implementation**: ✅ Service worker caches pages

#### 2. Fast Load Time
**Requirement**: Page loads fast on mobile networks

**Target**: FCP < 1.8s, LCP < 2.5s

### Optimized for Mobile

#### 1. Viewport Meta Tag
**Requirement**: Has viewport meta tag

**Implementation**: ✅ In `app/layout.tsx`
```tsx
viewport: {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}
```

#### 2. Theming
**Requirement**: Has theme-color meta tag

**Implementation**: ✅ In manifest and meta tags

## Audit Results Template

```markdown
## Lighthouse Audit Results
**Date**: YYYY-MM-DD
**URL**: https://your-app.com
**Device**: Mobile
**Connection**: 4G throttled

### Scores
- Performance: __ / 100
- Accessibility: __ / 100
- Best Practices: __ / 100
- SEO: __ / 100
- PWA: Pass/Fail

### Performance Metrics
- FCP: __s (target: < 1.8s)
- LCP: __s (target: < 2.5s)
- TBT: __ms (target: < 200ms)
- CLS: __ (target: < 0.1)
- Speed Index: __s (target: < 3.4s)

### Opportunities (Performance)
1. [Opportunity name] - Save __s
   - [ ] Action item
2. [Opportunity name] - Save __s
   - [ ] Action item

### Failed Audits
1. [Audit name]
   - Category: [Performance/Accessibility/etc.]
   - Fix: [Description]
   - [ ] Completed

### Screenshots
[Attach Lighthouse report screenshot]
```

## Continuous Monitoring

### Track Over Time
- Run Lighthouse weekly during development
- Track trend: improving or regressing?
- Set up Lighthouse CI for PRs
- Monitor Core Web Vitals in production

### Real User Monitoring (RUM)
- Use Google Analytics 4 for Web Vitals
- Track 75th percentile scores
- Monitor by device type
- Alert on regressions

## Next Steps After Audit

1. **Prioritize Issues**
   - Critical: Accessibility violations, broken PWA features
   - High: Performance < 80, major UX issues
   - Medium: Performance 80-90, minor issues
   - Low: Optimizations, nice-to-haves

2. **Fix Critical Issues First**
   - Accessibility should be 100
   - PWA must pass all checks
   - No console errors

3. **Optimize Performance**
   - Focus on LCP and CLS first (biggest impact)
   - Then TBT and FCP
   - Speed Index usually improves automatically

4. **Retest**
   - Run Lighthouse again after fixes
   - Verify improvements
   - Check for regressions

5. **Document**
   - Record before/after scores
   - Note what fixed which issue
   - Share learnings with team

## Resources

- [Lighthouse Documentation](https://developers.google.com/web/tools/lighthouse)
- [Web Vitals](https://web.dev/vitals/)
- [PWA Checklist](https://web.dev/pwa-checklist/)
- [Lighthouse Scoring Calculator](https://googlechrome.github.io/lighthouse/scorecalc/)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)
