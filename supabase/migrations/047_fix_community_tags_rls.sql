-- ============================================================================
-- Migration 047: Fix Community Tags RLS Policies
-- ============================================================================
-- This migration fixes the RLS policies for community_tags to ensure
-- tenant admins and super admins can properly create tags

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view tags in their tenant" ON community_tags;
DROP POLICY IF EXISTS "Users can create tags in their tenant" ON community_tags;
DROP POLICY IF EXISTS "Users can update their own tags" ON community_tags;
DROP POLICY IF EXISTS "Tenant admins can manage tags in their tenant" ON community_tags;
DROP POLICY IF EXISTS "Super admins can manage all tags" ON community_tags;

-- Recreate policies with explicit WITH CHECK clauses

-- Users can view tags in their tenant
CREATE POLICY "Users can view tags in their tenant" ON community_tags
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
        )
    );

-- Users can create tags in their tenant
CREATE POLICY "Users can create tags in their tenant" ON community_tags
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
        )
    );

-- Users can update their own created tags
CREATE POLICY "Users can update their own tags" ON community_tags
    FOR UPDATE USING (
        created_by = auth.uid()
    ) WITH CHECK (
        created_by = auth.uid() AND
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
        )
    );

-- Tenant admins can manage all tags in their tenant
CREATE POLICY "Tenant admins can manage tags in their tenant" ON community_tags
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('tenant_admin', 'manager')
            AND tenant_id = community_tags.tenant_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('tenant_admin', 'manager')
        ) AND
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
        )
    );

-- Super admins can manage all tags
CREATE POLICY "Super admins can manage all tags" ON community_tags
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );
