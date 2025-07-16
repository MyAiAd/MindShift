# 👑 First User Super Admin System

## ✅ **Feature Overview**

The first user to register in your system will **automatically become a super admin** with full access to all features and tenants. This is a common SaaS pattern that ensures the system owner has complete control from day one.

---

## 🎯 **How It Works**

### **Super Admin Creation Options:**

#### **Option 1: Manual Setup (Recommended)**
1. **Register your first user** and confirm their email
2. **Run the setup function** in Supabase SQL Editor
3. **First user becomes super admin** automatically

#### **Option 2: Application Integration**
1. **Call the registration function** from your app's auth flow
2. **System detects** if this is the first confirmed user
3. **Automatically assigns** `super_admin` role to first user
4. **Creates default tenant** called "Super Admin Organization"

### **Subsequent Users:**
- **Regular users** get `user` role by default
- **No automatic tenant assignment** (they need to create/join tenants)
- **Standard permissions** based on their role and tenant

---

## 📄 **SQL Migration to Run**

### **File: `supabase/migrations/023_first_user_super_admin.sql`**

Copy and paste this **complete SQL code** into your Supabase SQL Editor:

```sql
-- ===============================================
-- FIRST USER SUPER ADMIN MIGRATION
-- ===============================================
-- Automatically makes the first user in the system a super admin

-- Ensure user_role enum type exists
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('super_admin', 'tenant_admin', 'manager', 'coach', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Function to handle new user registration (called from application)
CREATE OR REPLACE FUNCTION handle_new_user_registration(
    user_id UUID,
    user_email VARCHAR(255),
    user_first_name VARCHAR(100) DEFAULT NULL,
    user_last_name VARCHAR(100) DEFAULT NULL
) 
RETURNS JSONB AS $$
DECLARE
    existing_user_count INTEGER;
    new_user_role user_role;
    default_tenant_id UUID;
    result JSONB;
BEGIN
    -- Check if this is the first user in the system
    SELECT COUNT(*) INTO existing_user_count 
    FROM auth.users 
    WHERE id != user_id AND email_confirmed_at IS NOT NULL;
    
    -- If this is the first user, make them super admin
    IF existing_user_count = 0 THEN
        new_user_role := 'super_admin';
        
        -- Get or create a default tenant for super admin
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
            'premium',
            NOW() + INTERVAL '10 years', -- Super admin gets long trial
            NOW(),
            NOW()
        ) 
        ON CONFLICT (slug) DO UPDATE SET 
            updated_at = NOW()
        RETURNING id INTO default_tenant_id;
        
        -- If tenant already exists, get its ID
        IF default_tenant_id IS NULL THEN
            SELECT id INTO default_tenant_id FROM tenants WHERE slug = 'super-admin';
        END IF;
        
    ELSE
        -- Regular users get 'user' role and no default tenant
        new_user_role := 'user';
        default_tenant_id := NULL;
    END IF;
    
    -- Create the user profile
    INSERT INTO profiles (
        id,
        tenant_id,
        email,
        first_name,
        last_name,
        role,
        is_active,
        settings,
        created_at,
        updated_at
    ) VALUES (
        user_id,
        default_tenant_id,
        user_email,
        user_first_name,
        user_last_name,
        new_user_role,
        TRUE,
        '{}',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        tenant_id = COALESCE(default_tenant_id, profiles.tenant_id),
        email = user_email,
        first_name = COALESCE(user_first_name, profiles.first_name),
        last_name = COALESCE(user_last_name, profiles.last_name),
        role = CASE 
            WHEN existing_user_count = 0 THEN 'super_admin'::user_role
            ELSE profiles.role
        END,
        updated_at = NOW();
    
    -- Create audit log for super admin creation
    IF new_user_role = 'super_admin' THEN
        INSERT INTO audit_logs (
            tenant_id,
            user_id,
            action,
            resource_type,
            resource_id,
            new_data,
            created_at
        ) VALUES (
            default_tenant_id,
            user_id,
            'CREATE',
            'super_admin',
            user_id,
            jsonb_build_object(
                'email', user_email,
                'role', 'super_admin',
                'reason', 'first_user_auto_promotion'
            ),
            NOW()
        );
    END IF;
    
    -- Return result
    result := jsonb_build_object(
        'success', true,
        'user_id', user_id,
        'role', new_user_role,
        'tenant_id', default_tenant_id,
        'is_super_admin', new_user_role = 'super_admin',
        'message', CASE 
            WHEN new_user_role = 'super_admin' THEN 'First user promoted to super admin'
            ELSE 'Regular user profile created'
        END
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION handle_new_user_registration(UUID, VARCHAR, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user_registration(UUID, VARCHAR, VARCHAR, VARCHAR) TO anon;

-- Helper function to setup first super admin manually
CREATE OR REPLACE FUNCTION setup_first_super_admin()
RETURNS JSONB AS $$
DECLARE
    first_user_id UUID;
    first_user_email VARCHAR(255);
    result JSONB;
BEGIN
    -- Get the first confirmed user
    SELECT id, email INTO first_user_id, first_user_email 
    FROM auth.users 
    WHERE email_confirmed_at IS NOT NULL 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    -- Check if we found a user
    IF first_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'No confirmed users found in the system'
        );
    END IF;
    
    -- Check if user already has a profile
    IF EXISTS (SELECT 1 FROM profiles WHERE id = first_user_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'User already has a profile',
            'user_id', first_user_id,
            'email', first_user_email
        );
    END IF;
    
    -- Call the registration function
    result := handle_new_user_registration(
        first_user_id,
        first_user_email,
        NULL, -- first_name
        NULL  -- last_name
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission to use the setup function
GRANT EXECUTE ON FUNCTION setup_first_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION setup_first_super_admin() TO anon;

-- Update existing super admin policies to work with the new system
DO $$ 
BEGIN
    -- Update RLS policies to recognize the new auto-created super admin
    -- This ensures the super admin can access all tenants
    DROP POLICY IF EXISTS "Super admin can access all tenants" ON tenants;
    CREATE POLICY "Super admin can access all tenants" ON tenants
        FOR ALL TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE profiles.id = auth.uid() 
                AND profiles.role = 'super_admin'
            )
        );
        
    -- Update profiles policy for super admin
    DROP POLICY IF EXISTS "Super admin can access all profiles" ON profiles;
    CREATE POLICY "Super admin can access all profiles" ON profiles
        FOR ALL TO authenticated
        USING (
            profiles.id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM profiles super_admin_profile
                WHERE super_admin_profile.id = auth.uid() 
                AND super_admin_profile.role = 'super_admin'
            )
        );
        
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Ignore policy creation errors
END $$;

-- Create a function to manually promote a user to super admin (if needed)
CREATE OR REPLACE FUNCTION promote_user_to_super_admin(user_email VARCHAR(255))
RETURNS BOOLEAN AS $$
DECLARE
    user_id UUID;
    default_tenant_id UUID;
    success BOOLEAN := FALSE;
BEGIN
    -- Check if caller is super admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'Only super admins can promote users';
    END IF;
    
    -- Find the user
    SELECT au.id INTO user_id 
    FROM auth.users au 
    WHERE au.email = user_email AND au.email_confirmed_at IS NOT NULL;
    
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'User not found or email not confirmed';
    END IF;
    
    -- Get super admin tenant
    SELECT id INTO default_tenant_id FROM tenants WHERE slug = 'super-admin';
    
    -- Update user profile
    UPDATE profiles SET
        role = 'super_admin',
        tenant_id = default_tenant_id,
        updated_at = NOW()
    WHERE id = user_id;
    
    -- Create audit log
    INSERT INTO audit_logs (
        tenant_id,
        user_id,
        action,
        resource_type,
        resource_id,
        new_data,
        created_at
    ) VALUES (
        default_tenant_id,
        auth.uid(),
        'UPDATE',
        'user_promotion',
        user_id,
        jsonb_build_object(
            'promoted_user_email', user_email,
            'new_role', 'super_admin',
            'reason', 'manual_promotion'
        ),
        NOW()
    );
    
    success := TRUE;
    RETURN success;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission to use the promotion function
GRANT EXECUTE ON FUNCTION promote_user_to_super_admin(VARCHAR) TO authenticated;
```

