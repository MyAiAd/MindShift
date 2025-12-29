'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  Target
} from 'lucide-react';

interface TutorialVideo {
  id: string;
  title: string;
  description: string;
  duration: string;
  thumbnail?: string;
  videoUrl: string;
  category: string;
  provider: 'youtube' | 'vimeo' | 'wistia';
  tags: string[];
  featured?: boolean;
}

// Tutorial videos data - your client can replace these with their actual video links
const tutorialVideos: TutorialVideo[] = [
  {
    id: 'intro-1',
    title: 'Welcome to Mind-Shifting: Getting Started',
    description: 'Learn the basics of mind-shifting and how our platform can help you transform your mindset and achieve your goals.',
    duration: '8:45',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Replace with actual video
    category: 'Getting Started',
    provider: 'youtube',
    tags: ['introduction', 'basics', 'overview'],
    featured: true
  },
  {
    id: 'intro-2',
    title: 'Understanding the 6 Modalities',
    description: 'Deep dive into the six powerful modalities: Problem Shifting, Reality Shifting, Belief Shifting, Identity Shifting, Blockage Shifting, and Trauma Shifting.',
    duration: '15:30',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Replace with actual video
    category: 'Getting Started',
    provider: 'youtube',
    tags: ['modalities', 'techniques', 'overview'],
    featured: true
  },
  {
    id: 'session-1',
    title: 'Your First Mind-Shifting Session',
    description: 'Step-by-step guide to starting and completing your first mind-shifting session. Learn what to expect and how to get the most out of each session.',
    duration: '12:20',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Replace with actual video
    category: 'Sessions',
    provider: 'youtube',
    tags: ['sessions', 'tutorial', 'beginner']
  },
  {
    id: 'problem-1',
    title: 'Problem Shifting Deep Dive',
    description: 'Master the art of Problem Shifting - learn how to reframe challenges and find innovative solutions through guided mental exercises.',
    duration: '18:15',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Replace with actual video
    category: 'Modalities',
    provider: 'youtube',
    tags: ['problem-shifting', 'techniques', 'advanced']
  },
  {
    id: 'reality-1',
    title: 'Reality Shifting Techniques',
    description: 'Discover how to shift your perception of reality and create new possibilities through powerful visualization and mental reframing techniques.',
    duration: '16:40',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Replace with actual video
    category: 'Modalities',
    provider: 'youtube',
    tags: ['reality-shifting', 'visualization', 'advanced']
  },
  {
    id: 'belief-1',
    title: 'Belief Shifting Fundamentals',
    description: 'Learn how to identify and transform limiting beliefs that hold you back. Practical exercises to rewire your belief system.',
    duration: '14:55',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Replace with actual video
    category: 'Modalities',
    provider: 'youtube',
    tags: ['belief-shifting', 'mindset', 'techniques']
  },
  {
    id: 'voice-1',
    title: 'Using Voice Sessions Effectively',
    description: 'Get the most out of voice-enabled sessions. Tips for clear communication, best environments, and troubleshooting common issues.',
    duration: '10:30',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Replace with actual video
    category: 'Features',
    provider: 'youtube',
    tags: ['voice', 'features', 'tutorial']
  },
  {
    id: 'coach-1',
    title: 'Booking and Preparing for Coach Sessions',
    description: 'How to book sessions with human coaches, what to prepare, and how to make the most of your one-on-one coaching time.',
    duration: '11:45',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Replace with actual video
    category: 'Coaching',
    provider: 'youtube',
    tags: ['coaching', 'sessions', 'preparation']
  },
  {
    id: 'goals-1',
    title: 'Setting and Tracking Goals',
    description: 'Learn how to set effective goals, track your progress, and use our dashboard to measure your transformation journey.',
    duration: '9:20',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Replace with actual video
    category: 'Features',
    provider: 'youtube',
    tags: ['goals', 'tracking', 'progress']
  },
  {
    id: 'community-1',
    title: 'Engaging with the Community',
    description: 'Discover how to connect with other users, share experiences, participate in events, and build meaningful relationships.',
    duration: '7:30',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Replace with actual video
    category: 'Community',
    provider: 'youtube',
    tags: ['community', 'social', 'networking']
  },
  {
    id: 'advanced-1',
    title: 'Advanced Techniques: Combining Modalities',
    description: 'Learn how to combine multiple modalities for more powerful results. Advanced strategies for experienced users.',
    duration: '22:10',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Replace with actual video
    category: 'Advanced',
    provider: 'youtube',
    tags: ['advanced', 'techniques', 'modalities']
  },
  {
    id: 'success-1',
    title: 'Success Stories and Best Practices',
    description: 'Real user stories and best practices from those who have achieved remarkable transformations using mind-shifting.',
    duration: '19:45',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Replace with actual video
    category: 'Inspiration',
    provider: 'youtube',
    tags: ['success', 'stories', 'inspiration']
  }
];

