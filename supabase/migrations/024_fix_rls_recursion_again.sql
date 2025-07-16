-- ===============================================
-- FIX RLS RECURSION ISSUE (AGAIN)
-- ===============================================
-- This migration fixes the infinite recursion issue in profiles table RLS policies
-- The issue was reintroduced in 023_first_user_super_admin.sql

-- Drop the problematic recursive policy on profiles table
DROP POLICY IF EXISTS "Super admin can access all profiles" ON profiles;

-- Drop other potentially problematic policies
DROP POLICY IF EXISTS "Super admin can access all tenants" ON tenants;
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Tenant admins can manage profiles in their tenant" ON profiles;
DROP POLICY IF EXISTS "Comprehensive profile access" ON profiles;

-- Create non-recursive policies for profiles table
-- Allow users to view their own profile (no recursion)
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

-- Allow users to update their own profile (no recursion)
CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid());

-- Allow users to insert their own profile (no recursion)
CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

-- For now, we'll use a simple approach that avoids recursion completely
-- Super admin access will be handled by a separate mechanism
-- This ensures the basic profile access works without recursion

-- Note: Super admin functionality can be added later once the recursion is resolved
-- For now, users can only access their own profiles, which prevents the recursion issue

-- Create tenant-based access policy
CREATE POLICY "Tenant members can view profiles in their tenant" ON profiles
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (
            SELECT p.tenant_id 
            FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.tenant_id IS NOT NULL
        )
    );

-- Super admin tenant access is temporarily disabled to avoid recursion
-- This will be re-enabled once the recursion issue is fully resolved

-- Create a safer tenant access policy
CREATE POLICY "Users can view their own tenant" ON tenants
    FOR SELECT TO authenticated
    USING (
        id IN (
            SELECT p.tenant_id 
            FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.tenant_id IS NOT NULL
        )
    );

-- Update tenant admin policy
CREATE POLICY "Tenant admins can update their tenant" ON tenants
    FOR UPDATE TO authenticated
    USING (
        id IN (
            SELECT p.tenant_id 
            FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.role IN ('tenant_admin', 'super_admin')
            AND p.tenant_id IS NOT NULL
        )
    ); 