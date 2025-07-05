import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import { 
  rateLimit, 
  RATE_LIMITS, 
  validateSession,
  DataPrivacyManager,
  logSecurityEvent
} from '@/lib/security-middleware';

// Helper function to check admin permissions
async function checkAdminPermissions(supabase: any) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return { error: 'Unauthorized', status: 401 };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single();

  if (!profile || !['tenant_admin', 'super_admin'].includes(profile.role)) {
    return { error: 'Insufficient permissions', status: 403 };
  }

  return { user, profile };
}

// GET - Fetch privacy data and compliance status
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, RATE_LIMITS.admin);
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
    const authResult = await checkAdminPermissions(supabase);
    
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user, profile } = authResult;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const userId = searchParams.get('user_id');
    const tenantId = searchParams.get('tenant_id');

    // Determine tenant scope
    const targetTenantId = profile.role === 'tenant_admin' ? profile.tenant_id : tenantId;

    switch (action) {
      case 'privacy_requests': {
        // Get data privacy requests
        let query = supabase
          .from('data_privacy_requests')
          .select(`
            *,
            profiles!user_id (
              email,
              first_name,
              last_name
            ),
            requested_by_profile:profiles!requested_by (
              email,
              first_name,
              last_name
            )
          `)
          .order('created_at', { ascending: false });

        if (targetTenantId) {
          query = query.eq('tenant_id', targetTenantId);
        }

        const { data: requests, error } = await query;

        if (error) {
          console.error('Error fetching privacy requests:', error);
          return NextResponse.json({ error: 'Failed to fetch privacy requests' }, { status: 500 });
        }

        return NextResponse.json({ requests });
      }

      case 'consent_status': {
        // Get user consent status
        if (!userId) {
          return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const { data: consents, error } = await supabase
          .from('user_consents')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false });

        if (error) {
          console.error('Error fetching consent status:', error);
          return NextResponse.json({ error: 'Failed to fetch consent status' }, { status: 500 });
        }

        return NextResponse.json({ consents });
      }

      case 'export_user_data': {
        // Export user data for GDPR compliance
        if (!userId) {
          return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const privacyManager = new DataPrivacyManager();
        const userData = await privacyManager.exportUserData(userId);

        // Log the export action
        await logSecurityEvent(
          'user_data_export',
          user.id,
          { exported_user_id: userId, admin_user: user.id },
          request
        );

        return NextResponse.json({ 
          export_data: userData,
          exported_at: new Date().toISOString()
        });
      }

      case 'security_events': {
        // Get security events
        let query = supabase
          .from('security_events')
          .select(`
            *,
            profiles!user_id (
              email,
              first_name,
              last_name
            )
          `)
          .order('created_at', { ascending: false })
          .limit(100);

        if (targetTenantId) {
          query = query.eq('tenant_id', targetTenantId);
        }

        if (userId) {
          query = query.eq('user_id', userId);
        }

        const { data: events, error } = await query;

        if (error) {
          console.error('Error fetching security events:', error);
          return NextResponse.json({ error: 'Failed to fetch security events' }, { status: 500 });
        }

        return NextResponse.json({ events });
      }

      case 'compliance_dashboard': {
        // Get compliance dashboard data
        const analytics = await supabase.rpc('get_customer_analytics', {
          p_tenant_id: targetTenantId,
          p_days: 30
        });

        // Count privacy requests by status
        let requestQuery = supabase
          .from('data_privacy_requests')
          .select('status', { count: 'exact' });

        if (targetTenantId) {
          requestQuery = requestQuery.eq('tenant_id', targetTenantId);
        }

        const { count: totalRequests } = await requestQuery;

        const { count: pendingRequests } = await requestQuery
          .eq('status', 'pending');

        const { count: completedRequests } = await requestQuery
          .eq('status', 'completed');

        // Count consent grants
        let consentQuery = supabase
          .from('user_consents')
          .select('consent_type, granted', { count: 'exact' });

        if (targetTenantId) {
          consentQuery = consentQuery.eq('tenant_id', targetTenantId);
        }

        const { count: totalConsents } = await consentQuery;
        const { count: grantedConsents } = await consentQuery.eq('granted', true);

        // Recent security events
        let securityQuery = supabase
          .from('security_events')
          .select('severity', { count: 'exact' })
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        if (targetTenantId) {
          securityQuery = securityQuery.eq('tenant_id', targetTenantId);
        }

        const { count: weeklySecurityEvents } = await securityQuery;
        const { count: criticalEvents } = await securityQuery.in('severity', ['error', 'critical']);

        return NextResponse.json({
          compliance_summary: {
            total_privacy_requests: totalRequests || 0,
            pending_requests: pendingRequests || 0,
            completed_requests: completedRequests || 0,
            total_consents: totalConsents || 0,
            granted_consents: grantedConsents || 0,
            consent_rate: totalConsents ? ((grantedConsents || 0) / totalConsents * 100).toFixed(1) : '0',
            weekly_security_events: weeklySecurityEvents || 0,
            critical_security_events: criticalEvents || 0
          },
          customer_analytics: analytics?.data?.[0] || {}
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in privacy API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create privacy requests, update consents
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, RATE_LIMITS.admin);
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
    const authResult = await checkAdminPermissions(supabase);
    
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user, profile } = authResult;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    const body = await request.json();

    switch (action) {
      case 'create_privacy_request': {
        const { user_id, request_type, request_details } = body;

        if (!user_id || !request_type) {
          return NextResponse.json({ error: 'User ID and request type are required' }, { status: 400 });
        }

        // Get user's tenant
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', user_id)
          .single();

        const targetTenantId = userProfile?.tenant_id;

        // Check if admin has permission for this tenant
        if (profile.role === 'tenant_admin' && targetTenantId !== profile.tenant_id) {
          return NextResponse.json({ error: 'No permission for this user' }, { status: 403 });
        }

        // Create privacy request
        const { data: privacyRequest, error } = await supabase
          .from('data_privacy_requests')
          .insert({
            user_id,
            tenant_id: targetTenantId,
            request_type,
            request_details: request_details || {},
            requested_by: user.id,
            status: 'pending'
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating privacy request:', error);
          return NextResponse.json({ error: 'Failed to create privacy request' }, { status: 500 });
        }

        // Log the action
        await logSecurityEvent(
          'privacy_request_created',
          user.id,
          { 
            request_id: privacyRequest.id,
            target_user: user_id,
            request_type,
            admin_user: user.id
          },
          request
        );

        return NextResponse.json({ request: privacyRequest });
      }

      case 'update_consent': {
        const { user_id, consent_type, granted } = body;

        if (!user_id || !consent_type || typeof granted !== 'boolean') {
          return NextResponse.json({ error: 'User ID, consent type, and granted status are required' }, { status: 400 });
        }

        // Get user's tenant
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', user_id)
          .single();

        const targetTenantId = userProfile?.tenant_id;

        // Check permissions
        if (profile.role === 'tenant_admin' && targetTenantId !== profile.tenant_id) {
          return NextResponse.json({ error: 'No permission for this user' }, { status: 403 });
        }

        // Update consent
        const { data: consent, error } = await supabase
          .from('user_consents')
          .upsert({
            user_id,
            tenant_id: targetTenantId,
            consent_type,
            granted,
            granted_at: granted ? new Date().toISOString() : null,
            revoked_at: granted ? null : new Date().toISOString(),
            method: 'admin',
            ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
            user_agent: request.headers.get('user-agent'),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,consent_type'
          })
          .select()
          .single();

        if (error) {
          console.error('Error updating consent:', error);
          return NextResponse.json({ error: 'Failed to update consent' }, { status: 500 });
        }

        // Log the action
        await logSecurityEvent(
          'consent_updated',
          user.id,
          { 
            target_user: user_id,
            consent_type,
            granted,
            admin_user: user.id
          },
          request
        );

        return NextResponse.json({ consent });
      }

      case 'process_privacy_request': {
        const { request_id, status, processing_notes } = body;

        if (!request_id || !status) {
          return NextResponse.json({ error: 'Request ID and status are required' }, { status: 400 });
        }

        // Get the request
        const { data: privacyRequest, error: fetchError } = await supabase
          .from('data_privacy_requests')
          .select('*')
          .eq('id', request_id)
          .single();

        if (fetchError || !privacyRequest) {
          return NextResponse.json({ error: 'Privacy request not found' }, { status: 404 });
        }

        // Check permissions
        if (profile.role === 'tenant_admin' && privacyRequest.tenant_id !== profile.tenant_id) {
          return NextResponse.json({ error: 'No permission for this request' }, { status: 403 });
        }

        let updateData: any = {
          status,
          processing_notes,
          requested_by: user.id,
          updated_at: new Date().toISOString()
        };

        // If completing the request, process accordingly
        if (status === 'completed') {
          updateData.completed_at = new Date().toISOString();

          const privacyManager = new DataPrivacyManager();

          if (privacyRequest.request_type === 'export') {
            // Export user data
            const userData = await privacyManager.exportUserData(privacyRequest.user_id);
            // In production, you'd upload this to secure storage and provide a download link
            updateData.exported_data_url = 'secure-download-link';
          } else if (privacyRequest.request_type === 'delete' || privacyRequest.request_type === 'anonymize') {
            // Anonymize user data
            const retainHistory = privacyRequest.request_details?.retain_subscription_history !== false;
            const result = await privacyManager.anonymizeUserData(privacyRequest.user_id, retainHistory);
            updateData.processing_notes = `${processing_notes || ''}\nUser data anonymized. New email: ${result.anonymized_email}`;
          }
        }

        // Update the request
        const { data: updatedRequest, error: updateError } = await supabase
          .from('data_privacy_requests')
          .update(updateData)
          .eq('id', request_id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating privacy request:', updateError);
          return NextResponse.json({ error: 'Failed to update privacy request' }, { status: 500 });
        }

        // Log the action
        await logSecurityEvent(
          'privacy_request_processed',
          user.id,
          { 
            request_id,
            target_user: privacyRequest.user_id,
            request_type: privacyRequest.request_type,
            new_status: status,
            admin_user: user.id
          },
          request
        );

        return NextResponse.json({ request: updatedRequest });
      }

      case 'cleanup_expired_data': {
        // Only super admins can run cleanup
        if (profile.role !== 'super_admin') {
          return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
        }

        const { data: cleanupResult } = await supabase.rpc('cleanup_expired_security_data');

        // Log the cleanup
        await logSecurityEvent(
          'data_cleanup_executed',
          user.id,
          { 
            cleanup_result: cleanupResult,
            admin_user: user.id
          },
          request
        );

        return NextResponse.json({ cleanup_result: cleanupResult });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in privacy API POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Handle data deletion requests
export async function DELETE(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, RATE_LIMITS.admin);
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
    const authResult = await checkAdminPermissions(supabase);
    
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user, profile } = authResult;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const requestId = searchParams.get('request_id');

    switch (action) {
      case 'delete_privacy_request': {
        if (!requestId) {
          return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
        }

        // Get the request first to check permissions
        const { data: privacyRequest } = await supabase
          .from('data_privacy_requests')
          .select('tenant_id, user_id')
          .eq('id', requestId)
          .single();

        if (!privacyRequest) {
          return NextResponse.json({ error: 'Privacy request not found' }, { status: 404 });
        }

        // Check permissions
        if (profile.role === 'tenant_admin' && privacyRequest.tenant_id !== profile.tenant_id) {
          return NextResponse.json({ error: 'No permission for this request' }, { status: 403 });
        }

        // Delete the request
        const { error } = await supabase
          .from('data_privacy_requests')
          .delete()
          .eq('id', requestId);

        if (error) {
          console.error('Error deleting privacy request:', error);
          return NextResponse.json({ error: 'Failed to delete privacy request' }, { status: 500 });
        }

        // Log the action
        await logSecurityEvent(
          'privacy_request_deleted',
          user.id,
          { 
            request_id: requestId,
            target_user: privacyRequest.user_id,
            admin_user: user.id
          },
          request
        );

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in privacy API DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 