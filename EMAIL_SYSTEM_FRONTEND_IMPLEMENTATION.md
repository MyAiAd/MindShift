# Email System Frontend Implementation Guide

**Date Created:** January 5, 2026  
**Status:** In Progress  
**Priority:** High

---

## 📋 Overview

This document outlines the complete frontend implementation needed to fully enable and verify the email system for MindShifting. The backend email system is already complete using Resend.

### Design Requirements
- **Mobile-First**: All components optimized for mobile (PWA)
- **Theme Compliant**: Use CSS variables only (bg-primary, text-foreground, etc.)
- **Accessible**: WCAG compliant, proper touch targets (min 44x44px)
- **Consistent**: Follow existing shadcn/ui component patterns

---

## ✅ Already Complete (Backend)

| Component | File | Status |
|-----------|------|--------|
| Email Service | `services/email/email.service.ts` | ✅ Complete |
| Coach Invitations API | `app/api/coaches/invitations/route.ts` | ✅ Complete |
| Coach Invitation Acceptance | `app/api/auth/coach-invitation/route.ts` | ✅ Complete |
| Tenant Welcome Emails | `app/api/tenants/route.ts` | ✅ Complete |
| Email Notification API | `app/api/notifications/email/route.ts` | ✅ Complete |
| Notification Preferences | `app/dashboard/settings/page.tsx` | ✅ Complete |

---

## 🔧 Implementation Tasks

### Phase 1: Test Email API & UI

#### 1.1 Create Test Email API Route
**File:** `app/api/notifications/email/test/route.ts`

**Purpose:** Allow admins to test email delivery to verify Resend configuration

**Features:**
- POST: Send test email to current user's email
- Requires admin authentication
- Returns detailed success/failure information
- Rate limited (1 test email per minute)

**Response includes:**
- Email delivery status
- Resend message ID
- Error details if failed

---

#### 1.2 Add Test Email Section to Admin Settings
**File:** `app/dashboard/admin/settings/page.tsx` (modify existing)

**Add new tab: "Email"**

**Features:**
- Display email configuration status
- "Send Test Email" button
- Loading state during send
- Success/error toast feedback
- Mobile-responsive layout

**UI Components to use:**
- `Card`, `CardHeader`, `CardContent` for container
- `Button` for actions
- `useToast` for feedback
- Status indicators using theme colors

---

### Phase 2: Coach Invitations Admin Page

#### 2.1 Create Coach Management Page
**File:** `app/dashboard/admin/coaches/page.tsx`

**Purpose:** Full admin interface for managing coach invitations

**Sections:**

**A. Invite Coach Form**
- Email input (required)
- First name input (optional)
- Last name input (optional)
- Tenant selector (super admin only)
- Submit button with loading state
- Toast feedback showing email delivery status

**B. Pending Invitations List**
- Table/card list of pending invitations
- Shows: Email, Name, Invited By, Sent Date, Expires Date
- Actions: Resend invitation, Revoke invitation
- Empty state when no invitations

**C. Accepted Invitations History**
- Shows coaches who accepted invitations
- Shows: Name, Email, Accepted Date
- Link to view coach profile

**Mobile Layout:**
- Stacked cards instead of tables
- Full-width forms
- Bottom-sheet style for actions
- Swipe gestures for quick actions (optional)

---

#### 2.2 Create Coach Invitation Card Component
**File:** `components/admin/CoachInvitationCard.tsx`

**Purpose:** Reusable card for displaying invitation info (mobile-optimized)

**Props:**
```typescript
interface CoachInvitationCardProps {
  invitation: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    status: 'pending' | 'accepted' | 'expired' | 'revoked';
    created_at: string;
    expires_at: string;
    accepted_at?: string;
    invited_by: {
      first_name?: string;
      last_name?: string;
      email: string;
    };
  };
  onResend?: () => void;
  onRevoke?: () => void;
  loading?: boolean;
}
```

**Styling:**
- Use `bg-card`, `border-border`, `text-foreground`
- Status badge with theme-appropriate colors
- Touch-friendly action buttons

---

### Phase 3: Enhanced Email Status Feedback

#### 3.1 Email Status Component
**File:** `components/admin/EmailStatus.tsx`

**Purpose:** Reusable component showing email system status

**Features:**
- Shows if Resend is configured
- Shows recent email activity (optional)
- Visual indicator (green/yellow/red)
- Links to Resend dashboard

**Usage:**
- Admin dashboard header
- Admin settings email tab
- Coach invitations page

---

#### 3.2 Add Email Delivery Feedback to Forms
**When sending coach invitations:**
- Show inline feedback "Invitation email sent successfully" or "Invitation created but email failed"
- If email fails, show retry button
- Store email status in invitation record

---

### Phase 4: Navigation Updates

#### 4.1 Add Coaches Link to Admin Navigation
**File:** `components/layout/AdminSidebar.tsx` (or equivalent)

**Add menu item:**
- Icon: `Users` or `UserPlus`
- Label: "Coaches"
- Path: `/dashboard/admin/coaches`
- Show count badge for pending invitations

---

## 📱 Mobile-First Guidelines

