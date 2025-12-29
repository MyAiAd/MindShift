'use client';

import React from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Play,
  Edit,
  Trash2,
  MoreVertical,
  Eye,
  CheckCircle,
  Clock,
  Star,
  Users,
} from 'lucide-react';

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

interface VideoCardProps {
  video: Video;
  onEdit: (video: Video) => void;
  onDelete: (video: Video) => void;
  onPreview: (video: Video) => void;
}

export default function VideoCard({ video, onEdit, onDelete, onPreview }: VideoCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProviderColor = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'youtube':
        return 'bg-red-100 text-red-800';
      case 'vimeo':
        return 'bg-blue-100 text-blue-800';
      case 'wistia':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {video.is_featured && (
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
              )}
              <h3 className="font-semibold text-base leading-tight truncate">{video.title}</h3>
            </div>
            {video.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {video.description}
              </p>
            )}
          </div>

          {/* Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onPreview(video)}>
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(video)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete(video)} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Video Thumbnail/Placeholder */}
        <div className="aspect-video bg-secondary rounded-lg overflow-hidden relative mt-3 group">
          {video.thumbnail_url ? (
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
              <Play className="h-12 w-12 text-primary/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onPreview(video)}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              Preview
            </Button>
          </div>
          {video.duration_text && (
            <div className="absolute bottom-2 right-2 bg-black/75 text-white px-2 py-0.5 rounded text-xs">
              {video.duration_text}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={getStatusColor(video.status)}>
            {video.status}
          </Badge>
          <Badge variant="outline" className={getProviderColor(video.provider)}>
            {video.provider}
          </Badge>
          {video.category && (
            <Badge variant="outline">{video.category.name}</Badge>
          )}
        </div>

        {/* Tags */}
        {video.tags && video.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {video.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                #{tag}
              </Badge>
            ))}
            {video.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{video.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-3 border-t">
        {/* Analytics */}
        <div className="grid grid-cols-3 gap-4 w-full text-sm">
          <div className="flex items-center gap-1.5">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-semibold">{video.view_count}</div>
              <div className="text-xs text-muted-foreground">Views</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-semibold">{video.completion_count}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-semibold">{video.average_watch_percentage.toFixed(0)}%</div>
              <div className="text-xs text-muted-foreground">Avg Watch</div>
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
