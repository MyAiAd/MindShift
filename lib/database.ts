import { createBrowserClient } from '@supabase/ssr';

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

// Improved singleton pattern for browser client
let _clientInstance: ReturnType<typeof createBrowserClient<Database>> | null = null;

// Check if we're in browser environment
const isBrowser = typeof window !== 'undefined';

export const createClient = (): ReturnType<typeof createBrowserClient<Database>> => {
  // For server-side rendering, return a mock client
  if (!isBrowser) {
    console.log('Database: Creating SSR client instance');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase environment variables not found - returning mock client for SSR');
      return {
        auth: { 
          getUser: async () => ({ data: { user: null }, error: null }),
          signOut: async () => ({ error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
          getSession: async () => ({ data: { session: null }, error: null })
        },
        from: () => ({ 
          select: () => ({ 
            eq: () => ({ 
              single: async () => ({ data: null, error: null }) 
            }) 
          }) 
        }),
        rpc: async () => ({ data: null, error: null })
      } as any;
    }

    return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  }

  // Return existing instance if available
  if (_clientInstance) {
    console.log('Database: Reusing existing Supabase client instance');
    return _clientInstance;
  }

  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  console.log('Database: Creating new Supabase client instance (singleton)');
  
  _clientInstance = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  
  console.log('Database: Supabase client created successfully');
  
  return _clientInstance;
};

// Function to reset the client (useful for debugging or complete logout)
export const resetClient = () => {
  if (isBrowser) {
    console.log('Database: Resetting Supabase client');
    _clientInstance = null;
    // Clear auth storage
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('myai-auth') || key.startsWith('sb-kdx')) {
        localStorage.removeItem(key);
      }
    });
  }
};

// Helper types
export type Tenant = Database['public']['Tables']['tenants']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type TenantInsert = Database['public']['Tables']['tenants']['Insert'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type TenantUpdate = Database['public']['Tables']['tenants']['Update'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']; 