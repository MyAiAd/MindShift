import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const userId = params.id;

    // Get target user profile
    const { data: targetUser, error: targetUserError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (targetUserError || !targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check tenant access (super_admin can access all)
    if (profile.role !== 'super_admin' && targetUser.tenant_id !== profile.tenant_id) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot access users from other tenants' },
        { status: 403 }
      );
    }

    // Get user activity stats
    const [videosWatched, sessions, posts, comments] = await Promise.all([
      supabase
        .from('tutorial_video_progress')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('mind_shifting_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('community_posts')
        .select('id', { count: 'exact', head: true })
        .eq('author_id', userId),
      supabase
        .from('community_comments')
        .select('id', { count: 'exact', head: true })
        .eq('author_id', userId),
    ]);

    const stats = {
      total_videos_watched: videosWatched.count || 0,
      total_sessions: sessions.count || 0,
      total_posts: posts.count || 0,
      total_comments: comments.count || 0,
    };

    return NextResponse.json({
      success: true,
      user: targetUser,
      stats,
    });

  } catch (error) {
    console.error('Error in user details API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const userId = params.id;
    const body = await request.json();

    // Get target user
    const { data: targetUser, error: targetUserError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', userId)
      .single();

    if (targetUserError || !targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check tenant access
    if (profile.role !== 'super_admin' && targetUser.tenant_id !== profile.tenant_id) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot modify users from other tenants' },
        { status: 403 }
      );
    }

    // Update user profile
    const { data: updatedUser, error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: body.full_name,
        // Add other updatable fields as needed
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating user:', updateError);
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });

  } catch (error) {
    console.error('Error in user update API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
