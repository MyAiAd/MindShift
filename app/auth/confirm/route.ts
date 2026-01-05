import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  
  // Handle different token types from Supabase emails
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type') as 'signup' | 'recovery' | 'email' | 'invite' | null;
  const next = requestUrl.searchParams.get('next') ?? '/dashboard';
  
  // Also check for legacy token parameter
  const token = requestUrl.searchParams.get('token');
  
  if (!token_hash && !token) {
    console.error('Auth confirm: No token provided');
    return NextResponse.redirect(
      new URL('/auth?error=Invalid confirmation link', request.url)
    );
  }

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
            console.error('Error setting cookie:', error);
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            console.error('Error removing cookie:', error);
          }
        },
      },
    }
  );

  try {
    if (token_hash && type) {
      // New Supabase auth flow with token_hash
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash,
        type,
      });

      if (error) {
        console.error('Auth confirm error:', error);
        return NextResponse.redirect(
          new URL(`/auth?error=${encodeURIComponent(error.message)}`, request.url)
        );
      }

      if (data?.session) {
        console.log('Auth confirm: Email verified successfully for:', data.session.user.email);
        
        // Redirect based on type
        if (type === 'recovery') {
          return NextResponse.redirect(new URL('/auth/reset-password', request.url));
        }
        
        return NextResponse.redirect(new URL(next, request.url));
      }
    } else if (token) {
      // Legacy token flow - try to verify with magic link
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'signup',
      });

      if (error) {
        console.error('Auth confirm (legacy) error:', error);
        return NextResponse.redirect(
          new URL(`/auth?error=${encodeURIComponent(error.message)}`, request.url)
        );
      }

      if (data?.session) {
        console.log('Auth confirm: Email verified successfully');
        return NextResponse.redirect(new URL(next, request.url));
      }
    }

    // If we get here without a session, something went wrong
    return NextResponse.redirect(
      new URL('/auth?error=Unable to verify email. Please try again.', request.url)
    );
    
  } catch (error) {
    console.error('Auth confirm exception:', error);
    return NextResponse.redirect(
      new URL('/auth?error=Failed to confirm email', request.url)
    );
  }
}

