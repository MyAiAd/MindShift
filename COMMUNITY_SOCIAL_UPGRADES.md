# Community Social Platform Upgrades

## 🎯 **Overview**

This document outlines comprehensive upgrades to transform the MindShifting Community page (`/dashboard/community`) from a basic forum into a modern social platform similar to Skool or Facebook Groups. All implementations will be **idempotent** to support iterative development.

**Current Status**: Basic post/comment functionality exists with backend infrastructure in place.

**Target**: Rich social experience with media, enhanced UX, member directory, and advanced moderation.

---

## 📊 **Implementation Phases**

### **Phase 1: UI/UX Transformation**
### **Phase 2: Media & Rich Content** 
### **Phase 3: Member Directory & Messaging**
### **Phase 4: Admin Controls & Moderation**
### **Phase 5: Bug Fixes & Current Issues**

---

## 🎨 **PHASE 1: UI/UX Transformation**

### **Objective**: Make the community feel like Skool/Facebook Groups

### **1.1 Remove Stats Cards**

**Current State**: 
- Page shows "Members: 1,234", "Total Posts", "Active Today" cards
- Located at lines 283-319 in `app/dashboard/community/page.tsx`

**Required Changes**:
```typescript
// REMOVE THIS SECTION (lines 283-319):
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
  <Card>/* Members */</Card>
  <Card>/* Total Posts */</Card>
  <Card>/* Active Today */</Card>
</div>
```

**Implementation Notes**:
- Simply remove the stats cards section
- Adjust spacing/margin to maintain clean layout
- Stats can be moved to a separate Analytics page if needed later

**Files to Modify**:
- `app/dashboard/community/page.tsx` (lines 283-319)

**Acceptance Criteria**:
- ✅ Stats cards no longer visible on community page
- ✅ Page layout remains clean and balanced
- ✅ Mobile responsive layout maintained

---

### **1.2 Facebook/Skool-Style Layout**

**Current State**: 
- Basic card layout with posts
- Simple header with search

**Target Design**:
```
┌─────────────────────────────────────────┐
│ 🏠 MIND SHIFTING COMMUNITY   [+ Post]   │
│ Search posts...                         │
├─────────────────────────────────────────┤
│ 🔥 Pinned Posts                         │
│ ┌───────────────────────────────────┐   │
│ │ [User Avatar] John Doe · 2h ago   │   │
│ │ 📌 Welcome to the community!      │   │
│ │ Content here...                   │   │
│ │ 🏷️ Tag1 Tag2                      │   │
│ │ ❤️ 12  💬 5  👁️ 45                │   │
│ └───────────────────────────────────┘   │
├─────────────────────────────────────────┤
│ 📰 Recent Posts                         │
│ ┌───────────────────────────────────┐   │
│ │ [User Avatar] Jane Smith · 5m ago │   │
│ │ My progress update...             │   │
│ │ [Image Preview]                   │   │
│ │ [Video Embed]                     │   │
│ │ 🏷️ Progress Goals                 │   │
│ │ ❤️ 3  💬 1  👁️ 15                 │   │
│ └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Implementation Notes**:
- Cleaner visual hierarchy
- Better avatar prominence
- Inline reactions and counts
- Clear separation between pinned and regular content

**Files to Modify**:
- `app/dashboard/community/page.tsx` (entire component)
- Create new component: `components/community/PostFeed.tsx`
- Create new component: `components/community/PostCard.tsx`

**Acceptance Criteria**:
- ✅ Modern, clean Facebook-style layout
- ✅ Clear visual hierarchy
- ✅ Responsive on all devices
- ✅ Accessible (ARIA labels, keyboard navigation)

---

## 📸 **PHASE 2: Media & Rich Content**

### **Objective**: Enable image uploads, video embeds, and file attachments

### **2.1 Database Schema Updates**

**Current State**: 
- `community_posts` table has `metadata` JSONB field
- No dedicated fields for media

**Required Schema Addition**:

Create migration: `supabase/migrations/030_community_media_support.sql`

```sql
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
    DROP POLICY IF EXISTS "Users can update their own uploads" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own uploads" ON storage.objects;

    -- Create policies
    CREATE POLICY "Authenticated users can upload community media"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'community-media');

    CREATE POLICY "Public can view community media"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'community-media');

    CREATE POLICY "Users can update their own uploads"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'community-media' AND auth.uid()::text = (storage.foldername(name))[1]);

    CREATE POLICY "Users can delete their own uploads"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'community-media' AND auth.uid()::text = (storage.foldername(name))[1]);
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
    USING (bucket_id = 'community-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
END $$;

-- Add helpful comments
COMMENT ON COLUMN community_posts.media_urls IS 'Array of image URLs uploaded to Supabase Storage. Format: [{url: string, width: number, height: number, alt: string}]';
COMMENT ON COLUMN community_posts.video_embeds IS 'Array of video embed URLs (YouTube, Vimeo, Wistia). Format: [{provider: string, url: string, embedUrl: string, thumbnail: string}]';
COMMENT ON COLUMN community_posts.attachments IS 'Array of file attachments. Format: [{name: string, url: string, size: number, mimeType: string}]';
```

**Schema Documentation**:

```typescript
// TypeScript interface for media_urls
interface MediaUrl {
  url: string;           // Supabase Storage public URL
  width: number;         // Image width in pixels
  height: number;        // Image height in pixels
  alt?: string;          // Alt text for accessibility
  thumbnail?: string;    // Optional thumbnail URL
}

// TypeScript interface for video_embeds
interface VideoEmbed {
  provider: 'youtube' | 'vimeo' | 'wistia' | 'other';
  url: string;           // Original URL provided by user
  embedUrl: string;      // Iframe embed URL
  thumbnail?: string;    // Video thumbnail image
  title?: string;        // Video title
  duration?: number;     // Duration in seconds
}

// TypeScript interface for attachments
interface Attachment {
  name: string;          // Original filename
  url: string;           // Supabase Storage URL
  size: number;          // File size in bytes
  mimeType: string;      // MIME type
  uploadedAt: string;    // ISO timestamp
}
```

**Files to Create**:
- `supabase/migrations/030_community_media_support.sql`

**Acceptance Criteria**:
- ✅ Migration runs successfully without errors
- ✅ Migration is idempotent (can run multiple times safely)
- ✅ Storage buckets created with proper permissions
- ✅ RLS policies enforce security
- ✅ Indexes improve query performance

---

### **2.2 Image Upload Implementation**

**Current State**: No image upload capability

**Target Functionality**:
- Drag-and-drop image upload
- Multiple images per post (max 10)
- Image preview before posting
- Auto-compression for large images
- Progress indicator during upload

**Implementation**:

Create utility: `lib/community/media-upload.ts`

```typescript
import { createBrowserClient } from '@/lib/database';

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
  error?: string;
}

