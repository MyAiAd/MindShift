import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// GET /api/community/blocks - List users the current user has blocked
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: blocks, error } = await supabase
      .from('community_blocks')
      .select(`
        *,
        blocked_user:profiles!blocked_id(id, first_name, last_name, email, avatar_url)
      `)
      .eq('blocker_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching blocks:', error);
      return NextResponse.json(
        { error: 'Failed to fetch blocks' },
        { status: 500 }
      );
    }

    return NextResponse.json({ blocks: blocks || [] });
  } catch (error) {
    console.error('Error in GET /api/community/blocks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/community/blocks - Block a user
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { blocked_id, reason } = body;

    if (!blocked_id) {
      return NextResponse.json(
        { error: 'Missing required field: blocked_id' },
        { status: 400 }
      );
    }

    // Prevent self-blocking
    if (blocked_id === user.id) {
      return NextResponse.json(
        { error: 'Cannot block yourself' },
        { status: 400 }
      );
    }

    // Verify the user to be blocked exists and is in the same tenant
    const { data: blockedUser, error: blockedUserError } = await supabase
      .from('profiles')
      .select('id, tenant_id')
      .eq('id', blocked_id)
      .single();

    if (blockedUserError || !blockedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (profile.tenant_id !== blockedUser.tenant_id) {
      return NextResponse.json(
        { error: 'Can only block users in your community' },
        { status: 403 }
      );
    }

    // Create the block
    const { data: block, error: blockError } = await supabase
      .from('community_blocks')
      .insert({
        tenant_id: profile.tenant_id,
        blocker_id: user.id,
        blocked_id,
        reason: reason || null
      })
      .select()
      .single();

    if (blockError) {
      // Check if it's a duplicate
      if (blockError.code === '23505') {
        return NextResponse.json(
          { error: 'User is already blocked' },
          { status: 409 }
        );
      }
      console.error('Error creating block:', blockError);
      return NextResponse.json(
        { error: 'Failed to block user' },
        { status: 500 }
      );
    }

    return NextResponse.json({ block }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/community/blocks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

