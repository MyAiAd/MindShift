import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// GET /api/community/activity - Get community activity feed
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;
    const type = searchParams.get('type') || ''; // 'posts', 'comments', 'likes', 'all'
    const since = searchParams.get('since') || ''; // ISO date string

    let activities: any[] = [];

    // Get recent posts
    if (!type || type === 'posts' || type === 'all') {
      const { data: posts } = await supabase
        .from('community_posts')
        .select(`
          id, title, created_at, updated_at, status, like_count, comment_count,
          author:profiles!user_id(id, first_name, last_name, email)
        `)
        .eq('tenant_id', profile.tenant_id)
        .eq('status', 'published')
        .gte('created_at', since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(type === 'posts' ? limit : Math.floor(limit / 3));

      if (posts) {
        activities.push(...posts.map(post => ({
          type: 'post_created',
          id: `post_${post.id}`,
          post_id: post.id,
          title: post.title,
          author: post.author,
          created_at: post.created_at,
          metadata: {
            like_count: post.like_count,
            comment_count: post.comment_count
          }
        })));
      }
    }

    // Get recent comments
    if (!type || type === 'comments' || type === 'all') {
             const { data: comments } = await supabase
         .from('community_comments')
         .select(`
           id, content, created_at, post_id,
           author:profiles!user_id(id, first_name, last_name, email),
           post:community_posts!post_id(id, title)
         `)
        .eq('tenant_id', profile.tenant_id)
        .in('status', ['published', 'approved'])
        .gte('created_at', since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(type === 'comments' ? limit : Math.floor(limit / 3));

      if (comments) {
                activities.push(...comments.map(comment => ({
          type: 'comment_created',
          id: `comment_${comment.id}`,
          comment_id: comment.id,
          post_id: comment.post_id,
          content: comment.content.substring(0, 100) + (comment.content.length > 100 ? '...' : ''),
          author: comment.author,
          post_title: (comment.post as any)?.title || 'Unknown Post',
          created_at: comment.created_at
        })));
      }
    }

    // Get recent community notifications (likes, etc.)
    if (!type || type === 'notifications' || type === 'all') {
      const { data: notifications } = await supabase
        .from('client_messages')
        .select(`
          id, message_type, subject, message_content, created_at, metadata,
          sender:profiles!sender_id(id, first_name, last_name, email)
        `)
        .eq('tenant_id', profile.tenant_id)
        .in('message_type', ['comment_on_post', 'reply_to_comment', 'post_liked', 'comment_liked'])
        .gte('created_at', since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(type === 'notifications' ? limit : Math.floor(limit / 3));

      if (notifications) {
        activities.push(...notifications.map(notification => ({
          type: notification.message_type,
          id: `notification_${notification.id}`,
          subject: notification.subject,
          content: notification.message_content,
          author: notification.sender,
          created_at: notification.created_at,
          metadata: notification.metadata
        })));
      }
    }

    // Sort all activities by creation date
    activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Apply pagination to the combined results
    const paginatedActivities = activities.slice(offset, offset + limit);

    return NextResponse.json({
      activities: paginatedActivities,
      pagination: {
        page,
        limit,
        total: activities.length,
        totalPages: Math.ceil(activities.length / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching community activity:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/community/activity - Trigger community notifications (for background jobs)
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
    const { action, targetType, targetId, recipientId, metadata = {} } = body;

    // Validate required fields
    if (!action || !targetType || !targetId) {
      return NextResponse.json(
        { error: 'Missing required fields: action, targetType, targetId' },
        { status: 400 }
      );
    }

    // Only allow specific actions
    const allowedActions = ['post_created', 'comment_created', 'post_liked', 'comment_liked'];
    if (!allowedActions.includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    // Only allow specific target types
    const allowedTargetTypes = ['post', 'comment'];
    if (!allowedTargetTypes.includes(targetType)) {
      return NextResponse.json(
        { error: 'Invalid targetType' },
        { status: 400 }
      );
    }

    // Verify target exists and user has access
    if (targetType === 'post') {
      const { data: post, error: postError } = await supabase
        .from('community_posts')
        .select('id, tenant_id, user_id, title')
        .eq('id', targetId)
        .single();

      if (postError || !post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      if (profile.role !== 'super_admin' && post.tenant_id !== profile.tenant_id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      // Use the send_community_notification function directly
      const messageType = action === 'post_liked' ? 'post_liked' : 'comment_on_post';
      const subject = action === 'post_liked' ? 'Someone liked your post' : 'New comment on your post';
      const content = action === 'post_liked' 
        ? `Your post "${post.title}" received a new like!`
        : `Your post "${post.title}" received a new comment!`;

      const notificationId = await supabase
        .rpc('send_community_notification', {
          p_tenant_id: profile.tenant_id,
          p_recipient_id: recipientId || post.user_id,
          p_sender_id: user.id,
          p_message_type: messageType,
          p_subject: subject,
          p_content: content,
          p_metadata: { ...metadata, post_id: targetId, post_title: post.title }
        });

      return NextResponse.json({ 
        success: true, 
        notificationId,
        action,
        targetType,
        targetId
      });

    } else {
      // Handle comment notifications
             const { data: comment, error: commentError } = await supabase
         .from('community_comments')
         .select(`
           id, tenant_id, user_id, content, post_id
         `)
        .eq('id', targetId)
        .single();

      if (commentError || !comment) {
        return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
      }

      if (profile.role !== 'super_admin' && comment.tenant_id !== profile.tenant_id) {
                 return NextResponse.json({ error: 'Access denied' }, { status: 403 });
       }

       // Get post title for notification
       const { data: post } = await supabase
         .from('community_posts')
         .select('title')
         .eq('id', comment.post_id)
         .single();

       const messageType = action === 'comment_liked' ? 'comment_liked' : 'reply_to_comment';
       const subject = action === 'comment_liked' ? 'Someone liked your comment' : 'Someone replied to your comment';
       const content = action === 'comment_liked'
         ? `Your comment received a new like!`
         : `Someone replied to your comment!`;

       const notificationId = await supabase
         .rpc('send_community_notification', {
           p_tenant_id: profile.tenant_id,
           p_recipient_id: recipientId || comment.user_id,
           p_sender_id: user.id,
           p_message_type: messageType,
           p_subject: subject,
           p_content: content,
           p_metadata: { 
             ...metadata, 
             comment_id: targetId, 
             post_id: comment.post_id,
             post_title: post?.title 
           }
         });

      return NextResponse.json({ 
        success: true, 
        notificationId,
        action,
        targetType,
        targetId
      });
    }
  } catch (error) {
    console.error('Error triggering community notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 