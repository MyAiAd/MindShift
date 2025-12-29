import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

export async function GET(request: NextRequest) {
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

    // Build tenant filter
    const tenantFilter = profile.role === 'super_admin' ? {} : { tenant_id: profile.tenant_id };

    // Fetch overview analytics in parallel
    const [
      usersCount,
      videosCount,
      postsCount,
      sessionsCount,
      recentUsers,
      videoViews,
      topVideos,
    ] = await Promise.all([
      // Total users
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .match(tenantFilter),
      
      // Total videos
      supabase
        .from('tutorial_videos')
        .select('id', { count: 'exact', head: true })
        .match(tenantFilter),
      
      // Total community posts
      supabase
        .from('community_posts')
        .select('id', { count: 'exact', head: true })
        .match(tenantFilter),
      
      // Total sessions
      supabase
        .from('mind_shifting_sessions')
        .select('id', { count: 'exact', head: true })
        .match(tenantFilter),
      
      // Recent users (last 30 days)
      supabase
        .from('profiles')
        .select('created_at')
        .match(tenantFilter)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .select('id', { count: 'exact', head: true }),
      
      // Total video views
      supabase
        .from('tutorial_video_progress')
        .select('id', { count: 'exact', head: true }),
      
      // Top 5 videos by views
      supabase
        .from('tutorial_videos')
        .select('id, title, view_count')
        .match(tenantFilter)
        .order('view_count', { ascending: false })
        .limit(5),
    ]);

    // Calculate growth rates (simplified - comparing with all-time data)
    const usersGrowth = recentUsers.count && usersCount.count
      ? Math.round((recentUsers.count / usersCount.count) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      overview: {
        total_users: usersCount.count || 0,
        total_videos: videosCount.count || 0,
        total_posts: postsCount.count || 0,
        total_sessions: sessionsCount.count || 0,
        new_users_30_days: recentUsers.count || 0,
        total_video_views: videoViews.count || 0,
      },
      growth: {
        users: usersGrowth,
        videos: 0, // Can be calculated with historical data
        posts: 0,
        sessions: 0,
      },
      top_videos: topVideos.data || [],
    });

  } catch (error) {
    console.error('Error in analytics API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
