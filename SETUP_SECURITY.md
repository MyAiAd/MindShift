# 🔒 Security Setup Guide

## ⚠️ CRITICAL: Before Deployment

This template has been secured by removing all real secrets. Before you can use this application, you must:

### 1. Environment Variables Setup

1. **Copy the example file:**
   ```bash
   cp .env.example .env.local
   ```

2. **Fill in your real values** in `.env.local`:
   - Replace all placeholder values with your actual keys
   - Never commit `.env.local` to version control
   - Keep your secrets secure

### 2. Database Password

The super admin password in `supabase/migrations/003_create_super_admin.sql` needs to be changed:

1. **Open the file:** `supabase/migrations/003_create_super_admin.sql`
2. **Find line 61:** `encrypted_password = crypt('CHANGE_ME_SUPER_ADMIN_PASSWORD', gen_salt('bf'))`
3. **Replace** `CHANGE_ME_SUPER_ADMIN_PASSWORD` with your secure password
4. **Run the migration** to update the database

### 3. Security Checklist

Before connecting to GitHub or deploying:

- [ ] All `.env*` files contain only placeholder values or are gitignored
- [ ] No real API keys in source code
- [ ] Database passwords are changed from defaults
- [ ] VAPID keys are generated for your domain
- [ ] Supabase RLS policies are enabled
- [ ] Stripe webhook endpoints are configured
- [ ] All secrets are stored in environment variables, not code

### 4. Files That Should NEVER Be Committed

These files are already in `.gitignore` but double-check:
- `.env`
- `.env.local`
- `.env.production`
- Any file ending in `-secrets.*` or `-keys.*`
- `vercel-environment-variables.txt`

### 5. Deployment Environment Variables

When deploying to Vercel:
1. Set all environment variables in the Vercel dashboard
2. Never create `vercel-environment-variables.txt` with real secrets
3. Use Vercel's environment variable management

## 🚨 If You Find Real Secrets in the Code

If you discover any real API keys or passwords in the codebase:

1. **Immediately rotate/regenerate** all affected keys
2. **Remove the secrets** from the code
3. **Add them to `.gitignore`** if not already there
4. **Check git history** for any commits containing secrets

## 💡 Best Practices

- Use different keys for development and production
- Regularly rotate API keys and passwords
- Monitor for any secret leaks in your repository
- Use environment-specific configuration files
- Enable all relevant security features (2FA, RLS, etc.) 