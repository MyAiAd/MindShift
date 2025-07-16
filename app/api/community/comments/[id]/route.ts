import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// GET /api/community/comments/[id] - Get a specific comment with replies
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

    const commentId = params.id;
    const { searchParams } = new URL(request.url);
    const includeReplies = searchParams.get('include_replies') === 'true';

    // Fetch comment with author and parent comment info
    const { data: comment, error } = await supabase
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
      .eq('id', commentId)
      .single();

    if (error || !comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Fetch replies if requested
    let replies = null;
    if (includeReplies) {
      const { data: repliesData } = await supabase
        .from('community_comments')
        .select(`
          *,
          author:profiles!user_id(id, first_name, last_name, email)
        `)
        .eq('parent_comment_id', commentId)
        .in('status', ['published', 'approved'])
        .order('created_at', { ascending: true });

      replies = repliesData || [];
    }

    return NextResponse.json({ 
      comment,
      replies 
    });
  } catch (error) {
    console.error('Error fetching comment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/community/comments/[id] - Update a specific comment
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

    const commentId = params.id;
    const body = await request.json();
    const { content, status, moderationReason, metadata } = body;

    // Get existing comment to verify ownership
    const { data: existingComment, error: fetchError } = await supabase
      .from('community_comments')
      .select('*')
      .eq('id', commentId)
      .single();

    if (fetchError || !existingComment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Check permissions
    const canEdit = existingComment.user_id === user.id || 
                   ['tenant_admin', 'super_admin'].includes(profile.role);
    
    const canModerate = ['tenant_admin', 'super_admin'].includes(profile.role);

    if (!canEdit) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Build update data
    const updateData: any = {};
    
    if (content !== undefined) {
      if (existingComment.user_id !== user.id) {
        return NextResponse.json({ error: 'Only authors can edit comment content' }, { status: 403 });
      }
      
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

      updateData.content = content.trim();
    }

    if (metadata !== undefined) {
      updateData.metadata = metadata;
    }

    // Only moderators can change status
    if (status !== undefined && canModerate) {
      const validStatuses = ['published', 'pending_moderation', 'approved', 'rejected', 'deleted'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        );
      }
      updateData.status = status;
      
      if (status === 'rejected' && moderationReason) {
        updateData.moderation_reason = moderationReason;
        updateData.moderated_by = user.id;
        updateData.moderated_at = new Date().toISOString();
      }
    }

    // Update comment
    const { data: updatedComment, error: updateError } = await supabase
      .from('community_comments')
      .update(updateData)
      .eq('id', commentId)
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

    if (updateError) {
      console.error('Error updating comment:', updateError);
      return NextResponse.json(
        { error: 'Failed to update comment' },
        { status: 500 }
      );
    }

    return NextResponse.json({ comment: updatedComment });
  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/community/comments/[id] - Delete a specific comment
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

    const commentId = params.id;

    // Get existing comment to verify ownership
    const { data: existingComment, error: fetchError } = await supabase
      .from('community_comments')
      .select('*')
      .eq('id', commentId)
      .single();

    if (fetchError || !existingComment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Check permissions
    const canDelete = existingComment.user_id === user.id || 
                     ['tenant_admin', 'super_admin'].includes(profile.role);

    if (!canDelete) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Check if comment has replies
    const { data: replies, error: repliesError } = await supabase
      .from('community_comments')
      .select('id')
      .eq('parent_comment_id', commentId)
      .limit(1);

    if (repliesError) {
      console.error('Error checking for replies:', repliesError);
      return NextResponse.json(
        { error: 'Failed to verify comment status' },
        { status: 500 }
      );
    }

    if (replies && replies.length > 0) {
      // Soft delete by setting status to 'deleted' and clearing content
      const { error: deleteError } = await supabase
        .from('community_comments')
        .update({ 
          status: 'deleted',
          content: '[Comment deleted]'
        })
        .eq('id', commentId);

      if (deleteError) {
        console.error('Error soft deleting comment:', deleteError);
        return NextResponse.json(
          { error: 'Failed to delete comment' },
          { status: 500 }
        );
      }

      return NextResponse.json({ 
        message: 'Comment deleted successfully',
        type: 'soft_delete'
      });
    } else {
      // Hard delete if no replies
      const { error: deleteError } = await supabase
        .from('community_comments')
        .delete()
        .eq('id', commentId);

      if (deleteError) {
        console.error('Error deleting comment:', deleteError);
        return NextResponse.json(
          { error: 'Failed to delete comment' },
          { status: 500 }
        );
      }

      return NextResponse.json({ 
        message: 'Comment deleted successfully',
        type: 'hard_delete'
      });
    }
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 