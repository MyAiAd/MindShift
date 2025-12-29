-- ============================================================================
-- Migration 046: Tutorial Videos System
-- ============================================================================
-- This migration adds tutorial video management with:
-- 1. Videos table for tutorial content
-- 2. Video categories for organization
-- 3. User progress tracking (watched videos)
-- 4. Multi-tenant support with RLS
-- 5. Video analytics

-- Video provider enum
DO $$ BEGIN
    CREATE TYPE video_provider AS ENUM (
        'youtube',
        'vimeo',
        'wistia',
        'custom'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Video status enum
DO $$ BEGIN
    CREATE TYPE video_status AS ENUM (
        'draft',
        'published',
        'archived'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tutorial video categories table
CREATE TABLE IF NOT EXISTS tutorial_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    icon VARCHAR(50), -- Lucide icon name
    color VARCHAR(50), -- Tailwind color class
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id, name) -- Unique category names per tenant
);

-- Tutorial videos table
CREATE TABLE IF NOT EXISTS tutorial_videos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES tutorial_categories(id) ON DELETE SET NULL,
    
    -- Video metadata
    title VARCHAR(255) NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL, -- Embed URL (YouTube, Vimeo, etc.)
    thumbnail_url TEXT,
    duration_minutes INTEGER, -- Duration in minutes
    duration_text VARCHAR(20), -- Display format (e.g., "8:45")
    
    -- Provider information
    provider video_provider NOT NULL,
    provider_video_id VARCHAR(255), -- External video ID
    
    -- Organization
    status video_status DEFAULT 'published',
    is_featured BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    tags TEXT[], -- Array of tags
    
    -- Access control
    required_subscription_tier VARCHAR(50), -- 'trial', 'level_1', 'level_2', null = all
    
    -- Analytics
    view_count INTEGER DEFAULT 0,
    completion_count INTEGER DEFAULT 0,
    average_watch_percentage NUMERIC(5,2) DEFAULT 0,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User video progress tracking
CREATE TABLE IF NOT EXISTS tutorial_video_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    video_id UUID REFERENCES tutorial_videos(id) ON DELETE CASCADE NOT NULL,
    
    -- Progress tracking
    watched BOOLEAN DEFAULT FALSE,
    watch_percentage NUMERIC(5,2) DEFAULT 0, -- 0-100
    last_position_seconds INTEGER DEFAULT 0, -- Resume position
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Engagement
    liked BOOLEAN DEFAULT FALSE,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    notes TEXT,
    
    -- Timestamps
    first_watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, video_id) -- One progress record per user per video
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tutorial_categories_tenant_id ON tutorial_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tutorial_categories_display_order ON tutorial_categories(display_order);

CREATE INDEX IF NOT EXISTS idx_tutorial_videos_tenant_id ON tutorial_videos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tutorial_videos_category_id ON tutorial_videos(category_id);
CREATE INDEX IF NOT EXISTS idx_tutorial_videos_status ON tutorial_videos(status);
CREATE INDEX IF NOT EXISTS idx_tutorial_videos_is_featured ON tutorial_videos(is_featured);
CREATE INDEX IF NOT EXISTS idx_tutorial_videos_display_order ON tutorial_videos(display_order);
CREATE INDEX IF NOT EXISTS idx_tutorial_videos_provider ON tutorial_videos(provider);
CREATE INDEX IF NOT EXISTS idx_tutorial_videos_tags ON tutorial_videos USING GIN(tags);

-- Full-text search on videos
CREATE INDEX IF NOT EXISTS idx_tutorial_videos_search ON tutorial_videos 
    USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

CREATE INDEX IF NOT EXISTS idx_tutorial_video_progress_tenant_id ON tutorial_video_progress(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tutorial_video_progress_user_id ON tutorial_video_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_tutorial_video_progress_video_id ON tutorial_video_progress(video_id);
CREATE INDEX IF NOT EXISTS idx_tutorial_video_progress_watched ON tutorial_video_progress(watched);
CREATE INDEX IF NOT EXISTS idx_tutorial_video_progress_completed_at ON tutorial_video_progress(completed_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tutorial_videos_tenant_status_order ON tutorial_videos(tenant_id, status, display_order)
    WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_tutorial_videos_tenant_featured ON tutorial_videos(tenant_id, is_featured, display_order)
    WHERE is_featured = TRUE AND status = 'published';

-- Enable RLS on all tables
ALTER TABLE tutorial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutorial_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutorial_video_progress ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies for tutorial_categories
-- ============================================================================

-- Users can view categories in their tenant
CREATE POLICY "Users can view tutorial categories in their tenant" ON tutorial_categories
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
        )
    );

