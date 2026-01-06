-- Migration 034: Fix notification preferences duplicate key issue
-- This fixes the duplicate key constraint violation when creating default preferences

-- Drop and recreate the send_community_notification function with ON CONFLICT handling
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
    
    -- If no preferences found, use defaults (create them with ON CONFLICT)
    IF NOT FOUND THEN
        INSERT INTO community_notification_preferences (
            tenant_id, user_id, 
            email_notifications, in_app_notifications,
            notify_on_comments, notify_on_replies, notify_on_likes, notify_on_new_posts
        ) VALUES (
            p_tenant_id, p_recipient_id,
            TRUE, TRUE, TRUE, TRUE, FALSE, FALSE
        )
        ON CONFLICT (user_id) DO NOTHING;
        
        -- Fetch the preferences (either just created or already existing)
        SELECT * INTO user_prefs 
        FROM community_notification_preferences 
        WHERE user_id = p_recipient_id;
        
        -- If still not found (shouldn't happen), set defaults manually
        IF NOT FOUND THEN
            user_prefs.notify_on_comments := TRUE;
            user_prefs.notify_on_replies := TRUE;
            user_prefs.notify_on_likes := FALSE;
            user_prefs.notify_on_new_posts := FALSE;
            user_prefs.in_app_notifications := TRUE;
        END IF;
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
    
    -- Create the in-app notification
    IF user_prefs.in_app_notifications THEN
        INSERT INTO messages (
            tenant_id, user_id, message_type, sender_id,
            subject, message, metadata, status, priority
        ) VALUES (
            p_tenant_id, p_recipient_id, p_message_type, p_sender_id,
            p_subject, p_content, p_metadata, 'unread', 'normal'
        )
        RETURNING id INTO notification_id;
    END IF;
    
    -- TODO: Send email notification if enabled
    -- This would be handled by a separate email service
    
    RETURN notification_id;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the main operation
        RAISE WARNING 'Error sending notification: %', SQLERRM;
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION send_community_notification TO authenticated;

-- Add a comment to document the function
COMMENT ON FUNCTION send_community_notification IS 
'Sends community notifications (in-app and optionally email) to users based on their preferences. Handles duplicate preference creation gracefully with ON CONFLICT.';

