# Database Setup Guide - Tutorial Videos & Community Features

## Overview

This guide documents the complete database setup for **Tutorial Videos** and **Community Features** with full multi-tenant support and Row-Level Security (RLS).

## ✅ What's Already Set Up

### Community Feature (100% Complete)
All database tables, RLS policies, and triggers are fully implemented and production-ready:

#### Tables:
- ✅ `community_posts` - User posts with tenant isolation
- ✅ `community_comments` - Nested comments with replies
- ✅ `community_post_likes` - Post like tracking
- ✅ `community_comment_likes` - Comment like tracking
- ✅ `community_tags` - Tag system for posts
- ✅ `community_post_tags` - Many-to-many relationship
- ✅ `community_notification_preferences` - User notification settings
- ✅ `community_events` - Event management system
- ✅ `community_event_rsvps` - RSVP and attendance tracking
- ✅ `community_event_reminders` - Automated reminder system
- ✅ `community_event_attendance` - Detailed analytics

#### Features:
- ✅ Full RLS policies for tenant isolation
- ✅ Super admin access across all tenants
- ✅ Automated counters (likes, comments, views)
- ✅ Real-time notifications
- ✅ Content moderation system
- ✅ Event capacity and waitlist management
- ✅ Full-text search on posts and events

#### Migration File:
- `supabase/migrations/016_community_posts_system.sql`
- `supabase/migrations/017_community_comments_system.sql`
- `supabase/migrations/018_community_events_system.sql`

### Tutorial Videos Feature (NEW - Just Added)
Complete database schema for video tutorial management:

#### Tables:
- ✅ `tutorial_categories` - Organize videos by category
- ✅ `tutorial_videos` - Video metadata and embed URLs
- ✅ `tutorial_video_progress` - Track user watch progress

#### Features:
- ✅ Multi-tenant support with RLS
- ✅ Video progress tracking (watch percentage, last position)
- ✅ Subscription tier gating (restrict videos by plan)
- ✅ Video analytics (views, completions, ratings)
- ✅ Featured video support
- ✅ Tag system for categorization
- ✅ Multiple video providers (YouTube, Vimeo, Wistia, Custom)
- ✅ Auto-mark as watched at 90% completion
- ✅ User ratings and notes
- ✅ Full-text search

#### Migration File:
- `supabase/migrations/046_tutorial_videos_system.sql`

## 📋 Database Schema

### Tutorial Categories
```sql
CREATE TABLE tutorial_categories (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    icon VARCHAR(50),        -- Lucide icon name
    color VARCHAR(50),       -- Tailwind color class
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(tenant_id, name)
);
```

