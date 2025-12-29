'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { createClient } from '@/lib/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  PlayCircle, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle,
  Video,
  BookOpen,
  Lightbulb,
  Users,
  Brain,
  Target,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface TutorialVideo {
  id: string;
  title: string;
  description: string;
  duration_text: string;
  thumbnail_url?: string;
  video_url: string;
  category_name?: string;
  provider: 'youtube' | 'vimeo' | 'wistia' | 'custom';
  tags: string[];
  is_featured?: boolean;
}

interface VideoProgress {
  video_id: string;
  watched: boolean;
  watch_percentage: number;
}

export default function TutorialsPage() {
  const { profile } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('All Videos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<TutorialVideo | null>(null);
  const [videos, setVideos] = useState<TutorialVideo[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [videoProgress, setVideoProgress] = useState<Map<string, VideoProgress>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Fetch videos and progress on mount
  useEffect(() => {
    fetchVideosAndProgress();
  }, []);

  const fetchVideosAndProgress = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('tutorial_categories')
        .select('*')
        .order('display_order');

      if (categoriesError) throw categoriesError;

      // Build categories with icons
      const defaultCategories = [
        { name: 'All Videos', icon: Video, color: 'text-purple-600' }
      ];

      const fetchedCategories = (categoriesData || []).map((cat: any) => ({
        name: cat.name,
        icon: getIconComponent(cat.icon),
        color: cat.color || 'text-gray-600'
      }));

      setCategories([...defaultCategories, ...fetchedCategories]);

      // Fetch videos with categories
      const { data: videosData, error: videosError } = await supabase
        .from('tutorial_videos')
        .select(`
          *,
          category:tutorial_categories(name)
        `)
        .eq('status', 'published')
        .order('display_order');

      if (videosError) throw videosError;

      // Transform data
      const transformedVideos = (videosData || []).map((v: any) => ({
        id: v.id,
        title: v.title,
        description: v.description || '',
        duration_text: v.duration_text || '',
        thumbnail_url: v.thumbnail_url,
        video_url: v.video_url,
        category_name: v.category?.name,
        provider: v.provider,
        tags: v.tags || [],
        is_featured: v.is_featured
      }));

      setVideos(transformedVideos);

      // Fetch user's video progress
      if (profile?.id) {
        const { data: progressData, error: progressError } = await supabase
          .from('tutorial_video_progress')
          .select('video_id, watched, watch_percentage')
          .eq('user_id', profile.id);

        if (progressError) throw progressError;

        const progressMap = new Map<string, VideoProgress>();
        (progressData || []).forEach((p: any) => {
          progressMap.set(p.video_id, {
            video_id: p.video_id,
            watched: p.watched,
            watch_percentage: p.watch_percentage
          });
        });
        setVideoProgress(progressMap);
      }

    } catch (err: any) {
      console.error('Error fetching tutorials:', err);
      setError(err.message || 'Failed to load tutorials');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsWatched = async (videoId: string) => {
    if (!profile?.id) return;

    try {
      const currentProgress = videoProgress.get(videoId);
      const newWatchedState = !currentProgress?.watched;

      // Update in database
      const { error } = await supabase
        .from('tutorial_video_progress')
        .upsert({
          user_id: profile.id,
          video_id: videoId,
          tenant_id: profile.tenant_id,
          watched: newWatchedState,
          watch_percentage: newWatchedState ? 100 : 0,
          ...(newWatchedState && { completed_at: new Date().toISOString() })
        }, {
          onConflict: 'user_id,video_id'
        });

      if (error) throw error;

      // Update local state
      const updatedProgress = new Map(videoProgress);
      updatedProgress.set(videoId, {
        video_id: videoId,
        watched: newWatchedState,
        watch_percentage: newWatchedState ? 100 : 0
      });
      setVideoProgress(updatedProgress);

    } catch (err: any) {
      console.error('Error updating video progress:', err);
    }
  };

  // Helper to get icon component by name
  const getIconComponent = (iconName: string) => {
    const iconMap: any = {
      Video, BookOpen, PlayCircle, Brain, Lightbulb, Users, Target, CheckCircle
    };
    return iconMap[iconName] || Video;
  };

  // Filter videos based on category and search
  const filteredVideos = videos.filter(video => {
    const matchesCategory = selectedCategory === 'All Videos' || video.category_name === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesCategory && matchesSearch;
  });

  const featuredVideos = videos.filter(v => v.is_featured);

  const getVideoEmbedUrl = (video: TutorialVideo) => {
    // Ensure the URL is properly formatted for embedding
    return video.video_url;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading tutorials...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Error Loading Tutorials</h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={fetchVideosAndProgress}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Empty state
  if (videos.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Tutorial Videos
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Learn how to get the most out of your mind-shifting journey
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Video className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Videos Yet</h2>
              <p className="text-muted-foreground mb-4">
                Tutorial videos will appear here once they're added by your administrator.
              </p>
              {profile?.role === 'tenant_admin' && (
                <p className="text-sm text-muted-foreground">
                  As an admin, you can add videos through the admin panel or database.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          Tutorial Videos
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Learn how to get the most out of your mind-shifting journey with these helpful guides
        </p>
      </div>

      {/* Video Player Modal */}
      {selectedVideo && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedVideo(null)}
        >
          <div 
            className="bg-card rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                    {selectedVideo.title}
                  </h2>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    {selectedVideo.duration_text && (
                      <span className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {selectedVideo.duration_text}
                      </span>
                    )}
                    {selectedVideo.category_name && (
                      <span className="capitalize">{selectedVideo.category_name}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="text-muted-foreground hover:text-foreground ml-4"
                >
                  ✕
                </button>
              </div>

              {/* Video Embed */}
              <div className="aspect-video bg-secondary rounded-lg overflow-hidden mb-4">
                <iframe
                  src={getVideoEmbedUrl(selectedVideo)}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={selectedVideo.title}
                />
              </div>

              {/* Video Description */}
              <div className="mb-4">
                <p className="text-muted-foreground">
                  {selectedVideo.description}
                </p>
              </div>

              {/* Tags */}
              {selectedVideo.tags && selectedVideo.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedVideo.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-secondary text-xs rounded-full text-muted-foreground"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Mark as Watched */}
              <button
                onClick={() => handleMarkAsWatched(selectedVideo.id)}
                className={`w-full sm:w-auto px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors ${
                  videoProgress.get(selectedVideo.id)?.watched
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                <CheckCircle className="h-4 w-4" />
                <span>{videoProgress.get(selectedVideo.id)?.watched ? 'Watched' : 'Mark as Watched'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Featured Videos */}
      {selectedCategory === 'All Videos' && searchQuery === '' && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center">
            <PlayCircle className="h-5 w-5 mr-2 text-indigo-600" />
            Featured Videos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featuredVideos.map(video => (
              <Card 
                key={video.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setSelectedVideo(video)}
              >
                <div className="aspect-video bg-secondary relative overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <PlayCircle className="h-16 w-16 text-white opacity-80 hover:opacity-100 transition-opacity" />
                  </div>
                  {videoProgress.get(video.id)?.watched && (
                    <div className="absolute top-2 right-2 bg-green-600 text-white px-2 py-1 rounded-full text-xs flex items-center">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Watched
                    </div>
                  )}
                </div>
                <CardHeader>
                  <CardTitle className="text-lg">{video.title}</CardTitle>
                  <CardDescription className="flex items-center space-x-4 text-sm">
                    {video.duration_text && (
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {video.duration_text}
                      </span>
                    )}
                    {video.category_name && <span>{video.category_name}</span>}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {video.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="mb-6">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search tutorials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map(category => {
            const Icon = category.icon;
            const isSelected = selectedCategory === category.name;
            return (
              <button
                key={category.name}
                onClick={() => setSelectedCategory(category.name)}
                className={`px-3 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
                  isSelected
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                }`}
              >
                <Icon className={`h-4 w-4 ${isSelected ? category.color : ''}`} />
                <span className="text-sm">{category.name}</span>
                <span className="text-xs bg-background px-1.5 py-0.5 rounded-full">
                  {category.name === 'All Videos' 
                    ? tutorialVideos.length 
                    : tutorialVideos.filter(v => v.category === category.name).length
                  }
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Video Grid */}
      {filteredVideos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredVideos.map(video => (
            <Card 
              key={video.id}
              className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
              onClick={() => setSelectedVideo(video)}
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-secondary relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
                  <PlayCircle className="h-12 w-12 text-white opacity-80 hover:opacity-100 transition-opacity" />
                </div>
                {videoProgress.get(video.id)?.watched && (
                  <div className="absolute top-2 right-2 bg-green-600 text-white px-2 py-1 rounded-full text-xs flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Watched
                  </div>
                )}
                {video.duration_text && (
                  <div className="absolute bottom-2 right-2 bg-black/75 text-white px-2 py-1 rounded text-xs">
                    {video.duration_text}
                  </div>
                )}
              </div>

              <CardHeader className="pb-3">
                <CardTitle className="text-base line-clamp-2">{video.title}</CardTitle>
                {video.category_name && (
                  <CardDescription className="text-xs">{video.category_name}</CardDescription>
                )}
              </CardHeader>

              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {video.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Video className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No videos found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search or filter criteria
          </p>
        </div>
      )}

      {/* Progress Summary */}
      {videos.length > 0 && (
        <div className="mt-8 p-4 bg-card rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Your Progress</h3>
              <p className="text-sm text-muted-foreground">
                {Array.from(videoProgress.values()).filter(p => p.watched).length} of {videos.length} videos watched
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-indigo-600">
                {videos.length > 0 
                  ? Math.round((Array.from(videoProgress.values()).filter(p => p.watched).length / videos.length) * 100)
                  : 0}%
              </div>
              <div className="text-xs text-muted-foreground">Complete</div>
            </div>
          </div>
          <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-600 transition-all duration-500"
              style={{ width: `${videos.length > 0 ? (Array.from(videoProgress.values()).filter(p => p.watched).length / videos.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
