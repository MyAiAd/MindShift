# Admin Area Requirements - Complete Back Office

## 📋 Overview

This document outlines all features needed in the admin area for client handoff. The admin area should be self-sufficient for non-technical users to manage the entire platform.

**Access Level:** `tenant_admin` and `super_admin` roles only

---

## ✅ Current State

### Already Built:
- ✅ **Data Management** (`/dashboard/admin/data-management`)
  - Import/export data
  - Generate test data
  - Seed subscription plans
  - Database utilities

### Need to Build:
Everything below 👇

---

## 🎯 Required Admin Features

## 1. 📹 Tutorial Video Management
**Route:** `/dashboard/admin/videos`

### Features Needed:
- ✅ **Video Library View**
  - List all videos in table/grid
  - Search by title/description
  - Filter by category, status, provider
  - Sort by created date, views, completions
  - Bulk actions (delete, change status)

- ✅ **Create New Video**
  - Form fields:
    - Title (required)
    - Description
    - Video URL (required) - with provider auto-detect
    - Thumbnail URL (optional)
    - Duration (text format like "8:45")
    - Provider (YouTube/Vimeo/Wistia/Custom)
    - Category (dropdown)
    - Tags (multi-select or chips)
    - Featured toggle
    - Status (Draft/Published/Archived)
    - Subscription tier requirement (none/trial/level_1/level_2/level_3)
  - Real-time preview of embed
  - Save as draft or publish immediately

- ✅ **Edit Existing Video**
  - Same form as create
  - Show current analytics (views, completions, avg watch %)
  - Option to archive
  - Delete (with confirmation)

- ✅ **Category Management**
  - List all categories
  - Create new category
    - Name, description, icon, color
    - Display order
  - Edit/delete categories
  - Show video count per category

- ✅ **Video Analytics Dashboard**
  - Most viewed videos
  - Highest completion rates
  - Videos by provider
  - Recent uploads
  - Featured videos performance

### API Routes Already Created:
- ✅ POST/GET `/api/tutorials/videos`
- ✅ GET/PUT/DELETE `/api/tutorials/videos/[id]`
- ✅ POST/GET `/api/tutorials/categories`

---

## 2. 💬 Community Management
**Route:** `/dashboard/admin/community`

### Features Needed:
- ✅ **Post Moderation**
  - View all posts (including reported/flagged)
  - Filter by status, author, date, tags
  - Pin/unpin posts
  - Edit post content (as moderator)
  - Delete posts (with confirmation)
  - Archive posts
  - View post analytics (likes, comments, views)

- ✅ **Comment Moderation**
  - View all comments
  - Approve/reject pending comments
  - Delete comments
  - Ban words/phrases (optional)

- ✅ **Tag Management**
  - List all tags
  - Create/edit/delete tags
  - Merge duplicate tags
  - Show usage count

- ✅ **Event Management** (if using events feature)
  - Create new events
  - Edit upcoming events
  - View RSVPs and attendance
  - Send event reminders
  - Cancel events

- ✅ **Community Analytics**
  - Total posts/comments/likes
  - Most active users
  - Popular tags
  - Engagement trends
  - Growth metrics

### API Routes Already Created:
- ✅ `/api/community/posts` (full CRUD)
- ✅ `/api/community/comments`
- ✅ `/api/community/posts/[id]/like`

---

## 3. 👥 User Management
**Route:** `/dashboard/admin/users`

### Features Needed:
- ✅ **User List**
  - Table view with pagination
  - Search by name, email
  - Filter by role, status, subscription tier
  - Sort by join date, last login, activity
  - Bulk actions (export, change role, deactivate)

- ✅ **User Details/Edit**
  - View full profile
  - Edit user information
  - Change role (user/coach/manager/tenant_admin)
  - Activate/deactivate account
  - Reset password (send email)
  - View user activity
    - Videos watched
    - Community posts/comments
    - Session history
    - Last login

- ✅ **Subscription Management**
  - View current subscription
  - Change subscription tier
  - Extend trial
  - View payment history
  - Refund/cancel subscription

- ✅ **User Analytics**
  - Total users
  - Active users (last 30 days)
  - New signups (trend)
  - Users by subscription tier
  - Churn rate
  - User engagement score

### API Routes Needed:
- ❌ GET/PUT `/api/admin/users` (needs to be created)
- ❌ GET/PUT `/api/admin/users/[id]` (needs to be created)
- ❌ POST `/api/admin/users/[id]/change-role` (needs to be created)
- ⚠️ Subscription APIs may already exist (check)

