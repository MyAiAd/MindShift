import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// Rate limiting configuration
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string; // Custom key generator
}

// Default rate limits for different endpoint types
export const RATE_LIMITS = {
  // General API endpoints
  general: { windowMs: 15 * 60 * 1000, maxRequests: 100 }, // 100 requests per 15 minutes
  
  // Authentication endpoints (stricter)
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 10 }, // 10 requests per 15 minutes
  
  // Admin endpoints (moderate)
  admin: { windowMs: 15 * 60 * 1000, maxRequests: 50 }, // 50 requests per 15 minutes
  
  // Data export/import (very strict)
  dataManagement: { windowMs: 60 * 60 * 1000, maxRequests: 5 }, // 5 requests per hour
  
  // Public endpoints (lenient)
  public: { windowMs: 15 * 60 * 1000, maxRequests: 200 }, // 200 requests per 15 minutes
} as const;

// In-memory rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  rateLimitStore.forEach((value, key) => {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  });
}, 5 * 60 * 1000);

// Rate limiting middleware
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<{ success: boolean; remaining: number; resetTime: number; error?: string }> {
  const key = config.keyGenerator ? config.keyGenerator(request) : getDefaultKey(request);
  const now = Date.now();
  
  const current = rateLimitStore.get(key);
  
  if (!current || now > current.resetTime) {
    // First request or window expired
    const resetTime = now + config.windowMs;
    rateLimitStore.set(key, { count: 1, resetTime });
    return { success: true, remaining: config.maxRequests - 1, resetTime };
  }
  
  if (current.count >= config.maxRequests) {
    // Rate limit exceeded
    return {
      success: false,
      remaining: 0,
      resetTime: current.resetTime,
      error: 'Rate limit exceeded'
    };
  }
  
  // Increment counter
  current.count++;
  rateLimitStore.set(key, current);
  
  return {
    success: true,
    remaining: config.maxRequests - current.count,
    resetTime: current.resetTime
  };
}

// Default key generator (IP + User ID if available)
function getDefaultKey(request: NextRequest): string {
  const ip = request.headers.get('x-forwarded-for') || 
            request.headers.get('x-real-ip') || 
            'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  // Create a hash-like key from IP and user agent
  return `${ip}:${userAgent.slice(0, 50)}`;
}

// Enhanced session validation
export async function validateSession(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { valid: false, error: 'Invalid session' };
    }

    // Check if user is active
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, is_active, role, tenant_id, last_login_at')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return { valid: false, error: 'User profile not found' };
    }

    if (!profile.is_active) {
      return { valid: false, error: 'Account is deactivated' };
    }

    // Update last login timestamp (rate limited to once per hour)
    const lastLogin = profile.last_login_at ? new Date(profile.last_login_at) : null;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    if (!lastLogin || lastLogin < oneHourAgo) {
      await supabase
        .from('profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id);
    }

    return {
      valid: true,
      user,
      profile,
      sessionInfo: {
        userId: user.id,
        email: user.email,
        role: profile.role,
        tenantId: profile.tenant_id,
        lastLogin: profile.last_login_at
      }
    };

  } catch (error) {
    console.error('Session validation error:', error);
    return { valid: false, error: 'Session validation failed' };
  }
}

// Security headers middleware
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https://api.supabase.co wss://realtime.supabase.co; " +
    "frame-ancestors 'none';"
  );

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // HSTS (Strict Transport Security)
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  return response;
}

// Data privacy compliance utilities
export class DataPrivacyManager {
  private supabase: any;

  constructor() {
    this.supabase = createServerClient();
  }

