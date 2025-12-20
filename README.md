# MindShifting

A revolutionary AI-powered progressive web app for mindset transformation and personal growth. Built mobile-first with a native app-like experience.

## Overview

MindShifting is designed to help users transform their mindset, overcome limiting beliefs, and achieve personal growth through AI-powered insights and personalized coaching. The platform is now a fully-featured PWA with offline support, touch gestures, and accessibility-first design.

## ✨ Mobile-First Features

### Progressive Web App (PWA)
- 📲 **Installable** - Add to home screen on iOS and Android
- 🔄 **Offline Support** - Works without internet connection
- ⚡ **Fast Loading** - Optimized for 90+ Lighthouse performance score
- 💾 **Smart Caching** - Service worker with intelligent caching strategies
- 🔔 **App Shortcuts** - Quick actions from home screen icon

### Touch & Gestures
- 👆 **Pull-to-Refresh** - iOS-style reload with rubber-band physics
- 👈 **Swipe Actions** - Swipe cards to delete, archive, or favorite
- 📊 **Bottom Sheets** - Drag to different heights, dismiss with swipe
- � **Pinch Zoom** - Images and charts with two-finger zoom
- ⏱️ **Long Press** - Context menus on tap-and-hold
- 📳 **Haptic Feedback** - iOS-style vibrations for all interactions

### Mobile UI/UX
- 🎨 **Dark Mode** - Flicker-free theme switching with system detection
- 🔘 **Bottom Navigation** - Thumb-friendly navigation bar
- ✏️ **Smart Forms** - Native inputs with mobile keyboards
- 🎯 **Touch Targets** - Minimum 44×44px tap areas
- 📱 **Safe Areas** - Notch and home indicator support
- 🎭 **Action Sheets** - iOS-style bottom action menus
- 🍞 **Toast Notifications** - Context-aware feedback system

### Accessibility
- ♿ **WCAG 2.1 AA** - Fully compliant accessibility
- 🎤 **Screen Readers** - VoiceOver & TalkBack tested
- ⌨️ **Keyboard Navigation** - Complete keyboard support
- 🎨 **Color Contrast** - 4.5:1 minimum ratios
- 🔍 **Focus Management** - Skip links and focus traps
- 📢 **ARIA** - Comprehensive ARIA attributes

### Performance
- 🚀 **90+ Lighthouse Score** - Performance optimized
- 🖼️ **Image Optimization** - Next.js Image with WebP/AVIF
- 📦 **Code Splitting** - Lazy loading for heavy components
- 🎯 **Core Web Vitals** - LCP < 2.5s, CLS < 0.1, FCP < 1.8s
- 💨 **Fast Refresh** - Instant HMR in development

## Core Features

- �🧠 AI-powered mindset analysis
- 📊 Personal growth tracking  
- 🎯 Goal setting and achievement
- 💡 Personalized recommendations
- 🔐 Secure user authentication
- 🌐 Works on all devices (375px to 1920px+)

## Tech Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 3.4+ (mobile-first)
- **PWA**: next-pwa 5.6.0 with Workbox
- **Icons**: Lucide React
- **Components**: Radix UI (accessible primitives)

### Backend
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage
- **API**: Next.js API Routes

### Mobile Enhancements
- **Gestures**: Custom touch event handlers
- **Haptics**: Vibration API (iOS patterns)
- **Accessibility**: focus-trap-react
- **Forms**: Custom validation hooks

### Quality & Testing
- **Performance**: Lighthouse CI
- **Accessibility**: axe DevTools, VoiceOver, TalkBack
- **Device Testing**: BrowserStack, Chrome DevTools
- **Code Quality**: TypeScript, ESLint

### Deployment
- **Hosting**: Vercel
- **CDN**: Vercel Edge Network
- **Analytics**: Vercel Analytics
- **Monitoring**: Core Web Vitals (RUM)

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/MyAiAd/MindShift.git
cd MindShift
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your actual values
```

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Testing on Mobile Devices

#### iOS (Safari)
1. Find your local IP: `ipconfig getifaddr en0` (macOS)
2. Access `http://YOUR_IP:3000` on iPhone
3. Test PWA: Share → Add to Home Screen
4. Test gestures: Pull-to-refresh, swipe, bottom sheets

#### Android (Chrome)
1. Find your local IP: `ipconfig getifaddr en0` (macOS) or `hostname -I` (Linux)
2. Access `http://YOUR_IP:3000` on Android
3. Test PWA: Chrome menu → Install app
4. Test gestures and haptics

#### Device Emulation (Quick Testing)
1. Open Chrome DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select device (iPhone 14, Pixel 7, etc.)
4. Test responsive layouts and touch events

## Environment Variables

See `vercel-environment-variables.txt` for a complete list of environment variables needed for deployment.

### Required Variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

## 📖 Documentation

