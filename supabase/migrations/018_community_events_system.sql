-- ============================================================================
-- Migration 018: Community Events System
-- ============================================================================
-- This migration adds community events functionality with:
-- 1. Events table for scheduled community activities
-- 2. RSVP system with attendance tracking
-- 3. Zoom integration hooks (meeting IDs, links)
-- 4. Calendar integration metadata
-- 5. Event notifications and reminders
-- 6. Recurring events support
-- 7. Waitlist functionality

-- Event status enum
DO $$ BEGIN
    CREATE TYPE event_status AS ENUM (
        'draft',
        'published',
        'cancelled',
        'completed',
        'live'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Event type enum
DO $$ BEGIN
    CREATE TYPE event_type AS ENUM (
        'webinar',
        'workshop',
        'group_call',
        'q_and_a',
        'social',
        'training',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- RSVP status enum
DO $$ BEGIN
    CREATE TYPE rsvp_status AS ENUM (
        'going',
        'maybe',
        'not_going',
        'waitlist'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Recurrence pattern enum
DO $$ BEGIN
    CREATE TYPE recurrence_pattern AS ENUM (
        'none',
        'daily',
        'weekly',
        'monthly',
        'yearly'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Community Events table
CREATE TABLE IF NOT EXISTS community_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type event_type DEFAULT 'other',
    status event_status DEFAULT 'draft',
    
    -- Scheduling information
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Capacity and limits
    max_attendees INTEGER,
    enable_waitlist BOOLEAN DEFAULT FALSE,
    
    -- Meeting integration
    zoom_meeting_id VARCHAR(255),
    zoom_join_url TEXT,
    zoom_start_url TEXT,
    meeting_password VARCHAR(50),
    
    -- Calendar integration
    calendar_event_id VARCHAR(255),
    ical_uid VARCHAR(255),
    
    -- Recurrence
    recurrence_pattern recurrence_pattern DEFAULT 'none',
    recurrence_interval INTEGER DEFAULT 1, -- Every N days/weeks/months
    recurrence_count INTEGER, -- Total occurrences (null = infinite)
    recurrence_until TIMESTAMP WITH TIME ZONE, -- End date for recurrence
    parent_event_id UUID REFERENCES community_events(id) ON DELETE CASCADE, -- For recurring instances
    
    -- Engagement metrics
    rsvp_count INTEGER DEFAULT 0,
    going_count INTEGER DEFAULT 0,
    maybe_count INTEGER DEFAULT 0,
    waitlist_count INTEGER DEFAULT 0,
    
    -- Content and metadata
    agenda JSONB DEFAULT '[]', -- Structured agenda items
    resources JSONB DEFAULT '[]', -- Links, files, etc.
    tags JSONB DEFAULT '[]', -- Event tags for categorization
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Validation constraints
    CONSTRAINT valid_event_times CHECK (ends_at > starts_at),
    CONSTRAINT valid_max_attendees CHECK (max_attendees > 0 OR max_attendees IS NULL),
    CONSTRAINT valid_recurrence_interval CHECK (recurrence_interval > 0)
);

-- Event RSVPs table
CREATE TABLE IF NOT EXISTS community_event_rsvps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    event_id UUID REFERENCES community_events(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    status rsvp_status NOT NULL,
    notes TEXT, -- User can add notes when RSVPing
    attended BOOLEAN, -- Marked after event completion
    joined_at TIMESTAMP WITH TIME ZONE, -- When they actually joined the meeting
    left_at TIMESTAMP WITH TIME ZONE, -- When they left the meeting
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(event_id, user_id) -- One RSVP per user per event
);

-- Event reminders table (for scheduled notifications)
CREATE TABLE IF NOT EXISTS community_event_reminders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    event_id UUID REFERENCES community_events(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    reminder_type VARCHAR(50) NOT NULL, -- '24_hours', '1_hour', '15_minutes', 'custom'
    remind_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    message_template TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Can have multiple reminders per event per user
    UNIQUE(event_id, user_id, reminder_type)
);

-- Event attendance tracking (for detailed analytics)
CREATE TABLE IF NOT EXISTS community_event_attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    event_id UUID REFERENCES community_events(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL,
    left_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    device_type VARCHAR(50), -- 'web', 'mobile', 'desktop'
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_community_events_tenant_id ON community_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_community_events_created_by ON community_events(created_by);
CREATE INDEX IF NOT EXISTS idx_community_events_status ON community_events(status);
CREATE INDEX IF NOT EXISTS idx_community_events_starts_at ON community_events(starts_at);
CREATE INDEX IF NOT EXISTS idx_community_events_ends_at ON community_events(ends_at);
CREATE INDEX IF NOT EXISTS idx_community_events_event_type ON community_events(event_type);
CREATE INDEX IF NOT EXISTS idx_community_events_parent_event_id ON community_events(parent_event_id);

-- Full-text search on events
CREATE INDEX IF NOT EXISTS idx_community_events_search ON community_events 
    USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

CREATE INDEX IF NOT EXISTS idx_community_event_rsvps_tenant_id ON community_event_rsvps(tenant_id);
CREATE INDEX IF NOT EXISTS idx_community_event_rsvps_event_id ON community_event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_community_event_rsvps_user_id ON community_event_rsvps(user_id);
CREATE INDEX IF NOT EXISTS idx_community_event_rsvps_status ON community_event_rsvps(status);

CREATE INDEX IF NOT EXISTS idx_community_event_reminders_tenant_id ON community_event_reminders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_community_event_reminders_event_id ON community_event_reminders(event_id);
CREATE INDEX IF NOT EXISTS idx_community_event_reminders_remind_at ON community_event_reminders(remind_at);
CREATE INDEX IF NOT EXISTS idx_community_event_reminders_sent_at ON community_event_reminders(sent_at);

CREATE INDEX IF NOT EXISTS idx_community_event_attendance_tenant_id ON community_event_attendance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_community_event_attendance_event_id ON community_event_attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_community_event_attendance_user_id ON community_event_attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_community_event_attendance_joined_at ON community_event_attendance(joined_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_community_events_tenant_status_starts ON community_events(tenant_id, status, starts_at)
    WHERE status IN ('published', 'live');
CREATE INDEX IF NOT EXISTS idx_community_events_tenant_starts ON community_events(tenant_id, starts_at)
    WHERE status = 'published';

-- Enable RLS on all tables
ALTER TABLE community_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_event_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_event_attendance ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies for community_events
-- ============================================================================

-- Users can view published events in their tenant
CREATE POLICY "Users can view published events in their tenant" ON community_events
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
        ) AND 
        (status IN ('published', 'live', 'completed') OR 
         created_by = auth.uid()) -- Creators can see their own drafts
    );

-- Users can create events in their tenant (with proper role check)
CREATE POLICY "Users can create events in their tenant" ON community_events
    FOR INSERT WITH CHECK (
        created_by = auth.uid() AND
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid() AND role IN ('tenant_admin', 'manager', 'coach')
        )
    );

-- Users can update their own events
CREATE POLICY "Users can update their own events" ON community_events
    FOR UPDATE USING (
        created_by = auth.uid()
    );

-- Users can delete their own events (soft delete by setting status)
CREATE POLICY "Users can delete their own events" ON community_events
    FOR DELETE USING (
        created_by = auth.uid()
    );

-- Tenant admins can manage all events in their tenant
CREATE POLICY "Tenant admins can manage all events in their tenant" ON community_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('tenant_admin', 'manager')
            AND tenant_id = community_events.tenant_id
        )
    );

