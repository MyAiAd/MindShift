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
    const { post_id, action, value } = body;

    if (!post_id || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: post_id, action' },
        { status: 400 }
      );
    }

    // Get the post to check tenant
    const { data: post, error: postError } = await supabase
      .from('community_posts')
      .select('tenant_id')
      .eq('id', post_id)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Check tenant access
    if (profile.role !== 'super_admin' && post.tenant_id !== profile.tenant_id) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot moderate posts from other tenants' },
        { status: 403 }
      );
    }

    // Perform moderation action
    let updateData: any = { updated_at: new Date().toISOString() };

    switch (action) {
      case 'pin':
      case 'unpin':
        updateData.is_pinned = action === 'pin';
        break;
      case 'archive':
      case 'unarchive':
        updateData.is_archived = action === 'archive';
        break;
      case 'flag':
      case 'unflag':
        updateData.is_flagged = action === 'flag';
        break;
      case 'update_content':
        if (!value) {
          return NextResponse.json(
            { error: 'Missing content value' },
            { status: 400 }
          );
        }
        updateData.content = value;
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    // Update the post
    const { data: updatedPost, error: updateError } = await supabase
      .from('community_posts')
      .update(updateData)
      .eq('id', post_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating post:', updateError);
      return NextResponse.json(
        { error: 'Failed to update post' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      post: updatedPost,
      message: `Post ${action} successfully`,
    });

  } catch (error) {
    console.error('Error in post moderation API:', error);
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
    const post_id = searchParams.get('post_id');

    if (!post_id) {
      return NextResponse.json(
        { error: 'Missing post_id parameter' },
        { status: 400 }
      );
    }

    // Get the post to check tenant
    const { data: post, error: postError } = await supabase
      .from('community_posts')
      .select('tenant_id')
      .eq('id', post_id)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Check tenant access
    if (profile.role !== 'super_admin' && post.tenant_id !== profile.tenant_id) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot delete posts from other tenants' },
        { status: 403 }
      );
    }

    // Delete the post (cascade will delete comments)
    const { error: deleteError } = await supabase
      .from('community_posts')
      .delete()
      .eq('id', post_id);

    if (deleteError) {
      console.error('Error deleting post:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete post' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Post deleted successfully',
    });

  } catch (error) {
    console.error('Error in post deletion API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
