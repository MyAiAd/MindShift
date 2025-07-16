-- ============================================================================
-- Migration 014: Client Messaging System
-- ============================================================================
-- This migration adds a messaging system for client communication with:
-- 1. Messages table with sender/receiver model
-- 2. Proper RLS for dual access (sender AND receiver can see messages)
-- 3. Super admin can see all messages across tenants
-- 4. Tenant admins can see messages within their tenant

-- Message types enum
DO $$ BEGIN
    CREATE TYPE message_type AS ENUM (
        'direct_message',
        'system_notification', 
        'automated_reminder',
        'goal_checkin',
        'session_reminder',
        'progress_update'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Message status enum  
DO $$ BEGIN
    CREATE TYPE message_status AS ENUM (
        'sent',
        'delivered', 
        'read',
        'archived'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Client Messages Table
CREATE TABLE IF NOT EXISTS client_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    message_type message_type DEFAULT 'direct_message',
    subject VARCHAR(255),
    message_content TEXT NOT NULL,
    status message_status DEFAULT 'sent',
    template_used VARCHAR(100), -- Track which template was used if any
    metadata JSONB DEFAULT '{}', -- Store additional context like goal_id, session_id, etc.
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ
);

-- Message Threads Table (for grouping related messages)
CREATE TABLE IF NOT EXISTS message_threads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    participant_1_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    participant_2_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    thread_subject VARCHAR(255),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique thread per participant pair (regardless of order)
    UNIQUE(tenant_id, participant_1_id, participant_2_id)
);

-- Link messages to threads
ALTER TABLE client_messages 
ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES message_threads(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_messages_tenant_id ON client_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_messages_sender_id ON client_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_client_messages_receiver_id ON client_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_client_messages_thread_id ON client_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_client_messages_created_at ON client_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_messages_status ON client_messages(status);
CREATE INDEX IF NOT EXISTS idx_client_messages_type ON client_messages(message_type);

CREATE INDEX IF NOT EXISTS idx_message_threads_tenant_id ON message_threads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_participant_1 ON message_threads(participant_1_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_participant_2 ON message_threads(participant_2_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_last_message ON message_threads(last_message_at DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_client_messages_participants ON client_messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_messages_tenant_created ON client_messages(tenant_id, created_at DESC);

-- Enable RLS
ALTER TABLE client_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies for client_messages
-- ============================================================================

-- Users can see messages where they are sender OR receiver
CREATE POLICY "Users can see their own messages" ON client_messages
    FOR SELECT USING (
        sender_id = auth.uid() OR receiver_id = auth.uid()
    );

-- Users can create messages where they are the sender
CREATE POLICY "Users can send messages" ON client_messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid()
    );

-- Users can update messages they sent (for marking as read, archived, etc.)
CREATE POLICY "Users can update their sent messages" ON client_messages
    FOR UPDATE USING (
        sender_id = auth.uid()
    );

-- Users can update messages they received (for marking as read)
CREATE POLICY "Users can mark received messages as read" ON client_messages
    FOR UPDATE USING (
        receiver_id = auth.uid()
    );

-- Tenant admins can see all messages within their tenant
CREATE POLICY "Tenant admins can see tenant messages" ON client_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('tenant_admin', 'manager')
            AND tenant_id = client_messages.tenant_id
        )
    );

-- Super admin can see all messages across all tenants
CREATE POLICY "Super admin can see all messages" ON client_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- ============================================================================
-- RLS Policies for message_threads
-- ============================================================================

-- Users can see threads where they are a participant
CREATE POLICY "Users can see their threads" ON message_threads
    FOR SELECT USING (
        participant_1_id = auth.uid() OR participant_2_id = auth.uid()
    );

-- Users can create threads where they are a participant
CREATE POLICY "Users can create threads" ON message_threads
    FOR INSERT WITH CHECK (
        participant_1_id = auth.uid() OR participant_2_id = auth.uid()
    );

-- Users can update threads they participate in
CREATE POLICY "Users can update their threads" ON message_threads
    FOR UPDATE USING (
        participant_1_id = auth.uid() OR participant_2_id = auth.uid()
    );

-- Tenant admins can see all threads within their tenant
CREATE POLICY "Tenant admins can see tenant threads" ON message_threads
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('tenant_admin', 'manager')
            AND tenant_id = message_threads.tenant_id
        )
    );

