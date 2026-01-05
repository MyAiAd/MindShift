import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import { emailService } from '@/services/email/email.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Rate limiting: store last test time per user (in-memory for simplicity)
const lastTestTime: Map<string, number> = new Map();
const RATE_LIMIT_MS = 60 * 1000; // 1 minute

// POST - Send a test email to the current user
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check admin permissions
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, email, first_name')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Only admins can send test emails
    if (!['tenant_admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Admin permissions required' }, { status: 403 });
    }

    // Rate limiting check
    const lastTime = lastTestTime.get(user.id);
    const now = Date.now();
    if (lastTime && (now - lastTime) < RATE_LIMIT_MS) {
      const remainingSeconds = Math.ceil((RATE_LIMIT_MS - (now - lastTime)) / 1000);
      return NextResponse.json({ 
        error: `Please wait ${remainingSeconds} seconds before sending another test email`,
        retryAfter: remainingSeconds
      }, { status: 429 });
    }

    // Update rate limit timestamp
    lastTestTime.set(user.id, now);

    // Use the user's email
    const targetEmail = profile.email || user.email;
    if (!targetEmail) {
      return NextResponse.json({ error: 'No email address found for user' }, { status: 400 });
    }

    // Send test email using the notification template
    const result = await emailService.sendNotificationEmail({
      email: targetEmail,
      subject: '✅ MindShifting Email Test Successful',
      title: 'Email System Test',
      message: `
        <p>Congratulations! Your MindShifting email system is working correctly.</p>
        <p>This test email confirms that:</p>
        <ul style="color: inherit; margin: 16px 0; padding-left: 20px;">
          <li style="margin-bottom: 8px;">Your Resend API key is configured</li>
          <li style="margin-bottom: 8px;">Your domain is verified</li>
          <li style="margin-bottom: 8px;">Email delivery is functioning</li>
        </ul>
        <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
          Sent at: ${new Date().toLocaleString()}
        </p>
      `,
      actionUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://site-maker-lilac.vercel.app',
      actionText: 'Go to Dashboard',
    });

    if (!result.success) {
      console.error('Test email failed:', result.error);
      return NextResponse.json({ 
        success: false,
        error: 'Failed to send test email',
        details: result.error,
        configured: !!process.env.RESEND_API_KEY
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully',
      messageId: result.messageId,
      sentTo: targetEmail,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET - Check email configuration status
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check admin permissions
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Only admins can check email status
    if (!['tenant_admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Admin permissions required' }, { status: 403 });
    }

    // Check configuration
    const isConfigured = !!process.env.RESEND_API_KEY;
    const hasValidKey = isConfigured && process.env.RESEND_API_KEY?.startsWith('re_');

    return NextResponse.json({
      configured: isConfigured,
      validKeyFormat: hasValidKey,
      provider: 'resend',
      status: isConfigured ? (hasValidKey ? 'ready' : 'invalid_key_format') : 'not_configured',
      domain: 'mindshifting.myai.ad',
      senderEmail: 'noreply@mindshifting.myai.ad'
    });
  } catch (error) {
    console.error('Email status check error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