### Touch Targets
- All interactive elements: minimum 44x44px
- Adequate spacing between touch targets
- Use `min-h-[44px]` and `min-w-[44px]` for buttons

### Responsive Patterns
```css
/* Mobile first, then enhance */
grid-cols-1 md:grid-cols-2 lg:grid-cols-3
w-full md:w-auto
px-4 md:px-6
text-base md:text-sm
```

### Form Inputs
- Full width on mobile
- Larger text size for readability
- Clear labels above inputs
- Adequate spacing between fields

### Tables → Cards
- Use card layout on mobile instead of tables
- Stack information vertically
- Key info at top, actions at bottom

---

## 🎨 Theme Compliance

### DO Use:
```css
/* Backgrounds */
bg-background, bg-card, bg-secondary, bg-primary, bg-accent
bg-muted, bg-destructive

/* Text */
text-foreground, text-muted-foreground, text-primary-foreground
text-secondary-foreground, text-destructive

/* Borders */
border-border, border-input, border-ring

/* Status Colors (with opacity for backgrounds) */
bg-green-500/10, text-green-600, dark:text-green-400
bg-red-500/10, text-red-600, dark:text-red-400
bg-yellow-500/10, text-yellow-600, dark:text-yellow-400
```

### DON'T Use:
```css
/* Hardcoded colors */
bg-white, bg-black, bg-gray-100
text-gray-700, border-gray-200

/* Default HTML styling */
No unstyled <select>, <input>, <button>
```

### Components to Use:
- `Button` from `@/components/ui/button`
- `Input` from `@/components/ui/input`
- `Card` from `@/components/ui/card`
- `Label` from `@/components/ui/label`
- `Switch` from `@/components/ui/switch`
- `Select` from `@/components/ui/select`
- `Table` from `@/components/ui/table`
- `Badge` from `@/components/ui/badge`
- `Tabs` from `@/components/ui/tabs`
- `Dialog` from `@/components/ui/dialog`
- `AlertDialog` from `@/components/ui/alert-dialog`

---

## 🔒 Security Considerations

### Authentication
- All admin routes check for `tenant_admin` or `super_admin` role
- Redirect unauthorized users to dashboard

### Rate Limiting
- Test email: 1 per minute per user
- Coach invitation: 10 per hour per tenant

### Input Validation
- Email format validation (frontend + backend)
- Sanitize all user inputs
- CSRF protection via Next.js

---

## 📝 Implementation Checklist

### Phase 1: Test Email ✅
- [x] Create `app/api/notifications/email/test/route.ts` - **DONE**
- [x] Add Email tab to `app/dashboard/admin/settings/page.tsx` - **DONE**
- [x] Add "Send Test Email" button with feedback - **DONE**
- [ ] Test on mobile and desktop

### Phase 2: Coach Invitations ✅
- [x] Create `app/dashboard/admin/coaches/page.tsx` - **DONE**
- [x] Create `components/admin/CoachInvitationCard.tsx` - **DONE**
- [x] Implement invite form with validation - **DONE**
- [x] Implement pending invitations list - **DONE**
- [x] Implement accepted coaches list - **DONE**
- [x] Add revoke/resend functionality - **DONE**
- [ ] Test on mobile and desktop

### Phase 3: Status & Feedback ✅
- [x] Email status integrated into Admin Settings Email tab - **DONE**
- [x] Enhance invitation feedback with email status - **DONE**
- [ ] Create `components/admin/EmailStatus.tsx` (optional, not needed - integrated into settings)

### Phase 4: Navigation ✅
- [x] Add Coaches link to admin sidebar/menu - **DONE**
- [ ] Verify mobile navigation works

### Phase 5: Testing & Verification
- [ ] Test email delivery in development
- [ ] Test email delivery in production
- [ ] Verify all mobile layouts
- [ ] Test with all theme variants
- [ ] Document any issues found

---

## 🚀 Deployment Notes

### Environment Variables Required
- `RESEND_API_KEY` - Already configured in Vercel

### Post-Deployment Verification
1. Log in as super admin
2. Go to Admin Settings → Email
3. Click "Send Test Email"
4. Verify email received
5. Go to Admin → Coaches
6. Send test coach invitation
7. Verify invitation email received

---

## 📚 Related Documentation
- `RESEND_INTEGRATION_GUIDE.md` - Backend email setup
- `RESEND_SETUP.md` - Initial Resend configuration
- `TEST_RESEND_SETUP.md` - Testing procedures

---

## 🔄 Version History

| Date | Changes | Author |
|------|---------|--------|
| 2026-01-05 | Initial document creation | AI Assistant |
| 2026-01-05 | Phase 1-4 implementation complete | AI Assistant |

---

## 📁 Files Created/Modified

### New Files
| File | Purpose |
|------|---------|
| `app/api/notifications/email/test/route.ts` | Test email API with rate limiting |
| `app/dashboard/admin/coaches/page.tsx` | Coach management admin page |
| `components/admin/CoachInvitationCard.tsx` | Reusable invitation card component |

### Modified Files
| File | Changes |
|------|---------|
| `app/dashboard/admin/settings/page.tsx` | Added Email tab with status & test button |
| `app/dashboard/layout.tsx` | Added Coaches link to admin navigation |