---

## 4. 📊 Analytics & Reports
**Route:** `/dashboard/admin/analytics`

### Features Needed:
- ✅ **Dashboard Overview**
  - Key metrics cards:
    - Total users (with trend)
    - Active users (last 30 days)
    - Total videos
    - Total community posts
    - Revenue (if using Stripe)
    - New signups this week/month
  - Charts:
    - User growth over time
    - Video engagement over time
    - Community activity over time
    - Revenue over time

- ✅ **Video Analytics**
  - Total views
  - Total completions
  - Average watch percentage
  - Most popular videos
  - Least engaged videos
  - Completion rate by category
  - Provider breakdown

- ✅ **Community Analytics**
  - Total posts/comments
  - Average engagement per post
  - Most active users
  - Popular content times
  - Tag cloud/popular topics

- ✅ **User Analytics**
  - User growth chart
  - Active vs inactive users
  - Subscription distribution
  - User retention rate
  - Feature adoption (who uses what)

- ✅ **Export Reports**
  - Download as CSV/PDF
  - Schedule automated reports
  - Custom date ranges

### API Routes:
- ⚠️ Check if `/api/admin/analytics` already exists
- May need to expand with more endpoints

---

## 5. ⚙️ System Settings
**Route:** `/dashboard/admin/settings`

### Features Needed:
- ✅ **General Settings**
  - Site name
  - Site description
  - Logo upload
  - Favicon upload
  - Primary color/theme
  - Contact email
  - Support URL

- ✅ **Feature Flags**
  - Enable/disable community
  - Enable/disable video tutorials
  - Enable/disable coaching
  - Enable/disable events
  - Enable/disable voice features
  - Maintenance mode

- ✅ **Email Settings** (if applicable)
  - SMTP configuration
  - Email templates preview
  - Test email send

- ✅ **Subscription Tiers** (if editable)
  - View current tiers
  - Edit tier names/features
  - Set pricing (if not using Stripe admin)

- ✅ **Security Settings**
  - Password requirements
  - Session timeout
  - 2FA enforcement
  - IP whitelist (optional)

### API Routes Needed:
- ❌ GET/PUT `/api/admin/settings` (needs to be created)
- ❌ POST `/api/admin/settings/test-email` (optional)

---

## 6. 🔔 Notifications Management (Optional but Nice)
**Route:** `/dashboard/admin/notifications`

### Features Needed:
- ✅ **Send Announcement**
  - To all users or filtered group
  - Title, message, link
  - Schedule for later
  - In-app notification
  - Email notification (optional)

- ✅ **Notification Templates**
  - Welcome email
  - Password reset
  - Subscription renewal
  - New content available
  - Community activity digest

- ✅ **Notification History**
  - View sent notifications
  - Delivery status
  - Open/click rates

---

## 7. 📈 Coach Management (If Coaching Feature Active)
**Route:** `/dashboard/admin/coaches`

### Features Needed:
- ✅ **Coach List**
  - All coaches in system
  - Filter by specialty, status
  - Approve/reject coach applications
  - View coach profiles

- ✅ **Coach Details**
  - View/edit coach profile
  - View booking calendar
  - View session history
  - View ratings/reviews
  - Suspend/activate coach

- ✅ **Session Management**
  - View all scheduled sessions
  - Cancel sessions (with notification)
  - View session notes
  - Export session data

### API Routes:
- ⚠️ Check if coach APIs already exist
- May be part of existing booking system

---

## 8. 💰 Revenue & Billing (If Using Stripe)
**Route:** `/dashboard/admin/billing`

### Features Needed:
- ✅ **Revenue Dashboard**
  - Total revenue
  - Monthly recurring revenue (MRR)
  - Revenue by subscription tier
  - Revenue trends
  - Churn impact

- ✅ **Subscription Overview**
  - Active subscriptions
  - Canceled subscriptions
  - Trial conversions
  - Upgrade/downgrade tracking

- ✅ **Invoice Management**
  - View all invoices
  - Resend invoices
  - Refund management
  - Failed payment tracking

- ✅ **Stripe Integration**
  - Link to Stripe dashboard
  - Webhook status
  - Sync subscriptions

### API Routes:
- ⚠️ Check `/api/billing/*` routes
- May need admin-specific billing routes

---

