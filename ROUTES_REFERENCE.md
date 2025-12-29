# 🗺️ Application Routes Reference

**Quick reference guide for all available routes in the platform**

---

## 🏠 Public Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/auth` | Sign in / Sign up page |
| `/auth/coach-signup` | Coach invitation signup |
| `/about` | About page |
| `/features` | Features overview |
| `/pricing` | Pricing page |
| `/contact` | Contact page |
| `/privacy` | Privacy policy |
| `/offline` | Offline fallback page |

---

## 🔐 Dashboard Routes (Requires Authentication)

### Main Navigation

| Route | Description | Icon | Access Level |
|-------|-------------|------|--------------|
| `/dashboard` | Main dashboard | Brain | All users |
| `/dashboard/team` | Clients management | Users | All users |
| `/dashboard/goals` | Goals tracking | Target | All users |
| `/dashboard/progress` | Progress overview | TrendingUp | All users |
| `/dashboard/sessions` | Sessions hub | Calendar | All users |
| `/dashboard/tutorials` | Tutorial videos | Video | All users |
| `/dashboard/community` | Community feed | Users | All users |
| `/dashboard/subscription` | Billing & subscription | CreditCard | All users |
| `/dashboard/settings` | User settings | Settings | All users |

---

## 🧠 Treatment Sessions

| Route | Description | Status |
|-------|-------------|--------|
| `/dashboard/sessions/treatment-v2` | Treatment V2 | Legacy |
| `/dashboard/sessions/treatment-v3` | Treatment V3 | Stable |
| `/dashboard/sessions/treatment-v4` | Treatment V4 (Latest) | ✅ Production |
| `/dashboard/sessions/treatment-v4-old` | Treatment V4 Old | Backup |
| `/dashboard/sessions/analytics` | Session analytics | Level 2 only |

**Treatment Modalities Available:**
- Problem Shifting
- Reality Shifting
- Belief Shifting
- Identity Shifting
- Blockage Shifting
- Trauma Shifting

---

## 👥 Team / Client Management

| Route | Description | Access Level |
|-------|-------------|--------------|
| `/dashboard/team` | Team overview | All users |
| `/dashboard/team/customer/[id]` | Individual customer | Coaches+ |
| `/dashboard/team/message` | Message center | Level 2 |

---

## 🎓 Coach Routes

| Route | Description | Access Level |
|-------|-------------|--------------|
| `/dashboard/coach/profile` | Coach profile setup | Coaches only |

**Coach Features:**
- Set specialties
- Manage availability calendar
- Set meeting preferences
- Update bio & credentials

---

## 🔧 Admin Routes

| Route | Description | Access Level |
|-------|-------------|--------------|
| `/dashboard/admin/data-management` | Data import/export, test data | Admins only |

**Admin Features:**
- Import customers (CSV/JSON)
- Export data (CSV/JSON)
- Generate test data
- Analytics reports
- Customer management

---

## 💳 Billing & Subscription

| Route | Description |
|-------|-------------|
| `/dashboard/subscription` | Subscription management |
| `/checkout/success` | Successful payment |
| `/checkout/cancel` | Canceled payment |

**Features:**
- Upgrade/downgrade plans
- Cancel subscription
- Billing portal access
- Payment history

---

## 📹 Tutorial Videos

| Route | Description |
|-------|-------------|
| `/dashboard/tutorials` | All tutorial videos |

**Features:**
- 12 sample videos (replace URLs)
- 9 categories
- Search & filter
- Progress tracking
- Watch history

**Categories:**
- Getting Started
- Sessions
- Modalities
- Features
- Coaching
- Community
- Advanced
- Inspiration

---

## 👥 Community

| Route | Description |
|-------|-------------|
| `/dashboard/community` | Community feed |

**Features:**
- Create posts
- Like/unlike
- Comment on posts
- Search posts
- View pinned posts
- Member statistics

---

## 🔌 API Routes

### Authentication
- `POST /api/auth/coach-invitation` - Coach invitations
- `POST /api/auth/mfa` - Two-factor authentication
- `POST /api/auth/mfa/challenge` - MFA challenge

### User Management
- `GET /api/subscriptions` - Get user subscription
- `POST /api/subscriptions` - Update subscription
- `POST /api/checkout/create` - Create Stripe checkout
- `POST /api/billing/portal` - Access billing portal

### Goals & Progress
- `GET /api/goals` - Get user goals
- `POST /api/goals` - Create goal
- `GET /api/progress/stats` - Progress statistics

### Sessions
- `GET /api/sessions` - Get sessions
- `POST /api/sessions` - Book session
- `GET /api/sessions/stats` - Session stats

### Treatment
- `POST /api/treatment-v2` - V2 treatment logic
- `POST /api/treatment-v3` - V3 treatment logic
- `POST /api/treatment-v4` - V4 treatment logic
- `GET /api/tts` - Text-to-speech

