-- ============================================================================
-- Migration 017: Community Comments System
-- ============================================================================
-- This migration adds community comments functionality with:
-- 1. Comments table for post engagement
-- 2. Enhanced notification triggers for community activity
-- 3. Comment moderation features
-- 4. Nested comment support (replies)

-- Comment status enum
DO $$ BEGIN
    CREATE TYPE comment_status AS ENUM (
        'published',
        'pending_moderation',
        'approved',
        'rejected',
        'deleted'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Community activity notification types (extend existing message types)
DO $$ BEGIN
    ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'comment_on_post';
    ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'reply_to_comment';
    ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'post_liked';
    ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'comment_liked';
    ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'new_post_in_community';
EXCEPTION
    WHEN OTHERS THEN null;
END $$;

-- Comments table
CREATE TABLE IF NOT EXISTS community_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    parent_comment_id UUID REFERENCES community_comments(id) ON DELETE CASCADE, -- For replies
    content TEXT NOT NULL,
    status comment_status DEFAULT 'published',
    like_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    is_edited BOOLEAN DEFAULT FALSE,
    moderation_reason TEXT,
    moderated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    moderated_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comment likes table (for tracking who liked what)
CREATE TABLE IF NOT EXISTS community_comment_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    comment_id UUID REFERENCES community_comments(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(comment_id, user_id) -- Prevent duplicate likes
);

-- Post likes table (similar to comment likes)
CREATE TABLE IF NOT EXISTS community_post_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(post_id, user_id) -- Prevent duplicate likes
);

-- Community notification preferences (users can control what they want to be notified about)
CREATE TABLE IF NOT EXISTS community_notification_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    email_notifications BOOLEAN DEFAULT TRUE,
    in_app_notifications BOOLEAN DEFAULT TRUE,
    notify_on_comments BOOLEAN DEFAULT TRUE,
    notify_on_replies BOOLEAN DEFAULT TRUE,
    notify_on_likes BOOLEAN DEFAULT FALSE,
    notify_on_new_posts BOOLEAN DEFAULT FALSE,
    notify_on_mentions BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id) -- One preference set per user
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_community_comments_tenant_id ON community_comments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_post_id ON community_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_user_id ON community_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_parent_comment_id ON community_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_status ON community_comments(status);
CREATE INDEX IF NOT EXISTS idx_community_comments_created_at ON community_comments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_comment_likes_comment_id ON community_comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_community_comment_likes_user_id ON community_comment_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_community_comment_likes_tenant_id ON community_comment_likes(tenant_id);

CREATE INDEX IF NOT EXISTS idx_community_post_likes_post_id ON community_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_community_post_likes_user_id ON community_post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_community_post_likes_tenant_id ON community_post_likes(tenant_id);

CREATE INDEX IF NOT EXISTS idx_community_notification_preferences_user_id ON community_notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_community_notification_preferences_tenant_id ON community_notification_preferences(tenant_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_community_comments_post_status_created ON community_comments(post_id, status, created_at DESC)
    WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_community_comments_parent_created ON community_comments(parent_comment_id, created_at DESC)
    WHERE parent_comment_id IS NOT NULL;

-- Enable RLS on all tables
ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_notification_preferences ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies for community_comments
-- ============================================================================

-- Users can view published comments on posts they can see
CREATE POLICY "Users can view published comments in their tenant" ON community_comments
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
        ) AND 
        (status = 'published' OR 
         status = 'approved' OR
         user_id = auth.uid()) -- Authors can see their own comments regardless of status
    );

-- Users can create comments on posts they can see
CREATE POLICY "Users can create comments in their tenant" ON community_comments
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
        ) AND
        EXISTS (
            SELECT 1 FROM community_posts 
            WHERE id = community_comments.post_id 
            AND status = 'published'
        )
    );

-- Users can update their own comments
CREATE POLICY "Users can update their own comments" ON community_comments
    FOR UPDATE USING (
        user_id = auth.uid()
    );

-- Users can delete their own comments (soft delete)
CREATE POLICY "Users can delete their own comments" ON community_comments
    FOR DELETE USING (
        user_id = auth.uid()
    );

-- Tenant admins can moderate comments in their tenant
CREATE POLICY "Tenant admins can moderate comments in their tenant" ON community_comments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('tenant_admin', 'manager')
            AND tenant_id = community_comments.tenant_id
        )
    );

-- Super admins can manage all comments
CREATE POLICY "Super admins can manage all comments" ON community_comments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- ============================================================================
-- RLS Policies for community_comment_likes
-- ============================================================================

-- Users can view comment likes in their tenant
CREATE POLICY "Users can view comment likes in their tenant" ON community_comment_likes
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
        )
    );

-- Users can like/unlike comments
CREATE POLICY "Users can manage their own comment likes" ON community_comment_likes
    FOR ALL USING (
        user_id = auth.uid() AND
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
        )
    );

