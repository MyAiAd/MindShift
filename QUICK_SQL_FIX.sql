-- ============================================================================
-- QUICK FIX: Copy and paste this entire file into Supabase SQL Editor
-- ============================================================================
-- This is migration 048 - Idempotent Community Tags RLS Fix
-- Safe to run multiple times, fixes tag creation for super_admin users
-- ============================================================================

-- Drop all existing policies (safe - won't fail if they don't exist)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view tags in their tenant" ON community_tags;
    DROP POLICY IF EXISTS "Users can create tags in their tenant" ON community_tags;
    DROP POLICY IF EXISTS "Users can update their own tags" ON community_tags;
    DROP POLICY IF EXISTS "Users can update their own created tags" ON community_tags;
    DROP POLICY IF EXISTS "Tenant admins can manage tags in their tenant" ON community_tags;
    DROP POLICY IF EXISTS "Super admins can manage all tags" ON community_tags;
    RAISE NOTICE '✓ Dropped existing community_tags RLS policies';
END $$;

-- Policy 1: Users can view tags in their tenant
CREATE POLICY "Users can view tags in their tenant" ON community_tags
    FOR SELECT 
    USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
        )
    );

-- Policy 2: Users can create tags in their tenant
CREATE POLICY "Users can create tags in their tenant" ON community_tags
    FOR INSERT 
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
            AND tenant_id IS NOT NULL
        )
    );

-- Policy 3: Users can update their own created tags
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

-- Policy 4: Tenant admins can manage all tags in their tenant
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

-- Policy 5: Super admins can manage all tags (with JWT check to avoid recursion)
CREATE POLICY "Super admins can manage all tags" ON community_tags
    FOR ALL 
    USING (
        (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin'
        OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
    )
    WITH CHECK (
        (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin'
        OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
    );

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE '✓ Migration 048 completed successfully';
    RAISE NOTICE '✓ Created 5 RLS policies for community_tags table';
    RAISE NOTICE '✓ Tag creation should now work for super_admin users';
END $$;

-- ============================================================================
-- VERIFICATION: Run this to confirm policies were created
-- ============================================================================
-- SELECT policyname, cmd 
-- FROM pg_policies 
-- WHERE tablename = 'community_tags'
-- ORDER BY policyname;
-- 
-- Expected: 5 policies listed
-- ============================================================================
