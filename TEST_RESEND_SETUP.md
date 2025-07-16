# 🧪 Testing Resend Setup Guide

## 📋 **Your Current Setup:**
- **Vercel Environment Variables**: ✅ Added
- **RESEND_API_KEY**: `re_3n7DXFX3_ERxVAtYNSgzG2MR2ZVrUA6Y6`
- **ADMIN_EMAIL**: `Contact@MyAi.ad`
- **SENDER_NAME**: `MyAi`

---

## 🏃 **Quick Test Steps:**

### **Step 1: Add Environment Variables Locally**

Create or update your `.env.local` file:

```bash
# Create .env.local file
cat > .env.local << 'EOF'
# Resend Email Configuration
RESEND_API_KEY=re_3n7DXFX3_ERxVAtYNSgzG2MR2ZVrUA6Y6
ADMIN_EMAIL=Contact@MyAi.ad
SENDER_NAME=MyAi

# Your existing Supabase variables (add your actual values)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EOF
```

### **Step 2: Test Without Email Confirmation (Faster)**

```bash
# 1. Make sure email confirmation is disabled for initial test
# (It's currently disabled in your config)

# 2. Restart Supabase
supabase stop
supabase start

# 3. Start your Next.js app
npm run dev
```

### **Step 3: Test Signup Flow**

1. **Go to** `http://localhost:3000/auth`
2. **Click "Sign up"**
3. **Fill out the form** with:
   - Email: Use your real email
   - Password: Any password
   - Organization: Test Organization
4. **Submit the form**
5. **Expected result**: You should be automatically signed in and redirected to dashboard

### **Step 4: Check First User Super Admin**

1. **Check the console logs** for "First user became super admin"
2. **Go to dashboard** - you should see admin features
3. **Check your profile** - should show super admin role

---

## 📧 **Test With Email Confirmation (Full Flow)**

### **Step 1: Enable Email Confirmation**

```bash
# Edit supabase/config.toml
sed -i 's/enable_confirmations = false/enable_confirmations = true/' supabase/config.toml

# Restart Supabase
supabase stop
supabase start
```

### **Step 2: Test Email Confirmation Flow**

1. **Go to** `http://localhost:3000/auth`
2. **Sign up** with a real email address
3. **Expected result**: "Please check your email and click the confirmation link"
4. **Check your email** for confirmation message
5. **Click confirmation link** in email
6. **Expected result**: Redirected to app and signed in

### **Step 3: Monitor Emails**

- **Development**: Check `http://localhost:54324` for test emails
- **Production**: Check [resend.com/emails](https://resend.com/emails) for real emails

---

## 🔍 **Verification Checklist:**

### **✅ Local Testing:**
- [ ] Environment variables loaded correctly
- [ ] Supabase started without errors
- [ ] Signup form works without email confirmation
- [ ] First user becomes super admin
- [ ] Email confirmation works (if enabled)

### **✅ Production Testing (Vercel):**
- [ ] Deploy to Vercel
- [ ] Test signup on production URL
- [ ] Check Resend dashboard for sent emails
- [ ] Verify first user super admin works

---

## 🛠️ **Troubleshooting:**

### **❌ Error: "Environment variable not found"**
```bash
# Check if variables are loaded
echo $RESEND_API_KEY
echo $ADMIN_EMAIL
echo $SENDER_NAME

# If empty, restart your dev server
npm run dev
```

### **❌ Error: "Invalid API key"**
```bash
# Test API key directly
curl -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer re_3n7DXFX3_ERxVAtYNSgzG2MR2ZVrUA6Y6' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "MyAi <Contact@MyAi.ad>",
    "to": ["your-email@example.com"],
    "subject": "Test Email",
    "html": "<h1>Test successful!</h1>"
  }'
```

### **❌ Error: "Emails not sending"**
```bash
# Check Supabase logs
supabase logs

# Check Resend dashboard
# Go to https://resend.com/emails
```

---

## 📊 **Testing Commands:**

### **Quick Environment Check:**
```bash
# Test all environment variables
echo "RESEND_API_KEY: $RESEND_API_KEY"
echo "ADMIN_EMAIL: $ADMIN_EMAIL"
echo "SENDER_NAME: $SENDER_NAME"
echo "SUPABASE_URL: $NEXT_PUBLIC_SUPABASE_URL"
```

### **Test Supabase Connection:**
```bash
# Check if Supabase is running
supabase status

# Check logs for errors
supabase logs
```

### **Test Email Delivery:**
```bash
# Quick curl test to Resend API
curl -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer re_3n7DXFX3_ERxVAtYNSgzG2MR2ZVrUA6Y6' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "MyAi <Contact@MyAi.ad>",
    "to": ["Contact@MyAi.ad"],
    "subject": "API Test",
    "html": "<h1>API key working!</h1>"
  }'
```

---

## 🎯 **Expected Results:**

### **Without Email Confirmation:**
1. **Signup** → Immediate signin → Dashboard
2. **First user** → Super admin role
3. **Console logs** → "First user became super admin"

### **With Email Confirmation:**
1. **Signup** → "Check your email" message
2. **Email received** → Confirmation link
3. **Click link** → Signin → Dashboard
4. **First user** → Super admin role after confirmation

---

## 🚀 **Next Steps:**

1. **Run the tests above** to verify local setup
2. **Deploy to Vercel** if local tests pass
3. **Test production** with real signup
4. **Check Resend dashboard** for email delivery
5. **Monitor first user** super admin promotion

**Ready to test!** 🎉 