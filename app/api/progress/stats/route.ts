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

    // Get time range parameter
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30';
    const daysAgo = parseInt(timeRange);
    
    // Calculate the date threshold
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysAgo);

    // Build queries based on user role
    let goalsQuery = supabase.from('goals').select('*');
    let progressQuery = supabase.from('progress_entries').select('*');
    let milestonesQuery = supabase.from('goal_milestones').select('*');

    // Super admins can see all data, others only their own
    if (profile.role !== 'super_admin') {
      goalsQuery = goalsQuery.eq('user_id', user.id);
      progressQuery = progressQuery.eq('user_id', user.id);
      // For milestones, we need to join with goals to filter by user
      milestonesQuery = supabase
        .from('goal_milestones')
        .select(`
          *,
          goals!inner (
            user_id
          )
        `)
        .eq('goals.user_id', user.id);
    }

    // Execute all queries in parallel
    const [
      { data: goals, error: goalsError },
      { data: progressEntries, error: progressError },
      { data: milestones, error: milestonesError }
    ] = await Promise.all([
      goalsQuery,
      progressQuery,
      milestonesQuery
    ]);

    if (goalsError || progressError || milestonesError) {
      console.error('Error fetching progress stats:', { goalsError, progressError, milestonesError });
      return NextResponse.json(
        { error: 'Failed to fetch progress statistics' },
        { status: 500 }
      );
    }

    // Calculate statistics
    const totalGoals = goals?.length || 0;
    const completedGoals = goals?.filter(g => g.status === 'completed').length || 0;
    const inProgressGoals = goals?.filter(g => g.status === 'in_progress').length || 0;
    const totalProgressEntries = progressEntries?.length || 0;
    const completedMilestones = milestones?.filter(m => m.completed_at !== null).length || 0;
    const totalMilestones = milestones?.length || 0;

    // Calculate overall progress (average of all goal progress)
    const overallProgress = totalGoals > 0 
      ? Math.round(goals.reduce((sum, goal) => sum + goal.progress, 0) / totalGoals)
      : 0;

    // Recent achievements (completed goals and milestones in selected time range)
    const recentCompletedGoals = goals?.filter(g => 
      g.status === 'completed' && 
      g.updated_at && 
      new Date(g.updated_at) >= dateThreshold
    ) || [];

    const recentCompletedMilestones = milestones?.filter(m => 
      m.completed_at && 
      new Date(m.completed_at) >= dateThreshold
    ) || [];

    // Calculate average scores from progress entries
    const avgMoodScore = progressEntries?.length > 0 
      ? Math.round(progressEntries.reduce((sum, entry) => sum + (entry.mood_score || 0), 0) / progressEntries.length)
      : 0;

    const avgEnergyLevel = progressEntries?.length > 0 
      ? Math.round(progressEntries.reduce((sum, entry) => sum + (entry.energy_level || 0), 0) / progressEntries.length)
      : 0;

    const avgConfidenceLevel = progressEntries?.length > 0 
      ? Math.round(progressEntries.reduce((sum, entry) => sum + (entry.confidence_level || 0), 0) / progressEntries.length)
      : 0;

    // Progress by goal status for charts
    const progressByGoalStatus = goals?.reduce((acc, goal) => {
      const status = goal.status || 'not_started';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Recent progress entries for timeline
    const recentProgressEntries = progressEntries?.slice(0, 10) || [];

    // Calculate progress trends (selected time range)
    const progressTrends = progressEntries?.filter(entry => 
      new Date(entry.entry_date) >= dateThreshold
    ).sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()) || [];

    const stats = {
      overview: {
        totalGoals,
        completedGoals,
        inProgressGoals,
        totalProgressEntries,
        completedMilestones,
        totalMilestones,
        overallProgress,
        avgMoodScore,
        avgEnergyLevel,
        avgConfidenceLevel
      },
      recentAchievements: {
        completedGoals: recentCompletedGoals.map(goal => ({
          id: goal.id,
          title: goal.title,
          completedAt: goal.updated_at,
          type: 'goal'
        })),
        completedMilestones: recentCompletedMilestones.map(milestone => ({
          id: milestone.id,
          title: milestone.title,
          completedAt: milestone.completed_at,
          type: 'milestone'
        }))
      },
      progressByGoalStatus,
      recentProgressEntries,
      progressTrends
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error in progress stats fetch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 