### Mobile PWA Documentation
- **[MOBILE_FEATURES.md](./MOBILE_FEATURES.md)** - Complete feature catalog with metrics
- **[GESTURES.md](./GESTURES.md)** - Touch gesture interactions reference
- **[MOBILE_FORM_COMPONENTS.md](./MOBILE_FORM_COMPONENTS.md)** - Form system guide
- **[ACCESSIBILITY_TESTING_GUIDE.md](./ACCESSIBILITY_TESTING_GUIDE.md)** - A11y procedures
- **[CROSS_DEVICE_TESTING.md](./CROSS_DEVICE_TESTING.md)** - Device testing matrix
- **[LIGHTHOUSE_AUDIT_GUIDE.md](./LIGHTHOUSE_AUDIT_GUIDE.md)** - Performance auditing

### Setup Guides
- **[ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)** - Environment configuration
- **[PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md)** - Production deployment
- **[STRIPE_SETUP_GUIDE.md](./STRIPE_SETUP_GUIDE.md)** - Payment integration

### Architecture
- **[ARCHITECTURE_ANALYSIS.md](./ARCHITECTURE_ANALYSIS.md)** - System architecture
- **[SECURITY.md](./SECURITY.md)** - Security best practices

## Deployment

### Vercel Deployment (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy!

### PWA Deployment Checklist
- [ ] Update `public/manifest.json` with production URLs
- [ ] Generate PWA icons (192×192, 512×512, apple-touch-icon)
- [ ] Configure service worker caching strategies
- [ ] Test PWA installation on iOS and Android
- [ ] Run Lighthouse audit (target 90+)
- [ ] Verify offline functionality
- [ ] Check Core Web Vitals in production
- [ ] Enable HTTPS (required for PWA)
- [ ] Test on real devices (iPhone, Android)

### Post-Deployment Monitoring
```bash
# Install Lighthouse CI
npm install -g @lhci/cli

# Run audit
lhci autorun --upload.target=temporary-public-storage
```

Monitor Core Web Vitals:
- **LCP**: < 2.5s (Largest Contentful Paint)
- **FID**: < 100ms (First Input Delay)
- **CLS**: < 0.1 (Cumulative Layout Shift)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email support@myai.com or join our Slack channel.

## Browser Support

### Supported Browsers
- **iOS**: Safari 15+, Chrome iOS, Firefox iOS, Edge iOS
- **Android**: Chrome 90+, Firefox 90+, Samsung Internet, Edge
- **Desktop**: Chrome, Firefox, Safari 15+, Edge (Chromium)

### PWA Support
- iOS 15+ (Safari only for installation)
- Android 5+ (Chrome, Samsung Internet)
- Desktop: Chrome, Edge (Chromium)

## Performance Metrics

### Target Lighthouse Scores
- **Performance**: 90+ 🎯
- **Accessibility**: 95+ ♿
- **Best Practices**: 95+ ✅
- **SEO**: 95+ 🔍
- **PWA**: Pass 📱

### Core Web Vitals
- **First Contentful Paint (FCP)**: < 1.8s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Total Blocking Time (TBT)**: < 200ms
- **Cumulative Layout Shift (CLS)**: < 0.1
- **Speed Index**: < 3.4s

## Accessibility Compliance

- **WCAG 2.1 Level AA** compliant
- Screen reader tested (VoiceOver, TalkBack, NVDA)
- Keyboard navigable (all features accessible via keyboard)
- Color contrast ratios meet 4.5:1 minimum
- Focus indicators visible and clear
- ARIA attributes throughout
- Skip navigation links
- Alt text for all images

## Roadmap

### ✅ Completed (Mobile-First Transformation)
- [x] Progressive Web App (installable, offline)
- [x] Mobile-first responsive design
- [x] Touch gestures (pull-to-refresh, swipe, drag)
- [x] Haptic feedback system
- [x] Dark mode (flicker-free)
- [x] Accessibility (WCAG 2.1 AA)
- [x] Performance optimization (90+ Lighthouse)
- [x] Form components (mobile-optimized)
- [x] Bottom sheets and action sheets
- [x] Toast notification system

### 🚧 In Progress
- [ ] Push notifications for appointments
- [ ] Background sync for offline actions
- [ ] Advanced AI models integration

### 📋 Planned
- [ ] Web Share API for social sharing
- [ ] Camera access for profile photos
- [ ] Biometric authentication (Face ID, Touch ID)
- [ ] Payment Request API integration
- [ ] Contact Picker API
- [ ] Voice recording for journal entries
- [ ] Geolocation for location-based content
- [ ] Community features
- [ ] Progress tracking and analytics
- [ ] Personalized coaching recommendations

---

Built with ❤️ by [MyAi](https://MyAi.ad) # 2FA System Ready - Sat Jul 19 07:44:35 PM WEST 2025
