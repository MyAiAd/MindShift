import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// GET /api/community/posts - List posts with filtering, search, pagination
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
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100); // Max 100 per page
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') || '';
    const tagId = searchParams.get('tag_id') || '';
    const status = searchParams.get('status') || '';
    const authorId = searchParams.get('author_id') || '';
    const pinned = searchParams.get('pinned') === 'true';
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrder = searchParams.get('sort_order') || 'desc';

    // Build base query with author and tag information
    let query = supabase
      .from('community_posts')
      .select(`
        *,
        author:profiles!user_id(id, first_name, last_name, email),
        community_post_tags(
          community_tags(id, name, color)
        )
      `)
      .range(offset, offset + limit - 1);

    // Apply tenant filtering (RLS will also enforce this)
    if (profile.role !== 'super_admin') {
      query = query.eq('tenant_id', profile.tenant_id);
    }

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    } else {
      // Default to published posts only for non-admins
      if (!['tenant_admin', 'super_admin'].includes(profile.role)) {
        query = query.eq('status', 'published');
      }
    }

    if (authorId) {
      query = query.eq('user_id', authorId);
    }

    if (pinned) {
      query = query.eq('is_pinned', true);
    }

    // Apply tag filtering
    if (tagId) {
      // Get post IDs for the tag first
      const { data: taggedPosts } = await supabase
        .from('community_post_tags')
        .select('post_id')
        .eq('tag_id', tagId);
      
      const postIds = taggedPosts?.map(tp => tp.post_id) || [];
      if (postIds.length > 0) {
        query = query.in('id', postIds);
      } else {
        // No posts with this tag - return empty result
        return NextResponse.json({
          posts: [],
          pagination: { page, limit, total: 0, totalPages: 0 }
        });
      }
    }

    // Apply search
    if (search) {
      query = query.textSearch('title,content', search);
    }

    // Apply sorting
    const sortColumn = sortBy === 'published_at' ? 'published_at' : 
                      sortBy === 'updated_at' ? 'updated_at' : 
                      sortBy === 'view_count' ? 'view_count' :
                      sortBy === 'like_count' ? 'like_count' : 'created_at';
    
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

    // Always prioritize pinned posts
    if (!pinned && sortBy !== 'is_pinned') {
      query = query.order('is_pinned', { ascending: false });
    }

    const { data: posts, error } = await query;

    if (error) {
      console.error('Error fetching posts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch posts' },
        { status: 500 }
      );
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('community_posts')
      .select('id', { count: 'exact', head: true });

    if (profile.role !== 'super_admin') {
      countQuery = countQuery.eq('tenant_id', profile.tenant_id);
    }

    if (status) {
      countQuery = countQuery.eq('status', status);
    } else if (!['tenant_admin', 'super_admin'].includes(profile.role)) {
      countQuery = countQuery.eq('status', 'published');
    }

    if (authorId) {
      countQuery = countQuery.eq('user_id', authorId);
    }

    if (tagId) {
      // Reuse the same post IDs for count query
      const { data: taggedPosts } = await supabase
        .from('community_post_tags')
        .select('post_id')
        .eq('tag_id', tagId);
      
      const postIds = taggedPosts?.map(tp => tp.post_id) || [];
      if (postIds.length > 0) {
        countQuery = countQuery.in('id', postIds);
      }
    }

    if (search) {
      countQuery = countQuery.textSearch('title,content', search);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Error counting posts:', countError);
      return NextResponse.json(
        { error: 'Failed to count posts' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      posts: posts || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error in posts fetch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/community/posts - Create a new post
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
    const { title, content, status = 'published', scheduledAt, tagIds = [], metadata = {} } = body;

    // Validate required fields
    if (!title || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: title, content' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['draft', 'published', 'scheduled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: draft, published, scheduled' },
        { status: 400 }
      );
    }

    // Validate scheduled_at for scheduled posts
    if (status === 'scheduled' && !scheduledAt) {
      return NextResponse.json(
        { error: 'scheduled_at is required for scheduled posts' },
        { status: 400 }
      );
    }

    // Create post data
    const postData = {
      tenant_id: profile.tenant_id,
      user_id: user.id,
      title: title.trim(),
      content: content.trim(),
      status,
      scheduled_at: status === 'scheduled' ? scheduledAt : null,
      metadata,
    };

    // Insert post
    const { data: post, error: insertError } = await supabase
      .from('community_posts')
      .insert(postData)
      .select(`
        *,
        author:profiles!user_id(id, first_name, last_name, email)
      `)
      .single();

    if (insertError) {
      console.error('Error creating post:', insertError);
      return NextResponse.json(
        { error: 'Failed to create post' },
        { status: 500 }
      );
    }

    // Add tags if provided
    if (tagIds.length > 0) {
      // Verify all tags exist and belong to the same tenant
      const { data: tags, error: tagsError } = await supabase
        .from('community_tags')
        .select('id')
        .in('id', tagIds)
        .eq('tenant_id', profile.tenant_id);

      if (tagsError || !tags || tags.length !== tagIds.length) {
        // Post was created but tags failed - we could handle this better
        console.error('Error validating tags:', tagsError);
        return NextResponse.json({
          post,
          warning: 'Post created but some tags could not be applied'
        });
      }

      // Create post-tag relationships
      const postTagData = tagIds.map((tagId: string) => ({
        post_id: post.id,
        tag_id: tagId
      }));

      const { error: postTagError } = await supabase
        .from('community_post_tags')
        .insert(postTagData);

      if (postTagError) {
        console.error('Error adding tags to post:', postTagError);
        return NextResponse.json({
          post,
          warning: 'Post created but tags could not be applied'
        });
      }

      // Fetch the complete post with tags
      const { data: completePost } = await supabase
        .from('community_posts')
        .select(`
          *,
          author:profiles!user_id(id, first_name, last_name, email),
          community_post_tags(
            community_tags(id, name, color)
          )
        `)
        .eq('id', post.id)
        .single();

      return NextResponse.json({ post: completePost || post }, { status: 201 });
    }

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error('Error in post creation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 