# Email Configuration Fix Guide

## ❌ Current Issue
Users are getting a `500 Internal Server Error` when trying to register because the Supabase project doesn't have proper email configuration for sending confirmation emails.

## 🔧 Immediate Fix (Temporary)

**To allow users to register immediately**, disable email confirmations temporarily:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **siteMaker** (`jhuyequddikkolqxkdpn`)
3. Navigate to **Authentication** > **Settings**
4. Scroll down to **Email confirmations**
5. **Disable** the toggle for "Enable email confirmations"
6. Click **Save**

**This will allow users to register without email verification while you set up proper email configuration.**

## 📧 Permanent Fix: Configure Email Service

### Option 1: Using Resend (Recommended)

1. **Sign up for Resend**:
   - Go to [resend.com](https://resend.com)
   - Create an account
   - Verify your domain or use their testing domain

2. **Get API Key**:
   - Go to Resend dashboard
   - Navigate to **API Keys**
   - Create a new API key
   - Copy the API key (starts with `re_`)

3. **Configure in Supabase**:
   - Go to Supabase Dashboard > **Authentication** > **Settings**
   - Scroll to **SMTP Settings**
   - Configure:
     - **SMTP Host**: `smtp.resend.com`
     - **SMTP Port**: `465`
     - **SMTP User**: `resend`
     - **SMTP Pass**: Your Resend API key
     - **Sender Name**: `MyAi`
     - **Sender Email**: `noreply@yourdomain.com` (or Resend's testing email)

### Option 2: Using SendGrid

1. **Sign up for SendGrid**:
   - Go to [sendgrid.com](https://sendgrid.com)
   - Create account and verify email

2. **Get API Key**:
   - Go to Settings > API Keys
   - Create API key with Mail Send permissions
   - Copy the API key

3. **Configure in Supabase**:
   - Go to Supabase Dashboard > **Authentication** > **Settings**
   - Configure SMTP:
     - **SMTP Host**: `smtp.sendgrid.net`
     - **SMTP Port**: `587`
     - **SMTP User**: `apikey`
     - **SMTP Pass**: Your SendGrid API key
     - **Sender Name**: `MyAi`
     - **Sender Email**: Your verified sender email

## 📋 Step-by-Step Configuration

### 1. Access Supabase Dashboard
```
https://supabase.com/dashboard/project/jhuyequddikkolqxkdpn
```

### 2. Navigate to Authentication Settings
- Click **Authentication** in the left sidebar
- Click **Settings**
- Scroll to **SMTP Settings**

### 3. Configure SMTP (Example with Resend)
```
SMTP Host: smtp.resend.com
SMTP Port: 465
SMTP User: resend
SMTP Pass: [Your Resend API Key]
Sender Name: MyAi
Sender Email: noreply@yourdomain.com
```

### 4. Test Email Configuration
- Save the settings
- Go to **Authentication** > **Users**
- Try to send a test email or create a test user
- Check if emails are being sent successfully

### 5. Re-enable Email Confirmations
Once email is working:
- Go to **Authentication** > **Settings**
- **Enable** "Enable email confirmations"
- **Enable** "Enable email change confirmations" (optional)
- Click **Save**

## 🔍 Testing

After configuration:

1. **Test Registration**:
   - Try registering a new user
   - Check if confirmation email is received
   - Verify the email works

2. **Test Password Reset**:
   - Try "Forgot Password" functionality
   - Ensure reset emails are sent

3. **Monitor Logs**:
   - Check Supabase logs for any email-related errors
   - Monitor your email service dashboard for delivery stats

## 📝 Environment Variables

If you're using local development, create a `.env` file:

```bash
# For Resend
RESEND_API_KEY=your_resend_api_key_here
ADMIN_EMAIL=noreply@yourdomain.com
SENDER_NAME=MyAi

# For SendGrid
SENDGRID_API_KEY=your_sendgrid_api_key_here
ADMIN_EMAIL=noreply@yourdomain.com
SENDER_NAME=MyAi
```

## ⚠️ Important Notes

1. **Domain Verification**: Some email services require domain verification for production use
2. **Rate Limits**: Check your email service's rate limits
3. **Spam Filters**: Test that emails don't go to spam
4. **Email Templates**: Customize email templates in Supabase dashboard if needed

## 🚀 Production Checklist

- [ ] Email service configured (Resend/SendGrid)
- [ ] SMTP settings configured in Supabase
- [ ] Test emails working
- [ ] Domain verified (if required)
- [ ] Email confirmations enabled
- [ ] Email templates customized
- [ ] Rate limits checked
- [ ] Spam testing completed

## 🔄 Current Status

- ✅ Migration applied to document the issue
- ⏳ **Action Required**: Configure email service in Supabase dashboard
- ⏳ **Action Required**: Re-enable email confirmations after configuration

Once you complete the email configuration, users will be able to register normally with email verification! 