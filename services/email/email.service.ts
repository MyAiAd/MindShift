import { Resend } from 'resend';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Configuration
const EMAIL_CONFIG = {
  from: 'MindShifting <noreply@mindshifting.myai.ad>',
  replyTo: 'support@mindshifting.myai.ad',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://site-maker-lilac.vercel.app',
};

// Types
export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Email Service Class
export class EmailService {
  private static instance: EmailService;

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Send a generic email
   */
  async send(options: SendEmailOptions): Promise<EmailResult> {
    try {
      // Check if API key is configured
      if (!process.env.RESEND_API_KEY) {
        console.error('RESEND_API_KEY is not configured');
        return { success: false, error: 'Email service not configured' };
      }

      // Ensure we have at least one content type
      if (!options.html && !options.text) {
        return { success: false, error: 'Email must have html or text content' };
      }

      // Use type assertion for Resend SDK compatibility
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await resend.emails.send({
        from: EMAIL_CONFIG.from,
        to: options.to,
        subject: options.subject,
        html: options.html || '',
        text: options.text,
        replyTo: options.replyTo || EMAIL_CONFIG.replyTo,
      } as any);

      if (error) {
        console.error('Email send error:', error);
        return { success: false, error: error.message };
      }

      console.log('Email sent successfully:', data?.id);
      return { success: true, messageId: data?.id };
    } catch (error) {
      console.error('Email service error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Send coach invitation email
   */
  async sendCoachInvitation(options: {
    email: string;
    firstName?: string;
    lastName?: string;
    inviterName: string;
    organizationName: string;
    invitationToken: string;
  }): Promise<EmailResult> {
    const signupUrl = `${EMAIL_CONFIG.siteUrl}/auth/coach-signup?token=${options.invitationToken}`;
    const recipientName = options.firstName || 'there';
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Coach Invitation</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
          <div style="background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4F46E5; margin: 0; font-size: 28px;">🧠 MindShifting</h1>
            </div>
            
            <h2 style="color: #1a1a1a; margin-bottom: 20px;">You're Invited to Join as a Coach!</h2>
            
            <p style="color: #374151; margin-bottom: 16px;">Hi ${recipientName},</p>
            
            <p style="color: #374151; margin-bottom: 16px;">
              <strong>${options.inviterName}</strong> has invited you to join <strong>${options.organizationName}</strong> as a coach on MindShifting.
            </p>
            
            <p style="color: #374151; margin-bottom: 24px;">
              As a coach, you'll be able to guide clients through transformative mindset sessions and help them achieve their goals.
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${signupUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Accept Invitation
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
              This invitation will expire in <strong>7 days</strong>.
            </p>
            
            <p style="color: #6b7280; font-size: 14px;">
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              MindShifting - Transform Your Mindset<br>
              <a href="${EMAIL_CONFIG.siteUrl}" style="color: #9ca3af;">mindshifting.myai.ad</a>
            </p>
          </div>
        </body>
      </html>
    `;

    const text = `
You're Invited to Join MindShifting as a Coach!

Hi ${recipientName},

${options.inviterName} has invited you to join ${options.organizationName} as a coach on MindShifting.

As a coach, you'll be able to guide clients through transformative mindset sessions and help them achieve their goals.

Accept your invitation here: ${signupUrl}

This invitation will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

---
MindShifting - Transform Your Mindset
    `.trim();

    return this.send({
      to: options.email,
      subject: `${options.inviterName} invited you to coach on MindShifting`,
      html,
      text,
    });
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(options: {
    email: string;
    firstName?: string;
    role?: string;
  }): Promise<EmailResult> {
    const dashboardUrl = `${EMAIL_CONFIG.siteUrl}/dashboard`;
    const recipientName = options.firstName || 'there';
    const isCoach = options.role === 'coach';
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to MindShifting</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
          <div style="background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4F46E5; margin: 0; font-size: 28px;">🧠 MindShifting</h1>
            </div>
            
            <h2 style="color: #1a1a1a; margin-bottom: 20px;">Welcome to MindShifting! 🎉</h2>
            
            <p style="color: #374151; margin-bottom: 16px;">Hi ${recipientName},</p>
            
            <p style="color: #374151; margin-bottom: 16px;">
              Thank you for joining MindShifting! We're thrilled to have you on board.
            </p>
            
            <p style="color: #374151; margin-bottom: 16px;">Here's what you can do to get started:</p>
            
            <ul style="color: #374151; margin-bottom: 24px; padding-left: 20px;">
              ${isCoach ? `
                <li style="margin-bottom: 8px;">Set up your coach profile</li>
                <li style="margin-bottom: 8px;">Review the treatment protocols</li>
                <li style="margin-bottom: 8px;">Connect with your clients</li>
              ` : `
                <li style="margin-bottom: 8px;">Start your first treatment session</li>
                <li style="margin-bottom: 8px;">Set up your personal goals</li>
                <li style="margin-bottom: 8px;">Join the community and connect with others</li>
              `}
            </ul>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${dashboardUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Go to Dashboard
              </a>
            </div>
            
            <p style="color: #374151; margin-bottom: 16px;">
              If you have any questions, feel free to reach out to our support team.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              MindShifting - Transform Your Mindset<br>
              <a href="${EMAIL_CONFIG.siteUrl}" style="color: #9ca3af;">mindshifting.myai.ad</a>
            </p>
          </div>
        </body>
      </html>
    `;

    const text = `
Welcome to MindShifting! 🎉

Hi ${recipientName},

Thank you for joining MindShifting! We're thrilled to have you on board.

Here's what you can do to get started:
${isCoach ? `
- Set up your coach profile
- Review the treatment protocols
- Connect with your clients
` : `
- Start your first treatment session
- Set up your personal goals
- Join the community and connect with others
`}

Go to your dashboard: ${dashboardUrl}

If you have any questions, feel free to reach out to our support team.

---
MindShifting - Transform Your Mindset
    `.trim();

    return this.send({
      to: options.email,
      subject: 'Welcome to MindShifting! 🎉',
      html,
      text,
    });
  }

  /**
   * Send notification email (for users who prefer email notifications)
   */
  async sendNotificationEmail(options: {
    email: string;
    subject: string;
    title: string;
    message: string;
    actionUrl?: string;
    actionText?: string;
  }): Promise<EmailResult> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${options.title}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
          <div style="background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4F46E5; margin: 0; font-size: 28px;">🧠 MindShifting</h1>
            </div>
            
            <h2 style="color: #1a1a1a; margin-bottom: 20px;">${options.title}</h2>
            
            <p style="color: #374151; margin-bottom: 24px;">${options.message}</p>
            
            ${options.actionUrl && options.actionText ? `
              <div style="text-align: center; margin: 32px 0;">
                <a href="${options.actionUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  ${options.actionText}
                </a>
              </div>
            ` : ''}
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              MindShifting - Transform Your Mindset<br>
              <a href="${EMAIL_CONFIG.siteUrl}/dashboard/settings" style="color: #9ca3af;">Manage notification preferences</a>
            </p>
          </div>
        </body>
      </html>
    `;

    const text = `
${options.title}

${options.message}

${options.actionUrl ? `${options.actionText || 'Click here'}: ${options.actionUrl}` : ''}

---
MindShifting - Transform Your Mindset
Manage notification preferences: ${EMAIL_CONFIG.siteUrl}/dashboard/settings
    `.trim();

    return this.send({
      to: options.email,
      subject: options.subject,
      html,
      text,
    });
  }

  /**
   * Send password reset success notification
   */
  async sendPasswordResetConfirmation(options: {
    email: string;
    firstName?: string;
  }): Promise<EmailResult> {
    const recipientName = options.firstName || 'there';
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Changed</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
          <div style="background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4F46E5; margin: 0; font-size: 28px;">🧠 MindShifting</h1>
            </div>
            
            <h2 style="color: #1a1a1a; margin-bottom: 20px;">Password Changed Successfully</h2>
            
            <p style="color: #374151; margin-bottom: 16px;">Hi ${recipientName},</p>
            
            <p style="color: #374151; margin-bottom: 16px;">
              Your password has been successfully changed. If you made this change, you can safely ignore this email.
            </p>
            
            <p style="color: #374151; margin-bottom: 16px;">
              <strong>If you did not make this change</strong>, please contact us immediately at support@mindshifting.myai.ad
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              MindShifting - Transform Your Mindset<br>
              <a href="${EMAIL_CONFIG.siteUrl}" style="color: #9ca3af;">mindshifting.myai.ad</a>
            </p>
          </div>
        </body>
      </html>
    `;

    return this.send({
      to: options.email,
      subject: 'Your MindShifting password has been changed',
      html,
    });
  }

  /**
   * Send session reminder email
   */
  async sendSessionReminder(options: {
    email: string;
    firstName?: string;
    sessionType: string;
    scheduledTime?: string;
  }): Promise<EmailResult> {
    const dashboardUrl = `${EMAIL_CONFIG.siteUrl}/dashboard/sessions`;
    const recipientName = options.firstName || 'there';
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Session Reminder</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
          <div style="background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4F46E5; margin: 0; font-size: 28px;">🧠 MindShifting</h1>
            </div>
            
            <h2 style="color: #1a1a1a; margin-bottom: 20px;">Time for Your ${options.sessionType} Session! ⏰</h2>
            
            <p style="color: #374151; margin-bottom: 16px;">Hi ${recipientName},</p>
            
            <p style="color: #374151; margin-bottom: 16px;">
              This is a friendly reminder to continue your mindset transformation journey.
            </p>
            
            ${options.scheduledTime ? `
              <p style="color: #374151; margin-bottom: 24px;">
                <strong>Scheduled time:</strong> ${options.scheduledTime}
              </p>
            ` : ''}
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${dashboardUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Start Session
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              MindShifting - Transform Your Mindset<br>
              <a href="${EMAIL_CONFIG.siteUrl}/dashboard/settings" style="color: #9ca3af;">Manage notification preferences</a>
            </p>
          </div>
        </body>
      </html>
    `;

    return this.send({
      to: options.email,
      subject: `Reminder: Time for your ${options.sessionType} session`,
      html,
    });
  }
}

// Export singleton instance
export const emailService = EmailService.getInstance();

