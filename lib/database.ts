import { createClient as createSupabaseClient } from '@supabase/supabase-js';

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
          admin_email: string;
          tenant_domain?: string;
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

// Supabase client
export const supabase = createSupabaseClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Client for use in client components
export const createClient = () => createSupabaseClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Helper types
export type Tenant = Database['public']['Tables']['tenants']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type TenantInsert = Database['public']['Tables']['tenants']['Insert'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type TenantUpdate = Database['public']['Tables']['tenants']['Update'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']; 