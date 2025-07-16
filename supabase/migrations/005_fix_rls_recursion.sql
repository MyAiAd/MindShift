-- Fix RLS Policy Infinite Recursion
-- This migration fixes the circular dependency in profiles policies

-- Drop all existing policies on profiles to start fresh
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON profiles;
    DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
    DROP POLICY IF EXISTS "Tenant admins can manage profiles in their tenant" ON profiles;
    DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
    DROP POLICY IF EXISTS "Super admins can manage all profiles" ON profiles;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Create new non-recursive policies for profiles
-- Allow users to view their own profile without checking roles
DO $$ BEGIN
    CREATE POLICY "Users can view their own profile" ON profiles
        FOR SELECT USING (id = auth.uid());
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Allow users to update their own profile without checking roles
DO $$ BEGIN
    CREATE POLICY "Users can update their own profile" ON profiles
        FOR UPDATE USING (id = auth.uid());
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Allow users to insert their own profile (for new user creation)
DO $$ BEGIN
    CREATE POLICY "Users can insert their own profile" ON profiles
        FOR INSERT WITH CHECK (id = auth.uid());
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Create a comprehensive policy that handles all access without recursion
DO $$ BEGIN
    CREATE POLICY "Comprehensive profile access" ON profiles
        FOR ALL USING (
            -- Allow users to access their own profile
            id = auth.uid() OR
            -- Allow super admin access using the specific UUID
            auth.uid() = 'e3b0c442-98fc-1c14-9afb-92266f7e1234'::UUID
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$; 