# Resend Email Integration Guide for MindShifting

**A comprehensive guide for developers on integrating Resend for all email functionality.**

---

## 📋 Table of Contents

1. [Current State](#current-state)
2. [Infrastructure Setup (Completed)](#infrastructure-setup-completed)
3. [Supabase SMTP Configuration (Required)](#supabase-smtp-configuration-required)
4. [Installing Resend SDK (Optional)](#installing-resend-sdk-optional)
5. [Creating Email Service](#creating-email-service)
6. [Email Templates](#email-templates)
7. [Integration Points](#integration-points)
8. [Testing](#testing)
9. [Production Checklist](#production-checklist)

---

## Current State

### What Exists Now

| Component | Current State |
|-----------|---------------|
| **Auth Emails** | Handled by Supabase (confirmation, password reset, magic links) |
| **Coach Invitations** | Database records created, but NO email sent |
| **Notifications** | Push notifications only, no email sending |
| **Direct Email Sending** | Not implemented - no email service in codebase |

### Email-Related Files

```
services/
  └── notification/
      └── notification.service.ts  # Push only, no email

app/api/
  └── coaches/invitations/route.ts  # Creates DB record, no email sent
  └── auth/coach-invitation/route.ts  # Handles invitation acceptance
```

---

## Infrastructure Setup (Completed)

### ✅ Already Done

- [x] Resend account created
- [x] API key generated
- [x] `RESEND_API_KEY` added to Vercel environment variables
- [x] Domain `mindshifting.myai.ad` verified in Resend
- [x] Vercel redeployed with new environment variable

### Environment Variables

**Vercel (Production):**
```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Local Development (.env.local):**
```bash
# Add to your .env.local file
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Supabase SMTP Configuration (Required)

**This is the critical step to make Supabase auth emails work with Resend.**

### Step-by-Step Configuration

1. **Go to Supabase Dashboard**
   - URL: https://supabase.com/dashboard
   - Select your project

2. **Navigate to Authentication Settings**
   - Click **Project Settings** (gear icon)
   - Click **Authentication** in left menu
   - Scroll to **SMTP Settings**

3. **Enable Custom SMTP**
   - Toggle **"Enable Custom SMTP"** to ON

4. **Enter Resend SMTP Settings**

   | Setting | Value |
   |---------|-------|
   | **Sender email** | `noreply@mindshifting.myai.ad` |
   | **Sender name** | `MindShifting` |
   | **Host** | `smtp.resend.com` |
   | **Port number** | `465` |
   | **Minimum interval between emails** | `60` |
   | **Username** | `resend` |
   | **Password** | Your `RESEND_API_KEY` (starts with `re_`) |

5. **Click Save**

6. **Verify Site URL Configuration**
   - Go to **Authentication** → **URL Configuration**
   - Set **Site URL**: `https://site-maker-lilac.vercel.app`
   - Add **Redirect URLs**:
     ```
     https://site-maker-lilac.vercel.app
     https://site-maker-lilac.vercel.app/auth/callback
     https://site-maker-lilac.vercel.app/auth/confirm
     ```

7. **Re-enable Email Confirmations** (if disabled)
   - Go to **Authentication** → **Settings**
   - Enable **"Confirm email"** toggle

---

## Installing Resend SDK (Optional)

**Only needed if you want to send emails directly from the application** (e.g., coach invitations, custom notifications).

### Step 1: Install Package

```bash
npm install resend
```

### Step 2: Add Type Definitions

The package includes TypeScript types, no additional installation needed.

### Step 3: Update package.json

After installation, your `package.json` will include:
```json
{
  "dependencies": {
    "resend": "^4.0.0"
  }
}
```

---

## Creating Email Service

**Create a new email service for sending emails from the application.**

### File: `services/email/email.service.ts`

```typescript
import { Resend } from 'resend';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Configuration
const EMAIL_CONFIG = {
  from: 'MindShifting <noreply@mindshifting.myai.ad>',
  replyTo: 'support@mindshifting.myai.ad', // Optional
};

// Types
export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Email Service Class
export class EmailService {
  private static instance: EmailService;

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Send a generic email
   */
  async send(options: SendEmailOptions): Promise<EmailResult> {
    try {
      const { data, error } = await resend.emails.send({
        from: EMAIL_CONFIG.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo || EMAIL_CONFIG.replyTo,
      });

      if (error) {
        console.error('Email send error:', error);
        return { success: false, error: error.message };
      }

      return { success: true, messageId: data?.id };
    } catch (error) {
      console.error('Email service error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Send coach invitation email
   */
  async sendCoachInvitation(options: {
    email: string;
    firstName?: string;
    inviterName: string;
    organizationName: string;
    invitationToken: string;
  }): Promise<EmailResult> {
    const signupUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://site-maker-lilac.vercel.app'}/auth/coach-signup?token=${options.invitationToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Coach Invitation</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a1a;">You're Invited to Join MindShifting!</h1>
          
          <p>Hi${options.firstName ? ` ${options.firstName}` : ''},</p>
          
          <p><strong>${options.inviterName}</strong> has invited you to join <strong>${options.organizationName}</strong> as a coach on MindShifting.</p>
          
          <p>Click the button below to create your account and get started:</p>
          
          <a href="${signupUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            Accept Invitation
          </a>
          
          <p style="color: #666; font-size: 14px;">
            This invitation will expire in 7 days.
          </p>
          
          <p style="color: #666; font-size: 14px;">
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px;">
            MindShifting - Transform Your Mindset
          </p>
        </body>
      </html>
    `;

    return this.send({
      to: options.email,
      subject: `${options.inviterName} invited you to join ${options.organizationName} on MindShifting`,
      html,
    });
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(options: {
    email: string;
    firstName?: string;
  }): Promise<EmailResult> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to MindShifting</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a1a;">Welcome to MindShifting!</h1>
          
          <p>Hi${options.firstName ? ` ${options.firstName}` : ''},</p>
          
          <p>Thank you for joining MindShifting! We're excited to have you on board.</p>
          
          <p>Here's what you can do next:</p>
          
          <ul>
            <li>Start your first treatment session</li>
            <li>Set up your goals</li>
            <li>Join the community</li>
          </ul>
          
          <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://site-maker-lilac.vercel.app'}/dashboard" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            Go to Dashboard
          </a>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px;">
            MindShifting - Transform Your Mindset
          </p>
        </body>
      </html>
    `;

    return this.send({
      to: options.email,
      subject: 'Welcome to MindShifting!',
      html,
    });
  }

  /**
   * Send notification email (for users who prefer email notifications)
   */
  async sendNotificationEmail(options: {
    email: string;
    subject: string;
    title: string;
    message: string;
    actionUrl?: string;
    actionText?: string;
  }): Promise<EmailResult> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${options.title}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">${options.title}</h2>
          
          <p>${options.message}</p>
          
          ${options.actionUrl && options.actionText ? `
            <a href="${options.actionUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              ${options.actionText}
            </a>
          ` : ''}
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px;">
            MindShifting - Transform Your Mindset<br>
            <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings" style="color: #999;">Manage notification preferences</a>
          </p>
        </body>
      </html>
    `;

    return this.send({
      to: options.email,
      subject: options.subject,
      html,
    });
  }
}

// Export singleton instance
export const emailService = EmailService.getInstance();
```

---

## Integration Points

### 1. Coach Invitations

**Update `app/api/coaches/invitations/route.ts` to send emails:**

```typescript
// Add at the top of the file
import { emailService } from '@/services/email/email.service';

// In the POST handler, after creating the invitation:
// ... existing code to create invitation ...

if (result && result.success) {
  // Send invitation email
  const emailResult = await emailService.sendCoachInvitation({
    email: email.trim().toLowerCase(),
    firstName: firstName?.trim(),
    inviterName: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'A team member',
    organizationName: 'MindShifting', // Or fetch from tenant
    invitationToken: result.invitation.token,
  });

  if (!emailResult.success) {
    console.error('Failed to send invitation email:', emailResult.error);
    // Note: Don't fail the request - invitation is created, email failed
  }
}

return NextResponse.json({ 
  invitation: result,
  message: 'Coach invitation sent successfully'
});
```

### 2. Email Notifications API

**Create `app/api/notifications/email/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import { emailService } from '@/services/email/email.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { recipientId, subject, title, message, actionUrl, actionText } = body;

    // Get recipient's email and preferences
    const { data: recipient } = await supabase
      .from('profiles')
      .select('email, settings')
      .eq('id', recipientId)
      .single();

    if (!recipient?.email) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
    }

    // Check if user has email notifications enabled
    const settings = recipient.settings || {};
    if (settings.email_notifications_enabled === false) {
      return NextResponse.json({ 
        success: true, 
        skipped: true,
        reason: 'Email notifications disabled for user' 
      });
    }

    const result = await emailService.sendNotificationEmail({
      email: recipient.email,
      subject,
      title,
      message,
      actionUrl,
      actionText,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Email notification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### 3. Welcome Emails (Optional)

**Add to auth provider or signup flow:**

```typescript
// After successful signup and profile creation
import { emailService } from '@/services/email/email.service';

await emailService.sendWelcomeEmail({
  email: user.email,
  firstName: profile.first_name,
});
```

---

## Email Templates

### Customizing Supabase Auth Templates

1. Go to **Supabase Dashboard** → **Authentication** → **Email Templates**
2. Edit each template to use your branding
3. **Important**: Update all URLs to production domain

**Templates to customize:**
- Confirm signup
- Invite user  
- Magic Link
- Change Email Address
- Reset Password

**Example Confirm Signup Template:**

```html
<h2>Confirm your signup</h2>

<p>Hi there,</p>

<p>Thank you for signing up for MindShifting! Click the button below to confirm your email address:</p>

<p>
  <a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
    Confirm Email
  </a>
</p>

<p>This link will expire in 24 hours.</p>

<p>If you didn't sign up for MindShifting, you can safely ignore this email.</p>

<p style="color: #666; font-size: 12px; margin-top: 30px;">
  MindShifting - Transform Your Mindset
</p>
```

---

## Testing

### Test Supabase SMTP Configuration

1. Go to Supabase → **Authentication** → **Users**
2. Find an unconfirmed user
3. Click `...` → **Resend confirmation email**
4. Verify email arrives

### Test Application Email Sending

```typescript
// Create a test API route: app/api/test-email/route.ts
import { NextResponse } from 'next/server';
import { emailService } from '@/services/email/email.service';

export async function GET() {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
  }

  const result = await emailService.send({
    to: 'your-test-email@example.com',
    subject: 'Test Email from MindShifting',
    html: '<h1>Test Email</h1><p>This is a test email from your MindShifting application.</p>',
  });

  return NextResponse.json(result);
}
```

### Monitor Emails

- **Resend Dashboard**: https://resend.com/emails
- View sent emails, delivery status, bounces, and errors

---

## Production Checklist

### Before Going Live

- [ ] `RESEND_API_KEY` set in Vercel environment variables
- [ ] Domain `mindshifting.myai.ad` verified in Resend
- [ ] Supabase SMTP configured with Resend credentials
- [ ] Site URL set correctly in Supabase
- [ ] Redirect URLs configured in Supabase
- [ ] Email confirmation enabled in Supabase
- [ ] Email templates customized with branding
- [ ] Test email sent and received successfully

### Optional Enhancements

- [ ] Install Resend SDK (`npm install resend`)
- [ ] Create `services/email/email.service.ts`
- [ ] Update coach invitations to send emails
- [ ] Add email notifications for users who prefer email
- [ ] Add welcome email for new signups

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "Invalid API key" | Verify RESEND_API_KEY is correct and starts with `re_` |
| "Domain not verified" | Check Resend dashboard, ensure DNS records are added |
| "Email not delivered" | Check spam folder, verify domain SPF/DKIM records |
| "Rate limit exceeded" | Resend free tier: 100/day, 3000/month |
| "Supabase emails not sending" | Verify Custom SMTP is enabled and saved |

### Resend Rate Limits (Free Tier)

| Limit | Amount |
|-------|--------|
| Per day | 100 emails |
| Per month | 3,000 emails |
| Domains | 1 |

For higher limits: https://resend.com/pricing

---

## Summary

### Minimum Required (Auth Emails Only)

1. Configure Supabase SMTP with Resend credentials ← **Do this now**
2. Test by resending confirmation email

### Full Integration (Application Emails)

1. Install Resend SDK: `npm install resend`
2. Create email service: `services/email/email.service.ts`
3. Update coach invitations to send emails
4. Add email notifications where needed

---

## Useful Links

- [Resend Dashboard](https://resend.com)
- [Resend API Documentation](https://resend.com/docs)
- [Supabase Auth Settings](https://supabase.com/dashboard/project/_/settings/auth)
- [Supabase SMTP Guide](https://supabase.com/docs/guides/auth/auth-smtp)