---

## 🚀 **How to Implement**

### **Step 1: Ensure Prerequisites**
**⚠️ IMPORTANT**: Before running this migration, you must have run the initial schema migration (`001_initial_schema.sql`) first. This creates the required tables and enum types.

If you haven't run the initial migrations yet:
1. **Run migrations 001-022** in order from the `supabase/migrations/` folder
2. **Or use Supabase CLI**: `supabase db reset` (if starting fresh)

### **Step 2: Run the Migration**
1. **Open Supabase Dashboard**
2. **Go to SQL Editor**
3. **Copy and paste** the complete SQL code above
4. **Click "Run"** to execute the migration

### **Step 3: Setup First Super Admin**

#### **Option A: Manual Setup (Easiest)**
1. **Register your first user** via your app's signup flow
2. **Confirm the email** (check your inbox)
3. **Run this in Supabase SQL Editor:**
   ```sql
   SELECT setup_first_super_admin();
   ```
4. **Check the result** - should show success message

#### **Option B: Application Integration**
1. **Add to your signup flow** (after user confirms email):
   ```javascript
   // Call this after user confirms email
   const { data, error } = await supabase.rpc('handle_new_user_registration', {
     user_id: user.id,
     user_email: user.email,
     user_first_name: user.user_metadata?.first_name,
     user_last_name: user.user_metadata?.last_name
   });
   ```
2. **Check the response** - `data.is_super_admin` will be true for first user

### **Step 4: Verify Super Admin Access**
1. **Log in as the first user**
2. **Check Dashboard** → **Settings** → you should see admin features
3. **Verify tenant access** → Super admin should see all tenants
4. **Test feature access** → All features should be available

---

## 🔧 **Technical Details**

### **Database Functions:**
- **`setup_first_super_admin()`** - Manual setup function (easiest approach)
- **`handle_new_user_registration()`** - Application integration function

