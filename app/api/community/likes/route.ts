import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// POST /api/community/likes - Like or unlike a post/comment
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check role and tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { type, targetId, action } = body; // type: 'post' | 'comment', action: 'like' | 'unlike'

    // Validate required fields
    if (!type || !targetId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: type, targetId, action' },
        { status: 400 }
      );
    }

    if (!['post', 'comment'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "post" or "comment"' },
        { status: 400 }
      );
    }

    if (!['like', 'unlike'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "like" or "unlike"' },
        { status: 400 }
      );
    }

    if (type === 'post') {
      // Verify the post exists and user has access
      const { data: post, error: postError } = await supabase
        .from('community_posts')
        .select('id, tenant_id, status')
        .eq('id', targetId)
        .single();

      if (postError || !post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      if (post.status !== 'published') {
        return NextResponse.json({ error: 'Cannot like unpublished posts' }, { status: 400 });
      }

      // Verify tenant access
      if (profile.role !== 'super_admin' && post.tenant_id !== profile.tenant_id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      if (action === 'like') {
        // Add like (ignore if already exists)
        const { error: likeError } = await supabase
          .from('community_post_likes')
          .upsert({
            tenant_id: profile.tenant_id,
            post_id: targetId,
            user_id: user.id
          }, {
            onConflict: 'post_id,user_id',
            ignoreDuplicates: true
          });

        if (likeError) {
          console.error('Error liking post:', likeError);
          return NextResponse.json(
            { error: 'Failed to like post' },
            { status: 500 }
          );
        }
      } else {
        // Remove like
        const { error: unlikeError } = await supabase
          .from('community_post_likes')
          .delete()
          .eq('post_id', targetId)
          .eq('user_id', user.id);

        if (unlikeError) {
          console.error('Error unliking post:', unlikeError);
          return NextResponse.json(
            { error: 'Failed to unlike post' },
            { status: 500 }
          );
        }
      }

      // Get updated like count
      const { data: updatedPost } = await supabase
        .from('community_posts')
        .select('like_count')
        .eq('id', targetId)
        .single();

      return NextResponse.json({
        success: true,
        action,
        type: 'post',
        targetId,
        likeCount: updatedPost?.like_count || 0
      });

    } else {
      // Handle comment likes
      const { data: comment, error: commentError } = await supabase
        .from('community_comments')
        .select('id, tenant_id, status')
        .eq('id', targetId)
        .single();

      if (commentError || !comment) {
        return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
      }

      if (!['published', 'approved'].includes(comment.status)) {
        return NextResponse.json({ error: 'Cannot like unpublished comments' }, { status: 400 });
      }

      // Verify tenant access
      if (profile.role !== 'super_admin' && comment.tenant_id !== profile.tenant_id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      if (action === 'like') {
        // Add like (ignore if already exists)
        const { error: likeError } = await supabase
          .from('community_comment_likes')
          .upsert({
            tenant_id: profile.tenant_id,
            comment_id: targetId,
            user_id: user.id
          }, {
            onConflict: 'comment_id,user_id',
            ignoreDuplicates: true
          });

        if (likeError) {
          console.error('Error liking comment:', likeError);
          return NextResponse.json(
            { error: 'Failed to like comment' },
            { status: 500 }
          );
        }
      } else {
        // Remove like
        const { error: unlikeError } = await supabase
          .from('community_comment_likes')
          .delete()
          .eq('comment_id', targetId)
          .eq('user_id', user.id);

        if (unlikeError) {
          console.error('Error unliking comment:', unlikeError);
          return NextResponse.json(
            { error: 'Failed to unlike comment' },
            { status: 500 }
          );
        }
      }

      // Get updated like count
      const { data: updatedComment } = await supabase
        .from('community_comments')
        .select('like_count')
        .eq('id', targetId)
        .single();

      return NextResponse.json({
        success: true,
        action,
        type: 'comment',
        targetId,
        likeCount: updatedComment?.like_count || 0
      });
    }
  } catch (error) {
    console.error('Error in like/unlike action:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/community/likes - Get like status for posts/comments
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check role and tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'post' | 'comment'
    const targetIds = searchParams.get('target_ids')?.split(',') || [];

    if (!type || !['post', 'comment'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid or missing type parameter' },
        { status: 400 }
      );
    }

    if (targetIds.length === 0) {
      return NextResponse.json({
        likes: {},
        userLikes: []
      });
    }

    if (type === 'post') {
      // Get user's likes for these posts
      const { data: userLikes, error: userLikesError } = await supabase
        .from('community_post_likes')
        .select('post_id')
        .in('post_id', targetIds)
        .eq('user_id', user.id);

      if (userLikesError) {
        console.error('Error fetching user post likes:', userLikesError);
        return NextResponse.json(
          { error: 'Failed to fetch like status' },
          { status: 500 }
        );
      }

      // Get total like counts for these posts
      const { data: posts, error: postsError } = await supabase
        .from('community_posts')
        .select('id, like_count')
        .in('id', targetIds);

      if (postsError) {
        console.error('Error fetching post like counts:', postsError);
        return NextResponse.json(
          { error: 'Failed to fetch like counts' },
          { status: 500 }
        );
      }

      const likeCounts = posts?.reduce((acc, post) => {
        acc[post.id] = post.like_count;
        return acc;
      }, {} as Record<string, number>) || {};

      const userLikedIds = userLikes?.map(like => like.post_id) || [];

      return NextResponse.json({
        likes: likeCounts,
        userLikes: userLikedIds
      });

    } else {
      // Handle comment likes
      const { data: userLikes, error: userLikesError } = await supabase
        .from('community_comment_likes')
        .select('comment_id')
        .in('comment_id', targetIds)
        .eq('user_id', user.id);

      if (userLikesError) {
        console.error('Error fetching user comment likes:', userLikesError);
        return NextResponse.json(
          { error: 'Failed to fetch like status' },
          { status: 500 }
        );
      }

      // Get total like counts for these comments
      const { data: comments, error: commentsError } = await supabase
        .from('community_comments')
        .select('id, like_count')
        .in('id', targetIds);

      if (commentsError) {
        console.error('Error fetching comment like counts:', commentsError);
        return NextResponse.json(
          { error: 'Failed to fetch like counts' },
          { status: 500 }
        );
      }

      const likeCounts = comments?.reduce((acc, comment) => {
        acc[comment.id] = comment.like_count;
        return acc;
      }, {} as Record<string, number>) || {};

      const userLikedIds = userLikes?.map(like => like.comment_id) || [];

      return NextResponse.json({
        likes: likeCounts,
        userLikes: userLikedIds
      });
    }
  } catch (error) {
    console.error('Error fetching like status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 