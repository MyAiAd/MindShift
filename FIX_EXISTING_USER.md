# 🔧 Fix Existing User Profile Issue

## 🎯 **Problem:**
You have an existing user account (`b820aa9a-39fa-4a96-beb4-01f58523896e`) but no profile in the database, causing a 500 error.

## 🚀 **Solution: Run This in Supabase SQL Editor**

Copy and paste this SQL to fix your existing user:

```sql
-- ===============================================
-- FIX EXISTING USER PROFILE
-- ===============================================

-- First, let's see what users exist
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at
FROM auth.users 
ORDER BY created_at ASC;

-- Create profile for existing user and make them super admin
SELECT setup_first_super_admin();

-- Alternative: If the function doesn't work, manually create the profile
-- Replace the UUID below with your actual user ID
INSERT INTO profiles (
    id,
    tenant_id,
    email,
    first_name,
    last_name,
    role,
    subscription_tier,
    is_active,
    settings,
    created_at,
    updated_at
) 
SELECT 
    au.id,
    (SELECT id FROM tenants WHERE slug = 'super-admin'),
    au.email,
    'Admin',
    'User',
    'super_admin',
    'premium',
    true,
    '{}',
    NOW(),
    NOW()
FROM auth.users au 
WHERE au.id = 'b820aa9a-39fa-4a96-beb4-01f58523896e'
ON CONFLICT (id) DO UPDATE SET
    role = 'super_admin',
    tenant_id = (SELECT id FROM tenants WHERE slug = 'super-admin'),
    subscription_tier = 'premium',
    updated_at = NOW();

-- Create audit log for the promotion
INSERT INTO audit_logs (
    tenant_id,
    user_id,
    action,
    resource_type,
    resource_id,
    new_data,
    created_at
) VALUES (
    (SELECT id FROM tenants WHERE slug = 'super-admin'),
    'b820aa9a-39fa-4a96-beb4-01f58523896e',
    'CREATE',
    'super_admin',
    'b820aa9a-39fa-4a96-beb4-01f58523896e',
    jsonb_build_object(
        'email', 'sage@myai.ad',
        'role', 'super_admin',
        'reason', 'existing_user_promotion'
    ),
    NOW()
);

-- Verify the profile was created
SELECT 
    p.id,
    p.email,
    p.role,
    p.tenant_id,
    t.name as tenant_name
FROM profiles p
LEFT JOIN tenants t ON p.tenant_id = t.id
WHERE p.id = 'b820aa9a-39fa-4a96-beb4-01f58523896e';

-- Success message
SELECT 'Profile created successfully! You can now use the dashboard.' as message;
```

---

## 🔍 **Expected Results:**

After running this SQL, you should see:
1. **User information** from auth.users table
2. **Profile creation** confirmation
3. **Audit log entry** for the promotion
4. **Profile verification** showing super admin role
5. **Success message**

---

## 🧪 **Test Your Fix:**

1. **Run the SQL** in Supabase SQL Editor
2. **Go back to your app** and refresh the page
3. **Dashboard should load** without errors
4. **Check console** for "Profile loaded" messages
5. **Verify you have super admin** access

---

## 🛠️ **Alternative Quick Fix:**

If the above doesn't work, try this simpler approach:

```sql
-- Quick fix: Create Super Admin tenant if it doesn't exist
INSERT INTO tenants (
    id,
    name,
    slug,
    status,
    subscription_status,
    trial_ends_at,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'Super Admin Organization',
    'super-admin',
    'active',
    'active',
    NOW() + INTERVAL '10 years',
    NOW(),
    NOW()
) ON CONFLICT (slug) DO NOTHING;

-- Create profile for your user
INSERT INTO profiles (
    id,
    tenant_id,
    email,
    first_name,
    last_name,
    role,
    subscription_tier,
    is_active,
    settings,
    created_at,
    updated_at
) VALUES (
    'b820aa9a-39fa-4a96-beb4-01f58523896e',
    (SELECT id FROM tenants WHERE slug = 'super-admin'),
    'sage@myai.ad',
    'Sage',
    'Admin',
    'super_admin',
    'premium',
    true,
    '{}',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    role = 'super_admin',
    tenant_id = (SELECT id FROM tenants WHERE slug = 'super-admin'),
    subscription_tier = 'premium',
    updated_at = NOW();
```

---

## ✅ **What This Fixes:**

- **✅ Creates your profile** in the database
- **✅ Makes you super admin** with full access
- **✅ Assigns you to Super Admin Organization**
- **✅ Fixes the 500 error** on dashboard
- **✅ Enables full dashboard** functionality

**Run this SQL and your dashboard should work perfectly!** 🎉 