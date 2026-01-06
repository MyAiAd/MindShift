import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// GET /api/community/members - List community members with stats
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

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query to get members in the same tenant
    let query = supabase
      .from('profiles')
      .select('id, first_name, last_name, email, role, avatar_url, bio, location, website, community_joined_at, last_active_at')
      .order('last_active_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply tenant filtering (unless super admin)
    if (profile.role !== 'super_admin') {
      query = query.eq('tenant_id', profile.tenant_id);
    }

    // Apply search filter
    if (search) {
      // Search in first_name, last_name, or email
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: members, error } = await query;

    if (error) {
      console.error('Error fetching members:', error);
      return NextResponse.json(
        { error: 'Failed to fetch members' },
        { status: 500 }
      );
    }

    // Get stats for each member
    const membersWithStats = await Promise.all(
      (members || []).map(async (member) => {
        const { data: statsData } = await supabase.rpc('get_member_stats', {
          p_user_id: member.id
        });

        // Check if current user has blocked this member
        const { data: blockData } = await supabase
          .from('community_blocks')
          .select('id')
          .eq('blocker_id', user.id)
          .eq('blocked_id', member.id)
          .single();

        return {
          ...member,
          stats: statsData || {
            post_count: 0,
            comment_count: 0,
            like_count: 0,
            member_since: member.community_joined_at
          },
          is_blocked: !!blockData
        };
      })
    );

    return NextResponse.json({ 
      members: membersWithStats,
      total: membersWithStats.length 
    });
  } catch (error) {
    console.error('Error in GET /api/community/members:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

