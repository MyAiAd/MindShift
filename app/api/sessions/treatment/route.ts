import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

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

    // Build query for treatment sessions
    let query = supabase
      .from('treatment_sessions')
      .select(`
        *,
        profiles!treatment_sessions_user_id_fkey(id, first_name, last_name, email)
      `)
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

    return NextResponse.json({ treatmentSessions: sessions || [] });
  } catch (error) {
    console.error('Error in treatment sessions fetch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 