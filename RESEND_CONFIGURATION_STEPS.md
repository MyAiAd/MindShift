# Resend Email Configuration - Step by Step

## ✅ Your Configuration Details
- **Resend API Key**: `re_[YOUR_API_KEY]` (✅ Use your actual key)
- **Verified Domain**: `msgs.myai.ad` (✅ Verified in Resend)
- **Sender Email**: `NoReply@msgs.myai.ad` (✅ Correct - matches verified domain)
- **Sender Name**: `MyAi`

## 🔧 Configure in Supabase Dashboard

### Step 1: Access Supabase Settings
1. Go to: https://supabase.com/dashboard/project/jhuyequddikkolqxkdpn
2. Click **Authentication** in the left sidebar
3. Click **Settings**
4. Scroll down to **SMTP Settings**

### Step 2: Configure SMTP Settings
Enter exactly these values:

```
SMTP Host: smtp.resend.com
SMTP Port: 465
SMTP User: resend
SMTP Pass: [Your Resend API Key]
Sender Name: MyAi
Sender Email: NoReply@msgs.myai.ad
```

**⚠️ Important**: Use your actual Resend API key in the SMTP Pass field.

### Step 3: Save and Test
1. Click **Save** at the bottom
2. Wait for the settings to be applied
3. The configuration should now be active

## 📧 Test Email Configuration

### Method 1: Test User Registration
1. Try registering a new user with a real email address
2. Check if the confirmation email arrives
3. Verify that the email comes from `NoReply@msgs.myai.ad`

### Method 2: Password Reset Test
1. Go to your login page
2. Click "Forgot Password"
3. Enter an email address
4. Check if the reset email is sent

## 🔄 Re-enable Email Confirmations

Once emails are working:
1. Go to **Authentication** > **Settings**
2. Find **Email confirmations** section
3. **Enable** the toggle for "Enable email confirmations"
4. **Enable** "Enable email change confirmations" (optional)
5. Click **Save**

## 📝 Environment Variables (Local Development)

Create a `.env` file for local development:

```bash
# Resend Configuration
RESEND_API_KEY=re_[YOUR_API_KEY]
ADMIN_EMAIL=NoReply@msgs.myai.ad
SENDER_NAME=MyAi

# Additional environment variables
OPENAI_API_KEY=your_openai_key_here
```

**⚠️ Important**: Never commit the `.env` file to version control!

## 🎯 Expected Results

After configuration:
- ✅ Users can register and receive confirmation emails
- ✅ Password reset emails work
- ✅ Emails come from `NoReply@msgs.myai.ad`
- ✅ No more `500 Internal Server Error` during registration

## 🔍 Troubleshooting

### If emails don't arrive:
1. **Check spam folder**
2. **Verify domain** in Resend dashboard
3. **Check Resend logs** for delivery status
4. **Try a different email address** for testing

### If still getting errors:
1. **Double-check SMTP settings** in Supabase
2. **Verify API key** is correct in Resend
3. **Check Supabase logs** for specific error messages

### Domain Issues:
- Make sure `msgs.myai.ad` is verified in your Resend dashboard
- The sender email MUST use the verified domain
- If you want to use a different domain, verify it in Resend first

## 🚀 Next Steps

1. **Configure SMTP** in Supabase dashboard (5 minutes)
2. **Test email delivery** (2 minutes)
3. **Re-enable email confirmations** (1 minute)
4. **Test full registration flow** (2 minutes)

Total time: ~10 minutes to get emails working!

## 📊 Verification Checklist

- [ ] SMTP settings configured in Supabase
- [ ] Test email sent successfully
- [ ] Email arrives from `NoReply@msgs.myai.ad`
- [ ] Email confirmations re-enabled
- [ ] User registration works end-to-end
- [ ] Password reset emails work
- [ ] No 500 errors during registration

Once all items are checked, your email system is fully operational! 🎉 