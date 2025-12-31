import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user profile and check admin role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    if (!['tenant_admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { comment_id, action } = body;

    if (!comment_id || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: comment_id, action' },
        { status: 400 }
      );
    }

    // Get the comment and its post to check tenant
    const { data: comment, error: commentError } = await supabase
      .from('community_comments')
      .select(`
        *,
        community_posts!inner(tenant_id)
      `)
      .eq('id', comment_id)
      .single();

    if (commentError || !comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    // Check tenant access
    if (profile.role !== 'super_admin' && comment.community_posts.tenant_id !== profile.tenant_id) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot moderate comments from other tenants' },
        { status: 403 }
      );
    }

    // Perform moderation action
    let updateData: any = { updated_at: new Date().toISOString() };

    switch (action) {
      case 'flag':
      case 'unflag':
        updateData.is_flagged = action === 'flag';
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    // Update the comment
    const { data: updatedComment, error: updateError } = await supabase
      .from('community_comments')
      .update(updateData)
      .eq('id', comment_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating comment:', updateError);
      return NextResponse.json(
        { error: 'Failed to update comment' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      comment: updatedComment,
      message: `Comment ${action} successfully`,
    });

  } catch (error) {
    console.error('Error in comment moderation API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user profile and check admin role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    if (!['tenant_admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const comment_id = searchParams.get('comment_id');

    if (!comment_id) {
      return NextResponse.json(
        { error: 'Missing comment_id parameter' },
        { status: 400 }
      );
    }

    // Get the comment and its post to check tenant
    const { data: comment, error: commentError } = await supabase
      .from('community_comments')
      .select(`
        *,
        community_posts!inner(tenant_id)
      `)
      .eq('id', comment_id)
      .single();

    if (commentError || !comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    // Check tenant access
    if (profile.role !== 'super_admin' && comment.community_posts.tenant_id !== profile.tenant_id) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot delete comments from other tenants' },
        { status: 403 }
      );
    }

    // Delete the comment
    const { error: deleteError } = await supabase
      .from('community_comments')
      .delete()
      .eq('id', comment_id);

    if (deleteError) {
      console.error('Error deleting comment:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete comment' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Comment deleted successfully',
    });

  } catch (error) {
    console.error('Error in comment deletion API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
