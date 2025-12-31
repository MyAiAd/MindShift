-- ============================================================================
-- Migration 048: Idempotent Community Tags RLS Fix
-- ============================================================================
-- This migration safely updates community_tags RLS policies to fix tag creation
-- for super_admin users and ensure proper tenant isolation.
-- This migration is IDEMPOTENT - it can be run multiple times safely.
--
-- Fixes:
-- 1. Super admin users with NULL tenant_id can create tags
-- 2. Proper WITH CHECK clauses for INSERT operations
-- 3. JWT-based super_admin detection to avoid RLS recursion
-- 4. Tenant admin and manager permissions
-- ============================================================================

-- Drop all existing policies (idempotent - won't fail if they don't exist)
DO $$ 
BEGIN
    -- Drop policies if they exist
    DROP POLICY IF EXISTS "Users can view tags in their tenant" ON community_tags;
    DROP POLICY IF EXISTS "Users can create tags in their tenant" ON community_tags;
    DROP POLICY IF EXISTS "Users can update their own tags" ON community_tags;
    DROP POLICY IF EXISTS "Users can update their own created tags" ON community_tags;
    DROP POLICY IF EXISTS "Tenant admins can manage tags in their tenant" ON community_tags;
    DROP POLICY IF EXISTS "Super admins can manage all tags" ON community_tags;
    
    -- Log the action
    RAISE NOTICE 'Dropped existing community_tags RLS policies';
END $$;

-- ============================================================================
-- Recreate all policies with proper constraints
-- ============================================================================

-- Policy 1: Users can view tags in their tenant
-- Any authenticated user can see tags from their tenant
CREATE POLICY "Users can view tags in their tenant" ON community_tags
    FOR SELECT 
    USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
        )
    );

COMMENT ON POLICY "Users can view tags in their tenant" ON community_tags IS 
    'Allows users to view all tags within their tenant';

-- ============================================================================
-- Policy 2: Users can create tags in their tenant
-- Regular users can create tags, but only in their own tenant
CREATE POLICY "Users can create tags in their tenant" ON community_tags
    FOR INSERT 
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
            AND tenant_id IS NOT NULL
        )
    );

COMMENT ON POLICY "Users can create tags in their tenant" ON community_tags IS 
    'Allows users to create tags in their tenant (requires non-null tenant_id)';

-- ============================================================================
-- Policy 3: Users can update their own created tags
-- Users can only update tags they created, and can't change the tenant
CREATE POLICY "Users can update their own tags" ON community_tags
    FOR UPDATE 
    USING (
        created_by = auth.uid()
    ) 
    WITH CHECK (
        created_by = auth.uid() AND
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
        )
    );

COMMENT ON POLICY "Users can update their own tags" ON community_tags IS 
    'Allows users to update tags they created, but not change tenant ownership';

-- ============================================================================
-- Policy 4: Tenant admins can manage all tags in their tenant
-- Tenant admins and managers have full control over tags in their tenant
CREATE POLICY "Tenant admins can manage tags in their tenant" ON community_tags
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('tenant_admin', 'manager')
            AND tenant_id = community_tags.tenant_id
            AND tenant_id IS NOT NULL
        )
    )
    WITH CHECK (
        -- For INSERT/UPDATE: Must be admin/manager and tag must be in their tenant
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('tenant_admin', 'manager')
            AND tenant_id IS NOT NULL
        ) 
        AND 
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
        )
    );

COMMENT ON POLICY "Tenant admins can manage tags in their tenant" ON community_tags IS 
    'Allows tenant_admin and manager roles to fully manage tags within their tenant';

-- ============================================================================
-- Policy 5: Super admins can manage all tags across all tenants
-- Super admins have unrestricted access to all tags
-- Uses JWT claim check first to avoid RLS recursion issues
CREATE POLICY "Super admins can manage all tags" ON community_tags
    FOR ALL 
    USING (
        -- Check JWT claims first (faster, no recursion risk)
        (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin'
        OR
        -- Fallback to database check
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
    )
    WITH CHECK (
        -- Super admins can create tags in any tenant (even with NULL tenant_id in profile)
        (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin'
        OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
    );

COMMENT ON POLICY "Super admins can manage all tags" ON community_tags IS 
    'Allows super_admin role unrestricted access to all tags across all tenants. Uses JWT check to avoid RLS recursion.';

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this to verify the policies were created correctly:
-- 
-- SELECT 
--     schemaname,
--     tablename,
--     policyname,
--     permissive,
--     roles,
--     cmd,
--     qual,
--     with_check
-- FROM pg_policies 
-- WHERE tablename = 'community_tags'
-- ORDER BY policyname;
-- ============================================================================

-- Log success
DO $$ 
BEGIN
    RAISE NOTICE '✓ Migration 048 completed successfully';
    RAISE NOTICE '✓ Created 5 RLS policies for community_tags table';
    RAISE NOTICE '✓ Policies are idempotent and support super_admin with NULL tenant_id';
END $$;