## 9. 🗂️ Content Library (Future Enhancement)
**Route:** `/dashboard/admin/content`

### Features Needed:
- ✅ **Resource Management**
  - Downloadable PDFs
  - Worksheets
  - Templates
  - Upload/organize files
  - Set access by subscription tier

- ✅ **FAQ Management**
  - Create/edit FAQ items
  - Organize by category
  - Reorder questions

---

## 📊 Priority Matrix

### 🔴 Critical (Must Have for Handoff)
1. **Tutorial Video Management** - Client needs to add their videos
2. **User Management** - Client needs to manage users
3. **Basic Analytics Dashboard** - Client needs to see what's happening
4. **Community Moderation** - Client needs to moderate content

### 🟡 Important (Should Have)
5. **System Settings** - Client should be able to customize
6. **Category Management** - Organize content
7. **Detailed Analytics** - Better insights

### 🟢 Nice to Have (Can Wait)
8. **Coach Management** - If using coaching feature
9. **Notifications System** - Can be manual for now
10. **Revenue Dashboard** - Stripe has its own dashboard
11. **Content Library** - Can be added later

---

## 🎨 UI/UX Requirements

### All Admin Pages Should Have:
- ✅ **Consistent Layout**
  - Same navigation as existing admin pages
  - Breadcrumbs
  - Page title + description
  - Action buttons in consistent locations

- ✅ **Data Tables**
  - Pagination
  - Search
  - Sort
  - Filters
  - Bulk actions
  - Export to CSV

- ✅ **Forms**
  - Clear validation
  - Error messages
  - Success confirmations
  - Cancel/save buttons
  - Unsaved changes warning

- ✅ **Modals**
  - Confirmation dialogs (delete, etc.)
  - Quick edit modals
  - Loading states

- ✅ **Responsive Design**
  - Mobile-friendly (tablets at minimum)
  - Collapsible sidebar
  - Touch-friendly buttons

- ✅ **Empty States**
  - Clear CTAs when no data
  - Helpful instructions
  - Sample data links (optional)

---

## 🔐 Security Requirements

### All Admin Routes Must:
- ✅ Check user authentication
- ✅ Verify role is `tenant_admin` or `super_admin`
- ✅ Enforce tenant isolation (except super_admin)
- ✅ Log all admin actions (audit trail)
- ✅ Validate all inputs
- ✅ Use CSRF protection
- ✅ Rate limit sensitive operations

---

## 📝 Documentation Requirements

### Client Handoff Docs Should Include:
- ✅ **Admin User Guide** (how to use each feature)
- ✅ **Quick Start Guide** (first 10 things to do)
- ✅ **Video Tutorial Setup Guide** (how to add videos)
- ✅ **Community Moderation Guide**
- ✅ **User Management Guide**
- ✅ **Troubleshooting Common Issues**
- ✅ **FAQ for Admins**

---

## 🚀 Implementation Plan

### Phase 1: Critical Features (Do First)
1. Tutorial Video Management UI
2. Video Category Management
3. Basic User List & Search
4. Community Post Moderation
5. Simple Analytics Dashboard

**Estimated:** ~8-12 hours of work

### Phase 2: Important Features
6. User Details & Role Management
7. Detailed Analytics & Reports
8. System Settings Page
9. Export functionality

**Estimated:** ~6-8 hours of work

### Phase 3: Nice to Have
10. Notification System
11. Coach Management
12. Advanced Filters & Bulk Actions

**Estimated:** ~4-6 hours of work

---

## ✅ Success Criteria

Client can independently:
- ✅ Add/edit/delete tutorial videos
- ✅ Organize videos into categories
- ✅ Moderate community posts/comments
- ✅ View and manage users
- ✅ See platform analytics
- ✅ Change basic settings
- ✅ Export data when needed

**No developer required for daily operations!**

---

## 🎯 Next Steps

1. Review this document
2. Confirm priorities
3. Begin implementation with Phase 1
4. Test each feature thoroughly
5. Create client documentation
6. Handoff training session

---

## 📋 Checklist for Handoff

- [ ] All Phase 1 features implemented
- [ ] All Phase 2 features implemented (optional)
- [ ] Admin User Guide written
- [ ] Quick Start Guide created
- [ ] All features tested
- [ ] Demo video recorded (optional)
- [ ] Training session scheduled
- [ ] Support contact provided

---

**Ready to build?** Let's start with Phase 1! 🚀
