-- ============================================================================
-- Migration 016: Community Posts System
-- ============================================================================
-- This migration adds community posts functionality with:
-- 1. Posts table for user-generated content
-- 2. Tags table for content categorization  
-- 3. Post_tags junction table for many-to-many relationship
-- 4. Proper RLS for tenant isolation
-- 5. Indexes for performance

-- Post status enum
DO $$ BEGIN
    CREATE TYPE post_status AS ENUM (
        'draft',
        'published', 
        'scheduled',
        'archived',
        'deleted'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Posts table
CREATE TABLE IF NOT EXISTS community_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    status post_status DEFAULT 'published',
    is_pinned BOOLEAN DEFAULT FALSE,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE
);

-- Tags table  
CREATE TABLE IF NOT EXISTS community_tags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7), -- Hex color code
    use_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id, name) -- Unique tag names per tenant
);

-- Post-Tags junction table (many-to-many)
CREATE TABLE IF NOT EXISTS community_post_tags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE NOT NULL,
    tag_id UUID REFERENCES community_tags(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(post_id, tag_id) -- Prevent duplicate tag assignments
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_community_posts_tenant_id ON community_posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_user_id ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_status ON community_posts(status);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_published_at ON community_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_is_pinned ON community_posts(is_pinned);
CREATE INDEX IF NOT EXISTS idx_community_posts_scheduled_at ON community_posts(scheduled_at);

-- Full text search index on posts content
CREATE INDEX IF NOT EXISTS idx_community_posts_search ON community_posts USING gin(to_tsvector('english', title || ' ' || content));

CREATE INDEX IF NOT EXISTS idx_community_tags_tenant_id ON community_tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_community_tags_name ON community_tags(name);
CREATE INDEX IF NOT EXISTS idx_community_tags_use_count ON community_tags(use_count DESC);

CREATE INDEX IF NOT EXISTS idx_community_post_tags_post_id ON community_post_tags(post_id);
CREATE INDEX IF NOT EXISTS idx_community_post_tags_tag_id ON community_post_tags(tag_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_community_posts_tenant_status_published ON community_posts(tenant_id, status, published_at DESC) 
    WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_community_posts_tenant_pinned_published ON community_posts(tenant_id, is_pinned, published_at DESC) 
    WHERE status = 'published';

-- Enable RLS on all tables
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_post_tags ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies for community_posts
-- ============================================================================

-- Users can view published posts in their tenant
CREATE POLICY "Users can view published posts in their tenant" ON community_posts
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
        ) AND 
        (status = 'published' OR 
         (status = 'scheduled' AND scheduled_at <= NOW()) OR
         user_id = auth.uid()) -- Authors can see their own drafts
    );

-- Users can create posts in their tenant
CREATE POLICY "Users can create posts in their tenant" ON community_posts
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
        )
    );

-- Users can update their own posts
CREATE POLICY "Users can update their own posts" ON community_posts
    FOR UPDATE USING (
        user_id = auth.uid()
    );

-- Users can delete their own posts (soft delete by setting status)
CREATE POLICY "Users can delete their own posts" ON community_posts
    FOR DELETE USING (
        user_id = auth.uid()
    );

-- Tenant admins can manage all posts in their tenant
CREATE POLICY "Tenant admins can manage all posts in their tenant" ON community_posts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('tenant_admin', 'manager')
            AND tenant_id = community_posts.tenant_id
        )
    );

-- Super admins can manage all posts
CREATE POLICY "Super admins can manage all posts" ON community_posts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- ============================================================================
-- RLS Policies for community_tags
-- ============================================================================

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

-- Tenant admins can manage tags in their tenant
CREATE POLICY "Tenant admins can manage tags in their tenant" ON community_tags
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('tenant_admin', 'manager')
            AND tenant_id = community_tags.tenant_id
        )
    );

-- Super admins can manage all tags
CREATE POLICY "Super admins can manage all tags" ON community_tags
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- ============================================================================
-- RLS Policies for community_post_tags
-- ============================================================================

-- Users can view post-tag relationships for posts they can see
CREATE POLICY "Users can view post-tag relationships" ON community_post_tags
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM community_posts 
            WHERE id = community_post_tags.post_id
            AND tenant_id IN (
                SELECT tenant_id FROM profiles 
                WHERE id = auth.uid()
            )
        )
    );

-- Users can create post-tag relationships for their own posts
CREATE POLICY "Users can create post-tag relationships for their posts" ON community_post_tags
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM community_posts 
            WHERE id = community_post_tags.post_id
            AND user_id = auth.uid()
        )
    );

-- Users can delete post-tag relationships for their own posts
CREATE POLICY "Users can delete post-tag relationships for their posts" ON community_post_tags
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM community_posts 
            WHERE id = community_post_tags.post_id
            AND user_id = auth.uid()
        )
    );

-- Tenant admins can manage post-tag relationships in their tenant
CREATE POLICY "Tenant admins can manage post-tag relationships" ON community_post_tags
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM community_posts 
            JOIN profiles ON profiles.id = auth.uid()
            WHERE community_posts.id = community_post_tags.post_id
            AND profiles.role IN ('tenant_admin', 'manager')
            AND community_posts.tenant_id = profiles.tenant_id
        )
    );

-- Super admins can manage all post-tag relationships
CREATE POLICY "Super admins can manage all post-tag relationships" ON community_post_tags
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- ============================================================================
-- Triggers for automation
-- ============================================================================

-- Auto-update timestamps
CREATE TRIGGER update_community_posts_updated_at
    BEFORE UPDATE ON community_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_community_tags_updated_at
    BEFORE UPDATE ON community_tags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-set published_at when status changes to published
CREATE OR REPLACE FUNCTION set_published_at()
RETURNS TRIGGER AS $$
BEGIN
    -- Set published_at when status changes to published
    IF NEW.status = 'published' AND OLD.status != 'published' THEN
        NEW.published_at = NOW();
    END IF;
    
    -- Clear published_at when status changes away from published
    IF NEW.status != 'published' AND OLD.status = 'published' THEN
        NEW.published_at = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_post_published_at
    BEFORE UPDATE ON community_posts
    FOR EACH ROW
    EXECUTE FUNCTION set_published_at();

-- Update tag use_count when post-tag relationships change
CREATE OR REPLACE FUNCTION update_tag_use_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE community_tags 
        SET use_count = use_count + 1 
        WHERE id = NEW.tag_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE community_tags 
        SET use_count = GREATEST(use_count - 1, 0) 
        WHERE id = OLD.tag_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tag_use_count_trigger
    AFTER INSERT OR DELETE ON community_post_tags
    FOR EACH ROW
    EXECUTE FUNCTION update_tag_use_count(); 