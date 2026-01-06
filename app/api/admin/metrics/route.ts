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

    // Get user's profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.role !== 'super_admin' && profile.role !== 'admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    // Call the database function to get admin aggregate metrics
    const { data: metricsData, error: metricsError } = await supabase
      .rpc('get_admin_aggregate_metrics', { p_days: days });

    if (metricsError) {
      console.error('Error fetching admin metrics:', metricsError);
      
      // Fallback to manual calculation if function doesn't exist yet
      return await getFallbackMetrics(supabase, days);
    }

    // Return the first row of results
    const stats = metricsData && metricsData.length > 0 ? metricsData[0] : getEmptyStats();

    return NextResponse.json({ 
      stats,
      period: {
        days,
        startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error in admin metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Fallback function if the database function doesn't exist yet
async function getFallbackMetrics(supabase: any, days: number) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data: sessions, error } = await supabase
      .from('treatment_sessions')
      .select('*')
      .gte('created_at', cutoffDate.toISOString());

    if (error || !sessions) {
      return NextResponse.json({ stats: getEmptyStats() });
    }

    const completedSessions = sessions.filter((s: any) => s.status === 'completed');
    const activeSessions = sessions.filter((s: any) => s.status === 'active');
    const uniqueUsers = new Set(sessions.map((s: any) => s.user_id)).size;
    const uniqueDays = new Set(sessions.map((s: any) => 
      new Date(s.created_at).toDateString()
    )).size;

    const totalMinutes = sessions.reduce((sum: number, s: any) => 
      sum + (s.duration_minutes || 0), 0
    );
    
    // Use problems_count if available, otherwise count completed sessions
    const problemsCleared = sessions.reduce((sum: number, s: any) => 
      sum + (s.problems_count || (s.status === 'completed' ? 1 : 0)), 0
    );
    
    const goalsOptimized = sessions.reduce((sum: number, s: any) => 
      sum + (s.goals_count || 0), 0
    );
    
    const experiencesCleared = sessions.reduce((sum: number, s: any) => 
      sum + (s.experiences_count || 0), 0
    );

    const stats = {
      total_users: uniqueUsers,
      total_sessions: sessions.length,
      completed_sessions: completedSessions.length,
      active_sessions: activeSessions.length,
      problems_cleared: problemsCleared,
      goals_optimized: goalsOptimized,
      experiences_cleared: experiencesCleared,
      total_minutes: totalMinutes,
      avg_session_duration: sessions.length > 0 ? Math.round(totalMinutes / sessions.length) : 0,
      avg_minutes_per_problem: problemsCleared > 0 ? Math.round(totalMinutes / problemsCleared) : 0,
      total_active_days: uniqueDays,
      avg_sessions_per_user: uniqueUsers > 0 ? Math.round(sessions.length / uniqueUsers * 10) / 10 : 0
    };

    return NextResponse.json({ 
      stats,
      period: {
        days,
        startDate: cutoffDate.toISOString(),
        endDate: new Date().toISOString()
      },
      _fallback: true // Indicates fallback calculation was used
    });
  } catch (error) {
    console.error('Error in fallback metrics:', error);
    return NextResponse.json({ stats: getEmptyStats() });
  }
}

function getEmptyStats() {
  return {
    total_users: 0,
    total_sessions: 0,
    completed_sessions: 0,
    active_sessions: 0,
    problems_cleared: 0,
    goals_optimized: 0,
    experiences_cleared: 0,
    total_minutes: 0,
    avg_session_duration: 0,
    avg_minutes_per_problem: 0,
    total_active_days: 0,
    avg_sessions_per_user: 0
  };
}

