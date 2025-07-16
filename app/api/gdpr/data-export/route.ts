// ===============================================
// GDPR DATA EXPORT API
// ===============================================
// Handle user data export requests for GDPR compliance

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import { rateLimit, RATE_LIMITS, logSecurityEvent } from '@/lib/security-middleware';
import config from '@/lib/config';

// POST - Request data export
export async function POST(request: NextRequest) {
  try {
    // Check if GDPR is enabled
    if (!config.gdpr.consentManagerEnabled) {
      return NextResponse.json({ error: 'GDPR data export is disabled' }, { status: 404 });
    }

    // Apply rate limiting (stricter for data export)
    const rateLimitResult = await rateLimit(request, {
      ...RATE_LIMITS.auth,
      maxRequests: 3, // Only 3 export requests per hour
      windowMs: 60 * 60 * 1000, // 1 hour
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
          }
        }
      );
    }

    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { userId, format = 'json' } = await request.json();
    const targetUserId = userId || user.id;

    // Only allow users to export their own data, unless they're an admin
    if (targetUserId !== user.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || !['tenant_admin', 'super_admin'].includes(profile.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    // Get user's tenant
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', targetUserId)
      .single();

    // Check if there's already a pending export request
    const { data: existingRequest } = await supabase
      .from('data_privacy_requests')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('request_type', 'export')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (existingRequest && existingRequest.length > 0) {
      const lastRequest = existingRequest[0];
      const hoursSinceRequest = (new Date().getTime() - new Date(lastRequest.created_at).getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceRequest < 24) {
        return NextResponse.json({ 
          error: 'A data export request is already pending. Please wait 24 hours before requesting another export.',
          requestId: lastRequest.id,
          status: lastRequest.status
        }, { status: 409 });
      }
    }

    // Create privacy request
    const { data: privacyRequest, error: requestError } = await supabase
      .from('data_privacy_requests')
      .insert({
        user_id: targetUserId,
        tenant_id: userProfile?.tenant_id,
        request_type: 'export',
        status: 'pending',
        requested_by: user.id,
        request_details: {
          format,
          requested_at: new Date().toISOString(),
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          user_agent: request.headers.get('user-agent') || '',
        },
      })
      .select()
      .single();

    if (requestError) {
      console.error('Error creating privacy request:', requestError);
      return NextResponse.json({ error: 'Failed to create export request' }, { status: 500 });
    }

    // Log security event
    await logSecurityEvent(
      'data_export_requested',
      user.id,
      {
        request_id: privacyRequest.id,
        target_user: targetUserId,
        format,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      },
      request
    );

    // In production, this would trigger a background job to process the export
    // For now, we'll return a success response
    return NextResponse.json({
      success: true,
      requestId: privacyRequest.id,
      message: 'Data export request created successfully. You will receive an email when the export is ready.',
      estimatedCompletionTime: '24-48 hours',
      status: 'pending'
    });

  } catch (error) {
    console.error('Error in data export POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - Check export status
export async function GET(request: NextRequest) {
  try {
    // Check if GDPR is enabled
    if (!config.gdpr.consentManagerEnabled) {
      return NextResponse.json({ error: 'GDPR data export is disabled' }, { status: 404 });
    }

    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, RATE_LIMITS.general);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
          }
        }
      );
    }

    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestId: string | null = searchParams.get('requestId');

    if (!requestId) {
      // Get all export requests for the user
      const { data: requests, error } = await supabase
        .from('data_privacy_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('request_type', 'export')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching export requests:', error);
        return NextResponse.json({ error: 'Failed to fetch export requests' }, { status: 500 });
      }

      return NextResponse.json({ requests });
    }

    // Get specific request
    const { data: exportRequest, error } = await supabase
      .from('data_privacy_requests')
      .select('*')
      .eq('id', requestId)
      .eq('user_id', user.id)
      .eq('request_type', 'export')
      .single();

    if (error) {
      console.error('Error fetching export request:', error);
      return NextResponse.json({ error: 'Export request not found' }, { status: 404 });
    }

    return NextResponse.json({ request: exportRequest });

  } catch (error) {
    console.error('Error in data export GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 