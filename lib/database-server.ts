import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';

// Server-side client for use in API routes and server components
export const createServerClient = () => {
  const cookieStore = cookies();
  
  console.log('Database: Creating server client with cookies');
  
  // Debug: Log all cookies
  const allCookies = cookieStore.getAll();
  console.log('Database: All cookies:', allCookies.map(c => ({ name: c.name, hasValue: !!c.value, valueLength: c.value?.length || 0 })));
  
  return createSupabaseServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
          console.log('Database: Setting cookie', name, { 
            hasValue: !!value, 
            valueLength: value?.length || 0,
            options 
          });
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            console.error('Database: Error setting cookie', name, error);
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: any) {
          console.log('Database: Removing cookie', name, { options });
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            console.error('Database: Error removing cookie', name, error);
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}; 