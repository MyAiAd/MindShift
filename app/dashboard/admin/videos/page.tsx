'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import VideoCard from '@/components/admin/VideoCard';
import CategoryManager from '@/components/admin/CategoryManager';
import { Plus, Search, Filter, Loader2, Video as VideoIcon } from 'lucide-react';

interface Video {
  id: string;
  title: string;
  description?: string;
  duration_text?: string;
  thumbnail_url?: string;
  video_url: string;
  provider: string;
  status: string;
  is_featured: boolean;
  view_count: number;
  completion_count: number;
  average_watch_percentage: number;
  category?: {
    id: string;
    name: string;
  };
  tags?: string[];
  created_at: string;
}

interface Category {
  id: string;
  name: string;
}

export default function VideoManagementPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProvider, setFilterProvider] = useState('all');
  const [deletingVideo, setDeletingVideo] = useState<Video | null>(null);
  const [previewVideo, setPreviewVideo] = useState<Video | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  // Check if user is admin
  useEffect(() => {
    if (profile && !['tenant_admin', 'super_admin'].includes(profile.role)) {
      router.push('/dashboard');
    }
  }, [profile, router]);

  useEffect(() => {
    if (profile && ['tenant_admin', 'super_admin'].includes(profile.role)) {
      fetchVideos();
      fetchCategories();
    }
  }, [profile]);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tutorials/videos');
      if (response.ok) {
        const data = await response.json();
        setVideos(data.videos || []);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/tutorials/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleEdit = (video: Video) => {
    router.push(`/dashboard/admin/videos/${video.id}`);
  };

  const handleDelete = async () => {
    if (!deletingVideo) return;

    try {
      const response = await fetch(`/api/tutorials/videos/${deletingVideo.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchVideos();
      }
    } catch (error) {
      console.error('Error deleting video:', error);
    } finally {
      setDeletingVideo(null);
    }
  };

  const filteredVideos = videos.filter((video) => {
    const matchesSearch =
      searchQuery === '' ||
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      filterCategory === 'all' ||
      (filterCategory === 'uncategorized' && !video.category) ||
      video.category?.id === filterCategory;

    const matchesStatus =
      filterStatus === 'all' || video.status === filterStatus;

    const matchesProvider =
      filterProvider === 'all' || video.provider === filterProvider;

    return matchesSearch && matchesCategory && matchesStatus && matchesProvider;
  });

  // Calculate stats
  const totalViews = videos.reduce((sum, v) => sum + v.view_count, 0);
  const totalCompletions = videos.reduce((sum, v) => sum + v.completion_count, 0);
  const avgWatchPercentage = videos.length > 0
    ? videos.reduce((sum, v) => sum + v.average_watch_percentage, 0) / videos.length
    : 0;

  if (!profile || !['tenant_admin', 'super_admin'].includes(profile.role)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Video Management</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Manage tutorial videos and categories
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCategoryManager(true)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Categories
            </Button>
            <Button onClick={() => router.push('/dashboard/admin/videos/new')} className="gap-2">
              <Plus className="h-4 w-4" />
              New Video
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Videos</CardDescription>
            <CardTitle className="text-3xl">{videos.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Views</CardDescription>
            <CardTitle className="text-3xl">{totalViews.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Completions</CardDescription>
            <CardTitle className="text-3xl">{totalCompletions.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avg Watch %</CardDescription>
            <CardTitle className="text-3xl">{avgWatchPercentage.toFixed(0)}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filter Videos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category Filter */}
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="uncategorized">Uncategorized</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            {/* Provider Filter */}
            <Select value={filterProvider} onValueChange={setFilterProvider}>
              <SelectTrigger>
                <SelectValue placeholder="All providers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All providers</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="vimeo">Vimeo</SelectItem>
                <SelectItem value="wistia">Wistia</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Video Grid */}
      {loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </CardContent>
        </Card>
      ) : filteredVideos.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <VideoIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {videos.length === 0 ? 'No videos yet' : 'No videos match your filters'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {videos.length === 0
                  ? 'Get started by creating your first tutorial video'
                  : 'Try adjusting your filters or search query'}
              </p>
              {videos.length === 0 && (
                <Button onClick={() => router.push('/dashboard/admin/videos/new')} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create First Video
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onEdit={handleEdit}
              onDelete={setDeletingVideo}
              onPreview={setPreviewVideo}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingVideo} onOpenChange={() => setDeletingVideo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Video?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingVideo?.title}"? This action cannot be undone.
              All user progress for this video will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete Video
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Video Preview Dialog */}
      {previewVideo && (
        <Dialog open={!!previewVideo} onOpenChange={() => setPreviewVideo(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{previewVideo.title}</DialogTitle>
            </DialogHeader>
            <div className="aspect-video bg-secondary rounded-lg overflow-hidden">
              <iframe
                src={previewVideo.video_url}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={previewVideo.title}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Category Manager Dialog */}
      {showCategoryManager && (
        <Dialog open={showCategoryManager} onOpenChange={setShowCategoryManager}>
          <DialogContent className="max-w-3xl">
            <CategoryManager />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
