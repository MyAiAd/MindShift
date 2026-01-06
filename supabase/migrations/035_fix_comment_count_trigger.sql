-- ============================================================================
-- Migration 035: Fix Comment Count Trigger
-- ============================================================================
-- Ensures comment_count on posts updates automatically when comments are added/deleted
-- This migration is IDEMPOTENT - safe to run multiple times

-- Drop and recreate the function to ensure it's up to date
CREATE OR REPLACE FUNCTION update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment comment count for the post
        UPDATE community_posts 
        SET comment_count = comment_count + 1,
            updated_at = NOW()
        WHERE id = NEW.post_id;
        
        -- If this is a reply, increment reply count for parent comment
        IF NEW.parent_comment_id IS NOT NULL THEN
            UPDATE community_comments 
            SET reply_count = reply_count + 1,
                updated_at = NOW()
            WHERE id = NEW.parent_comment_id;
        END IF;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement comment count for the post
        UPDATE community_posts 
        SET comment_count = GREATEST(comment_count - 1, 0),
            updated_at = NOW()
        WHERE id = OLD.post_id;
        
        -- If this was a reply, decrement reply count for parent comment
        IF OLD.parent_comment_id IS NOT NULL THEN
            UPDATE community_comments 
            SET reply_count = GREATEST(reply_count - 1, 0),
                updated_at = NOW()
            WHERE id = OLD.parent_comment_id;
        END IF;
        
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the trigger to ensure it's active
DROP TRIGGER IF EXISTS update_post_comment_count_trigger ON community_comments;
CREATE TRIGGER update_post_comment_count_trigger
    AFTER INSERT OR DELETE ON community_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_post_comment_count();

-- Fix any posts that have incorrect comment counts
-- This counts actual comments and updates the post
UPDATE community_posts
SET comment_count = (
    SELECT COUNT(*)
    FROM community_comments
    WHERE community_comments.post_id = community_posts.id
    AND community_comments.status IN ('published', 'approved')
)
WHERE id IN (
    SELECT DISTINCT post_id 
    FROM community_comments
);

-- Set comment_count to 0 for posts with no comments (if any are NULL)
UPDATE community_posts
SET comment_count = 0
WHERE comment_count IS NULL;

-- Ensure comment_count defaults to 0 for new posts
ALTER TABLE community_posts
ALTER COLUMN comment_count SET DEFAULT 0;

-- Add a check to ensure comment_count is never negative
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'community_posts_comment_count_check'
    ) THEN
        ALTER TABLE community_posts
        ADD CONSTRAINT community_posts_comment_count_check 
        CHECK (comment_count >= 0);
    END IF;
END $$;

-- Add helpful comment
COMMENT ON FUNCTION update_post_comment_count() IS 
'Automatically updates comment_count on posts when comments are added or deleted. Runs as SECURITY DEFINER to bypass RLS.';

-- Log success
DO $$
BEGIN
    RAISE NOTICE 'Migration 035 completed: Comment count trigger recreated and existing counts fixed';
END $$;