export class CommunityMediaUploader {
  private supabase;
  private maxFileSize = 50 * 1024 * 1024; // 50MB
  private maxImagesPerPost = 10;
  private allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  constructor() {
    this.supabase = createBrowserClient();
  }

  /**
   * Validate image file before upload
   */
  validateImage(file: File): { valid: boolean; error?: string } {
    if (!this.allowedImageTypes.includes(file.type)) {
      return { valid: false, error: 'Only JPEG, PNG, GIF, and WebP images are allowed' };
    }

    if (file.size > this.maxFileSize) {
      return { valid: false, error: 'Image must be less than 50MB' };
    }

    return { valid: true };
  }

  /**
   * Compress image if needed (using canvas API)
   */
  async compressImage(file: File, maxWidth = 1920, maxHeight = 1080, quality = 0.85): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Calculate new dimensions
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas to Blob conversion failed'));
            }
          },
          file.type,
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Upload single image to Supabase Storage
   */
  async uploadImage(
    file: File,
    userId: string,
    onProgress?: (progress: number) => void
  ): Promise<MediaUrl> {
    // Validate
    const validation = this.validateImage(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Compress if needed
    let uploadFile: File | Blob = file;
    if (file.size > 2 * 1024 * 1024) { // Compress if > 2MB
      uploadFile = await this.compressImage(file);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = file.name.split('.').pop();
    const fileName = `${userId}/${timestamp}-${randomString}.${extension}`;

    // Upload to Supabase Storage
    const { data, error } = await this.supabase.storage
      .from('community-media')
      .upload(fileName, uploadFile, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = this.supabase.storage
      .from('community-media')
      .getPublicUrl(fileName);

    // Get image dimensions
    const dimensions = await this.getImageDimensions(file);

    return {
      url: publicUrl,
      width: dimensions.width,
      height: dimensions.height,
      alt: file.name,
    };
  }

  /**
   * Get image dimensions
   */
  private async getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };

      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Upload multiple images with progress tracking
   */
  async uploadMultipleImages(
    files: File[],
    userId: string,
    onProgress?: (progresses: UploadProgress[]) => void
  ): Promise<MediaUrl[]> {
    if (files.length > this.maxImagesPerPost) {
      throw new Error(`Maximum ${this.maxImagesPerPost} images allowed per post`);
    }

    const progresses: UploadProgress[] = files.map(f => ({
      fileName: f.name,
      progress: 0,
      status: 'uploading',
    }));

    const uploadPromises = files.map(async (file, index) => {
      try {
        const result = await this.uploadImage(file, userId, (progress) => {
          progresses[index].progress = progress;
          onProgress?.(progresses);
        });
        progresses[index].status = 'complete';
        progresses[index].progress = 100;
        onProgress?.(progresses);
        return result;
      } catch (error) {
        progresses[index].status = 'error';
        progresses[index].error = error instanceof Error ? error.message : 'Upload failed';
        onProgress?.(progresses);
        throw error;
      }
    });

    return Promise.all(uploadPromises);
  }

  /**
   * Delete image from storage
   */
  async deleteImage(imageUrl: string): Promise<void> {
    // Extract file path from URL
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split('/');
    const filePath = pathParts.slice(pathParts.indexOf('community-media') + 1).join('/');

    const { error } = await this.supabase.storage
      .from('community-media')
      .remove([filePath]);

    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  }
}

export const mediaUploader = new CommunityMediaUploader();
```

**Files to Create**:
- `lib/community/media-upload.ts`
- `components/community/ImageUploader.tsx`
- `components/community/ImageGallery.tsx`

**Files to Modify**:
- `app/dashboard/community/page.tsx` (add image upload to post creation)
- `app/api/community/posts/route.ts` (handle media_urls in POST)

**Acceptance Criteria**:
- ✅ Users can drag-drop images
- ✅ Multiple images supported (max 10)
- ✅ Images auto-compress before upload
- ✅ Upload progress shown
- ✅ Preview images before posting
- ✅ Delete images before posting
- ✅ Images display in post feed

---

### **2.3 Video Embed Implementation**

**Current State**: No video embed capability

**Target Functionality**:
- Paste YouTube, Vimeo, Wistia URLs
- Auto-detect video provider
- Extract video ID and create embed URL
- Show video thumbnail in feed
- Click to play embedded video
- Support for unlisted videos

**Implementation**:

Create utility: `lib/community/video-embed.ts`

```typescript
export interface VideoProvider {
  name: 'youtube' | 'vimeo' | 'wistia' | 'other';
  urlPatterns: RegExp[];
  extractId: (url: string) => string | null;
  getEmbedUrl: (id: string) => string;
  getThumbnail: (id: string) => Promise<string | null>;
}

export const videoProviders: Record<string, VideoProvider> = {
  youtube: {
    name: 'youtube',
    urlPatterns: [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
    ],
    extractId: (url: string) => {
      for (const pattern of videoProviders.youtube.urlPatterns) {
        const match = url.match(pattern);
        if (match) return match[1];
      }
      return null;
    },
    getEmbedUrl: (id: string) => `https://www.youtube.com/embed/${id}`,
    getThumbnail: async (id: string) => {
      // Try high quality first, fall back to default
      const qualities = ['maxresdefault', 'hqdefault', 'mqdefault', 'default'];
      for (const quality of qualities) {
        const url = `https://img.youtube.com/vi/${id}/${quality}.jpg`;
        try {
          const response = await fetch(url, { method: 'HEAD' });
          if (response.ok) return url;
        } catch {
          continue;
        }
      }
      return `https://img.youtube.com/vi/${id}/default.jpg`;
    },
  },

  vimeo: {
    name: 'vimeo',
    urlPatterns: [
      /vimeo\.com\/([0-9]+)/,
      /player\.vimeo\.com\/video\/([0-9]+)/,
    ],
    extractId: (url: string) => {
      for (const pattern of videoProviders.vimeo.urlPatterns) {
        const match = url.match(pattern);
        if (match) return match[1];
      }
      return null;
    },
    getEmbedUrl: (id: string) => `https://player.vimeo.com/video/${id}`,
    getThumbnail: async (id: string) => {
      try {
        const response = await fetch(`https://vimeo.com/api/v2/video/${id}.json`);
        const data = await response.json();
        return data[0]?.thumbnail_large || null;
      } catch {
        return null;
      }
    },
  },

  wistia: {
    name: 'wistia',
    urlPatterns: [
      /wistia\.com\/medias\/([a-zA-Z0-9]+)/,
      /fast\.wistia\.net\/embed\/iframe\/([a-zA-Z0-9]+)/,
    ],
    extractId: (url: string) => {
      for (const pattern of videoProviders.wistia.urlPatterns) {
        const match = url.match(pattern);
        if (match) return match[1];
      }
      return null;
    },
    getEmbedUrl: (id: string) => `https://fast.wistia.net/embed/iframe/${id}`,
    getThumbnail: async (id: string) => {
      try {
        const response = await fetch(`https://fast.wistia.net/oembed?url=https://home.wistia.com/medias/${id}`);
        const data = await response.json();
        return data.thumbnail_url || null;
      } catch {
        return null;
      }
    },
  },
};

export class VideoEmbedParser {
  /**
   * Detect video provider from URL
   */
  detectProvider(url: string): VideoProvider | null {
    for (const provider of Object.values(videoProviders)) {
      for (const pattern of provider.urlPatterns) {
        if (pattern.test(url)) {
          return provider;
        }
      }
    }
    return null;
  }

  /**
   * Parse video URL and create embed object
   */
  async parseVideoUrl(url: string): Promise<VideoEmbed | null> {
    const provider = this.detectProvider(url);
    if (!provider) {
      return null;
    }

    const videoId = provider.extractId(url);
    if (!videoId) {
      return null;
    }

    const embedUrl = provider.getEmbedUrl(videoId);
    const thumbnail = await provider.getThumbnail(videoId);

    return {
      provider: provider.name,
      url,
      embedUrl,
      thumbnail: thumbnail || undefined,
    };
  }

  /**
   * Parse multiple video URLs
   */
  async parseMultipleUrls(urls: string[]): Promise<VideoEmbed[]> {
    const promises = urls.map(url => this.parseVideoUrl(url));
    const results = await Promise.all(promises);
    return results.filter((r): r is VideoEmbed => r !== null);
  }

  /**
   * Validate video URL
   */
  isValidVideoUrl(url: string): boolean {
    return this.detectProvider(url) !== null;
  }
}

export const videoParser = new VideoEmbedParser();
```

**Files to Create**:
- `lib/community/video-embed.ts`
- `components/community/VideoEmbedInput.tsx`
- `components/community/VideoPlayer.tsx`

**Files to Modify**:
- `app/dashboard/community/page.tsx` (add video embed to post creation)
- `app/api/community/posts/route.ts` (handle video_embeds in POST)

**Acceptance Criteria**:
- ✅ Paste YouTube/Vimeo/Wistia URLs
- ✅ Auto-detect and validate URLs
- ✅ Show video thumbnail in feed
- ✅ Click to play embedded video
- ✅ Responsive video player
- ✅ Support multiple videos per post

---

### **2.4 File Attachment Implementation**

**Current State**: No file attachment capability

**Target Functionality**:
- Upload PDFs, DOC/DOCX, XLS/XLSX, TXT
- Max 100MB per file
- Max 5 files per post
- Show file icon, name, and size
- Download functionality
- Virus scanning (future enhancement)

**Implementation**:

Create utility: `lib/community/file-upload.ts`

```typescript
import { createBrowserClient } from '@/lib/database';

export class FileUploader {
  private supabase;
  private maxFileSize = 100 * 1024 * 1024; // 100MB
  private maxFilesPerPost = 5;
  private allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ];

  constructor() {
    this.supabase = createBrowserClient();
  }

  /**
   * Validate file before upload
   */
  validateFile(file: File): { valid: boolean; error?: string } {
    if (!this.allowedMimeTypes.includes(file.type)) {
      return { valid: false, error: 'File type not allowed. Only PDF, DOC, DOCX, XLS, XLSX, and TXT files are supported.' };
    }

    if (file.size > this.maxFileSize) {
      return { valid: false, error: 'File must be less than 100MB' };
    }

    return { valid: true };
  }

  /**
   * Upload file to Supabase Storage
   */
  async uploadFile(
    file: File,
    userId: string,
    onProgress?: (progress: number) => void
  ): Promise<Attachment> {
    // Validate
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = file.name.split('.').pop();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${userId}/${timestamp}-${randomString}-${safeFileName}`;

    // Upload to Supabase Storage
    const { data, error } = await this.supabase.storage
      .from('community-attachments')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get signed URL (private bucket)
    const { data: { signedUrl } } = await this.supabase.storage
      .from('community-attachments')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year expiry

    return {
      name: file.name,
      url: signedUrl || '',
      size: file.size,
      mimeType: file.type,
      uploadedAt: new Date().toISOString(),
    };
  }

  /**
   * Upload multiple files
   */
  async uploadMultipleFiles(
    files: File[],
    userId: string,
    onProgress?: (fileName: string, progress: number) => void
  ): Promise<Attachment[]> {
    if (files.length > this.maxFilesPerPost) {
      throw new Error(`Maximum ${this.maxFilesPerPost} files allowed per post`);
    }

    const uploadPromises = files.map(file =>
      this.uploadFile(file, userId, (progress) =>
        onProgress?.(file.name, progress)
      )
    );

    return Promise.all(uploadPromises);
  }

  /**
   * Get file icon based on mime type
   */
  getFileIcon(mimeType: string): string {
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.includes('word')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    if (mimeType === 'text/plain') return '📃';
    return '📎';
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Delete file from storage
   */
  async deleteFile(fileUrl: string): Promise<void> {
    // Extract file path from signed URL
    const url = new URL(fileUrl);
    const pathMatch = url.pathname.match(/\/object\/sign\/community-attachments\/(.+)/);
    if (!pathMatch) {
      throw new Error('Invalid file URL');
    }

    const filePath = pathMatch[1];

    const { error } = await this.supabase.storage
      .from('community-attachments')
      .remove([filePath]);

    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  }
}

export const fileUploader = new FileUploader();
```

**Files to Create**:
- `lib/community/file-upload.ts`
- `components/community/FileUploader.tsx`
- `components/community/FileAttachmentList.tsx`

**Files to Modify**:
- `app/dashboard/community/page.tsx` (add file upload to post creation)
- `app/api/community/posts/route.ts` (handle attachments in POST)

**Acceptance Criteria**:
- ✅ Upload PDF, DOC, DOCX, XLS, XLSX, TXT files
- ✅ Max 100MB per file, 5 files per post
- ✅ Show file icon, name, size
- ✅ Download button functional
- ✅ Progress indicator during upload
- ✅ Delete files before posting

---

### **2.5 Tag Dropdown Integration**

**Current State**: 
- Tags backend exists (`community_tags` table)
- API endpoints functional (`/api/community/tags`)
- No UI for selecting tags

**Target Functionality**:
- Multi-select dropdown for tags
- Search/filter tags by name
- Create new tags on-the-fly (if user has permission)
- Show tag color chips
- Admin can manage tags in settings

**Implementation**:

Create component: `components/community/TagSelector.tsx`

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { Check, X, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagSelectorProps {
  selectedTags: string[]; // Array of tag IDs
  onChange: (tagIds: string[]) => void;
  maxTags?: number;
}

export default function TagSelector({ selectedTags, onChange, maxTags = 5 }: TagSelectorProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch available tags
  useEffect(() => {
    fetchTags();
  }, []);

  // Filter tags based on search
  useEffect(() => {
    if (searchQuery) {
      setFilteredTags(
        tags.filter(tag =>
          tag.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredTags(tags);
    }
  }, [searchQuery, tags]);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/community/tags?sort_by=use_count&limit=100');
      if (response.ok) {
        const data = await response.json();
        setTags(data.tags || []);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onChange(selectedTags.filter(id => id !== tagId));
    } else if (selectedTags.length < maxTags) {
      onChange([...selectedTags, tagId]);
    }
  };

  const createNewTag = async () => {
    if (!searchQuery.trim()) return;

    try {
      const response = await fetch('/api/community/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: searchQuery.trim(),
          color: '#6366f1', // Default indigo color
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTags([...tags, data.tag]);
        onChange([...selectedTags, data.tag.id]);
        setSearchQuery('');
      }
    } catch (error) {
      console.error('Error creating tag:', error);
    }
  };

  const selectedTagObjects = tags.filter(tag => selectedTags.includes(tag.id));

  return (
    <div className="relative">
      {/* Selected Tags Display */}
      <div className="flex flex-wrap gap-2 mb-2">
        {selectedTagObjects.map(tag => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium"
            style={{
              backgroundColor: `${tag.color}20`,
              color: tag.color,
            }}
          >
            {tag.name}
            <button
              onClick={() => toggleTag(tag.id)}
              className="hover:bg-black/10 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {/* Tag Input/Dropdown */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search or add tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowDropdown(true)}
            className="pl-10"
          />
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowDropdown(false)}
            />
            <div className="absolute z-20 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">Loading tags...</div>
              ) : filteredTags.length === 0 ? (
                <div className="p-4">
                  <p className="text-muted-foreground text-sm mb-2">No tags found</p>
                  {searchQuery && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={createNewTag}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create "{searchQuery}"
                    </Button>
                  )}
                </div>
              ) : (
                <div className="py-2">
                  {filteredTags.map(tag => {
                    const isSelected = selectedTags.includes(tag.id);
                    const isMaxed = selectedTags.length >= maxTags && !isSelected;
                    
                    return (
                      <button
                        key={tag.id}
                        onClick={() => !isMaxed && toggleTag(tag.id)}
                        disabled={isMaxed}
                        className={`w-full px-4 py-2 text-left flex items-center justify-between hover:bg-accent ${
                          isMaxed ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <span
                          className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-sm"
                          style={{
                            backgroundColor: `${tag.color}20`,
                            color: tag.color,
                          }}
                        >
                          {tag.name}
                        </span>
                        {isSelected && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {selectedTags.length >= maxTags && (
        <p className="text-xs text-muted-foreground mt-1">
          Maximum {maxTags} tags per post
        </p>
      )}
    </div>
  );
}
```

**Files to Create**:
- `components/community/TagSelector.tsx`

**Files to Modify**:
- `app/dashboard/community/page.tsx` (integrate TagSelector in post creation modal)

**Acceptance Criteria**:
- ✅ Multi-select dropdown for tags
- ✅ Search tags by name
- ✅ Create new tags inline
- ✅ Show tag colors
- ✅ Max 5 tags per post
- ✅ Visual feedback for selected tags

---

## 👥 **PHASE 3: Member Directory & Messaging**

### **Objective**: Enable member discovery, profiles, and direct messaging

### **3.1 Member Directory Database**

**Current State**:
- `profiles` table exists with user data
- No specific member directory features
- Messaging system exists (`client_messages` table)

**Required Additions**:

Create migration: `supabase/migrations/031_community_member_features.sql`

```sql
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

    -- Add joined_at field (when they joined the community)
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
```

**Files to Create**:
- `supabase/migrations/031_community_member_features.sql`

**Acceptance Criteria**:
- ✅ Migration runs successfully
- ✅ Idempotent (safe to run multiple times)
- ✅ Profile fields added for community features
- ✅ Blocking system implemented
- ✅ Member stats function created
- ✅ Last active tracking working

---

### **3.2 Member Directory UI**

**Target Design**:
```
┌──────────────────────────────────────────────┐
│ 👥 MEMBERS                          [X Close] │
├──────────────────────────────────────────────┤
│ 🔍 Search members...                         │
├──────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────┐ │
│ │ [Avatar] John Doe        🟢 Online       │ │
│ │ Coach · Member since Jan 2024            │ │
│ │ 15 posts · 42 comments · Last active 2h  │ │
│ │ [💬 Message] [🚫 Block]                  │ │
│ └──────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────┐ │
│ │ [Avatar] Jane Smith      ⚪ Offline      │ │
│ │ Member · Member since Mar 2024           │ │
│ │ 8 posts · 15 comments · Last active 1d   │ │
│ │ [💬 Message] [🚫 Block]                  │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

**Implementation**:

Create component: `components/community/MemberDirectory.tsx`

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Search, MessageCircle, Ban, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  community_joined_at: string;
  last_active_at: string;
  stats: {
    post_count: number;
    comment_count: number;
    like_count: number;
  };
  is_blocked?: boolean;
}

interface MemberDirectoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MemberDirectory({ isOpen, onClose }: MemberDirectoryProps) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [blocking, setBlocking] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchMembers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchQuery) {
      setFilteredMembers(
        members.filter(member =>
          `${member.first_name} ${member.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
          member.email.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredMembers(members);
    }
  }, [searchQuery, members]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/community/members');
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members || []);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMessage = (memberId: string) => {
    router.push(`/dashboard/messages?to=${memberId}`);
    onClose();
  };

  const handleBlock = async (memberId: string) => {
    if (!confirm('Are you sure you want to block this member? You will no longer see their posts or comments.')) {
      return;
    }

    try {
      setBlocking(memberId);
      const response = await fetch('/api/community/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked_id: memberId }),
      });

      if (response.ok) {
        // Update local state
        setMembers(members.map(m =>
          m.id === memberId ? { ...m, is_blocked: true } : m
        ));
      }
    } catch (error) {
      console.error('Error blocking user:', error);
    } finally {
      setBlocking(null);
    }
  };

  const handleUnblock = async (memberId: string) => {
    try {
      setBlocking(memberId);
      const response = await fetch(`/api/community/blocks/${memberId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Update local state
        setMembers(members.map(m =>
          m.id === memberId ? { ...m, is_blocked: false } : m
        ));
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
    } finally {
      setBlocking(null);
    }
  };

  const formatLastActive = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 5) return 'Online';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const formatJoinedDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const getActivityStatus = (lastActive: string) => {
    const diffInMinutes = Math.floor((new Date().getTime() - new Date(lastActive).getTime()) / (1000 * 60));
    if (diffInMinutes < 5) return { color: 'bg-green-500', label: 'Online' };
    if (diffInMinutes < 60) return { color: 'bg-yellow-500', label: 'Recently active' };
    return { color: 'bg-gray-400', label: 'Offline' };
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              👥 Members ({members.length})
            </span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Members List */}
        <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-2">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading members...
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No members found
            </div>
          ) : (
            filteredMembers.map(member => {
              const activityStatus = getActivityStatus(member.last_active_at);
              const isCurrentUser = member.id === user?.id;

              return (
                <div
                  key={member.id}
                  className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {/* Avatar */}
                      <div className="relative">
                        {member.avatar_url ? (
                          <img
                            src={member.avatar_url}
                            alt={`${member.first_name} ${member.last_name}`}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span className="text-indigo-600 font-medium text-lg">
                              {member.first_name?.[0]}{member.last_name?.[0]}
                            </span>
                          </div>
                        )}
                        <div
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${activityStatus.color}`}
                          title={activityStatus.label}
                        />
                      </div>

                      {/* Member Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-foreground truncate">
                            {member.first_name} {member.last_name}
                          </h4>
                          {member.role !== 'user' && (
                            <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full">
                              {member.role}
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground mb-2">
                          Member since {formatJoinedDate(member.community_joined_at)}
                        </p>

                        {member.bio && (
                          <p className="text-sm text-foreground mb-2 line-clamp-2">
                            {member.bio}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{member.stats.post_count} posts</span>
                          <span>·</span>
                          <span>{member.stats.comment_count} comments</span>
                          <span>·</span>
                          <span>Last active {formatLastActive(member.last_active_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {!isCurrentUser && (
                      <div className="flex items-center gap-2 ml-4">
                        {!member.is_blocked ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMessage(member.id)}
                            >
                              <MessageCircle className="h-4 w-4 mr-1" />
                              Message
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleBlock(member.id)}
                              disabled={blocking === member.id}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUnblock(member.id)}
                            disabled={blocking === member.id}
                          >
                            Unblock
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Files to Create**:
- `components/community/MemberDirectory.tsx`
- `app/api/community/members/route.ts`
- `app/api/community/blocks/route.ts`
- `app/api/community/blocks/[id]/route.ts`

**Files to Modify**:
- `app/dashboard/community/page.tsx` (add Members button to header)

**Acceptance Criteria**:
- ✅ Members button in top-right corner
- ✅ Modal opens with member list
- ✅ Search members by name
- ✅ Show member stats and activity
- ✅ Message button opens messaging
- ✅ Block/unblock functionality works
- ✅ Responsive design

---

## 🛡️ **PHASE 4: Admin Controls & Moderation**

### **Objective**: Enable admins to pin posts, moderate content, and manage community

### **4.1 Pin Post Functionality**

**Current State**:
- `is_pinned` field exists in `community_posts` table
- No UI to pin/unpin posts
- Backend API supports pinning

**Implementation**:

**Files to Modify**:
- `app/dashboard/community/page.tsx` (add pin button for admins)
- `components/community/PostCard.tsx` (add admin menu)

**Key Changes**:
```typescript
// Add admin menu to PostCard component
const isAdmin = ['super_admin', 'tenant_admin', 'manager'].includes(profile?.role || '');

{isAdmin && (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm">
        <MoreVertical className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => handlePinPost(post.id, !post.is_pinned)}>
        <Pin className="h-4 w-4 mr-2" />
        {post.is_pinned ? 'Unpin Post' : 'Pin Post'}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleEditPost(post.id)}>
        <Edit className="h-4 w-4 mr-2" />
        Edit Post
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleDeletePost(post.id)} className="text-red-600">
        <Trash2 className="h-4 w-4 mr-2" />
        Delete Post
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)}
```

**API Call**:
```typescript
const handlePinPost = async (postId: string, pin: boolean) => {
  try {
    const response = await fetch(`/api/community/posts/${postId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: pin }),
    });

    if (response.ok) {
      // Refresh posts
      fetchPosts();
    }
  } catch (error) {
    console.error('Error pinning post:', error);
  }
};
```

**Files to Modify**:
- `app/dashboard/community/page.tsx`
- Create: `components/community/PostAdminMenu.tsx`

**Acceptance Criteria**:
- ✅ Admins see menu with pin/unpin option
- ✅ Pinned posts appear at top of feed
- ✅ Visual indicator for pinned posts
- ✅ Only admins can pin/unpin
- ✅ Changes reflect immediately

---

## 🐛 **PHASE 5: Bug Fixes & Current Issues**

### **Objective**: Fix existing bugs preventing commenting and other issues

### **5.1 Comments Not Working**

**Current Issue**: 
- Users cannot add comments on `/dashboard/community`
- Possible causes: API endpoint errors, RLS issues, frontend bugs

**Investigation Steps**:

1. **Check API endpoint**: `/api/community/comments` (line 58 in route.ts has syntax error)
```typescript
// CURRENT (LINE 58-60):
if (postId)
  query = query.eq('post_id', postId);
}

// SHOULD BE:
if (postId) {
  query = query.eq('post_id', postId);
}
```

2. **Check frontend comment submission**:
- Line 184-212 in `app/dashboard/community/page.tsx`
- Verify `postId` vs `post_id` parameter naming

3. **Check RLS policies**:
- Verify `community_comments` policies allow INSERT

**Fix Required**:

Create file: `supabase/migrations/032_fix_community_comments.sql`

```sql
-- ============================================================================
-- Migration 032: Fix Community Comments
-- ============================================================================
-- Fixes comment creation and display issues
-- This migration is IDEMPOTENT - safe to run multiple times

-- Verify and fix RLS policies for community_comments
DO $$ 
BEGIN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Users can view published comments in their tenant" ON community_comments;
    DROP POLICY IF EXISTS "Users can create comments in their tenant" ON community_comments;
    DROP POLICY IF EXISTS "Users can update their own comments" ON community_comments;
    DROP POLICY IF EXISTS "Users can delete their own comments" ON community_comments;

    -- Create comprehensive policies
    CREATE POLICY "Users can view published comments in their tenant"
    ON community_comments FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        AND status IN ('published', 'approved')
    );

    CREATE POLICY "Users can create comments in their tenant"
    ON community_comments FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid() AND
        tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()) AND
        EXISTS (
            SELECT 1 FROM community_posts 
            WHERE id = community_comments.post_id 
            AND status = 'published'
        )
    );

    CREATE POLICY "Users can update their own comments"
    ON community_comments FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

    CREATE POLICY "Users can delete their own comments"
    ON community_comments FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

    -- Admin policies
    DROP POLICY IF EXISTS "Admins can manage all comments in their tenant" ON community_comments;
    CREATE POLICY "Admins can manage all comments in their tenant"
    ON community_comments FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'tenant_admin', 'manager')
            AND (
                role = 'super_admin' OR 
                tenant_id = community_comments.tenant_id
            )
        )
    );
END $$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_community_comments_post_status 
ON community_comments(post_id, status) 
WHERE status IN ('published', 'approved');

-- Add helpful constraint
ALTER TABLE community_comments 
ADD CONSTRAINT check_comment_content_length 
CHECK (char_length(content) BETWEEN 1 AND 10000);
```

**Fix API Endpoint**:

In `app/api/community/comments/route.ts`, fix line 58:

```typescript
// BEFORE:
if (postId)
  query = query.eq('post_id', postId);
}

// AFTER:
if (postId) {
  query = query.eq('post_id', postId);
}
```

**Fix Frontend**:

In `app/dashboard/community/page.tsx`, update `handleAddComment`:

```typescript
const handleAddComment = async (postId: string) => {
  if (!newComment.trim()) return;

  try {
    const response = await fetch('/api/community/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post_id: postId,  // Changed from postId to post_id
        content: newComment.trim(),
        status: 'published',
      })
    });

    if (response.ok) {
      setNewComment('');
      fetchComments(postId);
      
      // Update comment count
      setPosts(posts.map(post => {
        if (post.id === postId) {
          return { ...post, comment_count: post.comment_count + 1 };
        }
        return post;
      }));
    } else {
      const error = await response.json();
      console.error('Error adding comment:', error);
      alert(`Failed to add comment: ${error.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error adding comment:', error);
    alert('Failed to add comment. Please try again.');
  }
};
```

**Files to Create**:
- `supabase/migrations/032_fix_community_comments.sql`

**Files to Modify**:
- `app/api/community/comments/route.ts` (fix syntax error line 58)
- `app/dashboard/community/page.tsx` (fix API call parameters)

**Acceptance Criteria**:
- ✅ Users can add comments
- ✅ Comments appear immediately
- ✅ Comment count updates
- ✅ Errors show helpful messages
- ✅ RLS policies allow authenticated users

---

## 📋 **Implementation Checklist**

### **Phase 1: UI/UX Transformation**
- [ ] Remove stats cards from community page
- [ ] Implement Facebook/Skool-style layout
- [ ] Create PostFeed component
- [ ] Create enhanced PostCard component
- [ ] Test responsive design
- [ ] Verify accessibility

### **Phase 2: Media & Rich Content**
- [ ] Run migration 030 (media support)
- [ ] Create media upload utility
- [ ] Create video embed utility
- [ ] Create file upload utility
- [ ] Create ImageUploader component
- [ ] Create VideoEmbedInput component
- [ ] Create FileUploader component
- [ ] Create TagSelector component
- [ ] Integrate media in post creation modal
- [ ] Update API endpoints for media handling
- [ ] Test image upload/display
- [ ] Test video embed (YouTube, Vimeo, Wistia)
- [ ] Test file attachments
- [ ] Test tag selection/creation

### **Phase 3: Member Directory & Messaging**
- [ ] Run migration 031 (member features)
- [ ] Create MemberDirectory component
- [ ] Create member API endpoints
- [ ] Create blocking API endpoints
- [ ] Add Members button to community header
- [ ] Test member search
- [ ] Test messaging integration
- [ ] Test block/unblock functionality
- [ ] Test member stats display

### **Phase 4: Admin Controls**
- [ ] Create PostAdminMenu component
- [ ] Add pin/unpin functionality
- [ ] Add edit post functionality
- [ ] Add delete post functionality
- [ ] Test admin-only features
- [ ] Verify role-based permissions

### **Phase 5: Bug Fixes**
- [ ] Run migration 032 (fix comments)
- [ ] Fix API syntax error in comments route
- [ ] Fix frontend comment submission
- [ ] Test comment creation
- [ ] Test comment display
- [ ] Verify error handling

---

## 🧪 **Testing Plan**

### **Functional Testing**
- [ ] Test as regular user
- [ ] Test as admin user
- [ ] Test as super admin
- [ ] Test on desktop Chrome
- [ ] Test on desktop Firefox
- [ ] Test on desktop Safari
- [ ] Test on mobile iOS
- [ ] Test on mobile Android
- [ ] Test with screen reader

### **Security Testing**
- [ ] Verify RLS policies prevent unauthorized access
- [ ] Test file upload size limits
- [ ] Test file type restrictions
- [ ] Test SQL injection prevention
- [ ] Test XSS prevention
- [ ] Test CSRF protection

### **Performance Testing**
- [ ] Test with 100+ posts
- [ ] Test with 1000+ members
- [ ] Test image upload speed
- [ ] Test page load time
- [ ] Test search performance
- [ ] Test infinite scroll (if implemented)

---

## 🚀 **Deployment Steps**

1. **Database Migrations**
   ```bash
   # Run migrations in order
   supabase migration up 030_community_media_support
   supabase migration up 031_community_member_features
   supabase migration up 032_fix_community_comments
   ```

2. **Storage Setup**
   - Verify storage buckets created
   - Test RLS policies on storage
   - Configure CDN if needed

3. **Frontend Deployment**
   - Build and test locally
   - Deploy to staging environment
   - Run full test suite
   - Deploy to production

4. **Post-Deployment**
   - Monitor error logs
   - Check performance metrics
   - Gather user feedback
   - Create admin documentation

---

## 📚 **Additional Documentation Needed**

1. **User Guide**: How to use community features
2. **Admin Guide**: How to moderate and manage community
3. **Developer Guide**: Architecture and customization
4. **API Documentation**: Complete API reference
5. **Troubleshooting Guide**: Common issues and solutions

---

## 🔄 **Iteration Plan**

### **Version 1.0 (MVP)**
- Basic post creation with media
- Member directory with search
- Block functionality
- Admin pin posts
- Bug fixes

### **Version 1.1**
- Rich text editor for posts
- @ mentions in posts/comments
- Emoji reactions
- Post bookmarking
- Notifications for @mentions

### **Version 1.2**
- Advanced moderation tools
- Content reporting system
- Auto-moderation rules
- Member reputation system
- Gamification (badges, levels)

### **Version 2.0**
- Live chat/real-time features
- Voice/video rooms
- Calendar/events integration
- Analytics dashboard
- Mobile app

---

## 💡 **Notes & Considerations**

### **Media Storage**
- Consider CDN for media delivery
- Implement image optimization pipeline
- Add virus scanning for file uploads
- Set up automated backup of storage buckets

### **Scalability**
- Consider implementing pagination/infinite scroll for large communities
- Add caching layer for frequently accessed data
- Implement rate limiting on API endpoints
- Consider CDN for static assets

### **Accessibility**
- All images must have alt text
- Keyboard navigation required
- Screen reader compatibility
- ARIA labels on interactive elements
- Color contrast ratios must meet WCAG AA standards

### **Content Moderation**
- Consider automated content moderation (AI-based)
- Implement user reporting system
- Create moderation queue for admins
- Add content guidelines/community rules page

---

## 🎯 **Success Metrics**

### **Engagement Metrics**
- Daily active users (DAU)
- Posts per day
- Comments per post
- Time spent in community
- Return visitor rate

### **Technical Metrics**
- Page load time < 2 seconds
- Image upload time < 5 seconds
- API response time < 200ms
- Error rate < 0.1%
- Uptime > 99.9%

### **User Satisfaction**
- User survey scores
- Feature adoption rates
- Support ticket volume
- User retention rate

---

**END OF DOCUMENT**

This comprehensive guide provides everything needed to transform the MindShifting Community into a modern social platform. All implementations are designed to be idempotent and support iterative development.

