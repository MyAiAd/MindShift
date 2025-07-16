import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// GET /api/community/comments - List comments with filtering and pagination
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
    const postId = searchParams.get('post_id');
    const parentCommentId = searchParams.get('parent_comment_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;
    const status = searchParams.get('status') || '';
    const authorId = searchParams.get('author_id') || '';
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrder = searchParams.get('sort_order') || 'asc'; // Comments typically chronological

    // Build base query with author information
    let query = supabase
      .from('community_comments')
      .select(`
        *,
        author:profiles!user_id(id, first_name, last_name, email),
        parent_comment:community_comments!parent_comment_id(
          id,
          content,
          author:profiles!user_id(id, first_name, last_name, email)
        )
      `)
      .range(offset, offset + limit - 1);

    // Apply tenant filtering (RLS will also enforce this)
    if (profile.role !== 'super_admin') {
      query = query.eq('tenant_id', profile.tenant_id);
    }

    // Filter by post if specified
    if (postId) {
      query = query.eq('post_id', postId);
    }

    // Filter by parent comment (for replies) or top-level comments
    if (parentCommentId) {
      query = query.eq('parent_comment_id', parentCommentId);
    } else {
      // Default to top-level comments only unless specifically requesting replies
      const includeReplies = searchParams.get('include_replies') === 'true';
      if (!includeReplies) {
        query = query.is('parent_comment_id', null);
      }
    }

    // Apply status filter
    if (status) {
      query = query.eq('status', status);
    } else {
      // Default to published comments for non-admins
      if (!['tenant_admin', 'super_admin'].includes(profile.role)) {
        query = query.in('status', ['published', 'approved']);
      }
    }

    // Filter by author if specified
    if (authorId) {
      query = query.eq('user_id', authorId);
    }

    // Apply sorting
    const sortColumn = sortBy === 'updated_at' ? 'updated_at' : 
                      sortBy === 'like_count' ? 'like_count' : 'created_at';
    
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

    const { data: comments, error } = await query;

    if (error) {
      console.error('Error fetching comments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch comments' },
        { status: 500 }
      );
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('community_comments')
      .select('id', { count: 'exact', head: true });

    if (profile.role !== 'super_admin') {
      countQuery = countQuery.eq('tenant_id', profile.tenant_id);
    }

    if (postId) {
      countQuery = countQuery.eq('post_id', postId);
    }

    if (parentCommentId) {
      countQuery = countQuery.eq('parent_comment_id', parentCommentId);
    } else {
      const includeReplies = searchParams.get('include_replies') === 'true';
      if (!includeReplies) {
        countQuery = countQuery.is('parent_comment_id', null);
      }
    }

    if (status) {
      countQuery = countQuery.eq('status', status);
    } else if (!['tenant_admin', 'super_admin'].includes(profile.role)) {
      countQuery = countQuery.in('status', ['published', 'approved']);
    }

    if (authorId) {
      countQuery = countQuery.eq('user_id', authorId);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Error counting comments:', countError);
      return NextResponse.json(
        { error: 'Failed to count comments' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      comments: comments || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error in comments fetch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/community/comments - Create a new comment
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
    const { postId, parentCommentId, content, metadata = {} } = body;

    // Validate required fields
    if (!postId || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: postId, content' },
        { status: 400 }
      );
    }

    // Validate content length
    if (content.trim().length < 1) {
      return NextResponse.json(
        { error: 'Comment content cannot be empty' },
        { status: 400 }
      );
    }

    if (content.length > 10000) {
      return NextResponse.json(
        { error: 'Comment content is too long (max 10,000 characters)' },
        { status: 400 }
      );
    }

    // Verify the post exists and is published
    const { data: post, error: postError } = await supabase
      .from('community_posts')
      .select('id, status, tenant_id')
      .eq('id', postId)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (post.status !== 'published') {
      return NextResponse.json({ error: 'Cannot comment on unpublished posts' }, { status: 400 });
    }

    // Verify tenant access
    if (profile.role !== 'super_admin' && post.tenant_id !== profile.tenant_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // If this is a reply, verify the parent comment exists
    if (parentCommentId) {
      const { data: parentComment, error: parentError } = await supabase
        .from('community_comments')
        .select('id, post_id, tenant_id')
        .eq('id', parentCommentId)
        .single();

      if (parentError || !parentComment) {
        return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 });
      }

      if (parentComment.post_id !== postId) {
        return NextResponse.json({ error: 'Parent comment does not belong to this post' }, { status: 400 });
      }

      if (profile.role !== 'super_admin' && parentComment.tenant_id !== profile.tenant_id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Create comment data
    const commentData = {
      tenant_id: profile.tenant_id,
      post_id: postId,
      user_id: user.id,
      parent_comment_id: parentCommentId || null,
      content: content.trim(),
      status: 'published', // Could implement moderation later
      metadata,
    };

    // Insert comment
    const { data: comment, error: insertError } = await supabase
      .from('community_comments')
      .insert(commentData)
      .select(`
        *,
        author:profiles!user_id(id, first_name, last_name, email),
        parent_comment:community_comments!parent_comment_id(
          id,
          content,
          author:profiles!user_id(id, first_name, last_name, email)
        )
      `)
      .single();

    if (insertError) {
      console.error('Error creating comment:', insertError);
      return NextResponse.json(
        { error: 'Failed to create comment' },
        { status: 500 }
      );
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error('Error in comment creation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 