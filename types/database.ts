export type UserRole = 'super_admin' | 'tenant_admin' | 'manager' | 'coach' | 'user';
export type TenantStatus = 'active' | 'suspended' | 'trial' | 'expired';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing';

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          domain: string | null;
          logo_url: string | null;
          status: TenantStatus;
          settings: Record<string, any>;
          subscription_id: string | null;
          subscription_status: SubscriptionStatus;
          trial_ends_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          domain?: string | null;
          logo_url?: string | null;
          status?: TenantStatus;
          settings?: Record<string, any>;
          subscription_id?: string | null;
          subscription_status?: SubscriptionStatus;
          trial_ends_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          domain?: string | null;
          logo_url?: string | null;
          status?: TenantStatus;
          settings?: Record<string, any>;
          subscription_id?: string | null;
          subscription_status?: SubscriptionStatus;
          trial_ends_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          tenant_id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          avatar_url: string | null;
          role: UserRole;
          is_active: boolean;
          settings: Record<string, any>;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          tenant_id: string;
          email: string;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          is_active?: boolean;
          settings?: Record<string, any>;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          email?: string;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          is_active?: boolean;
          settings?: Record<string, any>;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      tenant_invitations: {
        Row: {
          id: string;
          tenant_id: string;
          email: string;
          role: UserRole;
          invited_by: string | null;
          token: string;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          email: string;
          role?: UserRole;
          invited_by?: string | null;
          token: string;
          expires_at: string;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          email?: string;
          role?: UserRole;
          invited_by?: string | null;
          token?: string;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
        };
      };
      assessments: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          title: string;
          description: string | null;
          questions: Record<string, any>;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          title: string;
          description?: string | null;
          questions: Record<string, any>;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          questions?: Record<string, any>;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      assessment_responses: {
        Row: {
          id: string;
          tenant_id: string;
          assessment_id: string;
          user_id: string;
          responses: Record<string, any>;
          score: number | null;
          analysis: Record<string, any> | null;
          completed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          assessment_id: string;
          user_id: string;
          responses: Record<string, any>;
          score?: number | null;
          analysis?: Record<string, any> | null;
          completed_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          assessment_id?: string;
          user_id?: string;
          responses?: Record<string, any>;
          score?: number | null;
          analysis?: Record<string, any> | null;
          completed_at?: string;
          created_at?: string;
        };
      };
      coaching_sessions: {
        Row: {
          id: string;
          tenant_id: string;
          coach_id: string;
          client_id: string;
          title: string;
          description: string | null;
          scheduled_at: string;
          duration_minutes: number;
          status: string;
          notes: string | null;
          recording_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          coach_id: string;
          client_id: string;
          title: string;
          description?: string | null;
          scheduled_at: string;
          duration_minutes?: number;
          status?: string;
          notes?: string | null;
          recording_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          coach_id?: string;
          client_id?: string;
          title?: string;
          description?: string | null;
          scheduled_at?: string;
          duration_minutes?: number;
          status?: string;
          notes?: string | null;
          recording_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      goals: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          title: string;
          description: string | null;
          target_date: string | null;
          status: string;
          progress: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          title: string;
          description?: string | null;
          target_date?: string | null;
          status?: string;
          progress?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          target_date?: string | null;
          status?: string;
          progress?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      goal_milestones: {
        Row: {
          id: string;
          tenant_id: string;
          goal_id: string;
          title: string;
          description: string | null;
          target_date: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          goal_id: string;
          title: string;
          description?: string | null;
          target_date?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          goal_id?: string;
          title?: string;
          description?: string | null;
          target_date?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
      };
      progress_entries: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          goal_id: string;
          entry_date: string;
          mood_score: number | null;
          energy_level: number | null;
          confidence_level: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          goal_id: string;
          entry_date: string;
          mood_score?: number | null;
          energy_level?: number | null;
          confidence_level?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string;
          goal_id?: string;
          entry_date?: string;
          mood_score?: number | null;
          energy_level?: number | null;
          confidence_level?: number | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      user_achievements: {
        Row: {
          id: string;
          tenant_id: string | null;
          user_id: string;
          achievement_type: string;
          title: string;
          description: string | null;
          icon: string | null;
          points: number;
          rarity: string;
          metadata: Record<string, any>;
          earned_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          user_id: string;
          achievement_type: string;
          title: string;
          description?: string | null;
          icon?: string | null;
          points?: number;
          rarity?: string;
          metadata?: Record<string, any>;
          earned_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string | null;
          user_id?: string;
          achievement_type?: string;
          title?: string;
          description?: string | null;
          icon?: string | null;
          points?: number;
          rarity?: string;
          metadata?: Record<string, any>;
          earned_at?: string;
          created_at?: string;
        };
      };
      user_streaks: {
        Row: {
          id: string;
          tenant_id: string | null;
          user_id: string;
          streak_type: string;
          current_count: number;
          best_count: number;
          started_at: string;
          last_activity_at: string;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          user_id: string;
          streak_type: string;
          current_count?: number;
          best_count?: number;
          started_at?: string;
          last_activity_at?: string;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string | null;
          user_id?: string;
          streak_type?: string;
          current_count?: number;
          best_count?: number;
          started_at?: string;
          last_activity_at?: string;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_gamification_stats: {
        Row: {
          id: string;
          tenant_id: string | null;
          user_id: string;
          total_points: number;
          level: number;
          level_progress: number;
          achievements_earned: number;
          goals_completed: number;
          progress_entries_count: number;
          treatment_sessions_count: number;
          best_streak_days: number;
          current_streak_days: number;
          weekly_points: number;
          monthly_points: number;
          last_activity_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          user_id: string;
          total_points?: number;
          level?: number;
          level_progress?: number;
          achievements_earned?: number;
          goals_completed?: number;
          progress_entries_count?: number;
          treatment_sessions_count?: number;
          best_streak_days?: number;
          current_streak_days?: number;
          weekly_points?: number;
          monthly_points?: number;
          last_activity_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string | null;
          user_id?: string;
          total_points?: number;
          level?: number;
          level_progress?: number;
          achievements_earned?: number;
          goals_completed?: number;
          progress_entries_count?: number;
          treatment_sessions_count?: number;
          best_streak_days?: number;
          current_streak_days?: number;
          weekly_points?: number;
          monthly_points?: number;
          last_activity_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_challenges: {
        Row: {
          id: string;
          tenant_id: string | null;
          user_id: string;
          challenge_type: string;
          title: string;
          description: string | null;
          target_value: number;
          current_value: number;
          points_reward: number;
          starts_at: string;
          ends_at: string;
          completed_at: string | null;
          metadata: Record<string, any>;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          user_id: string;
          challenge_type: string;
          title: string;
          description?: string | null;
          target_value: number;
          current_value?: number;
          points_reward?: number;
          starts_at: string;
          ends_at: string;
          completed_at?: string | null;
          metadata?: Record<string, any>;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string | null;
          user_id?: string;
          challenge_type?: string;
          title?: string;
          description?: string | null;
          target_value?: number;
          current_value?: number;
          points_reward?: number;
          starts_at?: string;
          ends_at?: string;
          completed_at?: string | null;
          metadata?: Record<string, any>;
          created_at?: string;
        };
      };
      ai_insights: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          type: string;
          title: string;
          content: string;
          confidence_score: number | null;
          metadata: Record<string, any>;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          type: string;
          title: string;
          content: string;
          confidence_score?: number | null;
          metadata?: Record<string, any>;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string;
          type?: string;
          title?: string;
          content?: string;
          confidence_score?: number | null;
          metadata?: Record<string, any>;
          is_read?: boolean;
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string | null;
          action: string;
          resource_type: string;
          resource_id: string | null;
          old_data: Record<string, any> | null;
          new_data: Record<string, any> | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id?: string | null;
          action: string;
          resource_type: string;
          resource_id?: string | null;
          old_data?: Record<string, any> | null;
          new_data?: Record<string, any> | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string | null;
          action?: string;
          resource_type?: string;
          resource_id?: string | null;
          old_data?: Record<string, any> | null;
          new_data?: Record<string, any> | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_tenant: {
        Args: {
          tenant_name: string;
          tenant_slug: string;
          tenant_domain?: string;
          admin_email: string;
          admin_first_name?: string;
          admin_last_name?: string;
        };
        Returns: string;
      };
    };
    Enums: {
      user_role: UserRole;
      tenant_status: TenantStatus;
      subscription_status: SubscriptionStatus;
    };
  };
}

// Helper types
export type Tenant = Database['public']['Tables']['tenants']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type TenantInvitation = Database['public']['Tables']['tenant_invitations']['Row'];
export type Assessment = Database['public']['Tables']['assessments']['Row'];
export type AssessmentResponse = Database['public']['Tables']['assessment_responses']['Row'];
export type CoachingSession = Database['public']['Tables']['coaching_sessions']['Row'];
export type Goal = Database['public']['Tables']['goals']['Row'];
export type GoalMilestone = Database['public']['Tables']['goal_milestones']['Row'];
export type ProgressEntry = Database['public']['Tables']['progress_entries']['Row'];
export type AIInsight = Database['public']['Tables']['ai_insights']['Row'];
export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];

// Insert types
export type TenantInsert = Database['public']['Tables']['tenants']['Insert'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type TenantInvitationInsert = Database['public']['Tables']['tenant_invitations']['Insert'];
export type AssessmentInsert = Database['public']['Tables']['assessments']['Insert'];
export type AssessmentResponseInsert = Database['public']['Tables']['assessment_responses']['Insert'];
export type CoachingSessionInsert = Database['public']['Tables']['coaching_sessions']['Insert'];
export type GoalInsert = Database['public']['Tables']['goals']['Insert'];
export type GoalMilestoneInsert = Database['public']['Tables']['goal_milestones']['Insert'];
export type ProgressEntryInsert = Database['public']['Tables']['progress_entries']['Insert'];
export type AIInsightInsert = Database['public']['Tables']['ai_insights']['Insert'];
export type AuditLogInsert = Database['public']['Tables']['audit_logs']['Insert'];

// Update types
export type TenantUpdate = Database['public']['Tables']['tenants']['Update'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
export type TenantInvitationUpdate = Database['public']['Tables']['tenant_invitations']['Update'];
export type AssessmentUpdate = Database['public']['Tables']['assessments']['Update'];
export type AssessmentResponseUpdate = Database['public']['Tables']['assessment_responses']['Update'];
export type CoachingSessionUpdate = Database['public']['Tables']['coaching_sessions']['Update'];
export type GoalUpdate = Database['public']['Tables']['goals']['Update'];
export type GoalMilestoneUpdate = Database['public']['Tables']['goal_milestones']['Update'];
export type ProgressEntryUpdate = Database['public']['Tables']['progress_entries']['Update'];
export type AIInsightUpdate = Database['public']['Tables']['ai_insights']['Update'];
export type AuditLogUpdate = Database['public']['Tables']['audit_logs']['Update'];

// Gamification types
export type UserAchievement = Database['public']['Tables']['user_achievements']['Row'];
export type UserStreak = Database['public']['Tables']['user_streaks']['Row'];
export type UserGamificationStats = Database['public']['Tables']['user_gamification_stats']['Row'];
export type UserChallenge = Database['public']['Tables']['user_challenges']['Row'];

export type UserAchievementInsert = Database['public']['Tables']['user_achievements']['Insert'];
export type UserStreakInsert = Database['public']['Tables']['user_streaks']['Insert'];
export type UserGamificationStatsInsert = Database['public']['Tables']['user_gamification_stats']['Insert'];
export type UserChallengeInsert = Database['public']['Tables']['user_challenges']['Insert'];

export type UserAchievementUpdate = Database['public']['Tables']['user_achievements']['Update'];
export type UserStreakUpdate = Database['public']['Tables']['user_streaks']['Update'];
export type UserGamificationStatsUpdate = Database['public']['Tables']['user_gamification_stats']['Update'];
export type UserChallengeUpdate = Database['public']['Tables']['user_challenges']['Update'];

// Gamification interface types
export interface GamificationData {
  userStats: UserGamificationStats;
  achievements: UserAchievement[];
  streaks: UserStreak[];
  recentAchievements: UserAchievement[];
  levelProgress: {
    currentLevel: number;
    totalPoints: number;
    levelProgress: number;
    levelProgressMax: number;
    levelProgressPercentage: number;
    pointsForNextLevel: number;
  };
}

export type AchievementType = 
  | 'first_goal_created'
  | 'first_progress_entry'
  | 'streak_7_days'
  | 'streak_30_days'
  | 'streak_90_days'
  | 'monthly_goal_crusher'
  | 'treatment_sessions_5'
  | 'treatment_sessions_10'
  | 'treatment_sessions_25'
  | 'treatment_sessions_50'
  | 'mood_improvement_3_points'
  | 'mood_improvement_5_points'
  | 'energy_improvement_3_points'
  | 'energy_improvement_5_points'
  | 'confidence_improvement_3_points'
  | 'confidence_improvement_5_points'
  | 'goal_completion_bronze'
  | 'goal_completion_silver'
  | 'goal_completion_gold'
  | 'progress_warrior'
  | 'consistency_champion'
  | 'milestone_master';

export type StreakType = 'daily_progress' | 'weekly_goal_progress' | 'treatment_sessions';

export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';