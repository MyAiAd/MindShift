import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase-middleware';

export async function middleware(request: NextRequest) {
  try {
    return await updateSession(request);
  } catch (error) {
    console.error('Middleware: Unhandled error:', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}; 