import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import { emailService } from '@/services/email/email.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST - Send an email notification
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      recipientId,     // User ID to send email to
      recipientEmail,  // Direct email (alternative to recipientId)
      subject, 
      title, 
      message, 
      actionUrl, 
      actionText,
      type            // Optional: 'notification', 'reminder', 'welcome'
    } = body;

    // Validate required fields
    if (!subject || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: subject, title, message' },
        { status: 400 }
      );
    }

    let targetEmail: string;

    if (recipientEmail) {
      // Direct email provided
      targetEmail = recipientEmail;
    } else if (recipientId) {
      // Get recipient's email and check preferences
      const { data: recipient, error: recipientError } = await supabase
        .from('profiles')
        .select('email, settings, first_name')
        .eq('id', recipientId)
        .single();

      if (recipientError || !recipient?.email) {
        return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
      }

      // Check if user has email notifications enabled
      const settings = recipient.settings as Record<string, boolean> | null;
      if (settings?.email_notifications_enabled === false) {
        return NextResponse.json({ 
          success: true, 
          skipped: true,
          reason: 'Email notifications disabled for user' 
        });
      }

      targetEmail = recipient.email;
    } else {
      return NextResponse.json(
        { error: 'Either recipientId or recipientEmail is required' },
        { status: 400 }
      );
    }

    // Send the email
    const result = await emailService.sendNotificationEmail({
      email: targetEmail,
      subject,
      title,
      message,
      actionUrl,
      actionText,
    });

    if (!result.success) {
      console.error('Email notification failed:', result.error);
      return NextResponse.json(
        { error: 'Failed to send email', details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      sentTo: targetEmail,
    });
  } catch (error) {
    console.error('Email notification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Check email notification status/configuration
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return email service status
    const isConfigured = !!process.env.RESEND_API_KEY;
    
    return NextResponse.json({
      configured: isConfigured,
      provider: 'resend',
      status: isConfigured ? 'ready' : 'not_configured',
    });
  } catch (error) {
    console.error('Email status check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

