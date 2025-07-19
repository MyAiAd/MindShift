# 🗄️ Supabase SQL Editor Setup

## 📋 **Run This SQL in Your Supabase SQL Editor**

Copy and paste this **complete SQL script** into your Supabase SQL Editor to set up the database:

```sql
-- ===============================================
-- MINDSHIFTING DATABASE SETUP - COMPLETE SCRIPT
-- ===============================================
-- Run this in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types (only if they don't exist)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('super_admin', 'tenant_admin', 'manager', 'coach', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'trial', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'unpaid', 'trialing');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ===============================================
-- CORE TABLES
-- ===============================================

-- Tenants table (organizations/companies)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255) UNIQUE,
    logo_url TEXT,
    status tenant_status DEFAULT 'trial',
    settings JSONB DEFAULT '{}',
    subscription_id VARCHAR(255),
    subscription_status subscription_status DEFAULT 'trialing',
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table (extends auth.users) - THIS IS THE MISSING TABLE
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    role user_role DEFAULT 'user',
    subscription_tier VARCHAR(50) DEFAULT 'trial',
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}',
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===============================================
-- FIRST USER SUPER ADMIN SYSTEM
-- ===============================================

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
            'active',
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
        subscription_tier,
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
        CASE WHEN new_user_role = 'super_admin' THEN 'premium' ELSE 'trial' END,
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

-- Function to manually promote a user to super admin (if needed)
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
        subscription_tier = 'premium',
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

-- ===============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ===============================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Tenants policies
CREATE POLICY "Users can view their own tenant" ON tenants
    FOR SELECT TO authenticated
    USING (
        id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Super admin can access all tenants" ON tenants
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'super_admin'
        )
    );

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

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

-- Audit logs policies
CREATE POLICY "Users can view their own audit logs" ON audit_logs
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid() OR
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Super admin can access all audit logs" ON audit_logs
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'super_admin'
        )
    );

-- ===============================================
-- GRANTS AND PERMISSIONS
-- ===============================================

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION handle_new_user_registration(UUID, VARCHAR, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user_registration(UUID, VARCHAR, VARCHAR, VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION setup_first_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION setup_first_super_admin() TO anon;
GRANT EXECUTE ON FUNCTION promote_user_to_super_admin(VARCHAR) TO authenticated;

-- ===============================================
-- TRIGGERS FOR UPDATED_AT
-- ===============================================

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to tables
CREATE TRIGGER update_tenants_updated_at 
    BEFORE UPDATE ON tenants 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===============================================
-- SETUP COMPLETE
-- ===============================================

-- Success message
SELECT 'Database setup completed successfully! You can now test user registration.' as message;
```

---

## 🚀 **After Running the SQL:**

1. **✅ Tables Created**: `tenants`, `profiles`, `audit_logs`
2. **✅ Functions Created**: Super admin system functions
3. **✅ RLS Policies**: Security policies enabled
4. **✅ First User System**: Ready for automatic super admin promotion

## 🧪 **Test Your Setup:**

1. **Go to your app** and try signing up
2. **First user** will automatically become super admin
3. **Check the console** for "First user became super admin" message
4. **Check your database** - you should see the profile created

## 📧 **With Email Confirmation:**

If you want email confirmation, also run this:

```sql
-- Enable email confirmation in your app
-- This is handled in your supabase/config.toml file
```

**Your database is now ready for the first user super admin system!** 🎉 