-- ============================================================================
-- RLS Policies for community_post_likes
-- ============================================================================

-- Users can view post likes in their tenant
CREATE POLICY "Users can view post likes in their tenant" ON community_post_likes
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
        )
    );

-- Users can like/unlike posts
CREATE POLICY "Users can manage their own post likes" ON community_post_likes
    FOR ALL USING (
        user_id = auth.uid() AND
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
        )
    );

-- ============================================================================
-- RLS Policies for community_notification_preferences
-- ============================================================================

-- Users can view their own notification preferences
CREATE POLICY "Users can view their own notification preferences" ON community_notification_preferences
    FOR SELECT USING (
        user_id = auth.uid()
    );

-- Users can manage their own notification preferences
CREATE POLICY "Users can manage their own notification preferences" ON community_notification_preferences
    FOR ALL USING (
        user_id = auth.uid()
    );

-- Tenant admins can view notification preferences in their tenant
CREATE POLICY "Tenant admins can view tenant notification preferences" ON community_notification_preferences
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('tenant_admin', 'super_admin')
            AND tenant_id = community_notification_preferences.tenant_id
        )
    );

-- ============================================================================
-- Triggers and Functions for Community Activity
-- ============================================================================

-- Auto-update timestamps
CREATE TRIGGER update_community_comments_updated_at
    BEFORE UPDATE ON community_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_community_notification_preferences_updated_at
    BEFORE UPDATE ON community_notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update post comment count when comments are added/removed
CREATE OR REPLACE FUNCTION update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment comment count for the post
        UPDATE community_posts 
        SET comment_count = comment_count + 1 
        WHERE id = NEW.post_id;
        
        -- If this is a reply, increment reply count for parent comment
        IF NEW.parent_comment_id IS NOT NULL THEN
            UPDATE community_comments 
            SET reply_count = reply_count + 1 
            WHERE id = NEW.parent_comment_id;
        END IF;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement comment count for the post
        UPDATE community_posts 
        SET comment_count = GREATEST(comment_count - 1, 0) 
        WHERE id = OLD.post_id;
        
        -- If this was a reply, decrement reply count for parent comment
        IF OLD.parent_comment_id IS NOT NULL THEN
            UPDATE community_comments 
            SET reply_count = GREATEST(reply_count - 1, 0) 
            WHERE id = OLD.parent_comment_id;
        END IF;
        
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_post_comment_count_trigger
    AFTER INSERT OR DELETE ON community_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_post_comment_count();

-- Update comment like count when likes are added/removed
CREATE OR REPLACE FUNCTION update_comment_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE community_comments 
        SET like_count = like_count + 1 
        WHERE id = NEW.comment_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE community_comments 
        SET like_count = GREATEST(like_count - 1, 0) 
        WHERE id = OLD.comment_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_comment_like_count_trigger
    AFTER INSERT OR DELETE ON community_comment_likes
    FOR EACH ROW
    EXECUTE FUNCTION update_comment_like_count();

-- Update post like count when likes are added/removed
CREATE OR REPLACE FUNCTION update_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE community_posts 
        SET like_count = like_count + 1 
        WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE community_posts 
        SET like_count = GREATEST(like_count - 1, 0) 
        WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_post_like_count_trigger
    AFTER INSERT OR DELETE ON community_post_likes
    FOR EACH ROW
    EXECUTE FUNCTION update_post_like_count();

