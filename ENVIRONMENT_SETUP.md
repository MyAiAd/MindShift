# 🔧 Environment Variables Setup Guide

## 📋 **Required Environment Variables**

Create a `.env.local` file in your project root with these variables:

```env
# ===============================================
# RESEND EMAIL CONFIGURATION
# ===============================================
RESEND_API_KEY=re_your_actual_api_key_here
ADMIN_EMAIL=admin@yourdomain.com
SENDER_NAME=Your App Name

# ===============================================
# SUPABASE CONFIGURATION
# ===============================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# ===============================================
# OPTIONAL: OPENAI CONFIGURATION
# ===============================================
OPENAI_API_KEY=your_openai_api_key_here

# ===============================================
# OPTIONAL: STRIPE CONFIGURATION
# ===============================================
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key

# ===============================================
# OPTIONAL: CUSTOM DATABASE URL
# ===============================================
DATABASE_URL=your_database_url_here
```

---

## 🔑 **How to Get Each Variable**

### **Resend Email Variables:**

1. **`RESEND_API_KEY`**:
   - Go to [resend.com/api-keys](https://resend.com/api-keys)
   - Create new API key with "Send access"
   - Copy the key (starts with `re_`)

2. **`ADMIN_EMAIL`**:
   - Your admin email address
   - Use an email from your domain if possible
   - Example: `admin@yourdomain.com`

3. **`SENDER_NAME`**:
   - Your app or company name
   - Appears in email "From" field
   - Example: `MindShifting App`

### **Supabase Variables:**

1. **`NEXT_PUBLIC_SUPABASE_URL`**:
   - Go to [supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your project
   - Go to Settings > API
   - Copy "Project URL"

2. **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**:
   - Same page as above
   - Copy "anon public" key

3. **`SUPABASE_SERVICE_ROLE_KEY`**:
   - Same page as above
   - Copy "service_role" key (keep secret!)

### **Optional Variables:**

1. **`OPENAI_API_KEY`** (for AI features):
   - Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Create new API key

2. **Stripe Keys** (for payments):
   - Go to [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)
   - Copy publishable and secret keys

---

## 🚀 **Quick Setup Commands**

### **1. Create Environment File:**
```bash
# Create .env.local file
touch .env.local

# Add to .gitignore (if not already there)
echo ".env.local" >> .gitignore
```

### **2. Template to Copy:**
```bash
cat > .env.local << 'EOF'
# Resend Email Configuration
RESEND_API_KEY=re_your_actual_api_key_here
ADMIN_EMAIL=admin@yourdomain.com
SENDER_NAME=Your App Name

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Optional: OpenAI
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
EOF
```

### **3. Replace Placeholder Values:**
Edit `.env.local` and replace all placeholder values with your actual keys.

---

## 🔒 **Security Best Practices**

### **✅ Do:**
- **Keep `.env.local` in `.gitignore`** - Never commit secrets
- **Use different keys** for development and production
- **Rotate keys regularly** - Generate new ones periodically
- **Use environment variables** - Never hardcode secrets in code

### **❌ Don't:**
- **Commit `.env.local`** to version control
- **Share keys** in chat or email
- **Use production keys** in development
- **Hardcode secrets** in your application code

---

## 🧪 **Testing Your Setup**

### **1. Check Environment Variables:**
```bash
# Test if variables are loaded
node -e "console.log(process.env.RESEND_API_KEY)"
node -e "console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)"
```

### **2. Test Email Sending:**
```bash
# Restart your development server
npm run dev

# Try signing up with a real email
# Check if confirmation email is sent
```

### **3. Check Logs:**
```bash
# Check Supabase logs
supabase logs

# Check your app logs
# Look for any environment variable errors
```

---

## 🔧 **Development vs Production**

### **Development (.env.local):**
```env
# Use test/development keys
RESEND_API_KEY=re_test_key_here
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### **Production (Platform Environment Variables):**
```env
# Use production keys
RESEND_API_KEY=re_production_key_here
STRIPE_SECRET_KEY=sk_prod_your_production_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_prod_your_production_key
```

### **Deployment Platforms:**
- **Vercel**: Project Settings > Environment Variables
- **Netlify**: Site Settings > Environment Variables
- **Railway**: Project Settings > Variables
- **Heroku**: App Settings > Config Vars

---

## 🛠️ **Troubleshooting**

### **❌ Error: "Environment variable not found"**
**Solution**: 
1. Check `.env.local` file exists
2. Verify variable names are correct
3. Restart your development server
4. Check for typos in variable names

### **❌ Error: "Invalid API key"**
**Solution**:
1. Generate a new API key
2. Copy the full key including prefixes
3. Make sure no extra spaces or characters
4. Test with a simple curl command

### **❌ Error: "CORS issues"**
**Solution**:
1. Check `NEXT_PUBLIC_SUPABASE_URL` is correct
2. Verify it includes `https://`
3. Make sure it's your actual project URL
4. Check Supabase dashboard for correct URL

---

## 📋 **Environment Variables Checklist**

### **✅ Required for Email Confirmation:**
- [ ] `RESEND_API_KEY` - Your Resend API key
- [ ] `ADMIN_EMAIL` - Your admin email address
- [ ] `SENDER_NAME` - Your app name
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key

### **✅ Optional but Recommended:**
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - For admin operations
- [ ] `OPENAI_API_KEY` - For AI features
- [ ] `STRIPE_SECRET_KEY` - For payment processing
- [ ] `STRIPE_WEBHOOK_SECRET` - For webhook verification
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - For frontend payments

---

## 🎯 **Next Steps**

1. **Create `.env.local`** with your actual values
2. **Test the setup** with email confirmation
3. **Verify first user** becomes super admin
4. **Set up production** environment variables
5. **Monitor email delivery** in Resend dashboard

**Your environment is now ready for production!** 🚀 