-- Super admins can manage all events
CREATE POLICY "Super admins can manage all events" ON community_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- ============================================================================
-- RLS Policies for community_event_rsvps
-- ============================================================================

-- Users can view RSVPs for events they can see
CREATE POLICY "Users can view event RSVPs" ON community_event_rsvps
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM community_events 
            WHERE id = community_event_rsvps.event_id
            AND tenant_id IN (
                SELECT tenant_id FROM profiles 
                WHERE id = auth.uid()
            )
        )
    );

-- Users can manage their own RSVPs
CREATE POLICY "Users can manage their own RSVPs" ON community_event_rsvps
    FOR ALL USING (
        user_id = auth.uid() AND
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
        )
    );

-- Event creators and admins can view all RSVPs for their events
CREATE POLICY "Event creators can view all RSVPs" ON community_event_rsvps
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM community_events 
            WHERE id = community_event_rsvps.event_id
            AND (
                created_by = auth.uid() OR
                tenant_id IN (
                    SELECT tenant_id FROM profiles 
                    WHERE id = auth.uid() AND role IN ('tenant_admin', 'manager')
                )
            )
        )
    );

-- Super admins can manage all RSVPs
CREATE POLICY "Super admins can manage all RSVPs" ON community_event_rsvps
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- ============================================================================
-- RLS Policies for community_event_reminders
-- ============================================================================

