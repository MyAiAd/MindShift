'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
  Trash2,
  Flag,
  User as UserIcon,
  MessageSquare,
} from 'lucide-react';
import { format } from 'date-fns';

interface Comment {
  id: string;
  content: string;
  author: {
    id: string;
    full_name?: string;
    email: string;
  } | null;
  post: {
    id: string;
    title: string;
  };
  created_at: string;
  is_flagged: boolean;
}

interface CommentModerationCardProps {
  comment: Comment;
  onDelete: (comment: Comment) => void;
  onToggleFlag: (comment: Comment) => void;
  onViewPost: (postId: string) => void;
}

export default function CommentModerationCard({
  comment,
  onDelete,
  onToggleFlag,
  onViewPost,
}: CommentModerationCardProps) {
  return (
    <Card className={comment.is_flagged ? 'border-red-300 bg-red-50/50' : ''}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <UserIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{comment.author?.full_name || comment.author?.email || 'Unknown User'}</span>
            {comment.is_flagged && (
              <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                <Flag className="h-3 w-3 mr-1" />
                Flagged
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            <button
              onClick={() => onViewPost(comment.post.id)}
              className="hover:underline hover:text-foreground"
            >
              {comment.post.title}
            </button>
            <span>•</span>
            <span>{format(new Date(comment.created_at), 'MMM d, yyyy')}</span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onViewPost(comment.post.id)}>
              <MessageSquare className="mr-2 h-4 w-4" />
              View Post
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleFlag(comment)}>
              {comment.is_flagged ? (
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
            <DropdownMenuItem onClick={() => onDelete(comment)} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent>
        <p className="text-sm">{comment.content}</p>
      </CardContent>
    </Card>
  );
}
