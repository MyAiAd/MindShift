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