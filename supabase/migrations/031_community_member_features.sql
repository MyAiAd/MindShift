-- ============================================================================
-- Migration 031: Community Member Features
-- ============================================================================
-- Adds member directory, blocking, and enhanced profiles
-- This migration is IDEMPOTENT - safe to run multiple times

-- Add community-specific profile fields (idempotent)
DO $$ 
BEGIN
    -- Add bio field
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'bio'
    ) THEN
        ALTER TABLE profiles ADD COLUMN bio TEXT;
    END IF;

    -- Add avatar_url field
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
    END IF;

    -- Add location field
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'location'
    ) THEN
        ALTER TABLE profiles ADD COLUMN location VARCHAR(255);
    END IF;

    -- Add website field
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'website'
    ) THEN
        ALTER TABLE profiles ADD COLUMN website VARCHAR(255);
    END IF;

    -- Add community_joined_at field (when they joined the community)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'community_joined_at'
    ) THEN
        ALTER TABLE profiles ADD COLUMN community_joined_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Add last_active_at field
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'last_active_at'
    ) THEN
        ALTER TABLE profiles ADD COLUMN last_active_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Create community_blocks table for blocking users (idempotent)
CREATE TABLE IF NOT EXISTS community_blocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    blocker_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    blocked_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent blocking yourself and duplicate blocks
    CHECK (blocker_id != blocked_id),
    UNIQUE(blocker_id, blocked_id)
);

-- Create indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_community_blocks_blocker ON community_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_community_blocks_blocked ON community_blocks(blocked_id);
CREATE INDEX IF NOT EXISTS idx_community_blocks_tenant ON community_blocks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON profiles(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_community_joined ON profiles(community_joined_at DESC);

-- Enable RLS on community_blocks (idempotent)
ALTER TABLE community_blocks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for community_blocks (idempotent with DROP IF EXISTS)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view their own blocks" ON community_blocks;
    DROP POLICY IF EXISTS "Users can create blocks" ON community_blocks;
    DROP POLICY IF EXISTS "Users can delete their own blocks" ON community_blocks;
    DROP POLICY IF EXISTS "Admins can view all blocks" ON community_blocks;

    CREATE POLICY "Users can view their own blocks"
    ON community_blocks FOR SELECT
    TO authenticated
    USING (blocker_id = auth.uid());

    CREATE POLICY "Users can create blocks"
    ON community_blocks FOR INSERT
    TO authenticated
    WITH CHECK (
        blocker_id = auth.uid() AND
        tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    );

    CREATE POLICY "Users can delete their own blocks"
    ON community_blocks FOR DELETE
    TO authenticated
    USING (blocker_id = auth.uid());

    CREATE POLICY "Admins can view all blocks"
    ON community_blocks FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'tenant_admin')
        )
    );
END $$;

-- Function to check if user A has blocked user B (idempotent)
CREATE OR REPLACE FUNCTION is_user_blocked(
    p_blocker_id UUID,
    p_blocked_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM community_blocks
        WHERE blocker_id = p_blocker_id
        AND blocked_id = p_blocked_id
    );
END;
$$;

-- Function to get member statistics (idempotent)
CREATE OR REPLACE FUNCTION get_member_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_post_count INTEGER;
    v_comment_count INTEGER;
    v_like_count INTEGER;
    v_member_since TIMESTAMPTZ;
BEGIN
    -- Count posts
    SELECT COUNT(*) INTO v_post_count
    FROM community_posts
    WHERE user_id = p_user_id AND status = 'published';

    -- Count comments
    SELECT COUNT(*) INTO v_comment_count
    FROM community_comments
    WHERE user_id = p_user_id AND status IN ('published', 'approved');

    -- Count likes received on posts
    SELECT COALESCE(SUM(like_count), 0) INTO v_like_count
    FROM community_posts
    WHERE user_id = p_user_id;

    -- Get member since date
    SELECT community_joined_at INTO v_member_since
    FROM profiles
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'post_count', v_post_count,
        'comment_count', v_comment_count,
        'like_count', v_like_count,
        'member_since', v_member_since
    );
END;
$$;

-- Trigger to update last_active_at when user posts or comments (idempotent)
CREATE OR REPLACE FUNCTION update_last_active()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE profiles
    SET last_active_at = NOW()
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$;

-- Create triggers (idempotent with DROP IF EXISTS)
DROP TRIGGER IF EXISTS update_last_active_on_post ON community_posts;
CREATE TRIGGER update_last_active_on_post
AFTER INSERT OR UPDATE ON community_posts
FOR EACH ROW
EXECUTE FUNCTION update_last_active();

DROP TRIGGER IF EXISTS update_last_active_on_comment ON community_comments;
CREATE TRIGGER update_last_active_on_comment
AFTER INSERT OR UPDATE ON community_comments
FOR EACH ROW
EXECUTE FUNCTION update_last_active();

-- Add helpful comments
COMMENT ON TABLE community_blocks IS 'Stores user blocking relationships for community features';
COMMENT ON COLUMN profiles.bio IS 'User bio/description for community profile';
COMMENT ON COLUMN profiles.avatar_url IS 'URL to user avatar image';
COMMENT ON COLUMN profiles.location IS 'User location (city, country)';
COMMENT ON COLUMN profiles.website IS 'User website or social link';
COMMENT ON COLUMN profiles.community_joined_at IS 'When user joined the community';
COMMENT ON COLUMN profiles.last_active_at IS 'Last time user was active in community';

