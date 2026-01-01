import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// GET /api/dashboard/performance - Get dashboard performance metrics
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

    // Calculate Goal Completion Rate
    const { data: allGoals } = await supabase
      .from('goals')
      .select('id, status')
      .eq('tenant_id', profile.tenant_id);

    const totalGoals = allGoals?.length || 0;
    const completedGoals = allGoals?.filter(g => g.status === 'completed').length || 0;
    const goalCompletionRate = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

    // Calculate Session Attendance Rate
    const { data: sessions } = await supabase
      .from('coaching_sessions')
      .select('id, status')
      .eq('tenant_id', profile.tenant_id);

    const scheduledSessions = sessions?.length || 0;
    const attendedSessions = sessions?.filter(s => s.status === 'completed').length || 0;
    const sessionAttendance = scheduledSessions > 0 ? Math.round((attendedSessions / scheduledSessions) * 100) : 0;

    // Calculate User Satisfaction (from average progress/mood scores)
    // This is an estimated metric based on available data
    const { data: progressEntries } = await supabase
      .from('progress_entries')
      .select('mood_score, confidence_level')
      .eq('tenant_id', profile.tenant_id)
      .not('mood_score', 'is', null)
      .not('confidence_level', 'is', null)
      .order('entry_date', { ascending: false })
      .limit(100); // Last 100 entries

    let userSatisfaction = 0;
    if (progressEntries && progressEntries.length > 0) {
      const avgMood = progressEntries.reduce((sum, e) => sum + (e.mood_score || 0), 0) / progressEntries.length;
      const avgConfidence = progressEntries.reduce((sum, e) => sum + (e.confidence_level || 0), 0) / progressEntries.length;
      // Convert 1-10 scale to percentage (average of mood and confidence)
      userSatisfaction = Math.round(((avgMood + avgConfidence) / 2) * 10);
    }

    return NextResponse.json({
      metrics: {
        userSatisfaction,
        goalCompletionRate,
        sessionAttendance
      },
      metadata: {
        totalGoals,
        completedGoals,
        scheduledSessions,
        attendedSessions,
        progressEntriesSampled: progressEntries?.length || 0
      }
    });
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
