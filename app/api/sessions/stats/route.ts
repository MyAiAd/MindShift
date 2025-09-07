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
        hint: statsError.hint
      });
      
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
        total_treatment_hours_this_month: 0
      };
      
      return NextResponse.json({ stats: defaultStats });
    }

    // The function returns an array with one row, extract the values
    const stats = statsData?.[0] || {
      total_sessions: 0,
      upcoming_sessions: 0,
      completed_sessions: 0,
      cancelled_sessions: 0,
      total_hours_this_month: 0,
      available_slots: 0,
      treatment_sessions: 0,
      active_treatment_sessions: 0,
      completed_treatment_sessions: 0,
      total_treatment_hours_this_month: 0
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error in session stats fetch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 