-- Users can view their own reminders
CREATE POLICY "Users can view their own event reminders" ON community_event_reminders
    FOR SELECT USING (
        user_id = auth.uid() OR user_id IS NULL -- System-wide reminders
    );

-- Event creators can manage reminders for their events
CREATE POLICY "Event creators can manage event reminders" ON community_event_reminders
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM community_events 
            WHERE id = community_event_reminders.event_id
            AND created_by = auth.uid()
        ) OR
        user_id = auth.uid() -- Users can manage their own reminders
    );

-- Tenant admins can manage reminders in their tenant
CREATE POLICY "Tenant admins can manage event reminders" ON community_event_reminders
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('tenant_admin', 'manager')
            AND tenant_id = community_event_reminders.tenant_id
        )
    );

-- Super admins can manage all reminders
CREATE POLICY "Super admins can manage all reminders" ON community_event_reminders
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- ============================================================================
-- RLS Policies for community_event_attendance
-- ============================================================================

-- Users can view their own attendance records
CREATE POLICY "Users can view their own attendance" ON community_event_attendance
    FOR SELECT USING (
        user_id = auth.uid()
    );

-- Event creators can view attendance for their events
CREATE POLICY "Event creators can view event attendance" ON community_event_attendance
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM community_events 
            WHERE id = community_event_attendance.event_id
            AND created_by = auth.uid()
        )
    );

-- System can create attendance records
CREATE POLICY "System can create attendance records" ON community_event_attendance
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
        )
    );

-- Tenant admins can view attendance in their tenant
CREATE POLICY "Tenant admins can view tenant attendance" ON community_event_attendance
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('tenant_admin', 'manager')
            AND tenant_id = community_event_attendance.tenant_id
        )
    );

-- Super admins can manage all attendance records
CREATE POLICY "Super admins can manage all attendance" ON community_event_attendance
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- ============================================================================
-- Triggers and Functions for Event Management
-- ============================================================================

-- Auto-update timestamps
CREATE TRIGGER update_community_events_updated_at
    BEFORE UPDATE ON community_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_community_event_rsvps_updated_at
    BEFORE UPDATE ON community_event_rsvps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update event RSVP counts when RSVPs change
CREATE OR REPLACE FUNCTION update_event_rsvp_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment counts based on RSVP status
        UPDATE community_events 
        SET 
            rsvp_count = rsvp_count + 1,
            going_count = going_count + CASE WHEN NEW.status = 'going' THEN 1 ELSE 0 END,
            maybe_count = maybe_count + CASE WHEN NEW.status = 'maybe' THEN 1 ELSE 0 END,
            waitlist_count = waitlist_count + CASE WHEN NEW.status = 'waitlist' THEN 1 ELSE 0 END
        WHERE id = NEW.event_id;
        
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle status changes
        UPDATE community_events 
        SET 
            going_count = going_count 
                + CASE WHEN NEW.status = 'going' THEN 1 ELSE 0 END
                - CASE WHEN OLD.status = 'going' THEN 1 ELSE 0 END,
            maybe_count = maybe_count 
                + CASE WHEN NEW.status = 'maybe' THEN 1 ELSE 0 END
                - CASE WHEN OLD.status = 'maybe' THEN 1 ELSE 0 END,
            waitlist_count = waitlist_count 
                + CASE WHEN NEW.status = 'waitlist' THEN 1 ELSE 0 END
                - CASE WHEN OLD.status = 'waitlist' THEN 1 ELSE 0 END
        WHERE id = NEW.event_id;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement counts
        UPDATE community_events 
        SET 
            rsvp_count = GREATEST(rsvp_count - 1, 0),
            going_count = going_count - CASE WHEN OLD.status = 'going' THEN 1 ELSE 0 END,
            maybe_count = maybe_count - CASE WHEN OLD.status = 'maybe' THEN 1 ELSE 0 END,
            waitlist_count = waitlist_count - CASE WHEN OLD.status = 'waitlist' THEN 1 ELSE 0 END
        WHERE id = OLD.event_id;
        
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_event_rsvp_counts_trigger
    AFTER INSERT OR UPDATE OR DELETE ON community_event_rsvps
    FOR EACH ROW
    EXECUTE FUNCTION update_event_rsvp_counts();

