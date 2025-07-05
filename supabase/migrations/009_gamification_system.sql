-- Gamification System Migration
-- This migration adds comprehensive gamification features with proper RLS for multi-tenant architecture

-- Achievement types enum
DO $$ BEGIN
    CREATE TYPE achievement_type AS ENUM (
        'first_goal_created',
        'first_progress_entry',
        'streak_7_days',
        'streak_30_days',
        'streak_90_days',
        'monthly_goal_crusher',
        'treatment_sessions_5',
        'treatment_sessions_10',
        'treatment_sessions_25',
        'treatment_sessions_50',
        'mood_improvement_3_points',
        'mood_improvement_5_points',
        'energy_improvement_3_points',
        'energy_improvement_5_points',
        'confidence_improvement_3_points',
        'confidence_improvement_5_points',
        'goal_completion_bronze',
        'goal_completion_silver',
        'goal_completion_gold',
        'progress_warrior',
        'consistency_champion',
        'milestone_master'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Streak types enum
DO $$ BEGIN
    CREATE TYPE streak_type AS ENUM (
        'daily_progress',
        'weekly_goal_progress',
        'treatment_sessions'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- User Achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    achievement_type achievement_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    points INTEGER DEFAULT 0,
    rarity VARCHAR(50) DEFAULT 'common', -- common, uncommon, rare, epic, legendary
    metadata JSONB DEFAULT '{}',
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, achievement_type)
);

-- User Streaks table
CREATE TABLE IF NOT EXISTS user_streaks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    streak_type streak_type NOT NULL,
    current_count INTEGER DEFAULT 0,
    best_count INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, streak_type)
);

-- User Gamification Stats table
CREATE TABLE IF NOT EXISTS user_gamification_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    total_points INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    level_progress INTEGER DEFAULT 0, -- Points toward next level
    achievements_earned INTEGER DEFAULT 0,
    goals_completed INTEGER DEFAULT 0,
    progress_entries_count INTEGER DEFAULT 0,
    treatment_sessions_count INTEGER DEFAULT 0,
    best_streak_days INTEGER DEFAULT 0,
    current_streak_days INTEGER DEFAULT 0,
    weekly_points INTEGER DEFAULT 0,
    monthly_points INTEGER DEFAULT 0,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Achievement Definitions table (for reference)
CREATE TABLE IF NOT EXISTS achievement_definitions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    achievement_type achievement_type NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(100),
    points INTEGER DEFAULT 0,
    rarity VARCHAR(50) DEFAULT 'common',
    requirements JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Weekly/Monthly Challenges table
CREATE TABLE IF NOT EXISTS user_challenges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    challenge_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    target_value INTEGER NOT NULL,
    current_value INTEGER DEFAULT 0,
    points_reward INTEGER DEFAULT 0,
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_tenant_id ON user_achievements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_earned_at ON user_achievements(earned_at);
CREATE INDEX IF NOT EXISTS idx_user_achievements_type ON user_achievements(achievement_type);

CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_tenant_id ON user_streaks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_type ON user_streaks(streak_type);

