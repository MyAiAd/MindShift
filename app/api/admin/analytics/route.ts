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

    // Build base queries with consistent tenant filtering
    let usersQuery = supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });
    
    let videosQuery = supabase
      .from('tutorial_videos')
      .select('id', { count: 'exact', head: true });
    
    let postsQuery = supabase
      .from('community_posts')
      .select('id', { count: 'exact', head: true });
    
    let sessionsQuery = supabase
      .from('mind_shifting_sessions')
      .select('id', { count: 'exact', head: true });
    
    let recentUsersQuery = supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    
    let topVideosQuery = supabase
      .from('tutorial_videos')
      .select('id, title, view_count')
      .order('view_count', { ascending: false })
      .limit(5);

    // Apply tenant filter consistently (same as Users API)
    if (profile.role !== 'super_admin') {
      usersQuery = usersQuery.eq('tenant_id', profile.tenant_id);
      videosQuery = videosQuery.eq('tenant_id', profile.tenant_id);
      postsQuery = postsQuery.eq('tenant_id', profile.tenant_id);
      sessionsQuery = sessionsQuery.eq('tenant_id', profile.tenant_id);
      recentUsersQuery = recentUsersQuery.eq('tenant_id', profile.tenant_id);
      topVideosQuery = topVideosQuery.eq('tenant_id', profile.tenant_id);
    }

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
      // Total users - filter by tenant
      usersQuery,
      
      // Total videos - filter by tenant
      videosQuery,
      
      // Total community posts - filter by tenant
      postsQuery,
      
      // Total sessions - filter by tenant
      sessionsQuery,
      
      // Recent users (last 30 days) - filter by tenant
      recentUsersQuery,
      
      // Total video views - needs tenant filter via join
      supabase
        .from('tutorial_video_progress')
        .select('id', { count: 'exact', head: true }),
      
      // Top 5 videos by views - filter by tenant
      topVideosQuery,
    ]);

    // Log for debugging
    console.log('Analytics Debug:', {
      tenant_id: profile.tenant_id,
      role: profile.role,
      usersCount: usersCount.count,
      usersError: usersCount.error,
    });

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
