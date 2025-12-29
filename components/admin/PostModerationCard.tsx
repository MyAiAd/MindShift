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
  MoreVertical,
  Edit,
  Trash2,
  Pin,
  PinOff,
  Archive,
  Flag,
  Eye,
  MessageSquare,
  Heart,
  User as UserIcon,
} from 'lucide-react';
import { format } from 'date-fns';

interface Post {
  id: string;
  title: string;
  content: string;
  author: {
    id: string;
    full_name?: string;
    email: string;
  };
  created_at: string;
  updated_at: string;
  is_pinned: boolean;
  is_archived: boolean;
  is_flagged: boolean;
  tags?: string[];
  views_count?: number;
  likes_count?: number;
  comments_count?: number;
}

interface PostModerationCardProps {
  post: Post;
  onEdit: (post: Post) => void;
  onDelete: (post: Post) => void;
  onTogglePin: (post: Post) => void;
  onToggleArchive: (post: Post) => void;
  onToggleFlag: (post: Post) => void;
  onView: (post: Post) => void;
}

export default function PostModerationCard({
  post,
  onEdit,
  onDelete,
  onTogglePin,
  onToggleArchive,
  onToggleFlag,
  onView,
}: PostModerationCardProps) {
  return (
    <Card className={`${post.is_flagged ? 'border-red-300 bg-red-50/50' : ''} ${post.is_archived ? 'opacity-60' : ''}`}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold line-clamp-1">{post.title}</h3>
            {post.is_pinned && (
              <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                <Pin className="h-3 w-3 mr-1" />
                Pinned
              </Badge>
            )}
            {post.is_archived && (
              <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">
                <Archive className="h-3 w-3 mr-1" />
                Archived
              </Badge>
            )}
            {post.is_flagged && (
              <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                <Flag className="h-3 w-3 mr-1" />
                Flagged
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserIcon className="h-3 w-3" />
            <span>{post.author.full_name || post.author.email}</span>
            <span>•</span>
            <span>{format(new Date(post.created_at), 'MMM d, yyyy')}</span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(post)}>
              <Eye className="mr-2 h-4 w-4" />
              View Full Post
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(post)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onTogglePin(post)}>
              {post.is_pinned ? (
                <>
                  <PinOff className="mr-2 h-4 w-4" />
                  Unpin
                </>
              ) : (
                <>
                  <Pin className="mr-2 h-4 w-4" />
                  Pin
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleArchive(post)}>
              {post.is_archived ? (
                <>
                  <Archive className="mr-2 h-4 w-4" />
                  Unarchive
                </>
              ) : (
                <>
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleFlag(post)}>
              {post.is_flagged ? (
                <>
                  <Flag className="mr-2 h-4 w-4" />
                  Unflag
                </>
              ) : (
                <>
                  <Flag className="mr-2 h-4 w-4" />
                  Flag
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(post)} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-3">{post.content}</p>
        
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {post.tags.map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center gap-4 text-sm text-muted-foreground border-t pt-4">
        <div className="flex items-center gap-1">
          <Eye className="h-4 w-4" />
          <span>{post.views_count || 0}</span>
        </div>
        <div className="flex items-center gap-1">
          <Heart className="h-4 w-4" />
          <span>{post.likes_count || 0}</span>
        </div>
        <div className="flex items-center gap-1">
          <MessageSquare className="h-4 w-4" />
          <span>{post.comments_count || 0}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
