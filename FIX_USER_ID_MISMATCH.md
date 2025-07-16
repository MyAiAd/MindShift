# 🔍 Fix User ID Mismatch - Foreign Key Error

## 🎯 **Problem:**
The user ID from the error logs doesn't exist in the `auth.users` table, causing a foreign key constraint violation.

## 🚀 **Solution: Find and Fix the Correct User**

**Step 1: Find Your Actual User ID**

Run this SQL in Supabase SQL Editor:

```sql
-- Find all users in the auth.users table
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    updated_at
FROM auth.users 
ORDER BY created_at DESC;
```

**Step 2: Create Profile for the Correct User**

After finding your user ID, replace `YOUR_ACTUAL_USER_ID` with the ID from Step 1:

```sql
-- ===============================================
-- FIX USER PROFILE WITH CORRECT ID
-- ===============================================

-- First, ensure Super Admin tenant exists
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

-- Create profile for your ACTUAL user (replace the ID below)
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
    'YOUR_ACTUAL_USER_ID',  -- Replace this with your real user ID
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

-- Verify the profile was created
SELECT 
    p.id,
    p.email,
    p.role,
    p.tenant_id,
    t.name as tenant_name
FROM profiles p
LEFT JOIN tenants t ON p.tenant_id = t.id
WHERE p.id = 'YOUR_ACTUAL_USER_ID';  -- Replace this too

-- Success message
SELECT 'Profile created successfully for correct user!' as message;
```

---

## 🔧 **Alternative: Use the Setup Function**

If you find your user ID, you can also use the automated function:

```sql
-- Find your user ID first
SELECT id, email FROM auth.users WHERE email = 'sage@myai.ad';

-- Then use the setup function
SELECT setup_first_super_admin();
```

---

## 🛠️ **If No Users Found:**

If the query returns no users, it means your user account was deleted. In that case:

1. **Sign out** of your app
2. **Sign up again** with the same email
3. **The first user super admin** system will work automatically

---

## 🎯 **Quick All-in-One Fix:**

If you want to avoid manual steps, run this comprehensive fix:

```sql
-- ===============================================
-- COMPREHENSIVE USER FIX
-- ===============================================

-- Create Super Admin tenant
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

-- Create profile for the first user found (if any)
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
    u.id,
    (SELECT id FROM tenants WHERE slug = 'super-admin'),
    u.email,
    'Admin',
    'User',
    'super_admin',
    'premium',
    true,
    '{}',
    NOW(),
    NOW()
FROM auth.users u
WHERE u.email = 'sage@myai.ad'
ORDER BY u.created_at ASC
LIMIT 1
ON CONFLICT (id) DO UPDATE SET
    role = 'super_admin',
    tenant_id = (SELECT id FROM tenants WHERE slug = 'super-admin'),
    subscription_tier = 'premium',
    updated_at = NOW();

-- Show results
SELECT 
    'User found and profile created!' as message,
    u.id as user_id,
    u.email,
    p.role
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'sage@myai.ad';
```

---

## 📋 **What to Do:**

1. **Run the first query** to find your actual user ID
2. **Copy the correct user ID** from the results
3. **Replace `YOUR_ACTUAL_USER_ID`** in the second query
4. **Run the profile creation query**
5. **Refresh your app** - dashboard should work

**If you don't see any users, you'll need to sign up again!** 🎉 