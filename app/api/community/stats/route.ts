import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// GET /api/community/stats - Get community statistics
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get total member count for tenant
    const { count: memberCount, error: memberError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', profile.tenant_id);

    if (memberError) {
      console.error('Error counting members:', memberError);
    }

    // Get active users today (last sign in within last 24 hours)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    
    const { count: activeToday, error: activeError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', profile.tenant_id)
      .gte('last_sign_in_at', twentyFourHoursAgo.toISOString());

    if (activeError) {
      console.error('Error counting active users:', activeError);
    }

    // Get total posts count
    const { count: totalPosts, error: postsError } = await supabase
      .from('community_posts')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', profile.tenant_id)
      .eq('status', 'published');

    if (postsError) {
      console.error('Error counting posts:', postsError);
    }

    return NextResponse.json({
      stats: {
        memberCount: memberCount || 0,
        activeToday: activeToday || 0,
        totalPosts: totalPosts || 0
      }
    });
  } catch (error) {
    console.error('Error fetching community stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
