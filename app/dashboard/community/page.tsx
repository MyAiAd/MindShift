'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus,
  Search,
  Heart,
  MessageCircle,
  Calendar,
  Users,
  TrendingUp,
  Filter,
  X,
  Loader2,
  Send,
  MoreVertical,
  Edit,
  Trash2,
  Pin,
  Eye
} from 'lucide-react';

interface Post {
  id: string;
  title: string;
  content: string;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  like_count: number;
  comment_count: number;
  view_count: number;
  is_pinned: boolean;
  author: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  community_post_tags?: Array<{
    community_tags: {
      id: string;
      name: string;
      color: string;
    };
  }>;
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

export default function CommunityPage() {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComment, setNewComment] = useState('');
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  // New post form state
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    status: 'published' as 'draft' | 'published' | 'scheduled'
  });

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/community/posts');
      
      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
      } else {
        console.error('Failed to fetch posts');
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (postId: string) => {
    try {
      const response = await fetch(`/api/community/comments?post_id=${postId}`);
      
      if (response.ok) {
        const data = await response.json();
        setComments(prev => ({ ...prev, [postId]: data.comments || [] }));
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPost.title.trim() || !newPost.content.trim()) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const response = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPost)
      });

      if (response.ok) {
        setShowNewPostModal(false);
        setNewPost({ title: '', content: '', status: 'published' });
        fetchPosts();
      } else {
        alert('Failed to create post');
      }
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post');
    }
  };

  const handleLikePost = async (postId: string) => {
    try {
      const response = await fetch('/api/community/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: postId, targetType: 'post' })
      });

      if (response.ok) {
        setLikedPosts(prev => {
          const newSet = new Set(prev);
          if (newSet.has(postId)) {
            newSet.delete(postId);
          } else {
            newSet.add(postId);
          }
          return newSet;
        });
        
        // Update like count in posts
        setPosts(posts.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              like_count: likedPosts.has(postId) ? post.like_count - 1 : post.like_count + 1
            };
          }
          return post;
        }));
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!newComment.trim()) return;

    try {
      const response = await fetch('/api/community/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          content: newComment
        })
      });

      if (response.ok) {
        setNewComment('');
        fetchComments(postId);
        
        // Update comment count
        setPosts(posts.map(post => {
          if (post.id === postId) {
            return { ...post, comment_count: post.comment_count + 1 };
          }
          return post;
        }));
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handlePostClick = (post: Post) => {
    setSelectedPost(post);
    fetchComments(post.id);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
    });
  };

  const filteredPosts = posts.filter(post => 
    searchQuery === '' || 
    post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedPosts = filteredPosts.filter(p => p.is_pinned);
  const regularPosts = filteredPosts.filter(p => !p.is_pinned);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              MIND SHIFTING COMMUNITY
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Connect, share, and grow together
            </p>
          </div>
          <Button
            onClick={() => setShowNewPostModal(true)}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Post
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center">
              <Users className="h-4 w-4 mr-2" />
              Members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">1,234</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center">
              <MessageCircle className="h-4 w-4 mr-2" />
              Total Posts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{posts.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center">
              <TrendingUp className="h-4 w-4 mr-2" />
              Active Today
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">156</div>
          </CardContent>
        </Card>
      </div>

      {/* Posts Feed */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pinned Posts */}
          {pinnedPosts.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-foreground flex items-center">
                <Pin className="h-4 w-4 mr-2 text-indigo-600" />
                Pinned Posts
              </h2>
              {pinnedPosts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  isLiked={likedPosts.has(post.id)}
                  onLike={handleLikePost}
                  onClick={handlePostClick}
                />
              ))}
              <div className="border-t border-border my-6"></div>
            </>
          )}

          {/* Regular Posts */}
          {regularPosts.length > 0 ? (
            regularPosts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                isLiked={likedPosts.has(post.id)}
                onLike={handleLikePost}
                onClick={handlePostClick}
              />
            ))
          ) : (
            <div className="text-center py-12">
              <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No posts yet</h3>
              <p className="text-muted-foreground mb-4">
                Be the first to start a conversation!
              </p>
              <Button onClick={() => setShowNewPostModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Post
              </Button>
            </div>
          )}
        </div>
      )}

      {/* New Post Modal */}
      {showNewPostModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowNewPostModal(false)}
        >
          <div 
            className="bg-card rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-foreground">Create New Post</h3>
                <button
                  onClick={() => setShowNewPostModal(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreatePost} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Title
                  </label>
                  <Input
                    type="text"
                    value={newPost.title}
                    onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                    placeholder="Enter post title..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Content
                  </label>
                  <textarea
                    rows={6}
                    value={newPost.content}
                    onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-background text-foreground"
                    placeholder="Share your thoughts..."
                    required
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNewPostModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    <Send className="h-4 w-4 mr-2" />
                    Publish Post
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Post Detail Modal */}
      {selectedPost && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPost(null)}
        >
          <div 
            className="bg-card rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    {selectedPost.title}
                  </h2>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <span>
                      {selectedPost.author?.first_name && selectedPost.author?.last_name
                        ? `${selectedPost.author.first_name} ${selectedPost.author.last_name}`
                        : 'Unknown User'}
                    </span>
                    <span>•</span>
                    <span>{formatDate(selectedPost.created_at)}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPost(null)}
                  className="text-muted-foreground hover:text-foreground ml-4"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="prose prose-sm max-w-none mb-6">
                <p className="text-foreground whitespace-pre-wrap">{selectedPost.content}</p>
              </div>

              <div className="flex items-center space-x-6 mb-6 pb-6 border-b border-border">
                <button
                  onClick={() => handleLikePost(selectedPost.id)}
                  className={`flex items-center space-x-2 transition-colors ${
                    likedPosts.has(selectedPost.id)
                      ? 'text-red-600'
                      : 'text-muted-foreground hover:text-red-600'
                  }`}
                >
                  <Heart className={`h-5 w-5 ${likedPosts.has(selectedPost.id) ? 'fill-current' : ''}`} />
                  <span>{selectedPost.like_count}</span>
                </button>
                
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <MessageCircle className="h-5 w-5" />
                  <span>{selectedPost.comment_count}</span>
                </div>
                
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <Eye className="h-5 w-5" />
                  <span>{selectedPost.view_count}</span>
                </div>
              </div>

              {/* Comments Section */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  Comments ({selectedPost.comment_count})
                </h3>

                {/* New Comment Form */}
                <div className="mb-6">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="text-indigo-600 font-medium text-sm">
                          {profile?.first_name?.[0] || 'U'}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <textarea
                        rows={2}
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-background text-foreground text-sm"
                        placeholder="Add a comment..."
                      />
                      <Button
                        size="sm"
                        className="mt-2"
                        onClick={() => handleAddComment(selectedPost.id)}
                        disabled={!newComment.trim()}
                      >
                        <Send className="h-3 w-3 mr-2" />
                        Comment
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Comments List */}
                <div className="space-y-4">
                  {comments[selectedPost.id]?.map(comment => (
                    <div key={comment.id} className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                          <span className="text-foreground font-medium text-sm">
                            {comment.author?.first_name?.[0] || 'U'}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="bg-secondary rounded-lg p-3">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium text-sm text-foreground">
                              {comment.author?.first_name && comment.author?.last_name
                                ? `${comment.author.first_name} ${comment.author.last_name}`
                                : 'Unknown User'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(comment.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-foreground">{comment.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {(!comments[selectedPost.id] || comments[selectedPost.id].length === 0) && (
                    <p className="text-center text-muted-foreground text-sm py-4">
                      No comments yet. Be the first to comment!
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Post Card Component
function PostCard({ 
  post, 
  isLiked, 
  onLike, 
  onClick 
}: { 
  post: Post; 
  isLiked: boolean; 
  onLike: (id: string) => void;
  onClick: (post: Post) => void;
}) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
    });
  };

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardHeader onClick={() => onClick(post)}>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <span className="text-indigo-600 font-medium">
                {post.author?.first_name?.[0] || 'U'}
              </span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <CardTitle className="text-base">
                  {post.author?.first_name && post.author?.last_name
                    ? `${post.author.first_name} ${post.author.last_name}`
                    : 'Unknown User'}
                </CardTitle>
                {post.is_pinned && (
                  <Pin className="h-3 w-3 text-indigo-600" />
                )}
              </div>
              <CardDescription className="text-xs">
                {formatDate(post.created_at)}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent onClick={() => onClick(post)}>
        <h3 className="font-semibold text-lg text-foreground mb-2">{post.title}</h3>
        <p className="text-muted-foreground line-clamp-3 mb-4">{post.content}</p>
        
        {post.community_post_tags && post.community_post_tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {post.community_post_tags.map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-secondary text-xs rounded-full text-foreground"
                style={{ 
                  backgroundColor: tag.community_tags.color + '20',
                  color: tag.community_tags.color 
                }}
              >
                {tag.community_tags.name}
              </span>
            ))}
          </div>
        )}
        
        <div className="flex items-center space-x-6">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLike(post.id);
            }}
            className={`flex items-center space-x-2 transition-colors ${
              isLiked
                ? 'text-red-600'
                : 'text-muted-foreground hover:text-red-600'
            }`}
          >
            <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
            <span className="text-sm">{post.like_count}</span>
          </button>
          
          <div className="flex items-center space-x-2 text-muted-foreground">
            <MessageCircle className="h-4 w-4" />
            <span className="text-sm">{post.comment_count}</span>
          </div>
          
          <div className="flex items-center space-x-2 text-muted-foreground">
            <Eye className="h-4 w-4" />
            <span className="text-sm">{post.view_count}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
