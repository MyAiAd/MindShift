import { createClient } from '@/lib/database';

export interface MediaUrl {
  url: string;
  width: number;
  height: number;
  alt?: string;
  thumbnail?: string;
}

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
    this.supabase = createClient();
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
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);

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

    // Get original dimensions before compression
    const originalDimensions = await this.getImageDimensions(file);

    // Compress if needed
    let uploadFile: File | Blob = file;
    if (file.size > 2 * 1024 * 1024) { // Compress if > 2MB
      onProgress?.(10);
      uploadFile = await this.compressImage(file);
      onProgress?.(30);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = file.name.split('.').pop();
    const fileName = `${userId}/${timestamp}-${randomString}.${extension}`;

    onProgress?.(40);

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

    onProgress?.(80);

    // Get public URL
    const { data: { publicUrl } } = this.supabase.storage
      .from('community-media')
      .getPublicUrl(fileName);

    onProgress?.(100);

    return {
      url: publicUrl,
      width: originalDimensions.width,
      height: originalDimensions.height,
      alt: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for alt text
    };
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
    const bucketIndex = pathParts.findIndex(part => part === 'community-media');
    
    if (bucketIndex === -1) {
      throw new Error('Invalid image URL');
    }

    const filePath = pathParts.slice(bucketIndex + 1).join('/');

    const { error } = await this.supabase.storage
      .from('community-media')
      .remove([filePath]);

    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  }
}

export const mediaUploader = new CommunityMediaUploader();

