'use client';

import React, { useState } from 'react';
import { X, Link as LinkIcon, Loader2, AlertCircle, CheckCircle, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { videoParser, VideoEmbed } from '@/lib/community/video-embed';

interface VideoEmbedInputProps {
  videos: VideoEmbed[];
  onVideosChange: (videos: VideoEmbed[]) => void;
  maxVideos?: number;
}

export default function VideoEmbedInput({ 
  videos, 
  onVideosChange, 
  maxVideos = 5 
}: VideoEmbedInputProps) {
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleAddVideo = async () => {
    if (!videoUrl.trim()) return;

    if (videos.length >= maxVideos) {
      setError(`Maximum ${maxVideos} videos per post`);
      return;
    }

    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const parsedVideo = await videoParser.parseVideoUrl(videoUrl.trim());
      
      if (!parsedVideo) {
        setError('Invalid video URL. Supported: YouTube, Vimeo, Wistia');
        return;
      }

      // Check for duplicates
      if (videos.some(v => v.url === parsedVideo.url)) {
        setError('This video has already been added');
        return;
      }

      onVideosChange([...videos, parsedVideo]);
      setVideoUrl('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse video URL');
      console.error('Video parsing error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveVideo = (index: number) => {
    onVideosChange(videos.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddVideo();
    }
  };

  const getProviderBadge = (provider: string) => {
    const colors: Record<string, string> = {
      youtube: 'bg-red-100 text-red-700',
      vimeo: 'bg-blue-100 text-blue-700',
      wistia: 'bg-green-100 text-green-700',
      other: 'bg-gray-100 text-gray-700',
    };
    return colors[provider] || colors.other;
  };

  return (
    <div className="space-y-3">
      {/* Input Area */}
      {videos.length < maxVideos && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="url"
                placeholder="Paste YouTube, Vimeo, or Wistia video URL..."
                value={videoUrl}
                onChange={(e) => {
                  setVideoUrl(e.target.value);
                  setError(null);
                }}
                onKeyPress={handleKeyPress}
                className="pl-10"
                disabled={loading}
              />
            </div>
            <Button
              type="button"
              onClick={handleAddVideo}
              disabled={!videoUrl.trim() || loading}
              variant="outline"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                'Add'
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Supported: YouTube, Vimeo, Wistia • Max {maxVideos - videos.length} more
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

      {/* Video List */}
      {videos.length > 0 && (
        <div className="space-y-2">
          {videos.map((video, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors"
            >
              {/* Thumbnail */}
              <div className="relative flex-shrink-0 w-24 h-16 bg-secondary rounded overflow-hidden">
                {video.thumbnail ? (
                  <img
                    src={video.thumbnail}
                    alt={video.title || 'Video thumbnail'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Video Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${getProviderBadge(
                      video.provider
                    )}`}
                  >
                    {video.provider}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveVideo(index)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm text-foreground truncate">
                  {video.title || 'Video'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {video.url}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Counter */}
      {videos.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {videos.length} of {maxVideos} videos added
        </p>
      )}
    </div>
  );
}

