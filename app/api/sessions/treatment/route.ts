import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check role and tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status'); // active, completed, cancelled

    // Build query for treatment sessions (without join first)
    let query = supabase
      .from('treatment_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    // For Super Admins: see all treatment sessions
    // For regular users: only see their own treatment sessions
    if (profile.role !== 'super_admin') {
      query = query.eq('user_id', user.id);
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error('Error fetching treatment sessions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch treatment sessions' },
        { status: 500 }
      );
    }

    // Now fetch profile data for each session
    const sessionsWithProfiles = await Promise.all(
      (sessions || []).map(async (session) => {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .eq('id', session.user_id)
          .single();

        return {
          ...session,
          profiles: profileData || {
            id: session.user_id,
            first_name: 'Unknown',
            last_name: 'User', 
            email: 'unknown@example.com'
          }
        };
      })
    );

    return NextResponse.json({ treatmentSessions: sessionsWithProfiles });
  } catch (error) {
    console.error('Error in treatment sessions fetch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check role and tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing required field: sessionId' },
        { status: 400 }
      );
    }

    // First, verify the session exists and user has permission to delete it
    const { data: session, error: fetchError } = await supabase
      .from('treatment_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (fetchError || !session) {
      return NextResponse.json(
        { error: 'Treatment session not found' },
        { status: 404 }
      );
    }

    // Check permissions: user can only delete their own sessions, unless they're super admin
    if (profile.role !== 'super_admin' && session.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Delete the treatment session (cascading deletes will handle related records)
    const { error: deleteError } = await supabase
      .from('treatment_sessions')
      .delete()
      .eq('session_id', sessionId);

    if (deleteError) {
      console.error('Error deleting treatment session:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete treatment session' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Treatment session deleted successfully' });
  } catch (error) {
    console.error('Error in treatment session deletion:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 