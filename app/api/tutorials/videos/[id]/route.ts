import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// GET /api/tutorials/videos/[id] - Get a specific video
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: video, error: videoError } = await supabase
      .from('tutorial_videos')
      .select(`
        *,
        category:tutorial_categories(id, name, icon, color)
      `)
      .eq('id', params.id)
      .single();

    if (videoError || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Get user's progress for this video
    const { data: progress } = await supabase
      .from('tutorial_video_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('video_id', params.id)
      .single();

    return NextResponse.json({ 
      video: {
        ...video,
        progress: progress || null
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching tutorial video:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tutorial video' },
      { status: 500 }
    );
  }
}

// PUT /api/tutorials/videos/[id] - Update a video (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
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

    // Update video
    const { data: video, error: videoError } = await supabase
      .from('tutorial_videos')
      .update(body)
      .eq('id', params.id)
      .select()
      .single();

    if (videoError) {
      throw videoError;
    }

    return NextResponse.json({ video }, { status: 200 });

  } catch (error: any) {
    console.error('Error updating tutorial video:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update tutorial video' },
      { status: 500 }
    );
  }
}

// DELETE /api/tutorials/videos/[id] - Delete a video (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if user is admin
    if (!['tenant_admin', 'manager', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Delete video
    const { error: deleteError } = await supabase
      .from('tutorial_videos')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ message: 'Video deleted successfully' }, { status: 200 });

  } catch (error: any) {
    console.error('Error deleting tutorial video:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete tutorial video' },
      { status: 500 }
    );
  }
}