-- Admins can manage categories in their tenant
CREATE POLICY "Admins can manage tutorial categories" ON tutorial_categories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('tenant_admin', 'manager')
            AND tenant_id = tutorial_categories.tenant_id
        )
    );

-- Super admins can manage all categories
CREATE POLICY "Super admins can manage all tutorial categories" ON tutorial_categories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- ============================================================================
-- RLS Policies for tutorial_videos
-- ============================================================================

-- Users can view published videos in their tenant (with subscription tier check)
CREATE POLICY "Users can view published videos in their tenant" ON tutorial_videos
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
        ) AND 
        status = 'published' AND
        (
            required_subscription_tier IS NULL OR
            required_subscription_tier IN (
                SELECT subscription_tier FROM profiles 
                WHERE id = auth.uid()
            )
        )
    );

-- Admins can view all videos in their tenant
CREATE POLICY "Admins can view all videos in their tenant" ON tutorial_videos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('tenant_admin', 'manager', 'coach')
            AND tenant_id = tutorial_videos.tenant_id
        )
    );

-- Admins can manage videos in their tenant
CREATE POLICY "Admins can manage videos in their tenant" ON tutorial_videos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('tenant_admin', 'manager')
            AND tenant_id = tutorial_videos.tenant_id
        )
    );

-- Super admins can manage all videos
CREATE POLICY "Super admins can manage all videos" ON tutorial_videos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- ============================================================================
-- RLS Policies for tutorial_video_progress
-- ============================================================================

-- Users can view their own progress
CREATE POLICY "Users can view their own video progress" ON tutorial_video_progress
    FOR SELECT USING (
        user_id = auth.uid()
    );

-- Users can manage their own progress
CREATE POLICY "Users can manage their own video progress" ON tutorial_video_progress
    FOR ALL USING (
        user_id = auth.uid() AND
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid()
        )
    );

-- Admins can view progress in their tenant (for analytics)
CREATE POLICY "Admins can view tenant video progress" ON tutorial_video_progress
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('tenant_admin', 'manager', 'coach')
            AND tenant_id = tutorial_video_progress.tenant_id
        )
    );

-- Super admins can view all progress
CREATE POLICY "Super admins can view all video progress" ON tutorial_video_progress
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- ============================================================================
-- Triggers and Functions
-- ============================================================================

-- Auto-update timestamps
CREATE TRIGGER update_tutorial_categories_updated_at
    BEFORE UPDATE ON tutorial_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tutorial_videos_updated_at
    BEFORE UPDATE ON tutorial_videos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tutorial_video_progress_updated_at
    BEFORE UPDATE ON tutorial_video_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update video view count when progress is created or updated
CREATE OR REPLACE FUNCTION update_video_view_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment view count
        UPDATE tutorial_videos 
        SET view_count = view_count + 1 
        WHERE id = NEW.video_id;
    END IF;
    
    -- Update completion count if video was completed
    IF TG_OP = 'UPDATE' AND NEW.watched = TRUE AND OLD.watched = FALSE THEN
        UPDATE tutorial_videos 
        SET completion_count = completion_count + 1 
        WHERE id = NEW.video_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_video_view_count_trigger
    AFTER INSERT OR UPDATE ON tutorial_video_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_video_view_count();

-- Function to calculate average watch percentage for a video
CREATE OR REPLACE FUNCTION calculate_video_average_watch()
RETURNS TRIGGER AS $$
DECLARE
    avg_percentage NUMERIC(5,2);
