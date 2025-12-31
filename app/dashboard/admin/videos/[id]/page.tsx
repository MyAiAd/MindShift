'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import VideoForm from '@/components/admin/VideoForm';
import VideoAnalytics from '@/components/admin/VideoAnalytics';
import { useToast } from '@/hooks/use-toast';

interface Video {
  id: string;
  title: string;
  description?: string;
  video_url: string;
  thumbnail_url?: string;
  duration_text?: string;
  provider: string;
  provider_video_id?: string;
  category_id?: string;
  status: string;
  is_featured: boolean;
  tags?: string[];
  required_subscription_tier?: string | null;
  view_count: number;
  completion_count: number;
  average_watch_percentage: number;
}

export default function EditVideoPage() {
  const router = useRouter();
  const params = useParams();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);

  const videoId = params.id as string;

  // Check if user is admin
  useEffect(() => {
    if (profile && !['tenant_admin', 'super_admin'].includes(profile.role)) {
      router.push('/dashboard');
    }
  }, [profile, router]);

  useEffect(() => {
    if (profile && ['tenant_admin', 'super_admin'].includes(profile.role) && videoId) {
      fetchVideo();
    }
  }, [profile, videoId]);

  const fetchVideo = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tutorials/videos/${videoId}`);
      if (response.ok) {
        const data = await response.json();
        setVideo(data.video);
      } else {
        toast({
          title: 'Error',
          description: 'Video not found',
          variant: 'destructive',
        });
        router.push('/dashboard/admin/videos');
      }
    } catch (error) {
      console.error('Error fetching video:', error);
      toast({
        title: 'Error',
        description: 'Failed to load video',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: any) => {
    try {
      const response = await fetch(`/api/tutorials/videos/${videoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Video updated successfully',
        });
        router.push('/dashboard/admin/videos');
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to update video',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating video:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = () => {
    router.push('/dashboard/admin/videos');
  };

  if (!profile || !['tenant_admin', 'super_admin'].includes(profile.role)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!video) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard/admin/videos')}
          className="mb-4 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Videos
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Edit Video</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Update video details and settings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <VideoForm
            mode="edit"
            initialData={{
              title: video.title,
              description: video.description || '',
              video_url: video.video_url,
              thumbnail_url: video.thumbnail_url,
              duration_text: video.duration_text,
              provider: video.provider as any,
              provider_video_id: video.provider_video_id,
              category_id: video.category_id,
              status: video.status as any,
              is_featured: video.is_featured,
              tags: video.tags || [],
              required_subscription_tier: video.required_subscription_tier,
            }}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </div>

        {/* Analytics Sidebar */}
        <div>
          <VideoAnalytics
            videoId={video.id}
            analytics={{
              view_count: video.view_count,
              completion_count: video.completion_count,
              average_watch_percentage: video.average_watch_percentage,
            }}
          />
        </div>
      </div>
    </div>
  );
}
