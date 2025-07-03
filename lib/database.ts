import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export type UserRole = 'super_admin' | 'tenant_admin' | 'manager' | 'coach' | 'user';
export type TenantStatus = 'active' | 'suspended' | 'trial' | 'expired';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing';
export type SubscriptionTier = 'level_1' | 'level_2' | 'trial' | 'cancelled';
export type PlanStatus = 'active' | 'inactive' | 'archived';

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
          current_subscription_id: string | null;
          subscription_tier: SubscriptionTier | null;
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
          current_subscription_id?: string | null;
          subscription_tier?: SubscriptionTier | null;
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
          current_subscription_id?: string | null;
          subscription_tier?: SubscriptionTier | null;
        };
      };
      subscription_plans: {
        Row: {
          id: string;
          name: string;
          tier: SubscriptionTier;
          description: string | null;
          price_monthly: number;
          price_yearly: number | null;
          features: Record<string, any>;
          limits: Record<string, any>;
          status: PlanStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          tier: SubscriptionTier;
          description?: string | null;
          price_monthly: number;
          price_yearly?: number | null;
          features?: Record<string, any>;
          limits?: Record<string, any>;
          status?: PlanStatus;
        };
        Update: {
          id?: string;
          name?: string;
          tier?: SubscriptionTier;
          description?: string | null;
          price_monthly?: number;
          price_yearly?: number | null;
          features?: Record<string, any>;
          limits?: Record<string, any>;
          status?: PlanStatus;
        };
      };
      user_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          tenant_id: string;
          plan_id: string;
          stripe_subscription_id: string | null;
          stripe_customer_id: string | null;
          current_tier: SubscriptionTier;
          status: SubscriptionStatus;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          cancelled_at: string | null;
          trial_ends_at: string | null;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tenant_id: string;
          plan_id: string;
          stripe_subscription_id?: string | null;
          stripe_customer_id?: string | null;
          current_tier: SubscriptionTier;
          status?: SubscriptionStatus;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          cancelled_at?: string | null;
          trial_ends_at?: string | null;
          metadata?: Record<string, any>;
        };
        Update: {
          id?: string;
          user_id?: string;
          tenant_id?: string;
          plan_id?: string;
          stripe_subscription_id?: string | null;
          stripe_customer_id?: string | null;
          current_tier?: SubscriptionTier;
          status?: SubscriptionStatus;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          cancelled_at?: string | null;
          trial_ends_at?: string | null;
          metadata?: Record<string, any>;
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
      update_user_subscription: {
        Args: {
          user_id_param: string;
          new_plan_id_param: string;
          stripe_subscription_id_param?: string;
          change_reason_param?: string;
        };
        Returns: string;
      };
      cancel_user_subscription: {
        Args: {
          user_id_param: string;
          cancel_immediately?: boolean;
        };
        Returns: boolean;
      };
      check_user_feature_access: {
        Args: {
          user_id_param: string;
          feature_key_param: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
      tenant_status: TenantStatus;
      subscription_status: SubscriptionStatus;
      subscription_tier: SubscriptionTier;
      plan_status: PlanStatus;
    };
  };
}

// Supabase client
export const supabase = createSupabaseClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Client for use in client components
// Singleton pattern to prevent multiple client instances
declare global {
  var __supabase_client__: ReturnType<typeof createSupabaseClient<Database>> | undefined;
}

export const createClient = () => {
  if (typeof window === 'undefined') {
    // Server-side: create a new client each time
    return createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  // Client-side: use global singleton
  if (globalThis.__supabase_client__) {
    return globalThis.__supabase_client__;
  }
  
  console.log('Database: Creating new Supabase client instance');
  
  globalThis.__supabase_client__ = createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        storage: window.localStorage,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
  
  console.log('Database: Supabase client created successfully');
  
  return globalThis.__supabase_client__;
};

// Server-side client for use in API routes
export const createServerClient = async () => {
  const cookieStore = cookies();
  
  console.log('Database: Creating server client with cookies');
  
  return createSupabaseServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookie = cookieStore.get(name);
          console.log('Database: Getting cookie', name, ':', !!cookie);
          return cookie?.value;
        },
        set(name: string, value: string, options: any) {
          console.log('Database: Setting cookie', name);
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            console.error('Database: Error setting cookie', name, error);
          }
        },
        remove(name: string, options: any) {
          console.log('Database: Removing cookie', name);
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            console.error('Database: Error removing cookie', name, error);
          }
        },
      },
    }
  );
};

// Function to reset the client (useful for debugging)
export const resetClient = () => {
  if (typeof window !== 'undefined') {
    globalThis.__supabase_client__ = undefined;
    // Clear any cached auth state
    window.localStorage.removeItem('sb-kdxwfaynzemmdonkmttf-auth-token');
    window.localStorage.removeItem('supabase.auth.token');
  }
};

// Helper types
export type Tenant = Database['public']['Tables']['tenants']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type TenantInsert = Database['public']['Tables']['tenants']['Insert'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type TenantUpdate = Database['public']['Tables']['tenants']['Update'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']; 