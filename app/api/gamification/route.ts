import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId'); // For super admin to view specific user
    
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

    // Determine target user ID (current user or specified user for super admin)
    const targetUserId = userId && profile.role === 'super_admin' ? userId : user.id;

    // Fetch gamification data in parallel
    const [
      { data: userStats },
      { data: achievements },
      { data: streaks },
      { data: recentAchievements }
    ] = await Promise.all([
      // User stats
      supabase
        .from('user_gamification_stats')
        .select('*')
        .eq('user_id', targetUserId)
        .single(),
      
      // All achievements
      supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', targetUserId)
        .order('earned_at', { ascending: false }),
      
      // All streaks
      supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', targetUserId),
      
      // Recent achievements (last 30 days)
      supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', targetUserId)
        .gte('earned_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('earned_at', { ascending: false })
        .limit(5)
    ]);

    // Calculate level progress
    const totalPoints = userStats?.total_points || 0;
    const currentLevel = userStats?.level || 1;
    const pointsForCurrentLevel = (currentLevel - 1) * 100 + ((currentLevel - 2) * (currentLevel - 1) * 50);
    const pointsForNextLevel = currentLevel * 100 + ((currentLevel - 1) * currentLevel * 50);
    const levelProgress = Math.max(0, totalPoints - pointsForCurrentLevel);
    const levelProgressMax = pointsForNextLevel - pointsForCurrentLevel;
    const levelProgressPercentage = Math.min(100, (levelProgress / levelProgressMax) * 100);

    return NextResponse.json({
      success: true,
      data: {
        userStats: userStats || {
          total_points: 0,
          level: 1,
          achievements_earned: 0,
          goals_completed: 0,
          progress_entries_count: 0,
          treatment_sessions_count: 0,
          best_streak_days: 0,
          current_streak_days: 0
        },
        achievements: achievements || [],
        streaks: streaks || [],
        recentAchievements: recentAchievements || [],
        levelProgress: {
          currentLevel,
          totalPoints,
          levelProgress,
          levelProgressMax,
          levelProgressPercentage,
          pointsForNextLevel: pointsForNextLevel - totalPoints
        }
      }
    });
  } catch (error) {
    console.error('Error fetching gamification data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await request.json();
    const { action, userId, achievementType, streakType } = body;
    
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

    // Handle different actions
    switch (action) {
      case 'award_achievement':
        if (profile.role !== 'super_admin') {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
        
        const { data: awardResult, error: awardError } = await supabase
          .rpc('award_achievement', {
            p_user_id: userId,
            p_achievement_type: achievementType,
            p_tenant_id: profile.tenant_id
          });

        if (awardError) {
          return NextResponse.json({ error: awardError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, awarded: awardResult });

      case 'update_streak':
        if (profile.role !== 'super_admin') {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
        
        const { error: streakError } = await supabase
          .rpc('update_user_streak', {
            p_user_id: userId,
            p_streak_type: streakType,
            p_tenant_id: profile.tenant_id
          });

        if (streakError) {
          return NextResponse.json({ error: streakError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });

      case 'update_stats':
        const targetUserId = userId && profile.role === 'super_admin' ? userId : user.id;
        
        const { error: statsError } = await supabase
          .rpc('update_user_gamification_stats', {
            p_user_id: targetUserId,
            p_tenant_id: profile.tenant_id
          });

        if (statsError) {
          return NextResponse.json({ error: statsError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in gamification API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const achievementId = searchParams.get('achievementId');
    
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

    // Only super admin can delete achievements
    if (profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (achievementId) {
      // Delete specific achievement
      const { error } = await supabase
        .from('user_achievements')
        .delete()
        .eq('id', achievementId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else if (userId) {
      // Delete all achievements for a user
      const { error } = await supabase
        .from('user_achievements')
        .delete()
        .eq('user_id', userId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting gamification data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 