### Tutorial Videos
```sql
CREATE TABLE tutorial_videos (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    category_id UUID REFERENCES tutorial_categories(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,           -- Embed URL
    thumbnail_url TEXT,
    duration_minutes INTEGER,
    duration_text VARCHAR(20),         -- Display format (e.g., "8:45")
    provider video_provider NOT NULL,  -- 'youtube', 'vimeo', 'wistia', 'custom'
    provider_video_id VARCHAR(255),
    status video_status DEFAULT 'published',
    is_featured BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    tags TEXT[],
    required_subscription_tier VARCHAR(50),  -- Gate by plan
    view_count INTEGER DEFAULT 0,
    completion_count INTEGER DEFAULT 0,
    average_watch_percentage NUMERIC(5,2),
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Tutorial Video Progress
```sql
CREATE TABLE tutorial_video_progress (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    user_id UUID REFERENCES profiles(id),
    video_id UUID REFERENCES tutorial_videos(id),
    watched BOOLEAN DEFAULT FALSE,
    watch_percentage NUMERIC(5,2) DEFAULT 0,  -- 0-100
    last_position_seconds INTEGER DEFAULT 0,
    completed_at TIMESTAMP,
    liked BOOLEAN DEFAULT FALSE,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    notes TEXT,
    first_watched_at TIMESTAMP,
    last_watched_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(user_id, video_id)
);
```

## 🔒 Row-Level Security (RLS)

### Tutorial Videos RLS Policies

**View Published Videos:**
```sql
-- Users can view published videos in their tenant (respects subscription tier)
CREATE POLICY "Users can view published videos in their tenant" 
ON tutorial_videos FOR SELECT 
USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    AND status = 'published'
    AND (
        required_subscription_tier IS NULL OR
        required_subscription_tier IN (
            SELECT subscription_tier FROM profiles WHERE id = auth.uid()
        )
    )
);
```

**Admin Management:**
```sql
-- Admins can manage all videos in their tenant
CREATE POLICY "Admins can manage videos in their tenant" 
ON tutorial_videos FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('tenant_admin', 'manager')
        AND tenant_id = tutorial_videos.tenant_id
    )
);
```

**Super Admin Access:**
```sql
-- Super admins can manage all videos across all tenants
CREATE POLICY "Super admins can manage all videos" 
ON tutorial_videos FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    )
);
```

### Progress Tracking RLS Policies

```sql
-- Users can view and manage their own progress
CREATE POLICY "Users can manage their own video progress" 
ON tutorial_video_progress FOR ALL 
USING (
    user_id = auth.uid() 
    AND tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- Admins can view progress in their tenant (for analytics)
CREATE POLICY "Admins can view tenant video progress" 
ON tutorial_video_progress FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('tenant_admin', 'manager', 'coach')
        AND tenant_id = tutorial_video_progress.tenant_id
    )
);
```

## 🚀 How to Apply the Migrations

### Option 1: Via Supabase CLI (Recommended)
```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push

# Or run specific migration
supabase db execute --file supabase/migrations/046_tutorial_videos_system.sql
```

### Option 2: Via Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/046_tutorial_videos_system.sql`
4. Paste and run the SQL

### Option 3: Via Direct SQL Connection
```bash
psql YOUR_DATABASE_CONNECTION_STRING < supabase/migrations/046_tutorial_videos_system.sql
```

## 📝 Adding Your First Videos

### Step 1: Create Categories (Optional but Recommended)

```sql
-- Example: Add categories for your tenant
INSERT INTO tutorial_categories (tenant_id, name, description, display_order, icon, color)
VALUES 
    ('YOUR_TENANT_ID', 'Getting Started', 'Introduction and basics', 1, 'BookOpen', 'text-blue-600'),
    ('YOUR_TENANT_ID', 'Sessions', 'How to use treatment sessions', 2, 'PlayCircle', 'text-green-600'),
    ('YOUR_TENANT_ID', 'Modalities', 'Deep dives into each modality', 3, 'Brain', 'text-indigo-600'),
    ('YOUR_TENANT_ID', 'Features', 'Platform features and tools', 4, 'Lightbulb', 'text-yellow-600'),
    ('YOUR_TENANT_ID', 'Advanced', 'Advanced techniques', 5, 'Target', 'text-red-600');
```

### Step 2: Add Videos

#### Via API (Recommended):
```javascript
// POST /api/tutorials/videos
const response = await fetch('/api/tutorials/videos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Welcome to Mind-Shifting',
    description: 'Learn the basics of mind-shifting',
    video_url: 'https://www.youtube.com/embed/VIDEO_ID',
    thumbnail_url: 'https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg',
    duration_minutes: 8,
    duration_text: '8:45',
    provider: 'youtube',
    provider_video_id: 'VIDEO_ID',
    category_id: 'CATEGORY_UUID',
    is_featured: true,
    tags: ['introduction', 'basics', 'overview'],
    status: 'published'
  })
});
```

#### Via SQL:
```sql
INSERT INTO tutorial_videos (
    tenant_id, 
    title, 
    description, 
    video_url, 
    duration_text,
    provider, 
    category_id,
    is_featured,
    status
) VALUES (
    'YOUR_TENANT_ID',
    'Welcome to Mind-Shifting',
    'Learn the basics of mind-shifting and how our platform works',
    'https://www.youtube.com/embed/VIDEO_ID',
    '8:45',
    'youtube',
    'CATEGORY_ID',
    true,
    'published'
);
```

