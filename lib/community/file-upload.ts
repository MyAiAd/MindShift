import { createClient } from '@/lib/database';

export interface Attachment {
  name: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

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
    this.supabase = createClient();
  }

  /**
   * Validate file before upload
   */
  validateFile(file: File): { valid: boolean; error?: string } {
    if (!this.allowedMimeTypes.includes(file.type)) {
      return { 
        valid: false, 
        error: 'File type not allowed. Only PDF, DOC, DOCX, XLS, XLSX, and TXT files are supported.' 
      };
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

    onProgress?.(10);

    // Generate unique filename with safe characters
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = file.name.split('.').pop();
    const safeFileName = file.name
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace unsafe chars
      .substring(0, 50); // Limit length
    const storagePath = `${userId}/${timestamp}-${randomString}-${safeFileName}.${extension}`;

    onProgress?.(30);

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

    onProgress?.(70);

    // Get signed URL (private bucket) - 1 year expiry
    const { data: urlData, error: urlError } = await this.supabase.storage
      .from('community-attachments')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    if (urlError || !urlData?.signedUrl) {
      throw new Error('Failed to generate download URL');
    }

    onProgress?.(100);

    return {
      name: file.name,
      url: urlData.signedUrl,
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
    const pathMatch = url.pathname.match(/\/object\/sign\/community-attachments\/(.+)\?/);
    
    if (!pathMatch) {
      throw new Error('Invalid file URL');
    }

    const filePath = decodeURIComponent(pathMatch[1]);

    const { error } = await this.supabase.storage
      .from('community-attachments')
      .remove([filePath]);

    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  }
}

export const fileUploader = new FileUploader();