-- Function to create default event reminders
CREATE OR REPLACE FUNCTION create_default_event_reminders(
    p_event_id UUID,
    p_tenant_id UUID
)
RETURNS VOID AS $$
DECLARE
    event_record RECORD;
BEGIN
    -- Get event details
    SELECT * INTO event_record FROM community_events WHERE id = p_event_id;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Create default reminders (24 hours and 1 hour before)
    INSERT INTO community_event_reminders (tenant_id, event_id, reminder_type, remind_at)
    VALUES 
        (p_tenant_id, p_event_id, '24_hours', event_record.starts_at - INTERVAL '24 hours'),
        (p_tenant_id, p_event_id, '1_hour', event_record.starts_at - INTERVAL '1 hour')
    ON CONFLICT (event_id, user_id, reminder_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default reminders when event is published
CREATE OR REPLACE FUNCTION trigger_event_reminders()
RETURNS TRIGGER AS $$
BEGIN
    -- Create default reminders when event is published
    IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
        PERFORM create_default_event_reminders(NEW.id, NEW.tenant_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_event_reminders_trigger
    AFTER INSERT OR UPDATE ON community_events
    FOR EACH ROW
    EXECUTE FUNCTION trigger_event_reminders();

-- Function to send event notifications
CREATE OR REPLACE FUNCTION send_event_notification(
    p_tenant_id UUID,
    p_event_id UUID,
    p_notification_type VARCHAR(50),
    p_recipient_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    event_record RECORD;
    creator_name VARCHAR(255);
    notification_id UUID;
    subject VARCHAR(255);
    content TEXT;
BEGIN
    -- Get event details
    SELECT e.*
    INTO event_record
    FROM community_events e
    WHERE e.id = p_event_id;
    
    -- Get creator name separately
    SELECT p.first_name || ' ' || p.last_name
    INTO creator_name
    FROM profiles p
    WHERE p.id = event_record.created_by;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Build notification content based on type
    CASE p_notification_type
        WHEN 'event_created' THEN
            subject := 'New Event: ' || event_record.title;
            content := creator_name || ' created a new event "' || event_record.title || '" scheduled for ' || 
                      TO_CHAR(event_record.starts_at, 'FMDay, Month DD at HH12:MI AM');
        
        WHEN 'event_updated' THEN
            subject := 'Event Updated: ' || event_record.title;
            content := 'The event "' || event_record.title || '" has been updated. Check the latest details.';
        
        WHEN 'event_reminder' THEN
            subject := 'Reminder: ' || event_record.title || ' starts soon';
            content := 'Don''t forget! "' || event_record.title || '" starts at ' || 
                      TO_CHAR(event_record.starts_at, 'HH12:MI AM on FMDay, Month DD');
        
        WHEN 'event_cancelled' THEN
            subject := 'Event Cancelled: ' || event_record.title;
            content := 'Unfortunately, the event "' || event_record.title || '" has been cancelled.';
        
        ELSE
            subject := 'Event Notification';
            content := 'There''s an update about the event "' || event_record.title || '"';
    END CASE;
    
    -- Send notification using existing function
    SELECT send_community_notification(
        p_tenant_id,
        COALESCE(p_recipient_id, event_record.created_by),
        event_record.created_by,
        'system_notification',
        subject,
        content,
        jsonb_build_object(
            'event_id', p_event_id,
            'event_title', event_record.title,
            'event_starts_at', event_record.starts_at,
            'notification_type', p_notification_type
        )
    ) INTO notification_id;
    
    RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check event capacity and manage waitlist
CREATE OR REPLACE FUNCTION check_event_capacity(
    p_event_id UUID,
    p_user_id UUID,
    p_desired_status rsvp_status
)
RETURNS rsvp_status AS $$
DECLARE
    event_record RECORD;
    current_going_count INTEGER;
BEGIN
    -- Get event details
    SELECT * INTO event_record FROM community_events WHERE id = p_event_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event not found';
    END IF;
    
    -- If no capacity limit, allow the desired status
    IF event_record.max_attendees IS NULL THEN
        RETURN p_desired_status;
    END IF;
    
    -- Get current going count
    SELECT COUNT(*) INTO current_going_count
    FROM community_event_rsvps
    WHERE event_id = p_event_id AND status = 'going';
    
    -- If user wants to go but event is at capacity
    IF p_desired_status = 'going' AND current_going_count >= event_record.max_attendees THEN
        -- Check if waitlist is enabled
        IF event_record.enable_waitlist THEN
            RETURN 'waitlist'::rsvp_status;
        ELSE
            RAISE EXCEPTION 'Event is at capacity and waitlist is not enabled';
        END IF;
    END IF;
    
    RETURN p_desired_status;
END;
$$ LANGUAGE plpgsql;

-- Function to process waitlist when someone cancels
CREATE OR REPLACE FUNCTION process_waitlist(p_event_id UUID)
RETURNS VOID AS $$
DECLARE
    event_record RECORD;
    current_going_count INTEGER;
    available_spots INTEGER;
    waitlist_user RECORD;
BEGIN
    -- Get event details
    SELECT * INTO event_record FROM community_events WHERE id = p_event_id;
    
    IF NOT FOUND OR event_record.max_attendees IS NULL THEN
        RETURN;
    END IF;
    
    -- Get current going count
    SELECT COUNT(*) INTO current_going_count
    FROM community_event_rsvps
    WHERE event_id = p_event_id AND status = 'going';
    
    available_spots := event_record.max_attendees - current_going_count;
    
    -- Move people from waitlist to going if there are available spots
    FOR waitlist_user IN 
        SELECT user_id FROM community_event_rsvps
        WHERE event_id = p_event_id AND status = 'waitlist'
        ORDER BY created_at
        LIMIT available_spots
    LOOP
        UPDATE community_event_rsvps
        SET status = 'going', updated_at = NOW()
        WHERE event_id = p_event_id AND user_id = waitlist_user.user_id;
        
        -- Send notification to user that they're off the waitlist
        PERFORM send_community_notification(
            event_record.tenant_id,
            waitlist_user.user_id,
            event_record.created_by,
            'system_notification',
            'You''re off the waitlist!',
            'Great news! A spot opened up for "' || event_record.title || '" and you''re now confirmed to attend.',
            jsonb_build_object(
                'event_id', p_event_id,
                'event_title', event_record.title
            )
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger to process waitlist when RSVP status changes
CREATE OR REPLACE FUNCTION trigger_waitlist_processing()
RETURNS TRIGGER AS $$
BEGIN
    -- If someone changed from 'going' to something else, process waitlist
    IF TG_OP = 'UPDATE' AND OLD.status = 'going' AND NEW.status != 'going' THEN
        PERFORM process_waitlist(NEW.event_id);
    ELSIF TG_OP = 'DELETE' AND OLD.status = 'going' THEN
        PERFORM process_waitlist(OLD.event_id);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_waitlist_processing_trigger
    AFTER UPDATE OR DELETE ON community_event_rsvps
    FOR EACH ROW
    EXECUTE FUNCTION trigger_waitlist_processing(); 