  // GDPR Data Export - Generate complete user data package
  async exportUserData(userId: string) {
    try {
      const userDataPackage: any = {
        generated_at: new Date().toISOString(),
        user_id: userId,
        data: {}
      };

      // Profile data
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      userDataPackage.data.profile = profile;

      // Subscription data
      const { data: subscriptions } = await this.supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans (*)
        `)
        .eq('user_id', userId);

      userDataPackage.data.subscriptions = subscriptions;

      // Goals and progress data
      const { data: goals } = await this.supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId);

      userDataPackage.data.goals = goals;

      // Treatment sessions (if any)
      const { data: sessions } = await this.supabase
        .from('treatment_sessions')
        .select('*')
        .eq('user_id', userId);

      userDataPackage.data.treatment_sessions = sessions;

      // Customer notes (if user is a customer)
      const { data: notes } = await this.supabase
        .from('customer_notes')
        .select('*')
        .eq('customer_user_id', userId);

      userDataPackage.data.customer_communications = notes;

      // Billing information (non-sensitive)
      const { data: billing } = await this.supabase
        .from('customer_billing_info')
        .select('billing_name, billing_address, city, state, country, postal_code')
        .eq('user_id', userId);

      userDataPackage.data.billing_address = billing;

      // Payment transaction history (non-sensitive)
      const { data: transactions } = await this.supabase
        .from('payment_transactions')
        .select('amount_cents, currency, status, transaction_date, description')
        .eq('user_id', userId);

      userDataPackage.data.payment_history = transactions;

      return userDataPackage;

    } catch (error) {
      console.error('Error exporting user data:', error);
      throw new Error('Failed to export user data');
    }
  }

  // GDPR Data Deletion - Anonymize user data
  async anonymizeUserData(userId: string, retainSubscriptionHistory: boolean = true) {
    try {
      const anonymizedEmail = `deleted-user-${userId.slice(0, 8)}@deleted.local`;
      const anonymizedData = {
        email: anonymizedEmail,
        first_name: '[Deleted]',
        last_name: '[User]',
        is_active: false,
        deletion_date: new Date().toISOString()
      };

      // Anonymize profile
      await this.supabase
        .from('profiles')
        .update(anonymizedData)
        .eq('id', userId);

      // Delete or anonymize personal data in goals
      await this.supabase
        .from('goals')
        .update({
          title: '[Deleted Goal]',
          description: '[Content deleted for privacy]'
        })
        .eq('user_id', userId);

      // Delete treatment session content
      await this.supabase
        .from('treatment_sessions')
        .update({
          session_notes: '[Content deleted for privacy]',
          ai_insights: null
        })
        .eq('user_id', userId);

      // Delete billing information
      await this.supabase
        .from('customer_billing_info')
        .delete()
        .eq('user_id', userId);

      // Anonymize customer notes
      await this.supabase
        .from('customer_notes')
        .update({
          title: '[Communication with deleted user]',
          content: '[Content deleted for privacy]'
        })
        .eq('customer_user_id', userId);

      if (!retainSubscriptionHistory) {
        // Delete subscription history if requested
        await this.supabase
          .from('user_subscriptions')
          .delete()
          .eq('user_id', userId);

        await this.supabase
          .from('subscription_history')
          .delete()
          .eq('user_id', userId);

        await this.supabase
          .from('payment_transactions')
          .delete()
          .eq('user_id', userId);
      } else {
        // Anonymize payment transactions but retain for business records
        await this.supabase
          .from('payment_transactions')
          .update({
            description: '[Transaction for deleted user]',
            metadata: null
          })
          .eq('user_id', userId);
      }

      // Log the deletion for compliance
      await this.supabase.rpc('log_admin_action', {
        p_action: 'gdpr_user_deletion',
        p_resource_type: 'user_data',
        p_resource_id: userId,
        p_new_data: { 
          anonymized_at: new Date().toISOString(),
          retain_subscription_history: retainSubscriptionHistory
        }
      });

      return { success: true, anonymized_email: anonymizedEmail };

    } catch (error) {
      console.error('Error anonymizing user data:', error);
      throw new Error('Failed to anonymize user data');
    }
  }

  // Data retention policy enforcement
  async enforceDataRetention() {
    try {
      const retentionPeriodDays = 365 * 7; // 7 years for business records
      const cutoffDate = new Date(Date.now() - retentionPeriodDays * 24 * 60 * 60 * 1000);

      // Find old inactive users for potential deletion
      const { data: oldUsers } = await this.supabase
        .from('profiles')
        .select('id, email, created_at, last_login_at, is_active')
        .eq('is_active', false)
        .lt('created_at', cutoffDate.toISOString())
        .or(`last_login_at.is.null,last_login_at.lt.${cutoffDate.toISOString()}`);

      // Clean up old audit logs (keep 2 years)
      const auditRetentionDays = 365 * 2;
      const auditCutoffDate = new Date(Date.now() - auditRetentionDays * 24 * 60 * 60 * 1000);
      
      await this.supabase
        .from('audit_logs')
        .delete()
        .lt('created_at', auditCutoffDate.toISOString());

      return {
        candidates_for_deletion: oldUsers?.length || 0,
        audit_logs_cleaned: true
      };

    } catch (error) {
      console.error('Error enforcing data retention:', error);
      throw new Error('Failed to enforce data retention policy');
    }
  }

  // Consent management
  async updateConsentStatus(userId: string, consentType: string, granted: boolean) {
    try {
      // Create or update consent record
      const { error } = await this.supabase
        .from('user_consents')
        .upsert({
          user_id: userId,
          consent_type: consentType,
          granted: granted,
          granted_at: granted ? new Date().toISOString() : null,
          revoked_at: granted ? null : new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,consent_type'
        });

      if (error) throw error;

      // Log consent change
      await this.supabase.rpc('log_admin_action', {
        p_action: 'consent_updated',
        p_resource_type: 'user_consent',
        p_resource_id: userId,
        p_new_data: { consent_type: consentType, granted }
      });

      return { success: true };

    } catch (error) {
      console.error('Error updating consent:', error);
      throw new Error('Failed to update consent status');
    }
  }
}

// IP-based geolocation for compliance (basic implementation)
export function getLocationFromIP(ip: string): { country?: string; region?: string } {
  // In production, integrate with a geolocation service like MaxMind GeoIP
  // This is a placeholder implementation
  if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return { country: 'LOCAL', region: 'PRIVATE' };
  }
  
  // Default to unknown for this implementation
  return { country: 'UNKNOWN', region: 'UNKNOWN' };
}

// Audit logging with enhanced metadata
export async function logSecurityEvent(
  eventType: string,
  userId: string | null,
  metadata: any,
  request?: NextRequest
) {
  try {
    const supabase = createServerClient();
    
    const eventData = {
      event_type: eventType,
      user_id: userId,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        ip_address: request?.headers.get('x-forwarded-for') || 
                   request?.headers.get('x-real-ip') || 
                   'unknown',
        user_agent: request?.headers.get('user-agent') || 'unknown',
        location: request ? getLocationFromIP(
          request.headers.get('x-forwarded-for') || 
          request.headers.get('x-real-ip') || 
          'unknown'
        ) : undefined
      }
    };

    await supabase
      .from('security_events')
      .insert(eventData);

  } catch (error) {
    console.error('Error logging security event:', error);
  }
} 