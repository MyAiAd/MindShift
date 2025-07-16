import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// GET /api/community/posts/[id] - Get a specific post
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const postId = params.id;

    // Fetch post with author and tags
    const { data: post, error } = await supabase
      .from('community_posts')
      .select(`
        *,
        author:profiles!user_id(id, first_name, last_name, email),
        community_post_tags(
          community_tags(id, name, color)
        )
      `)
      .eq('id', postId)
      .single();

    if (error || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Increment view count (only for published posts and not for the author)
    if (post.status === 'published' && post.user_id !== user.id) {
      await supabase
        .from('community_posts')
        .update({ view_count: post.view_count + 1 })
        .eq('id', postId);
      
      post.view_count += 1;
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error('Error fetching post:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/community/posts/[id] - Update a specific post
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const postId = params.id;
    const body = await request.json();
    const { title, content, status, scheduledAt, tagIds, metadata, isPinned } = body;

    // Get existing post to verify ownership
    const { data: existingPost, error: fetchError } = await supabase
      .from('community_posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (fetchError || !existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Check permissions
    const canEdit = existingPost.user_id === user.id || 
                   ['tenant_admin', 'super_admin'].includes(profile.role);
    
    const canPin = ['tenant_admin', 'super_admin'].includes(profile.role);

    if (!canEdit) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Build update data
    const updateData: any = {};
    
    if (title !== undefined) updateData.title = title.trim();
    if (content !== undefined) updateData.content = content.trim();
    if (metadata !== undefined) updateData.metadata = metadata;
    
    if (status !== undefined) {
      const validStatuses = ['draft', 'published', 'scheduled', 'archived'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        );
      }
      updateData.status = status;
    }

    if (scheduledAt !== undefined) {
      updateData.scheduled_at = scheduledAt;
    }

    // Only admins can pin/unpin posts
    if (isPinned !== undefined && canPin) {
      updateData.is_pinned = isPinned;
    }

    // Update post
    const { data: updatedPost, error: updateError } = await supabase
      .from('community_posts')
      .update(updateData)
      .eq('id', postId)
      .select(`
        *,
        author:profiles!user_id(id, first_name, last_name, email)
      `)
      .single();

    if (updateError) {
      console.error('Error updating post:', updateError);
      return NextResponse.json(
        { error: 'Failed to update post' },
        { status: 500 }
      );
    }

    // Update tags if provided
    if (tagIds !== undefined) {
      // Remove existing tags
      await supabase
        .from('community_post_tags')
        .delete()
        .eq('post_id', postId);

      // Add new tags if any
      if (tagIds.length > 0) {
        // Verify all tags exist and belong to the same tenant
        const { data: tags, error: tagsError } = await supabase
          .from('community_tags')
          .select('id')
          .in('id', tagIds)
          .eq('tenant_id', profile.tenant_id);

        if (tagsError || !tags || tags.length !== tagIds.length) {
          console.error('Error validating tags:', tagsError);
          return NextResponse.json({
            post: updatedPost,
            warning: 'Post updated but some tags could not be applied'
          });
        }

        // Create new post-tag relationships
        const postTagData = tagIds.map((tagId: string) => ({
          post_id: postId,
          tag_id: tagId
        }));

        const { error: postTagError } = await supabase
          .from('community_post_tags')
          .insert(postTagData);

        if (postTagError) {
          console.error('Error updating post tags:', postTagError);
          return NextResponse.json({
            post: updatedPost,
            warning: 'Post updated but tags could not be applied'
          });
        }
      }

      // Fetch the complete updated post with tags
      const { data: completePost } = await supabase
        .from('community_posts')
        .select(`
          *,
          author:profiles!user_id(id, first_name, last_name, email),
          community_post_tags(
            community_tags(id, name, color)
          )
        `)
        .eq('id', postId)
        .single();

      return NextResponse.json({ post: completePost || updatedPost });
    }

    return NextResponse.json({ post: updatedPost });
  } catch (error) {
    console.error('Error updating post:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/community/posts/[id] - Delete a specific post
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const postId = params.id;

    // Get existing post to verify ownership
    const { data: existingPost, error: fetchError } = await supabase
      .from('community_posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (fetchError || !existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Check permissions
    const canDelete = existingPost.user_id === user.id || 
                     ['tenant_admin', 'super_admin'].includes(profile.role);

    if (!canDelete) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Soft delete by setting status to 'deleted'
    const { error: deleteError } = await supabase
      .from('community_posts')
      .update({ status: 'deleted' })
      .eq('id', postId);

    if (deleteError) {
      console.error('Error deleting post:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete post' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 