CREATE INDEX IF NOT EXISTS idx_user_gamification_stats_user_id ON user_gamification_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_gamification_stats_tenant_id ON user_gamification_stats(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_gamification_stats_level ON user_gamification_stats(level);

CREATE INDEX IF NOT EXISTS idx_user_challenges_user_id ON user_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_challenges_tenant_id ON user_challenges(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_challenges_ends_at ON user_challenges(ends_at);

-- Enable RLS
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_gamification_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_challenges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_achievements
DO $$ BEGIN
    CREATE POLICY "Users can view their own achievements" ON user_achievements
        FOR SELECT USING (
            user_id = auth.uid() OR
            tenant_id IN (
                SELECT tenant_id FROM profiles 
                WHERE id = auth.uid() AND role IN ('coach', 'manager', 'tenant_admin')
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "System can manage achievements" ON user_achievements
        FOR ALL USING (
            user_id = auth.uid() OR
            tenant_id IN (
                SELECT tenant_id FROM profiles 
                WHERE id = auth.uid() AND role IN ('coach', 'manager', 'tenant_admin')
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Super admins can manage all achievements" ON user_achievements
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- RLS Policies for user_streaks
DO $$ BEGIN
    CREATE POLICY "Users can view their own streaks" ON user_streaks
        FOR SELECT USING (
            user_id = auth.uid() OR
            tenant_id IN (
                SELECT tenant_id FROM profiles 
                WHERE id = auth.uid() AND role IN ('coach', 'manager', 'tenant_admin')
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "System can manage streaks" ON user_streaks
        FOR ALL USING (
            user_id = auth.uid() OR
            tenant_id IN (
                SELECT tenant_id FROM profiles 
                WHERE id = auth.uid() AND role IN ('coach', 'manager', 'tenant_admin')
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Super admins can manage all streaks" ON user_streaks
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- RLS Policies for user_gamification_stats
DO $$ BEGIN
    CREATE POLICY "Users can view their own stats" ON user_gamification_stats
        FOR SELECT USING (
            user_id = auth.uid() OR
            tenant_id IN (
                SELECT tenant_id FROM profiles 
                WHERE id = auth.uid() AND role IN ('coach', 'manager', 'tenant_admin')
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "System can manage stats" ON user_gamification_stats
        FOR ALL USING (
            user_id = auth.uid() OR
            tenant_id IN (
                SELECT tenant_id FROM profiles 
                WHERE id = auth.uid() AND role IN ('coach', 'manager', 'tenant_admin')
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Super admins can manage all stats" ON user_gamification_stats
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- RLS Policies for achievement_definitions (public read, admin manage)
DO $$ BEGIN
    CREATE POLICY "Everyone can view achievement definitions" ON achievement_definitions
        FOR SELECT USING (is_active = TRUE);
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Super admins can manage achievement definitions" ON achievement_definitions
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- RLS Policies for user_challenges
DO $$ BEGIN
    CREATE POLICY "Users can view their own challenges" ON user_challenges
        FOR SELECT USING (
            user_id = auth.uid() OR
            tenant_id IN (
                SELECT tenant_id FROM profiles 
                WHERE id = auth.uid() AND role IN ('coach', 'manager', 'tenant_admin')
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "System can manage challenges" ON user_challenges
        FOR ALL USING (
            user_id = auth.uid() OR
            tenant_id IN (
                SELECT tenant_id FROM profiles 
                WHERE id = auth.uid() AND role IN ('coach', 'manager', 'tenant_admin')
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Super admins can manage all challenges" ON user_challenges
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Insert achievement definitions
INSERT INTO achievement_definitions (achievement_type, title, description, icon, points, rarity, requirements) VALUES
-- Goal achievements
('first_goal_created', 'Goal Setter', 'Created your first goal on your journey to transformation', '🎯', 10, 'common', '{"goals_created": 1}'),
('goal_completion_bronze', 'Goal Achiever', 'Completed 3 goals - you''re building momentum!', '🥉', 25, 'common', '{"goals_completed": 3}'),
('goal_completion_silver', 'Goal Champion', 'Completed 10 goals - you''re on fire!', '🥈', 50, 'uncommon', '{"goals_completed": 10}'),
('goal_completion_gold', 'Goal Master', 'Completed 25 goals - transformation expert!', '🥇', 100, 'rare', '{"goals_completed": 25}'),
('monthly_goal_crusher', 'Monthly Crusher', 'Completed 5 goals in a single month', '💪', 75, 'uncommon', '{"goals_completed_monthly": 5}'),

-- Progress tracking achievements
('first_progress_entry', 'Progress Pioneer', 'Logged your first progress entry', '📝', 10, 'common', '{"progress_entries": 1}'),
('progress_warrior', 'Progress Warrior', 'Logged 50 progress entries - consistency is key!', '⚔️', 50, 'uncommon', '{"progress_entries": 50}'),

-- Streak achievements
('streak_7_days', 'Week Warrior', 'Maintained a 7-day progress streak', '🔥', 25, 'common', '{"streak_days": 7}'),
('streak_30_days', 'Month Master', 'Maintained a 30-day progress streak', '🌟', 75, 'uncommon', '{"streak_days": 30}'),
('streak_90_days', 'Consistency Champion', 'Maintained a 90-day progress streak - incredible dedication!', '👑', 150, 'rare', '{"streak_days": 90}'),

-- Treatment session achievements
('treatment_sessions_5', 'Session Starter', 'Completed 5 treatment sessions', '🧠', 25, 'common', '{"treatment_sessions": 5}'),
('treatment_sessions_10', 'Mind Shifter', 'Completed 10 treatment sessions', '🔄', 50, 'uncommon', '{"treatment_sessions": 10}'),
('treatment_sessions_25', 'Transformation Seeker', 'Completed 25 treatment sessions', '🌱', 100, 'rare', '{"treatment_sessions": 25}'),
('treatment_sessions_50', 'Mindset Master', 'Completed 50 treatment sessions - truly transformed!', '🎭', 200, 'epic', '{"treatment_sessions": 50}'),

-- Mood improvement achievements
('mood_improvement_3_points', 'Mood Booster', 'Improved mood by 3+ points over a week', '😊', 30, 'common', '{"mood_improvement": 3}'),
('mood_improvement_5_points', 'Happiness Hero', 'Improved mood by 5+ points over a week', '😄', 50, 'uncommon', '{"mood_improvement": 5}'),

-- Energy improvement achievements
('energy_improvement_3_points', 'Energy Enhancer', 'Improved energy by 3+ points over a week', '⚡', 30, 'common', '{"energy_improvement": 3}'),
('energy_improvement_5_points', 'Vitality Victor', 'Improved energy by 5+ points over a week', '🔋', 50, 'uncommon', '{"energy_improvement": 5}'),

-- Confidence improvement achievements
('confidence_improvement_3_points', 'Confidence Builder', 'Improved confidence by 3+ points over a week', '💪', 30, 'common', '{"confidence_improvement": 3}'),
('confidence_improvement_5_points', 'Confidence Champion', 'Improved confidence by 5+ points over a week', '🦁', 50, 'uncommon', '{"confidence_improvement": 5}'),

-- Special achievements
('milestone_master', 'Milestone Master', 'Completed 10 goal milestones', '🏆', 75, 'uncommon', '{"milestones_completed": 10}');

-- Create function to calculate level from points
CREATE OR REPLACE FUNCTION calculate_level_from_points(points INTEGER)
RETURNS INTEGER AS $$
BEGIN
    -- Level formula: each level requires 100 more points than the previous
    -- Level 1: 0-99 points
    -- Level 2: 100-249 points 
    -- Level 3: 250-449 points
    -- Level 4: 450-699 points
    -- And so on...
    
    IF points < 100 THEN
        RETURN 1;
    ELSE
        RETURN FLOOR((-100 + SQRT(100*100 + 4*100*points)) / (2*100)) + 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate points needed for next level
CREATE OR REPLACE FUNCTION calculate_points_for_next_level(current_level INTEGER)
RETURNS INTEGER AS $$
BEGIN
    -- Points needed for the start of the next level
    RETURN (current_level * 100) + ((current_level - 1) * current_level * 50);
END;
$$ LANGUAGE plpgsql;

-- Create function to update user gamification stats
CREATE OR REPLACE FUNCTION update_user_gamification_stats(
    p_user_id UUID,
    p_tenant_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_tenant_id UUID;
    v_total_points INTEGER := 0;
    v_achievements_count INTEGER := 0;
    v_goals_completed INTEGER := 0;
    v_progress_entries INTEGER := 0;
    v_treatment_sessions INTEGER := 0;
    v_best_streak INTEGER := 0;
    v_current_streak INTEGER := 0;
    v_new_level INTEGER := 1;
    v_level_progress INTEGER := 0;
    v_next_level_points INTEGER := 0;
BEGIN
    -- Get tenant_id if not provided
    IF p_tenant_id IS NULL THEN
        SELECT tenant_id INTO v_tenant_id FROM profiles WHERE id = p_user_id;
    ELSE
        v_tenant_id := p_tenant_id;
    END IF;
    
    -- Calculate total points from achievements
    SELECT COALESCE(SUM(points), 0), COUNT(*)
    INTO v_total_points, v_achievements_count
    FROM user_achievements
    WHERE user_id = p_user_id;
    
    -- Count completed goals
    SELECT COUNT(*)
    INTO v_goals_completed
    FROM goals
    WHERE user_id = p_user_id AND status = 'completed';
    
    -- Count progress entries
    SELECT COUNT(*)
    INTO v_progress_entries
    FROM progress_entries
    WHERE user_id = p_user_id;
    
    -- Count treatment sessions
    SELECT COUNT(*)
    INTO v_treatment_sessions
    FROM treatment_sessions
    WHERE user_id = p_user_id AND status = 'completed';
    
    -- Get best and current streaks
    SELECT COALESCE(MAX(best_count), 0), COALESCE(MAX(current_count), 0)
    INTO v_best_streak, v_current_streak
    FROM user_streaks
    WHERE user_id = p_user_id;
    
    -- Calculate level and progress
    v_new_level := calculate_level_from_points(v_total_points);
    v_next_level_points := calculate_points_for_next_level(v_new_level);
    v_level_progress := v_total_points - calculate_points_for_next_level(v_new_level - 1);
    
    -- Insert or update stats
    INSERT INTO user_gamification_stats (
        user_id, tenant_id, total_points, level, level_progress,
        achievements_earned, goals_completed, progress_entries_count,
        treatment_sessions_count, best_streak_days, current_streak_days,
        last_activity_at, updated_at
    ) VALUES (
        p_user_id, v_tenant_id, v_total_points, v_new_level, v_level_progress,
        v_achievements_count, v_goals_completed, v_progress_entries,
        v_treatment_sessions, v_best_streak, v_current_streak,
        NOW(), NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        total_points = EXCLUDED.total_points,
        level = EXCLUDED.level,
        level_progress = EXCLUDED.level_progress,
        achievements_earned = EXCLUDED.achievements_earned,
        goals_completed = EXCLUDED.goals_completed,
        progress_entries_count = EXCLUDED.progress_entries_count,
        treatment_sessions_count = EXCLUDED.treatment_sessions_count,
        best_streak_days = EXCLUDED.best_streak_days,
        current_streak_days = EXCLUDED.current_streak_days,
        last_activity_at = EXCLUDED.last_activity_at,
        updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to award achievement
CREATE OR REPLACE FUNCTION award_achievement(
    p_user_id UUID,
    p_achievement_type achievement_type,
    p_tenant_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_tenant_id UUID;
    v_achievement_def achievement_definitions%ROWTYPE;
    v_awarded BOOLEAN := FALSE;
BEGIN
    -- Get tenant_id if not provided
    IF p_tenant_id IS NULL THEN
        SELECT tenant_id INTO v_tenant_id FROM profiles WHERE id = p_user_id;
    ELSE
        v_tenant_id := p_tenant_id;
    END IF;
    
    -- Get achievement definition
    SELECT * INTO v_achievement_def
    FROM achievement_definitions
    WHERE achievement_type = p_achievement_type AND is_active = TRUE;
    
    IF v_achievement_def.id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Try to insert achievement (will fail if already exists due to unique constraint)
    BEGIN
        INSERT INTO user_achievements (
            user_id, tenant_id, achievement_type, title, description,
            icon, points, rarity, earned_at
        ) VALUES (
            p_user_id, v_tenant_id, p_achievement_type, v_achievement_def.title,
            v_achievement_def.description, v_achievement_def.icon,
            v_achievement_def.points, v_achievement_def.rarity, NOW()
        );
        
        v_awarded := TRUE;
        
        -- Update user stats
        PERFORM update_user_gamification_stats(p_user_id, v_tenant_id);
        
    EXCEPTION
        WHEN unique_violation THEN
            -- Achievement already exists, do nothing
            v_awarded := FALSE;
    END;
    
    RETURN v_awarded;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update streak
CREATE OR REPLACE FUNCTION update_user_streak(
    p_user_id UUID,
    p_streak_type streak_type,
    p_tenant_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_tenant_id UUID;
    v_current_streak user_streaks%ROWTYPE;
    v_today DATE := CURRENT_DATE;
    v_yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
    v_new_count INTEGER := 1;
    v_is_consecutive BOOLEAN := FALSE;
BEGIN
    -- Get tenant_id if not provided
    IF p_tenant_id IS NULL THEN
        SELECT tenant_id INTO v_tenant_id FROM profiles WHERE id = p_user_id;
    ELSE
        v_tenant_id := p_tenant_id;
    END IF;
    
    -- Get current streak
    SELECT * INTO v_current_streak
    FROM user_streaks
    WHERE user_id = p_user_id AND streak_type = p_streak_type;
    
    -- Check if this is consecutive to previous activity
    IF v_current_streak.id IS NOT NULL THEN
        IF DATE(v_current_streak.last_activity_at) = v_yesterday THEN
            v_is_consecutive := TRUE;
            v_new_count := v_current_streak.current_count + 1;
        ELSIF DATE(v_current_streak.last_activity_at) = v_today THEN
            -- Same day, don't increment
            RETURN;
        ELSE
            -- Streak broken, reset to 1
            v_new_count := 1;
        END IF;
    END IF;
    
    -- Insert or update streak
    INSERT INTO user_streaks (
        user_id, tenant_id, streak_type, current_count, best_count,
        started_at, last_activity_at, updated_at
    ) VALUES (
        p_user_id, v_tenant_id, p_streak_type, v_new_count, 
        GREATEST(v_new_count, COALESCE(v_current_streak.best_count, 0)),
        CASE WHEN v_is_consecutive THEN v_current_streak.started_at ELSE NOW() END,
        NOW(), NOW()
    )
    ON CONFLICT (user_id, streak_type) DO UPDATE SET
        current_count = EXCLUDED.current_count,
        best_count = EXCLUDED.best_count,
        started_at = EXCLUDED.started_at,
        last_activity_at = EXCLUDED.last_activity_at,
        updated_at = EXCLUDED.updated_at;
    
    -- Check for streak achievements
    IF v_new_count >= 7 THEN
        PERFORM award_achievement(p_user_id, 'streak_7_days', v_tenant_id);
    END IF;
    
    IF v_new_count >= 30 THEN
        PERFORM award_achievement(p_user_id, 'streak_30_days', v_tenant_id);
    END IF;
    
    IF v_new_count >= 90 THEN
        PERFORM award_achievement(p_user_id, 'streak_90_days', v_tenant_id);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers to automatically award achievements and update streaks

-- Trigger for first goal created
CREATE OR REPLACE FUNCTION trigger_first_goal_achievement()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM award_achievement(NEW.user_id, 'first_goal_created', NEW.tenant_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER award_first_goal_achievement
    AFTER INSERT ON goals
    FOR EACH ROW
    EXECUTE FUNCTION trigger_first_goal_achievement();

-- Trigger for goal completion achievements
CREATE OR REPLACE FUNCTION trigger_goal_completion_achievements()
RETURNS TRIGGER AS $$
DECLARE
    v_completed_count INTEGER;
    v_monthly_count INTEGER;
BEGIN
    -- Only process if goal was just completed
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Count total completed goals
        SELECT COUNT(*) INTO v_completed_count
        FROM goals
        WHERE user_id = NEW.user_id AND status = 'completed';
        
        -- Count goals completed this month
        SELECT COUNT(*) INTO v_monthly_count
        FROM goals
        WHERE user_id = NEW.user_id AND status = 'completed'
        AND updated_at >= DATE_TRUNC('month', CURRENT_DATE);
        
        -- Award achievements based on counts
        IF v_completed_count >= 3 THEN
            PERFORM award_achievement(NEW.user_id, 'goal_completion_bronze', NEW.tenant_id);
        END IF;
        
        IF v_completed_count >= 10 THEN
            PERFORM award_achievement(NEW.user_id, 'goal_completion_silver', NEW.tenant_id);
        END IF;
        
        IF v_completed_count >= 25 THEN
            PERFORM award_achievement(NEW.user_id, 'goal_completion_gold', NEW.tenant_id);
        END IF;
        
        IF v_monthly_count >= 5 THEN
            PERFORM award_achievement(NEW.user_id, 'monthly_goal_crusher', NEW.tenant_id);
        END IF;
        
        -- Update weekly goal progress streak
        PERFORM update_user_streak(NEW.user_id, 'weekly_goal_progress', NEW.tenant_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER award_goal_completion_achievements
    AFTER UPDATE ON goals
    FOR EACH ROW
    EXECUTE FUNCTION trigger_goal_completion_achievements();

-- Trigger for progress entry achievements and streaks
CREATE OR REPLACE FUNCTION trigger_progress_entry_achievements()
RETURNS TRIGGER AS $$
DECLARE
    v_progress_count INTEGER;
    v_mood_improvement NUMERIC;
    v_energy_improvement NUMERIC;
    v_confidence_improvement NUMERIC;
    v_week_ago DATE := CURRENT_DATE - INTERVAL '7 days';
BEGIN
    -- Award first progress entry
    PERFORM award_achievement(NEW.user_id, 'first_progress_entry', NEW.tenant_id);
    
    -- Count total progress entries
    SELECT COUNT(*) INTO v_progress_count
    FROM progress_entries
    WHERE user_id = NEW.user_id;
    
    -- Award progress warrior achievement
    IF v_progress_count >= 50 THEN
        PERFORM award_achievement(NEW.user_id, 'progress_warrior', NEW.tenant_id);
    END IF;
    
    -- Calculate mood, energy, confidence improvements over the past week
    SELECT 
        COALESCE(AVG(CASE WHEN entry_date >= v_week_ago THEN mood_score END), 0) -
        COALESCE(AVG(CASE WHEN entry_date < v_week_ago THEN mood_score END), 0),
        COALESCE(AVG(CASE WHEN entry_date >= v_week_ago THEN energy_level END), 0) -
        COALESCE(AVG(CASE WHEN entry_date < v_week_ago THEN energy_level END), 0),
        COALESCE(AVG(CASE WHEN entry_date >= v_week_ago THEN confidence_level END), 0) -
        COALESCE(AVG(CASE WHEN entry_date < v_week_ago THEN confidence_level END), 0)
    INTO v_mood_improvement, v_energy_improvement, v_confidence_improvement
    FROM progress_entries
    WHERE user_id = NEW.user_id AND entry_date >= (v_week_ago - INTERVAL '7 days');
    
    -- Award improvement achievements
    IF v_mood_improvement >= 3 THEN
        PERFORM award_achievement(NEW.user_id, 'mood_improvement_3_points', NEW.tenant_id);
    END IF;
    
    IF v_mood_improvement >= 5 THEN
        PERFORM award_achievement(NEW.user_id, 'mood_improvement_5_points', NEW.tenant_id);
    END IF;
    
    IF v_energy_improvement >= 3 THEN
        PERFORM award_achievement(NEW.user_id, 'energy_improvement_3_points', NEW.tenant_id);
    END IF;
    
    IF v_energy_improvement >= 5 THEN
        PERFORM award_achievement(NEW.user_id, 'energy_improvement_5_points', NEW.tenant_id);
    END IF;
    
    IF v_confidence_improvement >= 3 THEN
        PERFORM award_achievement(NEW.user_id, 'confidence_improvement_3_points', NEW.tenant_id);
    END IF;
    
    IF v_confidence_improvement >= 5 THEN
        PERFORM award_achievement(NEW.user_id, 'confidence_improvement_5_points', NEW.tenant_id);
    END IF;
    
    -- Update daily progress streak
    PERFORM update_user_streak(NEW.user_id, 'daily_progress', NEW.tenant_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER award_progress_entry_achievements
    AFTER INSERT ON progress_entries
    FOR EACH ROW
    EXECUTE FUNCTION trigger_progress_entry_achievements();

-- Trigger for treatment session achievements
CREATE OR REPLACE FUNCTION trigger_treatment_session_achievements()
RETURNS TRIGGER AS $$
DECLARE
    v_session_count INTEGER;
BEGIN
    -- Only process if session was just completed
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Count completed sessions
        SELECT COUNT(*) INTO v_session_count
        FROM treatment_sessions
        WHERE user_id = NEW.user_id AND status = 'completed';
        
        -- Award achievements based on session count
        IF v_session_count >= 5 THEN
            PERFORM award_achievement(NEW.user_id, 'treatment_sessions_5', NEW.tenant_id);
        END IF;
        
        IF v_session_count >= 10 THEN
            PERFORM award_achievement(NEW.user_id, 'treatment_sessions_10', NEW.tenant_id);
        END IF;
        
        IF v_session_count >= 25 THEN
            PERFORM award_achievement(NEW.user_id, 'treatment_sessions_25', NEW.tenant_id);
        END IF;
        
        IF v_session_count >= 50 THEN
            PERFORM award_achievement(NEW.user_id, 'treatment_sessions_50', NEW.tenant_id);
        END IF;
        
        -- Update treatment session streak
        PERFORM update_user_streak(NEW.user_id, 'treatment_sessions', NEW.tenant_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER award_treatment_session_achievements
    AFTER UPDATE ON treatment_sessions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_treatment_session_achievements();

-- Create updated_at triggers for gamification tables
CREATE TRIGGER update_user_streaks_updated_at 
    BEFORE UPDATE ON user_streaks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_gamification_stats_updated_at 
    BEFORE UPDATE ON user_gamification_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 