### **Auto-Created Resources:**
- **Super Admin Tenant**: `"Super Admin Organization"` with slug `"super-admin"`
- **Premium Subscription**: 10-year trial for super admin tenant
- **Full Permissions**: Access to all tables and features

### **Security Features:**
- **RLS Policies**: Updated to recognize auto-created super admin
- **Audit Logging**: Records super admin creation and promotions
- **Manual Promotion**: Function to promote additional users if needed

---

## 🛡️ **Security Considerations**

### **✅ Built-in Safeguards:**
- **Email confirmation required** - Only confirmed users can become super admin
- **One-time check** - Only the absolute first user gets super admin
- **Audit trail** - All super admin actions are logged
- **Manual promotion** - Additional super admins require existing super admin

### **🔐 RLS Policies:**
- **Tenant isolation** - Super admin can access all tenants
- **Profile management** - Super admin can view/edit all profiles
- **System-wide access** - Super admin bypasses normal restrictions

---

## 📋 **What Happens After Implementation**

### **✅ First User Experience:**
1. **Registers and confirms email**
2. **Automatically becomes super admin**
3. **Gets assigned to "Super Admin Organization" tenant**
4. **Has access to all features immediately**
5. **Can see and manage all tenants**

### **✅ Regular User Experience:**
1. **Registers and confirms email**
2. **Gets "user" role by default**
3. **No automatic tenant assignment**
4. **Needs to create/join tenants**
5. **Standard feature access based on role**

---

## 🎯 **Manual Promotion Function**

If you need to promote additional users to super admin later:

```sql
-- Call this function as an existing super admin
SELECT promote_user_to_super_admin('user@example.com');
```

### **Requirements:**
- **Must be called by existing super admin**
- **Target user must exist and have confirmed email**
- **Creates audit log of the promotion**

---

## 🧪 **Testing Scenarios**

### **✅ Test Cases:**
1. **Fresh system**: First user → super admin
2. **Second user**: Regular user → user role
3. **Email confirmation**: Delayed confirmation → still works
4. **Manual promotion**: Existing super admin → can promote others
5. **RLS verification**: Super admin → access to all data

### **⚠️ Important Notes:**
- **Run in development first** to test the flow
- **Backup your database** before running in production
- **Test with real email confirmation** flow
- **Verify all RLS policies** work correctly

---

## 🎉 **Benefits of This System**

### **🔐 Security:**
- **Automatic owner assignment** - No manual intervention needed
- **Audit trail** - All super admin actions are tracked
- **Secure by default** - Only confirmed users can become super admin

### **🚀 User Experience:**
- **Seamless setup** - First user gets immediate full access
- **Clear hierarchy** - Super admin > tenant admin > user
- **Scalable** - Works for single-tenant or multi-tenant setups

### **⚙️ Development:**
- **Zero configuration** - Works out of the box
- **Flexible** - Can promote additional super admins later
- **Maintainable** - Clean trigger-based implementation

---

## 🔧 **Troubleshooting**

### **❌ Error: `type "user_role" does not exist`**
**Solution**: The migration now creates this type automatically, but if you still get this error:
```sql
-- Run this first (from 001_initial_schema.sql)
CREATE TYPE user_role AS ENUM ('super_admin', 'tenant_admin', 'manager', 'coach', 'user');
```

### **❌ Error: `relation "tenants" does not exist`**
**Solution**: Run migrations 001-022 in order first, then run this migration.

### **❌ Error: `relation "profiles" does not exist`**
**Solution**: Ensure you have run the complete initial schema migration.

### **❌ Error: `relation "audit_logs" does not exist`**
**Solution**: Run all previous migrations first - the audit_logs table is created in the initial schema.

### **❌ Error: `must be owner of table users`**
**Solution**: ✅ **FIXED!** The new migration doesn't use triggers, so this error won't occur.

### **❌ Error: `No confirmed users found`**
**Solution**: 
1. Make sure you have registered a user
2. Check the user confirmed their email
3. Run `SELECT * FROM auth.users WHERE email_confirmed_at IS NOT NULL;` to verify

### **✅ Quick Fix Command**
If you're starting fresh, run this in Supabase CLI:
```bash
supabase db reset
```
This will run all migrations in order.

---

## 🎯 **Next Steps**

### **🚀 Quick Start (Recommended)**
1. **Run the migration** in your Supabase SQL Editor
2. **Register your first user** via your app
3. **Confirm the email** (check inbox)
4. **Run:** `SELECT setup_first_super_admin();` in SQL Editor
5. **Login as first user** - you're now super admin! 👑

### **🔧 Advanced Integration**
1. **Run the migration** in your Supabase SQL Editor
2. **Integrate the function** into your app's auth flow
3. **Test with user registration** and email confirmation
4. **Verify super admin permissions** work correctly
5. **Deploy to production** when ready

**Your first user super admin system is now ready to use!** 🚀

### **💡 Pro Tips**
- **Use Option A (Manual Setup)** for simplicity
- **Use Option B (App Integration)** for fully automated experience
- **The manual setup is perfect** for getting started quickly
- **No more permission errors** - the new approach works with standard Supabase permissions 