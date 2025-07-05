import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

export async function GET(request: NextRequest) {
  console.log('Test Auth API: Starting request');
  console.log('Test Auth API: Request URL:', request.url);
  console.log('Test Auth API: Request headers:', Object.fromEntries(request.headers.entries()));
  
  try {
    // Create server client with proper auth context
    const supabase = createServerClient();
    console.log('Test Auth API: Server client created');
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('Test Auth API: Auth check result', { 
      user: !!user, 
      userId: user?.id,
      userEmail: user?.email,
      error: authError?.message,
      errorCode: authError?.code
    });
    
    if (authError || !user) {
      console.log('Test Auth API: Authentication failed', { 
        authError: authError?.message, 
        hasUser: !!user,
        errorDetails: authError
      });
      return NextResponse.json({ 
        error: 'Unauthorized',
        debug: {
          hasUser: !!user,
          authError: authError?.message,
          errorCode: authError?.code,
          timestamp: new Date().toISOString()
        }
      }, { status: 401 });
    }

    console.log('Test Auth API: User authenticated successfully', user.email);

    return NextResponse.json({ 
      success: true,
      user: {
        id: user.id,
        email: user.email,
        authenticated: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in test auth:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 