BEGIN
    -- Calculate average watch percentage
    SELECT AVG(watch_percentage) INTO avg_percentage
    FROM tutorial_video_progress
    WHERE video_id = NEW.video_id;
    
    -- Update the video's average
    UPDATE tutorial_videos 
    SET average_watch_percentage = COALESCE(avg_percentage, 0)
    WHERE id = NEW.video_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_video_average_watch_trigger
    AFTER INSERT OR UPDATE ON tutorial_video_progress
    FOR EACH ROW
    EXECUTE FUNCTION calculate_video_average_watch();

-- Auto-mark as watched when watch_percentage > 90%
CREATE OR REPLACE FUNCTION auto_mark_video_watched()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.watch_percentage >= 90 AND NOT NEW.watched THEN
        NEW.watched = TRUE;
        NEW.completed_at = NOW();
    END IF;
    
    -- Update last_watched_at
    NEW.last_watched_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_mark_video_watched_trigger
    BEFORE INSERT OR UPDATE ON tutorial_video_progress
    FOR EACH ROW
    EXECUTE FUNCTION auto_mark_video_watched();

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to get user's video progress stats
CREATE OR REPLACE FUNCTION get_user_video_progress_stats(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    stats JSON;
BEGIN
    SELECT json_build_object(
        'total_videos', (SELECT COUNT(*) FROM tutorial_videos WHERE status = 'published' AND tenant_id IN (SELECT tenant_id FROM profiles WHERE id = p_user_id)),
        'watched_videos', (SELECT COUNT(*) FROM tutorial_video_progress WHERE user_id = p_user_id AND watched = TRUE),
        'in_progress_videos', (SELECT COUNT(*) FROM tutorial_video_progress WHERE user_id = p_user_id AND watched = FALSE AND watch_percentage > 0),
        'total_watch_time_minutes', (SELECT COALESCE(SUM(tv.duration_minutes * (tvp.watch_percentage / 100)), 0) FROM tutorial_video_progress tvp JOIN tutorial_videos tv ON tv.id = tvp.video_id WHERE tvp.user_id = p_user_id),
        'completion_percentage', (
            CASE 
                WHEN (SELECT COUNT(*) FROM tutorial_videos WHERE status = 'published' AND tenant_id IN (SELECT tenant_id FROM profiles WHERE id = p_user_id)) = 0 
                THEN 0
                ELSE ROUND((SELECT COUNT(*)::numeric FROM tutorial_video_progress WHERE user_id = p_user_id AND watched = TRUE) / 
                     (SELECT COUNT(*)::numeric FROM tutorial_videos WHERE status = 'published' AND tenant_id IN (SELECT tenant_id FROM profiles WHERE id = p_user_id)) * 100, 2)
            END
        )
    ) INTO stats;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Default Categories (Optional - can be run after migration)
-- ============================================================================

-- NOTE: This section is commented out because categories should be tenant-specific
-- Uncomment and run separately for each tenant if you want default categories

/*
-- Insert default categories for a specific tenant
-- Replace 'YOUR_TENANT_ID_HERE' with actual tenant ID

INSERT INTO tutorial_categories (tenant_id, name, description, display_order, icon, color)
VALUES 
    ('YOUR_TENANT_ID_HERE', 'Getting Started', 'Introduction and basics', 1, 'BookOpen', 'text-blue-600'),
    ('YOUR_TENANT_ID_HERE', 'Sessions', 'How to use treatment sessions', 2, 'PlayCircle', 'text-green-600'),
    ('YOUR_TENANT_ID_HERE', 'Modalities', 'Deep dives into each modality', 3, 'Brain', 'text-indigo-600'),
    ('YOUR_TENANT_ID_HERE', 'Features', 'Platform features and tools', 4, 'Lightbulb', 'text-yellow-600'),
    ('YOUR_TENANT_ID_HERE', 'Coaching', 'Working with coaches', 5, 'Users', 'text-orange-600'),
    ('YOUR_TENANT_ID_HERE', 'Community', 'Community engagement', 6, 'Users', 'text-pink-600'),
    ('YOUR_TENANT_ID_HERE', 'Advanced', 'Advanced techniques', 7, 'Target', 'text-red-600'),
    ('YOUR_TENANT_ID_HERE', 'Inspiration', 'Success stories', 8, 'CheckCircle', 'text-teal-600')
ON CONFLICT (tenant_id, name) DO NOTHING;
*/
