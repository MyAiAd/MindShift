# Supabase Email Template Configuration Fix

## ❌ Current Issue
Email templates are pointing to `localhost` instead of your production URL `https://site-maker-lilac.vercel.app/`

## 🔧 Fix Email Template URLs in Supabase

### Step 1: Access Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/jhuyequddikkolqxkdpn
2. Click **Authentication** in the left sidebar
3. Click **Settings**

### Step 2: Update Site URL
1. Scroll to **Site URL** section
2. Change from: `http://localhost:3000`
3. Change to: `https://site-maker-lilac.vercel.app`
4. Click **Save**

### Step 3: Update Redirect URLs
1. Find **Redirect URLs** section
2. Remove: `http://localhost:3000`
3. Add: `https://site-maker-lilac.vercel.app`
4. Add: `https://site-maker-lilac.vercel.app/auth/callback` (if needed)
5. Click **Save**

### Step 4: Update Email Templates

#### Email Confirmation Template
1. Scroll to **Email Templates** section
2. Click on **Confirm signup** template
3. Look for any `localhost` references in the template
4. Replace with: `https://site-maker-lilac.vercel.app`

**Example template changes:**
```html
<!-- OLD -->
<a href="http://localhost:3000/auth/confirm?token={{ .Token }}">Confirm your email</a>

<!-- NEW -->
<a href="https://site-maker-lilac.vercel.app/auth/confirm?token={{ .Token }}">Confirm your email</a>
```

#### Password Reset Template
1. Click on **Reset password** template
2. Replace any `localhost` references
3. Update to: `https://site-maker-lilac.vercel.app`

**Example template changes:**
```html
<!-- OLD -->
<a href="http://localhost:3000/auth/reset-password?token={{ .Token }}">Reset your password</a>

<!-- NEW -->
<a href="https://site-maker-lilac.vercel.app/auth/reset-password?token={{ .Token }}">Reset your password</a>
```

#### Email Change Template
1. Click on **Confirm email change** template
2. Replace any `localhost` references
3. Update to: `https://site-maker-lilac.vercel.app`

### Step 5: Test Email Templates
1. After saving all changes
2. Send a test email (try registering a new user)
3. Check that email links point to `https://site-maker-lilac.vercel.app`
4. Verify links work correctly

## 🎯 Expected Results

After configuration:
- ✅ **Email confirmation links** point to `https://site-maker-lilac.vercel.app`
- ✅ **Password reset links** point to production site
- ✅ **Users are redirected** to correct domain after email actions
- ✅ **No more localhost** references in emails

## 📋 Production URL Configuration

### Your Production Settings
- **Site URL**: `https://site-maker-lilac.vercel.app`
- **Domain**: `site-maker-lilac.vercel.app`
- **Email Sender**: `NoReply@msgs.myai.ad`
- **Resend API**: Already configured ✅

### Redirect URLs to Add
```
https://site-maker-lilac.vercel.app
https://site-maker-lilac.vercel.app/auth/callback
https://site-maker-lilac.vercel.app/auth/confirm
https://site-maker-lilac.vercel.app/auth/reset-password
```

## 🔍 Verification Steps

1. **Register a new user** with a real email
2. **Check the confirmation email** 
3. **Verify all links** point to `https://site-maker-lilac.vercel.app`
4. **Click the confirmation link** to ensure it works
5. **Test password reset** functionality

## ⚠️ Important Notes

1. **Authentication Flow**: Make sure your app has proper auth callback handlers at:
   - `/auth/callback`
   - `/auth/confirm` 
   - `/auth/reset-password`

2. **Local Development**: You may want to keep localhost for local development in a separate environment

3. **Email Testing**: Always test with real email addresses to ensure templates work correctly

## 🚀 Next Steps

1. **Update Site URL** in Supabase dashboard
2. **Update Redirect URLs** 
3. **Update Email Templates** to use production URL
4. **Test email flow** end-to-end
5. **Verify all links** work in production

## 🔄 Current Status

- ✅ **Database**: Configured and working
- ✅ **Email SMTP**: Configured with Resend
- ⏳ **Email Templates**: Need to update URLs
- ⏳ **Testing**: Required after URL update

Once you update the email templates, your production email system will be fully operational with the correct URLs pointing to https://site-maker-lilac.vercel.app/! 