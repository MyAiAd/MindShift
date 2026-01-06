'use client';

import React, { useState, useRef } from 'react';
import { X, Upload, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mediaUploader, MediaUrl, UploadProgress } from '@/lib/community/media-upload';

interface ImageUploaderProps {
  userId: string;
  images: MediaUrl[];
  onImagesChange: (images: MediaUrl[]) => void;
  maxImages?: number;
}

export default function ImageUploader({ 
  userId, 
  images, 
  onImagesChange, 
  maxImages = 10 
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const remainingSlots = maxImages - images.length;

    if (fileArray.length > remainingSlots) {
      setError(`Can only add ${remainingSlots} more image(s). Maximum ${maxImages} images per post.`);
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const uploadedImages = await mediaUploader.uploadMultipleImages(
        fileArray,
        userId,
        (progresses) => setUploadProgress(progresses)
      );

      onImagesChange([...images, ...uploadedImages]);
      setUploadProgress([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload images');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleRemoveImage = async (index: number) => {
    const imageToRemove = images[index];
    try {
      await mediaUploader.deleteImage(imageToRemove.url);
      onImagesChange(images.filter((_, i) => i !== index));
    } catch (err) {
      console.error('Failed to delete image:', err);
      // Still remove from UI even if delete fails
      onImagesChange(images.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="space-y-3">
      {/* Upload Area */}
      {images.length < maxImages && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-accent/50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            disabled={uploading}
          />

          {uploading ? (
            <div className="space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Uploading images...</p>
              {uploadProgress.map((progress, i) => (
                <div key={i} className="text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="truncate max-w-[200px]">{progress.fileName}</span>
                    <span>{progress.progress}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all"
                      style={{ width: `${progress.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground mb-1">
                Drag and drop images here
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                or click to browse (max {maxImages - images.length} more)
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose Files
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                JPEG, PNG, GIF, WebP • Max 50MB per image
              </p>
            </>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Image Preview Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((image, index) => (
            <div key={index} className="relative group aspect-square">
              <img
                src={image.url}
                alt={image.alt || 'Uploaded image'}
                className="w-full h-full object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => handleRemoveImage(index)}
                className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-black rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={uploading}
              >
                <X className="h-4 w-4 text-white" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-xs text-white truncate">
                  {image.width} × {image.height}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Counter */}
      {images.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {images.length} of {maxImages} images added
        </p>
      )}
    </div>
  );
}

