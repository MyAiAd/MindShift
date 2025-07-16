// ===============================================
// REUSABLE MYAI TEMPLATE - DATABASE SERVICE
// ===============================================
// Centralized database service using configuration system

import { createBrowserClient } from '@supabase/ssr';
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';
import config from '@/lib/config';

// Singleton pattern for browser client
let _clientInstance: ReturnType<typeof createBrowserClient<Database>> | null = null;

// Check if we're in browser environment
const isBrowser = typeof window !== 'undefined';

// Browser client (for client-side operations)
export const createClient = (): ReturnType<typeof createBrowserClient<Database>> => {
  // For server-side rendering, return a mock client
  if (!isBrowser) {
    console.log('Database: Creating SSR client instance');
    
    if (!config.database.url || !config.database.anonKey) {
      console.warn('Database: Missing configuration - returning mock client for SSR');
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

    return createBrowserClient<Database>(config.database.url, config.database.anonKey);
  }

  // Return existing instance if available
  if (_clientInstance) {
    console.log('Database: Reusing existing Supabase client instance');
    return _clientInstance;
  }

  // Validate configuration
  if (!config.database.url || !config.database.anonKey) {
    throw new Error('Missing database configuration. Please check your environment variables.');
  }

  console.log('Database: Creating new Supabase client instance (singleton)');
  
  _clientInstance = createBrowserClient<Database>(config.database.url, config.database.anonKey);
  
  return _clientInstance;
};

// Server client (for server-side operations)
export const createServerClient = () => {
  const cookieStore = cookies();
  
  console.log('Database: Creating server client with cookies');
  
  // Debug: Log all cookies
  const allCookies = cookieStore.getAll();
  console.log('Database: All cookies:', allCookies.map(c => ({ name: c.name, hasValue: !!c.value, valueLength: c.value?.length || 0 })));
  
  // Validate configuration
  if (!config.database.url || !config.database.anonKey) {
    throw new Error('Missing database configuration. Please check your environment variables.');
  }
  
  return createSupabaseServerClient<Database>(
    config.database.url,
    config.database.anonKey,
    {
      cookies: {
        get(name: string) {
          const cookie = cookieStore.get(name);
          console.log('Database: Getting cookie', name, ':', { 
            exists: !!cookie, 
            hasValue: !!cookie?.value, 
            valueLength: cookie?.value?.length || 0 
          });
          return cookie?.value;
        },
        set(name: string, value: string, options: any) {
          console.log('Database: Setting cookie', name, ':', { 
            hasValue: !!value, 
            valueLength: value?.length || 0,
            options 
          });
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          console.log('Database: Removing cookie', name);
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
};

// Function to reset the client (useful for debugging or complete logout)
export const resetClient = () => {
  if (isBrowser) {
    console.log('Database: Resetting Supabase client');
    _clientInstance = null;
    // Clear auth storage
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('myai-auth') || key.startsWith('sb-')) {
        localStorage.removeItem(key);
      }
    });
  }
};

// Database health check
export const checkDatabaseHealth = async () => {
  try {
    const client = createClient();
    const { data, error } = await client.from('profiles').select('id').limit(1);
    
    return {
      healthy: !error,
      error: error?.message || null,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
};

// Database configuration info (for debugging)
export const getDatabaseInfo = () => {
  return {
    url: config.database.url.replace(/\/\/.*@/, '//***@'), // Hide credentials
    projectId: config.database.projectId,
    hasAnonKey: !!config.database.anonKey,
    hasServiceKey: !!config.database.serviceRoleKey,
    environment: config.deployment.nodeEnv
  };
};

// Export types for convenience
export type { Database } from '@/types/database'; 