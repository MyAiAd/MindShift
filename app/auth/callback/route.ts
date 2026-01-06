import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/dashboard';
  const error = requestUrl.searchParams.get('error');
  const error_description = requestUrl.searchParams.get('error_description');
  
  // Handle error from Supabase
  if (error) {
    console.error('Auth callback error:', error, error_description);
    return NextResponse.redirect(
      new URL(`/auth?error=${encodeURIComponent(error_description || error)}`, request.url)
    );
  }
  
  if (code) {
    const cookieStore = cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (error) {
              // Handle error in middleware context
              console.error('Error setting cookie:', error);
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (error) {
              // Handle error in middleware context
              console.error('Error removing cookie:', error);
            }
          },
        },
      }
    );

    try {
      // Exchange the code for a session
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      
      if (exchangeError) {
        console.error('Error exchanging code for session:', exchangeError);
        return NextResponse.redirect(
          new URL(`/auth?error=${encodeURIComponent(exchangeError.message)}`, request.url)
        );
      }
      
      if (data?.session) {
        console.log('Auth callback: Session created successfully for user:', data.session.user.email);

        // Check if profile exists, create it if not
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.session.user.id)
          .single();

        if (!profile) {
          console.log('Profile not found, creating via RPC...');

          // Call the RPC function to create the profile
          const { error: rpcError } = await supabase.rpc('handle_new_user_registration', {
            user_id: data.session.user.id,
            user_email: data.session.user.email!,
            user_first_name: data.session.user.user_metadata?.first_name || null,
            user_last_name: data.session.user.user_metadata?.last_name || null,
          });

          if (rpcError) {
            console.error('Error creating profile via RPC:', rpcError);
            // Continue anyway - the auth context will try again
          } else {
            console.log('Profile created successfully via RPC');
          }
        }

        // Redirect to the dashboard or requested page with confirmation success flag
        const redirectUrl = new URL(next, request.url);
        redirectUrl.searchParams.set('confirmed', 'true');
        console.log('Auth callback: Redirecting to URL:', redirectUrl.toString());
        console.log('Auth callback: Redirect search params:', redirectUrl.searchParams.toString());
        return NextResponse.redirect(redirectUrl);
      }
    } catch (error) {
      console.error('Auth callback exception:', error);
      return NextResponse.redirect(
        new URL('/auth?error=Failed to confirm email', request.url)
      );
    }
  }

  // If no code, redirect to auth page
  return NextResponse.redirect(new URL('/auth', request.url));
}

