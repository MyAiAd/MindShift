'use client';

import React, { useState, useRef } from 'react';
import { X, Paperclip, Loader2, AlertCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fileUploader, Attachment } from '@/lib/community/file-upload';

interface FileAttachmentUploaderProps {
  userId: string;
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  maxFiles?: number;
}

export default function FileAttachmentUploader({ 
  userId, 
  attachments, 
  onAttachmentsChange, 
  maxFiles = 5 
}: FileAttachmentUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const remainingSlots = maxFiles - attachments.length;

    if (fileArray.length > remainingSlots) {
      setError(`Can only add ${remainingSlots} more file(s). Maximum ${maxFiles} files per post.`);
      return;
    }

    setError(null);
    setUploading(true);
    setUploadProgress({});

    try {
      const uploadedFiles = await fileUploader.uploadMultipleFiles(
        fileArray,
        userId,
        (fileName, progress) => {
          setUploadProgress(prev => ({ ...prev, [fileName]: progress }));
        }
      );

      onAttachmentsChange([...attachments, ...uploadedFiles]);
      setUploadProgress({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload files');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFile = async (index: number) => {
    const fileToRemove = attachments[index];
    try {
      await fileUploader.deleteFile(fileToRemove.url);
      onAttachmentsChange(attachments.filter((_, i) => i !== index));
    } catch (err) {
      console.error('Failed to delete file:', err);
      // Still remove from UI even if delete fails
      onAttachmentsChange(attachments.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="space-y-3">
      {/* Upload Button */}
      {attachments.length < maxFiles && (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            disabled={uploading}
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Paperclip className="h-4 w-4 mr-2" />
                Attach Files
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            PDF, DOC, DOCX, XLS, XLSX, TXT • Max 100MB per file • {maxFiles - attachments.length} more allowed
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Upload Progress */}
      {uploading && Object.keys(uploadProgress).length > 0 && (
        <div className="space-y-2 p-3 bg-accent rounded-lg">
          {Object.entries(uploadProgress).map(([fileName, progress]) => (
            <div key={fileName} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate max-w-[200px]">{fileName}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors"
            >
              {/* File Icon */}
              <div className="flex-shrink-0 text-2xl">
                {fileUploader.getFileIcon(file.mimeType)}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fileUploader.formatFileSize(file.size)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <a
                  href={file.url}
                  download={file.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 hover:bg-accent rounded"
                  title="Download"
                >
                  <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </a>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(index)}
                  className="p-1 hover:bg-accent rounded"
                  disabled={uploading}
                  title="Remove"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* File Counter */}
      {attachments.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {attachments.length} of {maxFiles} files attached
        </p>
      )}
    </div>
  );
}

