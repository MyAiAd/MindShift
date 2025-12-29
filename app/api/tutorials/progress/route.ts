import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/tutorials/progress - Update video progress
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      video_id,
      watched,
      watch_percentage,
      last_position_seconds,
      liked,
      rating,
      notes
    } = body;

    // Validate required fields
    if (!video_id) {
      return NextResponse.json(
        { error: 'Missing required field: video_id' },
        { status: 400 }
      );
    }

    // Upsert progress
    const progressData: any = {
      user_id: user.id,
      video_id,
      tenant_id: profile.tenant_id
    };

    if (watched !== undefined) progressData.watched = watched;
    if (watch_percentage !== undefined) progressData.watch_percentage = watch_percentage;
    if (last_position_seconds !== undefined) progressData.last_position_seconds = last_position_seconds;
    if (liked !== undefined) progressData.liked = liked;
    if (rating !== undefined) progressData.rating = rating;
    if (notes !== undefined) progressData.notes = notes;

    // Auto-complete when watch percentage >= 90%
    if (watch_percentage >= 90 && !watched) {
      progressData.watched = true;
      progressData.completed_at = new Date().toISOString();
    }

    const { data: progress, error: progressError } = await supabase
      .from('tutorial_video_progress')
      .upsert(progressData, {
        onConflict: 'user_id,video_id'
      })
      .select()
      .single();

    if (progressError) {
      throw progressError;
    }

    return NextResponse.json({ progress }, { status: 200 });

  } catch (error: any) {
    console.error('Error updating video progress:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update video progress' },
      { status: 500 }
    );
  }
}

// GET /api/tutorials/progress - Get user's progress stats
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get progress stats using the database function
    const { data: stats, error: statsError } = await supabase
      .rpc('get_user_video_progress_stats', { p_user_id: user.id });

    if (statsError) {
      throw statsError;
    }

    return NextResponse.json({ stats }, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching video progress stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch video progress stats' },
      { status: 500 }
    );
  }
}