-- Super admin can see all threads
CREATE POLICY "Super admin can see all threads" ON message_threads
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to find or create a message thread between two users
CREATE OR REPLACE FUNCTION get_or_create_message_thread(
    p_participant_1_id UUID,
    p_participant_2_id UUID,
    p_tenant_id UUID,
    p_subject VARCHAR(255) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_thread_id UUID;
    v_ordered_p1 UUID;
    v_ordered_p2 UUID;
BEGIN
    -- Order participants to ensure consistent thread lookup regardless of who initiates
    IF p_participant_1_id < p_participant_2_id THEN
        v_ordered_p1 := p_participant_1_id;
        v_ordered_p2 := p_participant_2_id;
    ELSE
        v_ordered_p1 := p_participant_2_id;
        v_ordered_p2 := p_participant_1_id;
    END IF;
    
    -- Try to find existing thread
    SELECT id INTO v_thread_id
    FROM message_threads
    WHERE tenant_id = p_tenant_id
    AND participant_1_id = v_ordered_p1
    AND participant_2_id = v_ordered_p2;
    
    -- Create new thread if not found
    IF v_thread_id IS NULL THEN
        INSERT INTO message_threads (
            tenant_id,
            participant_1_id,
            participant_2_id,
            thread_subject,
            last_message_at
        ) VALUES (
            p_tenant_id,
            v_ordered_p1,
            v_ordered_p2,
            p_subject,
            NOW()
        ) RETURNING id INTO v_thread_id;
    END IF;
    
    RETURN v_thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send a message (handles thread creation and updates)
CREATE OR REPLACE FUNCTION send_client_message(
    p_sender_id UUID,
    p_receiver_id UUID, 
    p_message_content TEXT,
    p_subject VARCHAR(255) DEFAULT NULL,
    p_message_type message_type DEFAULT 'direct_message',
    p_template_used VARCHAR(100) DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_message_id UUID;
    v_thread_id UUID;
    v_tenant_id UUID;
    v_sender_profile profiles%ROWTYPE;
BEGIN
    -- Get sender's profile and tenant
    SELECT * INTO v_sender_profile
    FROM profiles
    WHERE id = p_sender_id;
    
    IF v_sender_profile.id IS NULL THEN
        RAISE EXCEPTION 'Sender profile not found';
    END IF;
    
    v_tenant_id := v_sender_profile.tenant_id;
    
    -- Verify receiver exists and belongs to same tenant (unless sender is super admin)
    IF v_sender_profile.role != 'super_admin' THEN
        IF NOT EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = p_receiver_id 
            AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'Receiver not found or not in same tenant';
        END IF;
    END IF;
    
    -- Get or create message thread
    v_thread_id := get_or_create_message_thread(
        p_sender_id,
        p_receiver_id,
        v_tenant_id,
        p_subject
    );
    
    -- Insert the message
    INSERT INTO client_messages (
        tenant_id,
        sender_id,
        receiver_id,
        thread_id,
        message_type,
        subject,
        message_content,
        template_used,
        metadata,
        status
    ) VALUES (
        v_tenant_id,
        p_sender_id,
        p_receiver_id,
        v_thread_id,
        p_message_type,
        p_subject,
        p_message_content,
        p_template_used,
        p_metadata,
        'sent'
    ) RETURNING id INTO v_message_id;
    
    -- Update thread's last message timestamp
    UPDATE message_threads 
    SET last_message_at = NOW()
    WHERE id = v_thread_id;
    
    RETURN v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark message as read
CREATE OR REPLACE FUNCTION mark_message_as_read(
    p_message_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_message client_messages%ROWTYPE;
BEGIN
    -- Get the message
    SELECT * INTO v_message
    FROM client_messages
    WHERE id = p_message_id;
    
    IF v_message.id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Only receiver can mark as read, and only if not already read
    IF v_message.receiver_id = p_user_id AND v_message.read_at IS NULL THEN
        UPDATE client_messages 
        SET 
            status = 'read',
            read_at = NOW()
        WHERE id = p_message_id;
        
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent messages for a user
CREATE OR REPLACE FUNCTION get_recent_messages(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    message_id UUID,
    sender_name TEXT,
    receiver_name TEXT,
    message_preview TEXT,
    message_type message_type,
    status message_status,
    created_at TIMESTAMPTZ,
    is_sender BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cm.id as message_id,
        CONCAT(sender.first_name, ' ', sender.last_name) as sender_name,
        CONCAT(receiver.first_name, ' ', receiver.last_name) as receiver_name,
        LEFT(cm.message_content, 100) as message_preview,
        cm.message_type,
        cm.status,
        cm.created_at,
        (cm.sender_id = p_user_id) as is_sender
    FROM client_messages cm
    JOIN profiles sender ON sender.id = cm.sender_id
    JOIN profiles receiver ON receiver.id = cm.receiver_id
    WHERE cm.sender_id = p_user_id OR cm.receiver_id = p_user_id
    ORDER BY cm.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_or_create_message_thread TO authenticated;
GRANT EXECUTE ON FUNCTION send_client_message TO authenticated;
GRANT EXECUTE ON FUNCTION mark_message_as_read TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_messages TO authenticated;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Trigger to update thread last_message_at when new message is inserted
CREATE OR REPLACE FUNCTION update_thread_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE message_threads 
    SET last_message_at = NEW.created_at
    WHERE id = NEW.thread_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_thread_timestamp
    AFTER INSERT ON client_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_thread_last_message(); 