### Coaches
- `GET /api/coaches` - List coaches
- `GET /api/coaches/profile` - Get coach profile
- `PUT /api/coaches/profile` - Update coach profile
- `POST /api/coaches/invitations` - Send invitation
- `GET /api/availability` - Get availability
- `POST /api/availability` - Set availability
- `GET /api/availability/slots` - Available time slots

### Community
- `GET /api/community/posts` - List posts
- `POST /api/community/posts` - Create post
- `GET /api/community/posts/[id]` - Get post
- `PUT /api/community/posts/[id]` - Update post
- `DELETE /api/community/posts/[id]` - Delete post
- `GET /api/community/comments` - List comments
- `POST /api/community/comments` - Create comment
- `POST /api/community/likes` - Like/unlike
- `GET /api/community/tags` - List tags
- `POST /api/community/events` - Create event
- `GET /api/community/events` - List events
- `POST /api/community/events/[id]/rsvp` - RSVP to event
- `GET /api/community/activity` - Activity feed

### Admin
- `GET /api/admin/analytics` - Analytics data
- `GET /api/admin/customers` - List customers
- `POST /api/admin/data-management` - Import/export data
- `GET /api/admin/billing` - Billing reports
- `GET /api/admin/tenants` - Tenant management

### Notifications
- `GET /api/notifications/preferences` - Get preferences
- `PUT /api/notifications/preferences` - Update preferences
- `POST /api/notifications/test` - Test notification
- `POST /api/notifications/subscriptions` - Push subscriptions

### GDPR
- `POST /api/gdpr/data-export` - Export user data
- `POST /api/gdpr/data-deletion` - Delete user data
- `GET /api/gdpr/consent` - Get consent status
- `POST /api/gdpr/consent` - Update consent

### Webhooks
- `POST /api/webhooks/stripe` - Stripe webhook handler

---

## 🎯 Feature Gates by Subscription Tier

### Trial (Free)
- ✅ Basic sessions
- ✅ Tutorials
- ❌ Advanced features locked

### Level 1 - Essential MyAi ($29/month)
- ✅ Problem Shifting modality
- ✅ Full tutorials
- ✅ Community
- ✅ Basic progress
- ❌ Other modalities locked
- ❌ Advanced analytics locked

### Level 2 - Complete MyAi ($49/month)
- ✅ All 6 modalities
- ✅ Voice sessions
- ✅ Coach booking
- ✅ Advanced analytics
- ✅ Team management
- ✅ Full community

---

## 🔒 Role-Based Access

### User Roles:
- **user** - Standard user (default)
- **coach** - Can manage profile, availability, clients
- **manager** - Team management features
- **tenant_admin** - Full tenant management
- **super_admin** - Platform-wide access

### Permission Hierarchy:
```
super_admin > tenant_admin > manager > coach > user
```

---

## 📱 Mobile Navigation

**Bottom Navigation (Mobile):**
- Home (Dashboard)
- Sessions
- Goals
- Settings

**Hamburger Menu (All Routes):**
- Access full sidebar navigation
- All routes available

---

## 🎨 Theme Routes

Users can switch themes from:
- Settings page (`/dashboard/settings`)
- Header theme dropdown (all pages)

**Available Themes:**
- Light Mode
- Dark Mode
- Solarized Dark
- Ocean
- Forest
- Sunset

---

## 🔗 Deep Links

**Session Resume:**
```
/dashboard/sessions/treatment-v4?sessionId=SESSION_ID&resume=true
```

**Direct Post:**
```
/dashboard/community#post-POST_ID
```

**Specific Settings:**
```
/dashboard/settings#profile
/dashboard/settings#security
/dashboard/settings#accessibility
/dashboard/settings#privacy
```

---

## 🚀 Quick Access URLs

**For Testing:**
- Sign up: `/auth`
- Dashboard: `/dashboard`
- Start Session: `/dashboard/sessions/treatment-v4`
- Book Coach: `/dashboard/sessions` → "Book Session"
- Community: `/dashboard/community`
- Tutorials: `/dashboard/tutorials`
- Settings: `/dashboard/settings`

**For Admins:**
- Data Management: `/dashboard/admin/data-management`
- Analytics: View via API calls or future admin dashboard

**For Coaches:**
- Profile Setup: `/dashboard/coach/profile`
- View Bookings: `/dashboard/sessions`

---

## 📊 Statistics & Analytics

**User Dashboard (`/dashboard`):**
- Goals completed
- Sessions count
- Progress percentage
- Recent activity

**Admin Analytics (API):**
- Revenue trends
- Customer lifecycle
- Support metrics
- Subscription breakdown

---

## 🎓 Help & Documentation

**In-App Help:**
- Tutorial videos page
- Settings tooltips
- Feature banners
- Onboarding guides

**External Documentation:**
- `FEATURE_COMPLETION_ROADMAP.md`
- `LAUNCH_READY_GUIDE.md`
- `ROUTES_REFERENCE.md` (this file)

---

**Last Updated:** December 29, 2025  
**Version:** 1.0.0
