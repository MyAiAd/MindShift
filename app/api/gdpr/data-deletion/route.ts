// ===============================================
// GDPR DATA DELETION API
// ===============================================
// Handle user data deletion requests (Right to be forgotten)

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import { rateLimit, RATE_LIMITS, logSecurityEvent } from '@/lib/security-middleware';
import config from '@/lib/config';

// POST - Request data deletion
export async function POST(request: NextRequest) {
  try {
    // Check if GDPR is enabled
    if (!config.gdpr.consentManagerEnabled) {
      return NextResponse.json({ error: 'GDPR data deletion is disabled' }, { status: 404 });
    }

    // Apply rate limiting (very strict for deletion)
    const rateLimitResult = await rateLimit(request, {
      ...RATE_LIMITS.auth,
      maxRequests: 1, // Only 1 deletion request per day
      windowMs: 24 * 60 * 60 * 1000, // 24 hours
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

    const { userId, reason, retainSubscriptionHistory = false } = await request.json();
    const targetUserId = userId || user.id;

    // Validate reason
    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      return NextResponse.json({ 
        error: 'A reason for deletion is required (minimum 10 characters)' 
      }, { status: 400 });
    }

    // Only allow users to delete their own data, unless they're an admin
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
      .select('tenant_id, email')
      .eq('id', targetUserId)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if there's already a pending deletion request
    const { data: existingRequest } = await supabase
      .from('data_privacy_requests')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('request_type', 'delete')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (existingRequest && existingRequest.length > 0) {
      return NextResponse.json({ 
        error: 'A data deletion request is already pending for this user.',
        requestId: existingRequest[0].id,
        status: existingRequest[0].status
      }, { status: 409 });
    }

    // Check for legal obligations that prevent deletion
    const { data: activeSubscriptions } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('status', 'active');

    if (activeSubscriptions && activeSubscriptions.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete data while user has active subscriptions. Please cancel all subscriptions first.',
        activeSubscriptions: activeSubscriptions.length
      }, { status: 400 });
    }

    // Check for recent payment transactions (legal requirement to retain for 10 years in Germany)
    const { data: recentTransactions } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('user_id', targetUserId)
      .gte('created_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()); // Last year

    if (recentTransactions && recentTransactions.length > 0 && !retainSubscriptionHistory) {
      return NextResponse.json({ 
        error: 'User has recent payment transactions. Data can be anonymized but not fully deleted due to legal requirements.',
        suggestion: 'Consider anonymization instead of deletion to comply with financial record retention laws.',
        recentTransactions: recentTransactions.length
      }, { status: 400 });
    }

    // Create deletion request
    const { data: privacyRequest, error: requestError } = await supabase
      .from('data_privacy_requests')
      .insert({
        user_id: targetUserId,
        tenant_id: userProfile.tenant_id,
        request_type: 'delete',
        status: 'pending',
        requested_by: user.id,
        request_details: {
          reason: reason.trim(),
          retainSubscriptionHistory,
          user_email: userProfile.email,
          requested_at: new Date().toISOString(),
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          user_agent: request.headers.get('user-agent') || '',
          legal_basis_assessment: {
            has_active_subscriptions: false,
            has_recent_transactions: recentTransactions ? recentTransactions.length > 0 : false,
            retention_required: retainSubscriptionHistory,
          }
        },
      })
      .select()
      .single();

    if (requestError) {
      console.error('Error creating deletion request:', requestError);
      return NextResponse.json({ error: 'Failed to create deletion request' }, { status: 500 });
    }

    // Log security event
    await logSecurityEvent(
      'data_deletion_requested',
      user.id,
      {
        request_id: privacyRequest.id,
        target_user: targetUserId,
        reason: reason.trim(),
        retain_subscription_history: retainSubscriptionHistory,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      },
      request
    );

    // In production, this would trigger a background job and send confirmation email
    return NextResponse.json({
      success: true,
      requestId: privacyRequest.id,
      message: 'Data deletion request created successfully. You will receive an email confirmation and updates on the processing status.',
      estimatedCompletionTime: '30 days',
      status: 'pending',
      importantNote: 'This action cannot be undone. Please ensure you have exported any data you wish to retain.',
      legalNote: 'Some data may be retained for legal compliance purposes even after deletion.',
    });

  } catch (error) {
    console.error('Error in data deletion POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - Check deletion status
export async function GET(request: NextRequest) {
  try {
    // Check if GDPR is enabled
    if (!config.gdpr.consentManagerEnabled) {
      return NextResponse.json({ error: 'GDPR data deletion is disabled' }, { status: 404 });
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
      // Get all deletion requests for the user
      const { data: requests, error } = await supabase
        .from('data_privacy_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('request_type', 'delete')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching deletion requests:', error);
        return NextResponse.json({ error: 'Failed to fetch deletion requests' }, { status: 500 });
      }

      return NextResponse.json({ requests });
    }

    // Get specific request
    const { data: deletionRequest, error } = await supabase
      .from('data_privacy_requests')
      .select('*')
      .eq('id', requestId)
      .eq('user_id', user.id)
      .eq('request_type', 'delete')
      .single();

    if (error) {
      console.error('Error fetching deletion request:', error);
      return NextResponse.json({ error: 'Deletion request not found' }, { status: 404 });
    }

    return NextResponse.json({ request: deletionRequest });

  } catch (error) {
    console.error('Error in data deletion GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 