# Resend Email Setup Guide for MindShifting

This guide walks you through configuring Resend as your email provider for Supabase authentication emails (confirmation, password reset, etc.).

---

## ✅ Completed Steps

- [x] Created Resend account
- [x] Generated API key
- [x] Added `RESEND_API_KEY` to Vercel environment variables
- [x] Redeployed to Vercel

---

## 🔧 Remaining Steps

### Step 1: Configure SMTP in Supabase Dashboard

1. Go to your **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Project Settings** (gear icon in sidebar)
4. Click **Authentication** in the left menu
5. Scroll down to **SMTP Settings**
6. Toggle **Enable Custom SMTP** to ON
7. Enter the following settings:

| Setting | Value |
|---------|-------|
| **Sender email** | `noreply@mindshifting.net` (or use `onboarding@resend.dev` for testing) |
| **Sender name** | `MindShifting` |
| **Host** | `smtp.resend.com` |
| **Port** | `465` |
| **Minimum interval** | `60` (seconds between emails to same address) |
| **Username** | `resend` |
| **Password** | Your Resend API key (starts with `re_`) |

8. Click **Save**

---

### Step 2: Verify Your Domain in Resend (Recommended for Production)

For better deliverability and to use your own domain in the "from" address:

1. Go to **Resend Dashboard**: https://resend.com/domains
2. Click **Add Domain**
3. Enter: `mindshifting.net`
4. Add the DNS records Resend provides to your domain registrar:
   - Usually 3 records: SPF, DKIM, and DMARC
5. Wait for verification (can take up to 48 hours, usually faster)
6. Once verified, update the **Sender email** in Supabase to `noreply@mindshifting.net`

**Note:** You can use `onboarding@resend.dev` as the sender email for testing before domain verification.

---

### Step 3: Test the Email Flow

1. Go to Supabase → **Authentication** → **Users**
2. Find an unconfirmed user
3. Click the `...` menu → **Resend confirmation email**
4. Check that the email arrives (check spam folder too)

Or test with a new signup:
1. Go to your app's `/auth` page
2. Sign up with a new email address
3. Check for the confirmation email

---

### Step 4: Update Email Templates (Optional)

Customize your email templates in Supabase:

1. Go to **Authentication** → **Email Templates**
2. Edit templates for:
   - **Confirm signup** - Email verification
   - **Invite user** - Team invitations
   - **Magic Link** - Passwordless login
   - **Change Email Address** - Email change confirmation
   - **Reset Password** - Password recovery

**Important:** Make sure all links in templates point to your production URL:
```
https://site-maker-lilac.vercel.app
```

Not `localhost:3000`.

---

## 📋 Supabase URL Configuration Checklist

While you're in Supabase settings, verify these are correct:

### Site URL
Go to **Authentication** → **URL Configuration**:

```
Site URL: https://site-maker-lilac.vercel.app
```

### Redirect URLs
Add all of these:
```
https://site-maker-lilac.vercel.app
https://site-maker-lilac.vercel.app/auth/callback
https://site-maker-lilac.vercel.app/auth/confirm
```

---

## 🚨 Troubleshooting

### "Email address is invalid" Error
- Make sure Custom SMTP is enabled in Supabase
- Verify the Resend API key is correct
- Check that the sender email domain is verified in Resend

### Emails Not Arriving
1. Check spam/junk folder
2. Verify SMTP settings are saved correctly
3. Check Resend dashboard for failed deliveries: https://resend.com/emails
4. Check Supabase Auth logs: Dashboard → Logs → Auth

### "Rate limit exceeded" Error
- Resend free tier: 100 emails/day, 3,000/month
- Supabase default: ~4 emails/hour
- With custom SMTP, Supabase rate limits don't apply (Resend limits do)

### Domain Not Verified
- DNS propagation can take up to 48 hours
- Use `onboarding@resend.dev` as sender while waiting
- Double-check DNS records match exactly what Resend shows

---

## 📊 Resend Free Tier Limits

| Limit | Amount |
|-------|--------|
| Emails per day | 100 |
| Emails per month | 3,000 |
| Domains | 1 |
| API keys | Unlimited |

For higher limits, see [Resend Pricing](https://resend.com/pricing).

---

## 🔗 Useful Links

- [Resend Dashboard](https://resend.com)
- [Resend Documentation](https://resend.com/docs)
- [Supabase Auth Settings](https://supabase.com/dashboard/project/_/settings/auth)
- [Supabase SMTP Guide](https://supabase.com/docs/guides/auth/auth-smtp)

---

## ✅ Final Verification

After completing all steps, verify:

1. [ ] Custom SMTP enabled in Supabase with Resend credentials
2. [ ] Test email sent successfully from Supabase dashboard
3. [ ] New user signup receives confirmation email
4. [ ] Email links point to production URL (not localhost)
5. [ ] Password reset flow works
6. [ ] (Optional) Domain verified in Resend for branded emails

---

## 🎉 Done!

Once configured, your authentication emails will be sent through Resend with much better deliverability than Supabase's default email service.

Users who previously couldn't confirm their email can now:
1. Be resent confirmation emails from Supabase dashboard
2. Or sign up again with the same email (if you deleted their unconfirmed account)

