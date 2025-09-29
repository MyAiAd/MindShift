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

    // Get user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    console.log('Debug: User profile:', { 
      id: profile.id, 
      role: profile.role, 
      tenant_id: profile.tenant_id,
      stats_cleared_at: profile.stats_cleared_at 
    });

    // Get all treatment sessions for this user (raw data)
    const { data: allSessions, error: sessionsError } = await supabase
      .from('treatment_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
    }

    // Get stats using the function
    const { data: statsData, error: statsError } = await supabase
      .rpc('get_session_stats', {
        p_user_id: user.id,
        p_tenant_id: profile.tenant_id,
        p_days: 30
      });

    if (statsError) {
      console.error('Error fetching stats:', statsError);
    }

    // Manual calculation for comparison
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const statsCleared = profile.stats_cleared_at ? new Date(profile.stats_cleared_at) : new Date('1970-01-01');
    
    const filteredSessions = allSessions?.filter(session => {
      const createdAt = new Date(session.created_at);
      return createdAt >= thirtyDaysAgo && createdAt >= statsCleared;
    }) || [];

    const manualStats = {
      total_treatment_sessions: filteredSessions.length,
      active_treatment_sessions: filteredSessions.filter(s => ['active', 'paused'].includes(s.status)).length,
      completed_treatment_sessions: filteredSessions.filter(s => s.status === 'completed').length,
      sessions_by_status: filteredSessions.reduce((acc, session) => {
        acc[session.status] = (acc[session.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    return NextResponse.json({
      debug_info: {
        user_id: user.id,
        profile: {
          role: profile.role,
          tenant_id: profile.tenant_id,
          stats_cleared_at: profile.stats_cleared_at
        },
        date_filters: {
          now: now.toISOString(),
          thirty_days_ago: thirtyDaysAgo.toISOString(),
          stats_cleared_at: statsCleared.toISOString()
        }
      },
      raw_sessions: allSessions?.map(session => ({
        session_id: session.session_id,
        status: session.status,
        created_at: session.created_at,
        current_phase: session.current_phase,
        current_step: session.current_step,
        user_id: session.user_id,
        tenant_id: session.tenant_id,
        completed_at: session.completed_at
      })) || [],
      filtered_sessions: filteredSessions.map(session => ({
        session_id: session.session_id,
        status: session.status,
        created_at: session.created_at,
        passes_date_filter: true
      })),
      function_stats: statsData?.[0] || null,
      manual_calculation: manualStats,
      potential_issues: {
        no_sessions_found: !allSessions || allSessions.length === 0,
        all_sessions_filtered_out: allSessions && allSessions.length > 0 && filteredSessions.length === 0,
        status_mismatch: allSessions && allSessions.some(s => !['active', 'paused', 'completed', 'cancelled'].includes(s.status)),
        function_error: !!statsError,
        sessions_error: !!sessionsError
      }
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ 
      error: 'Debug failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 