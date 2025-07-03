import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';

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