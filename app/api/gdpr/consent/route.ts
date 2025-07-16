// ===============================================
// GDPR CONSENT MANAGEMENT API
// ===============================================
// Handle user consent for cookies and data processing

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import { rateLimit, RATE_LIMITS, logSecurityEvent } from '@/lib/security-middleware';
import config from '@/lib/config';

// Helper function to get client IP
function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const remoteAddr = request.headers.get('x-remote-addr');
  
  return forwardedFor?.split(',')[0] || realIP || remoteAddr || 'unknown';
}

// GET - Retrieve user consent status
export async function GET(request: NextRequest) {
  try {
    // Check if GDPR is enabled
    if (!config.gdpr.consentManagerEnabled) {
      return NextResponse.json({ error: 'GDPR consent management is disabled' }, { status: 404 });
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

    const { data: consents, error } = await supabase
      .from('user_consents')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching consent:', error);
      return NextResponse.json({ error: 'Failed to fetch consent' }, { status: 500 });
    }

    return NextResponse.json({ consents });

  } catch (error) {
    console.error('Error in consent GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Update user consent
export async function POST(request: NextRequest) {
  try {
    // Check if GDPR is enabled
    if (!config.gdpr.consentManagerEnabled) {
      return NextResponse.json({ error: 'GDPR consent management is disabled' }, { status: 404 });
    }

    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, RATE_LIMITS.auth);
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

    const { userId, consentType, granted, metadata = {} } = await request.json();

    // Validate input
    if (!consentType || typeof granted !== 'boolean') {
      return NextResponse.json({ error: 'Invalid consent data' }, { status: 400 });
    }

    // Only allow users to update their own consent, unless they're an admin
    if (userId && userId !== user.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || !['tenant_admin', 'super_admin'].includes(profile.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    const targetUserId = userId || user.id;
    const now = new Date().toISOString();
    const clientIP = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';

    // Get user's tenant
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', targetUserId)
      .single();

    const consentData = {
      user_id: targetUserId,
      tenant_id: userProfile?.tenant_id,
      consent_type: consentType,
      granted,
      granted_at: granted ? now : null,
      revoked_at: granted ? null : now,
      version: '1.0',
      method: 'web',
      ip_address: clientIP,
      user_agent: userAgent,
      metadata: {
        ...metadata,
        updated_by: user.id,
        timestamp: now,
      },
      updated_at: now,
    };

    // Upsert consent record
    const { data: consent, error } = await supabase
      .from('user_consents')
      .upsert(consentData, {
        onConflict: 'user_id,consent_type'
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating consent:', error);
      return NextResponse.json({ error: 'Failed to update consent' }, { status: 500 });
    }

    // Log security event
    await logSecurityEvent(
      'consent_updated',
      user.id,
      {
        target_user: targetUserId,
        consent_type: consentType,
        granted,
        ip_address: clientIP,
        user_agent: userAgent,
      },
      request
    );

    return NextResponse.json({ 
      success: true,
      consent: {
        id: consent.id,
        consentType: consent.consent_type,
        granted: consent.granted,
        grantedAt: consent.granted_at,
        revokedAt: consent.revoked_at,
        version: consent.version,
        method: consent.method,
        updatedAt: consent.updated_at,
      }
    });

  } catch (error) {
    console.error('Error in consent POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Revoke all consent
export async function DELETE(request: NextRequest) {
  try {
    // Check if GDPR is enabled
    if (!config.gdpr.consentManagerEnabled) {
      return NextResponse.json({ error: 'GDPR consent management is disabled' }, { status: 404 });
    }

    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, RATE_LIMITS.auth);
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

    const now = new Date().toISOString();
    const clientIP = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';

    // Revoke all non-essential consents
    const { error } = await supabase
      .from('user_consents')
      .update({
        granted: false,
        revoked_at: now,
        method: 'web',
        ip_address: clientIP,
        user_agent: userAgent,
        updated_at: now,
      })
      .eq('user_id', user.id)
      .neq('consent_type', 'essential'); // Keep essential consents

    if (error) {
      console.error('Error revoking consents:', error);
      return NextResponse.json({ error: 'Failed to revoke consents' }, { status: 500 });
    }

    // Log security event
    await logSecurityEvent(
      'consent_revoked_all',
      user.id,
      {
        ip_address: clientIP,
        user_agent: userAgent,
      },
      request
    );

    return NextResponse.json({ 
      success: true,
      message: 'All non-essential consents revoked'
    });

  } catch (error) {
    console.error('Error in consent DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 