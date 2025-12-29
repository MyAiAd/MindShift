'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
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
import CommentModerationCard from '@/components/admin/CommentModerationCard';
import { Search, Loader2, MessageSquare, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Comment {
  id: string;
  content: string;
  author: {
    id: string;
    full_name?: string;
    email: string;
  };
  post: {
    id: string;
    title: string;
  };
  created_at: string;
  is_flagged: boolean;
}

export default function CommentsModerationPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [deletingComment, setDeletingComment] = useState<Comment | null>(null);

  // Check if user is admin
  useEffect(() => {
    if (profile && !['tenant_admin', 'super_admin'].includes(profile.role)) {
      router.push('/dashboard');
    }
  }, [profile, router]);

  useEffect(() => {
    if (profile && ['tenant_admin', 'super_admin'].includes(profile.role)) {
      fetchComments();
    }
  }, [profile, searchQuery, filterStatus]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await fetch(`/api/community/comments?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        let filteredComments = data.comments || [];

        // Apply filter
        if (filterStatus === 'flagged') {
          filteredComments = filteredComments.filter((c: Comment) => c.is_flagged);
        } else if (filterStatus === 'active') {
          filteredComments = filteredComments.filter((c: Comment) => !c.is_flagged);
        }

        setComments(filteredComments);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load comments',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load comments',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleModerateComment = async (commentId: string, action: string) => {
    try {
      const response = await fetch('/api/admin/community/comments/moderate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: commentId, action }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Comment ${action} successfully`,
        });
        fetchComments();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to moderate comment',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error moderating comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to moderate comment',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteComment = async () => {
    if (!deletingComment) return;

    try {
      const response = await fetch(`/api/admin/community/comments/moderate?comment_id=${deletingComment.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Comment deleted successfully',
        });
        setDeletingComment(null);
        fetchComments();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to delete comment',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete comment',
        variant: 'destructive',
      });
    }
  };

  if (!profile || !['tenant_admin', 'super_admin'].includes(profile.role)) {
    return null;
  }

  const stats = {
    total: comments.length,
    flagged: comments.filter(c => c.is_flagged).length,
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Comment Moderation</h1>
        <p className="text-muted-foreground mt-2">
          Review and moderate community comments
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Comments</p>
              <div className="text-2xl font-bold">{stats.total}</div>
            </div>
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Flagged Comments</p>
              <div className="text-2xl font-bold text-red-600">{stats.flagged}</div>
            </div>
            <MessageSquare className="h-8 w-8 text-red-600" />
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search comments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full md:w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Comments</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="flagged">Flagged Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Comments Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : comments.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No comments found</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery || filterStatus !== 'all'
                ? 'Try adjusting your search or filters'
                : 'No community comments yet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {comments.map((comment) => (
            <CommentModerationCard
              key={comment.id}
              comment={comment}
              onDelete={setDeletingComment}
              onToggleFlag={(c) => handleModerateComment(c.id, c.is_flagged ? 'unflag' : 'flag')}
              onViewPost={(postId) => router.push(`/dashboard/community/posts/${postId}`)}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingComment} onOpenChange={() => setDeletingComment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteComment}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