-- Function to send community notifications (integrates with existing messaging system)
CREATE OR REPLACE FUNCTION send_community_notification(
    p_tenant_id UUID,
    p_recipient_id UUID,
    p_sender_id UUID,
    p_message_type message_type,
    p_subject VARCHAR(255),
    p_content TEXT,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    notification_id UUID;
    user_prefs RECORD;
BEGIN
    -- Check if recipient wants this type of notification
    SELECT * INTO user_prefs 
    FROM community_notification_preferences 
    WHERE user_id = p_recipient_id;
    
    -- If no preferences found, use defaults (create them)
    IF NOT FOUND THEN
        INSERT INTO community_notification_preferences (
            tenant_id, user_id, 
            email_notifications, in_app_notifications,
            notify_on_comments, notify_on_replies, notify_on_likes, notify_on_new_posts
        ) VALUES (
            p_tenant_id, p_recipient_id,
            TRUE, TRUE, TRUE, TRUE, FALSE, FALSE
        );
        
        -- Set default preferences
        user_prefs.notify_on_comments := TRUE;
        user_prefs.notify_on_replies := TRUE;
        user_prefs.notify_on_likes := FALSE;
        user_prefs.notify_on_new_posts := FALSE;
        user_prefs.in_app_notifications := TRUE;
    END IF;
    
    -- Check if user wants this specific notification type
    IF (p_message_type = 'comment_on_post' AND NOT user_prefs.notify_on_comments) OR
       (p_message_type = 'reply_to_comment' AND NOT user_prefs.notify_on_replies) OR
       (p_message_type IN ('post_liked', 'comment_liked') AND NOT user_prefs.notify_on_likes) OR
       (p_message_type = 'new_post_in_community' AND NOT user_prefs.notify_on_new_posts) THEN
        RETURN NULL; -- User doesn't want this notification
    END IF;
    
    -- Don't notify users about their own actions
    IF p_recipient_id = p_sender_id THEN
        RETURN NULL;
    END IF;
    
    -- Send in-app notification if enabled
    IF user_prefs.in_app_notifications THEN
        -- Use existing client_messages table for in-app notifications
        INSERT INTO client_messages (
            tenant_id, sender_id, receiver_id, message_type,
            subject, message_content, metadata
        ) VALUES (
            p_tenant_id, p_sender_id, p_recipient_id, p_message_type,
            p_subject, p_content, p_metadata
        ) RETURNING id INTO notification_id;
    END IF;
    
    RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to send notifications when comments are created
CREATE OR REPLACE FUNCTION notify_on_comment_created()
RETURNS TRIGGER AS $$
DECLARE
    post_author_id UUID;
    post_title VARCHAR(255);
    commenter_name VARCHAR(255);
    parent_comment_author_id UUID;
BEGIN
    -- Get post details and author
    SELECT user_id, title INTO post_author_id, post_title
    FROM community_posts 
    WHERE id = NEW.post_id;
    
    -- Get commenter name
    SELECT COALESCE(first_name || ' ' || last_name, email) INTO commenter_name
    FROM profiles 
    WHERE id = NEW.user_id;
    
    -- Notify post author about new comment (if not a reply)
    IF NEW.parent_comment_id IS NULL THEN
        PERFORM send_community_notification(
            NEW.tenant_id,
            post_author_id,
            NEW.user_id,
            'comment_on_post',
            'New comment on your post',
            commenter_name || ' commented on your post "' || post_title || '"',
            jsonb_build_object(
                'post_id', NEW.post_id,
                'comment_id', NEW.id,
                'post_title', post_title
            )
        );
    ELSE
        -- This is a reply - notify the parent comment author
        SELECT user_id INTO parent_comment_author_id
        FROM community_comments 
        WHERE id = NEW.parent_comment_id;
        
        PERFORM send_community_notification(
            NEW.tenant_id,
            parent_comment_author_id,
            NEW.user_id,
            'reply_to_comment',
            'Someone replied to your comment',
            commenter_name || ' replied to your comment on "' || post_title || '"',
            jsonb_build_object(
                'post_id', NEW.post_id,
                'comment_id', NEW.id,
                'parent_comment_id', NEW.parent_comment_id,
                'post_title', post_title
            )
        );
        
        -- Also notify the post author if different from parent comment author
        IF post_author_id != parent_comment_author_id THEN
            PERFORM send_community_notification(
                NEW.tenant_id,
                post_author_id,
                NEW.user_id,
                'comment_on_post',
                'New reply on your post',
                commenter_name || ' replied to a comment on your post "' || post_title || '"',
                jsonb_build_object(
                    'post_id', NEW.post_id,
                    'comment_id', NEW.id,
                    'parent_comment_id', NEW.parent_comment_id,
                    'post_title', post_title
                )
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notify_on_comment_created_trigger
    AFTER INSERT ON community_comments
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_comment_created();

-- Trigger to send notifications when posts are liked
CREATE OR REPLACE FUNCTION notify_on_post_liked()
RETURNS TRIGGER AS $$
DECLARE
    post_author_id UUID;
    post_title VARCHAR(255);
    liker_name VARCHAR(255);
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Get post details and author
        SELECT user_id, title INTO post_author_id, post_title
        FROM community_posts 
        WHERE id = NEW.post_id;
        
        -- Get liker name
        SELECT COALESCE(first_name || ' ' || last_name, email) INTO liker_name
        FROM profiles 
        WHERE id = NEW.user_id;
        
        -- Notify post author about the like
        PERFORM send_community_notification(
            NEW.tenant_id,
            post_author_id,
            NEW.user_id,
            'post_liked',
            'Someone liked your post',
            liker_name || ' liked your post "' || post_title || '"',
            jsonb_build_object(
                'post_id', NEW.post_id,
                'post_title', post_title
            )
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notify_on_post_liked_trigger
    AFTER INSERT ON community_post_likes
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_post_liked();

-- Set is_edited flag when comment content is updated
CREATE OR REPLACE FUNCTION mark_comment_as_edited()
RETURNS TRIGGER AS $$
BEGIN
    -- If content changed, mark as edited
    IF OLD.content != NEW.content THEN
        NEW.is_edited = TRUE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mark_comment_as_edited_trigger
    BEFORE UPDATE ON community_comments
    FOR EACH ROW
    EXECUTE FUNCTION mark_comment_as_edited(); 