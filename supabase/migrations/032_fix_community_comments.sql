-- ============================================================================
-- Migration 032: Fix Community Comments
-- ============================================================================
-- Fixes comment creation and display issues
-- This migration is IDEMPOTENT - safe to run multiple times

-- Verify and fix RLS policies for community_comments
DO $$ 
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view published comments in their tenant" ON community_comments;
    DROP POLICY IF EXISTS "Users can create comments in their tenant" ON community_comments;
    DROP POLICY IF EXISTS "Users can update their own comments" ON community_comments;
    DROP POLICY IF EXISTS "Users can delete their own comments" ON community_comments;
    DROP POLICY IF EXISTS "Admins can manage all comments in their tenant" ON community_comments;
    DROP POLICY IF EXISTS "Tenant admins can manage comments in their tenant" ON community_comments;
    DROP POLICY IF EXISTS "Super admins can manage all comments" ON community_comments;

    -- Create comprehensive SELECT policy (simplified for better performance)
    CREATE POLICY "Users can view published comments in their tenant"
    ON community_comments FOR SELECT
    TO authenticated
    USING (
        -- Users can see published/approved comments in their tenant
        (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        AND status IN ('published', 'approved'))
        OR
        -- Super admins can see everything
        (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
    );

    -- Create INSERT policy (allow users to create comments)
    CREATE POLICY "Users can create comments in their tenant"
    ON community_comments FOR INSERT
    TO authenticated
    WITH CHECK (
        -- User must be creating with their own ID
        user_id = auth.uid() 
        AND
        -- Must be in their tenant
        tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        AND
        -- Post must exist and be published
        EXISTS (
            SELECT 1 FROM community_posts 
            WHERE id = community_comments.post_id 
            AND status = 'published'
            AND (
                -- Post is in same tenant
                tenant_id = community_comments.tenant_id
                OR
                -- Or super admin
                EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
            )
        )
    );

    -- Create UPDATE policy (users can edit their own comments)
    CREATE POLICY "Users can update their own comments"
    ON community_comments FOR UPDATE
    TO authenticated
    USING (
        -- Own comments
        user_id = auth.uid()
        OR
        -- Or admin in same tenant
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('tenant_admin', 'manager')
            AND tenant_id = community_comments.tenant_id
        )
        OR
        -- Or super admin
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

    -- Create DELETE policy (users can delete their own comments)
    CREATE POLICY "Users can delete their own comments"
    ON community_comments FOR DELETE
    TO authenticated
    USING (
        -- Own comments
        user_id = auth.uid()
        OR
        -- Or admin in same tenant
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('tenant_admin', 'manager')
            AND tenant_id = community_comments.tenant_id
        )
        OR
        -- Or super admin
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

END $$;

-- Add index for better performance on post queries
CREATE INDEX IF NOT EXISTS idx_community_comments_post_status 
ON community_comments(post_id, status) 
WHERE status IN ('published', 'approved');

-- Add index for user's own comments
CREATE INDEX IF NOT EXISTS idx_community_comments_user_id 
ON community_comments(user_id);

-- Ensure status defaults to 'published' for regular users
ALTER TABLE community_comments 
ALTER COLUMN status SET DEFAULT 'published';

-- Add helpful comment
COMMENT ON TABLE community_comments IS 'Community post comments with simplified RLS for better performance';