const categories = [
  { name: 'All Videos', icon: Video, color: 'text-purple-600' },
  { name: 'Getting Started', icon: BookOpen, color: 'text-blue-600' },
  { name: 'Sessions', icon: PlayCircle, color: 'text-green-600' },
  { name: 'Modalities', icon: Brain, color: 'text-indigo-600' },
  { name: 'Features', icon: Lightbulb, color: 'text-yellow-600' },
  { name: 'Coaching', icon: Users, color: 'text-orange-600' },
  { name: 'Community', icon: Users, color: 'text-pink-600' },
  { name: 'Advanced', icon: Target, color: 'text-red-600' },
  { name: 'Inspiration', icon: CheckCircle, color: 'text-teal-600' }
];

export default function TutorialsPage() {
  const { profile } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('All Videos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<TutorialVideo | null>(null);
  const [watchedVideos, setWatchedVideos] = useState<Set<string>>(new Set());

  // Filter videos based on category and search
  const filteredVideos = tutorialVideos.filter(video => {
    const matchesCategory = selectedCategory === 'All Videos' || video.category === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesCategory && matchesSearch;
  });

  const featuredVideos = tutorialVideos.filter(v => v.featured);

  const handleMarkAsWatched = (videoId: string) => {
    setWatchedVideos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
  };

  const getVideoEmbedUrl = (video: TutorialVideo) => {
    // Ensure the URL is properly formatted for embedding
    return video.videoUrl;
  };

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
                    <span className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {selectedVideo.duration}
                    </span>
                    <span className="capitalize">{selectedVideo.category}</span>
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

              {/* Mark as Watched */}
              <button
                onClick={() => handleMarkAsWatched(selectedVideo.id)}
                className={`w-full sm:w-auto px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors ${
                  watchedVideos.has(selectedVideo.id)
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                <CheckCircle className="h-4 w-4" />
                <span>{watchedVideos.has(selectedVideo.id) ? 'Watched' : 'Mark as Watched'}</span>
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
                  {watchedVideos.has(video.id) && (
                    <div className="absolute top-2 right-2 bg-green-600 text-white px-2 py-1 rounded-full text-xs flex items-center">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Watched
                    </div>
                  )}
                </div>
                <CardHeader>
                  <CardTitle className="text-lg">{video.title}</CardTitle>
                  <CardDescription className="flex items-center space-x-4 text-sm">
                    <span className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {video.duration}
                    </span>
                    <span>{video.category}</span>
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
                {watchedVideos.has(video.id) && (
                  <div className="absolute top-2 right-2 bg-green-600 text-white px-2 py-1 rounded-full text-xs flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Watched
                  </div>
                )}
                <div className="absolute bottom-2 right-2 bg-black/75 text-white px-2 py-1 rounded text-xs">
                  {video.duration}
                </div>
              </div>

              <CardHeader className="pb-3">
                <CardTitle className="text-base line-clamp-2">{video.title}</CardTitle>
                <CardDescription className="text-xs">{video.category}</CardDescription>
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
      <div className="mt-8 p-4 bg-card rounded-lg border border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">Your Progress</h3>
            <p className="text-sm text-muted-foreground">
              {watchedVideos.size} of {tutorialVideos.length} videos watched
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-indigo-600">
              {Math.round((watchedVideos.size / tutorialVideos.length) * 100)}%
            </div>
            <div className="text-xs text-muted-foreground">Complete</div>
          </div>
        </div>
        <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-600 transition-all duration-500"
            style={{ width: `${(watchedVideos.size / tutorialVideos.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
