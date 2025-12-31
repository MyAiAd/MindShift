'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import VideoForm from '@/components/admin/VideoForm';
import { useToast } from '@/hooks/use-toast';

export default function NewVideoPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { toast } = useToast();

  // Check if user is admin
  useEffect(() => {
    if (profile && !['tenant_admin', 'super_admin'].includes(profile.role)) {
      router.push('/dashboard');
    }
  }, [profile, router]);

  const handleSubmit = async (data: any) => {
    try {
      const response = await fetch('/api/tutorials/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Video created successfully',
        });
        router.push('/dashboard/admin/videos');
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to create video',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating video:', error);
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
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Create New Video</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Add a new tutorial video to your library
        </p>
      </div>

      {/* Form */}
      <div className="max-w-4xl">
        <VideoForm mode="create" onSubmit={handleSubmit} onCancel={handleCancel} />
      </div>
    </div>
  );
}