## 🎬 Video URL Formats

### YouTube
- **Embed URL:** `https://www.youtube.com/embed/VIDEO_ID`
- **Thumbnail:** `https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg`

### Vimeo
- **Embed URL:** `https://player.vimeo.com/video/VIDEO_ID`
- **Thumbnail:** Use Vimeo API to fetch

### Wistia
- **Embed URL:** `https://fast.wistia.net/embed/iframe/VIDEO_ID`

## 🔍 API Endpoints

### Videos
- `GET /api/tutorials/videos` - List all videos (supports filters)
- `GET /api/tutorials/videos/[id]` - Get specific video
- `POST /api/tutorials/videos` - Create video (admin only)
- `PUT /api/tutorials/videos/[id]` - Update video (admin only)
- `DELETE /api/tutorials/videos/[id]` - Delete video (admin only)

### Categories
- `GET /api/tutorials/categories` - List all categories
- `POST /api/tutorials/categories` - Create category (admin only)

### Progress
- `GET /api/tutorials/progress` - Get user's progress stats
- `POST /api/tutorials/progress` - Update video progress

## 📊 Analytics Functions

### Get User Progress Stats
```sql
SELECT get_user_video_progress_stats('USER_ID');
```

Returns:
```json
{
  "total_videos": 12,
  "watched_videos": 5,
  "in_progress_videos": 3,
  "total_watch_time_minutes": 47.5,
  "completion_percentage": 41.67
}
```

## 🔐 Subscription Tier Gating

To restrict a video to specific subscription tiers:

```sql
UPDATE tutorial_videos 
SET required_subscription_tier = 'level_2'
WHERE id = 'VIDEO_ID';

-- Options: null (all users), 'trial', 'level_1', 'level_2', 'level_3'
```

## 🎯 Features Summary

### ✅ Multi-Tenant Architecture
- All tables include `tenant_id` column
- RLS policies enforce tenant isolation
- Super admins can access all tenants

### ✅ Data Persistence
- All user interactions are saved (progress, likes, ratings)
- Resume functionality (last position tracking)
- Analytics and reporting ready

### ✅ Real Data Ready
- No sample/placeholder data in the code
- Empty state UI when no videos exist
- Admin prompts to add content

### ✅ Security
- Full RLS on all tables
- Role-based access control
- Subscription tier enforcement

## 📖 Next Steps

1. **Run the migration** (see "How to Apply the Migrations" above)
2. **Create categories** for your videos
3. **Add your first video** using the API or SQL
4. **Test the UI** at `/dashboard/tutorials`
5. **Configure subscription tiers** if needed

## 🆘 Troubleshooting

### Videos Not Showing Up?
- Check that `status = 'published'`
- Verify `tenant_id` matches user's tenant
- Check subscription tier requirements

### RLS Errors?
- Ensure user is authenticated
- Check user's role and tenant_id in profiles table
- Verify RLS policies are enabled

### Progress Not Saving?
- Check tenant_id is set correctly
- Verify user_id matches auth.uid()
- Check for unique constraint violations

## 📚 Related Documentation

- Community features: See migrations 016-018
- Subscription system: See migration 002
- User profiles: See migration 001
- Admin access: See migrations 003-004

## 🎉 Summary

✅ **Community System**: Fully implemented with posts, comments, likes, events, and RLS
✅ **Tutorial System**: Complete database schema with RLS and multi-tenant support
✅ **Sample Data**: Removed from all frontend components
✅ **Real Data**: All features ready for production data
✅ **Security**: Comprehensive RLS policies on all tables
✅ **Multi-Tenant**: Full tenant isolation with super admin override

Your platform is now ready for real data! 🚀
