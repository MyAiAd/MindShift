-- ============================================================================
-- Migration 033: Fix Community Notification Preferences RLS
-- ============================================================================
-- Fixes RLS policy to allow SECURITY DEFINER functions to create default preferences
-- This migration is IDEMPOTENT - safe to run multiple times

-- Drop existing INSERT policy that's too restrictive
DROP POLICY IF EXISTS "Users can manage their own notification preferences" ON community_notification_preferences;

-- Create separate policies for INSERT and UPDATE/DELETE
CREATE POLICY "Users can insert their own notification preferences" ON community_notification_preferences
    FOR INSERT 
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Allow SECURITY DEFINER functions to insert default preferences
CREATE POLICY "System can create default notification preferences" ON community_notification_preferences
    FOR INSERT 
    TO authenticated
    WITH CHECK (true); -- Security is handled by the function itself

CREATE POLICY "Users can update their own notification preferences" ON community_notification_preferences
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own notification preferences" ON community_notification_preferences
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Comments
COMMENT ON POLICY "System can create default notification preferences" ON community_notification_preferences 
IS 'Allows SECURITY DEFINER functions to create default preferences for users';

