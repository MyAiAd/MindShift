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
    const days = parseInt(searchParams.get('days') || '30');

    // Call the database function to get session statistics
    const { data: statsData, error: statsError } = await supabase
      .rpc('get_session_stats', {
        p_user_id: user.id,
        p_tenant_id: profile.tenant_id,
        p_days: days
      });

    if (statsError) {
      console.error('Error fetching session stats:', statsError);
      console.error('Stats error details:', {
        message: statsError.message,
        code: statsError.code,
        details: statsError.details,
        hint: statsError.hint,
        user_id: user.id,
        tenant_id: profile.tenant_id,
        days: days
      });
      
      // Try to get raw session data to compare
      const { data: rawSessions } = await supabase
        .from('treatment_sessions')
        .select('*')
        .eq('user_id', user.id);
      
      console.error('Raw sessions for comparison:', rawSessions);
      
      // Return default stats instead of failing completely
      const defaultStats = {
        total_sessions: 0,
        upcoming_sessions: 0,
        completed_sessions: 0,
        cancelled_sessions: 0,
        total_hours_this_month: 0,
        available_slots: 0,
        treatment_sessions: 0,
        active_treatment_sessions: 0,
        completed_treatment_sessions: 0,
        total_treatment_hours_this_month: 0,
        // New metrics
        problems_cleared: 0,
        goals_optimized: 0,
        experiences_cleared: 0,
        avg_minutes_per_problem: 0,
        unique_days_active: 0
      };
      
      return NextResponse.json({ 
        stats: defaultStats,
        debug: {
          function_error: true,
          error_details: statsError,
          raw_sessions: rawSessions
        }
      });
    }

    // Return the first row of results (the function returns a table)
    const stats = statsData && statsData.length > 0 ? statsData[0] : {
      total_sessions: 0,
      upcoming_sessions: 0,
      completed_sessions: 0,
      cancelled_sessions: 0,
      total_hours_this_month: 0,
      available_slots: 0,
      treatment_sessions: 0,
      active_treatment_sessions: 0,
      completed_treatment_sessions: 0,
      total_treatment_hours_this_month: 0,
      // New metrics
      problems_cleared: 0,
      goals_optimized: 0,
      experiences_cleared: 0,
      avg_minutes_per_problem: 0,
      unique_days_active: 0
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error in session stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST method to clear/reset statistics
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { action } = body;

    if (action !== 'clear_stats') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Update user profile to set stats_cleared_at timestamp
    // This will be used by the stats function to exclude sessions before this date
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        stats_cleared_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error clearing stats:', updateError);
      return NextResponse.json({ error: 'Failed to clear stats' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Statistics cleared successfully',
      cleared_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in clear stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 