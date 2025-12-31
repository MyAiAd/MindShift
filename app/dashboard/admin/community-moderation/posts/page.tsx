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
import PostModerationCard from '@/components/admin/PostModerationCard';
import TagManager from '@/components/admin/TagManager';
import { Search, Loader2, MessageSquare, Filter, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

export default function PostsModerationPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showTagManager, setShowTagManager] = useState(false);
  const [deletingPost, setDeletingPost] = useState<Post | null>(null);
  const [viewingPost, setViewingPost] = useState<Post | null>(null);

  // Check if user is admin
  useEffect(() => {
    if (profile && !['tenant_admin', 'super_admin'].includes(profile.role)) {
      router.push('/dashboard');
    }
  }, [profile, router]);

  useEffect(() => {
    if (profile && ['tenant_admin', 'super_admin'].includes(profile.role)) {
      fetchPosts();
    }
  }, [profile, searchQuery, filterStatus]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await fetch(`/api/community/posts?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        let filteredPosts = data.posts || [];

        // Apply filter
        if (filterStatus === 'pinned') {
          filteredPosts = filteredPosts.filter((p: Post) => p.is_pinned);
        } else if (filterStatus === 'archived') {
          filteredPosts = filteredPosts.filter((p: Post) => p.is_archived);
        } else if (filterStatus === 'flagged') {
          filteredPosts = filteredPosts.filter((p: Post) => p.is_flagged);
        } else if (filterStatus === 'active') {
          filteredPosts = filteredPosts.filter((p: Post) => !p.is_archived && !p.is_flagged);
        }

        setPosts(filteredPosts);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load posts',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load posts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleModeratePost = async (postId: string, action: string) => {
    try {
      const response = await fetch('/api/admin/community/posts/moderate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, action }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Post ${action} successfully`,
        });
        fetchPosts();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to moderate post',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error moderating post:', error);
      toast({
        title: 'Error',
        description: 'Failed to moderate post',
        variant: 'destructive',
      });
    }
  };

  const handleDeletePost = async () => {
    if (!deletingPost) return;

    try {
      const response = await fetch(`/api/admin/community/posts/moderate?post_id=${deletingPost.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Post deleted successfully',
        });
        setDeletingPost(null);
        fetchPosts();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to delete post',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete post',
        variant: 'destructive',
      });
    }
  };

  if (!profile || !['tenant_admin', 'super_admin'].includes(profile.role)) {
    return null;
  }

  const stats = {
    total: posts.length,
    pinned: posts.filter(p => p.is_pinned).length,
    flagged: posts.filter(p => p.is_flagged).length,
    archived: posts.filter(p => p.is_archived).length,
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Post Moderation</h1>
          <p className="text-muted-foreground mt-2">
            Manage community posts, pin content, and moderate discussions
          </p>
        </div>
        <Button onClick={() => setShowTagManager(true)}>
          <Tag className="h-4 w-4 mr-2" />
          Manage Tags
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pinned</CardTitle>
            <MessageSquare className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pinned}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Flagged</CardTitle>
            <MessageSquare className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.flagged}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Archived</CardTitle>
            <MessageSquare className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.archived}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search posts..."
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
            <SelectItem value="all">All Posts</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pinned">Pinned</SelectItem>
            <SelectItem value="flagged">Flagged</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Posts Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No posts found</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery || filterStatus !== 'all'
                ? 'Try adjusting your search or filters'
                : 'No community posts yet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {posts.map((post) => (
            <PostModerationCard
              key={post.id}
              post={post}
              onEdit={() => router.push(`/dashboard/community/posts/${post.id}/edit`)}
              onDelete={setDeletingPost}
              onTogglePin={(p) => handleModeratePost(p.id, p.is_pinned ? 'unpin' : 'pin')}
              onToggleArchive={(p) => handleModeratePost(p.id, p.is_archived ? 'unarchive' : 'archive')}
              onToggleFlag={(p) => handleModeratePost(p.id, p.is_flagged ? 'unflag' : 'flag')}
              onView={setViewingPost}
            />
          ))}
        </div>
      )}

      {/* Tag Manager Dialog */}
      <TagManager isOpen={showTagManager} onClose={() => setShowTagManager(false)} />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingPost} onOpenChange={() => setDeletingPost(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingPost?.title}</strong>?
              This action cannot be undone. All comments on this post will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePost}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Post Dialog */}
      <Dialog open={!!viewingPost} onOpenChange={() => setViewingPost(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingPost?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              By {viewingPost?.author.full_name || viewingPost?.author.email}
            </p>
            <div className="prose max-w-none">
              <p>{viewingPost?.content}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
