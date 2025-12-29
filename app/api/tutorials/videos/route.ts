import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/tutorials/videos - Fetch all published videos for the user's tenant
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check tenant
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id, role, subscription_tier')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get search params
    const searchParams = request.nextUrl.searchParams;
    const categoryId = searchParams.get('category_id');
    const featured = searchParams.get('featured');
    const search = searchParams.get('search');

    // Build query
    let query = supabase
      .from('tutorial_videos')
      .select(`
        *,
        category:tutorial_categories(id, name, icon, color)
      `)
      .eq('tenant_id', profile.tenant_id)
      .eq('status', 'published')
      .order('display_order');

    // Apply filters
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (featured === 'true') {
      query = query.eq('is_featured', true);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: videos, error: videosError } = await query;

    if (videosError) {
      throw videosError;
    }

    // Get user's progress for these videos
    const videoIds = videos.map(v => v.id);
    const { data: progress } = await supabase
      .from('tutorial_video_progress')
      .select('video_id, watched, watch_percentage, last_position_seconds')
      .eq('user_id', user.id)
      .in('video_id', videoIds);

    // Merge progress into videos
    const videosWithProgress = videos.map(video => ({
      ...video,
      progress: progress?.find(p => p.video_id === video.id) || null
    }));

    return NextResponse.json({ videos: videosWithProgress }, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching tutorial videos:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tutorial videos' },
      { status: 500 }
    );
  }
}

// POST /api/tutorials/videos - Create a new video (admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if user is admin
    if (!['tenant_admin', 'manager', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      title,
      description,
      video_url,
      thumbnail_url,
      duration_minutes,
      duration_text,
      provider,
      provider_video_id,
      category_id,
      status,
      is_featured,
      display_order,
      tags,
      required_subscription_tier
    } = body;

    // Validate required fields
    if (!title || !video_url || !provider) {
      return NextResponse.json(
        { error: 'Missing required fields: title, video_url, provider' },
        { status: 400 }
      );
    }

    // Create video
    const { data: video, error: videoError } = await supabase
      .from('tutorial_videos')
      .insert({
        tenant_id: profile.tenant_id,
        title,
        description,
        video_url,
        thumbnail_url,
        duration_minutes,
        duration_text,
        provider,
        provider_video_id,
        category_id,
        status: status || 'published',
        is_featured: is_featured || false,
        display_order: display_order || 0,
        tags: tags || [],
        required_subscription_tier,
        created_by: user.id
      })
      .select()
      .single();

    if (videoError) {
      throw videoError;
    }

    return NextResponse.json({ video }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating tutorial video:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create tutorial video' },
      { status: 500 }
    );
  }
}
