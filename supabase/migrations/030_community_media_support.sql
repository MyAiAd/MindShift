-- ============================================================================
-- Migration 030: Community Media Support
-- ============================================================================
-- Adds media and attachment support to community posts
-- This migration is IDEMPOTENT - safe to run multiple times

-- Add media columns to community_posts (idempotent with IF NOT EXISTS checks)
DO $$ 
BEGIN
    -- Add media_urls array if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'community_posts' 
        AND column_name = 'media_urls'
    ) THEN
        ALTER TABLE community_posts 
        ADD COLUMN media_urls JSONB DEFAULT '[]';
    END IF;

    -- Add video_embeds array if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'community_posts' 
        AND column_name = 'video_embeds'
    ) THEN
        ALTER TABLE community_posts 
        ADD COLUMN video_embeds JSONB DEFAULT '[]';
    END IF;

    -- Add attachments array if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'community_posts' 
        AND column_name = 'attachments'
    ) THEN
        ALTER TABLE community_posts 
        ADD COLUMN attachments JSONB DEFAULT '[]';
    END IF;
END $$;

-- Create indexes for media queries (idempotent)
CREATE INDEX IF NOT EXISTS idx_community_posts_has_media 
ON community_posts((jsonb_array_length(media_urls) > 0));

CREATE INDEX IF NOT EXISTS idx_community_posts_has_videos 
ON community_posts((jsonb_array_length(video_embeds) > 0));

CREATE INDEX IF NOT EXISTS idx_community_posts_has_attachments 
ON community_posts((jsonb_array_length(attachments) > 0));

-- Create storage bucket for community media (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'community-media',
    'community-media',
    true,
    52428800, -- 50MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for community attachments (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'community-attachments',
    'community-attachments',
    false, -- Private, requires authentication
    104857600, -- 100MB limit
    ARRAY['application/pdf', 'application/msword', 
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for community-media bucket (idempotent)
DO $$ 
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Authenticated users can upload community media" ON storage.objects;
    DROP POLICY IF EXISTS "Public can view community media" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update their own media uploads" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own media uploads" ON storage.objects;

    -- Create policies
    CREATE POLICY "Authenticated users can upload community media"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'community-media');

    CREATE POLICY "Public can view community media"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'community-media');

    CREATE POLICY "Users can update their own media uploads"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'community-media' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

    CREATE POLICY "Users can delete their own media uploads"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'community-media' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
END $$;

-- RLS policies for community-attachments bucket (idempotent)
DO $$ 
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
    DROP POLICY IF EXISTS "Tenant members can view attachments" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete own attachments" ON storage.objects;

    -- Create policies
    CREATE POLICY "Authenticated users can upload attachments"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'community-attachments');

    CREATE POLICY "Tenant members can view attachments"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'community-attachments');

    CREATE POLICY "Users can delete own attachments"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'community-attachments' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
END $$;

-- Add helpful comments
COMMENT ON COLUMN community_posts.media_urls IS 'Array of image URLs uploaded to Supabase Storage. Format: [{url: string, width: number, height: number, alt: string}]';
COMMENT ON COLUMN community_posts.video_embeds IS 'Array of video embed URLs (YouTube, Vimeo, Wistia). Format: [{provider: string, url: string, embedUrl: string, thumbnail: string}]';
COMMENT ON COLUMN community_posts.attachments IS 'Array of file attachments. Format: [{name: string, url: string, size: number, mimeType: string}]';

