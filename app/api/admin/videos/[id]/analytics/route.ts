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

    const videoId = params.id;

    // Get basic video analytics from the video table
    const { data: video, error: videoError } = await supabase
      .from('tutorial_videos')
      .select('id, view_count, completion_count, average_watch_percentage, tenant_id')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Verify tenant access (super_admin can access all)
    if (profile.role !== 'super_admin' && video.tenant_id !== profile.tenant_id) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot access videos from other tenants' },
        { status: 403 }
      );
    }

    // Get detailed analytics from video progress table
    const { data: progressData, error: progressError } = await supabase
      .from('tutorial_video_progress')
      .select('user_id, watch_percentage, completed, watched_at, updated_at')
      .eq('video_id', videoId);

    if (progressError) {
      console.error('Error fetching progress data:', progressError);
      // Continue with basic analytics even if detailed data fails
    }

    // Calculate detailed analytics
    let uniqueViewers = 0;
    let totalWatchTimeMinutes = 0;
    let completedCount = 0;

    if (progressData && progressData.length > 0) {
      // Count unique viewers
      const uniqueUsers = new Set(progressData.map(p => p.user_id));
      uniqueViewers = uniqueUsers.size;

      // Count completions
      completedCount = progressData.filter(p => p.completed).length;

      // Estimate total watch time (assuming average video is 10 minutes for calculation)
      // This is a rough estimate based on watch percentage
      const estimatedVideoDuration = 10; // minutes - could be improved with actual video duration
      totalWatchTimeMinutes = progressData.reduce(
        (total, progress) => total + (progress.watch_percentage / 100) * estimatedVideoDuration,
        0
      );
    }

    // Prepare analytics response
    const analytics = {
      video_id: video.id,
      view_count: video.view_count || 0,
      completion_count: video.completion_count || completedCount || 0,
      average_watch_percentage: video.average_watch_percentage || 0,
      unique_viewers: uniqueViewers,
      total_watch_time_minutes: Math.round(totalWatchTimeMinutes),
      completion_rate: video.view_count > 0 
        ? ((video.completion_count || 0) / video.view_count) * 100 
        : 0,
    };

    // Get recent viewers (last 10)
    const { data: recentViewers, error: viewersError } = await supabase
      .from('tutorial_video_progress')
      .select(`
        user_id,
        watch_percentage,
        completed,
        watched_at,
        profiles:user_id (
          full_name,
          email
        )
      `)
      .eq('video_id', videoId)
      .order('watched_at', { ascending: false })
      .limit(10);

    if (viewersError) {
      console.error('Error fetching recent viewers:', viewersError);
    }

    return NextResponse.json({
      success: true,
      analytics,
      recent_viewers: recentViewers || [],
    });

  } catch (error) {
    console.error('Error in video analytics API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
