import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import { emailService } from '@/services/email/email.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST - Handle coach invitation validation and acceptance
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await request.json();
    const { token, action, userId } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      );
    }

    if (action === 'validate') {
      // Validate invitation and return details for form pre-population
      const { data: result, error } = await supabase
        .rpc('get_coach_invitation_details', { invitation_token: token });

      if (error) {
        console.error('Error validating coach invitation:', error);
        return NextResponse.json(
          { error: 'Failed to validate invitation' },
          { status: 500 }
        );
      }

      if (!result || !result.success) {
        return NextResponse.json(
          { error: result?.error || 'Invalid invitation token' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        invitation: result.invitation
      });
    }

    if (action === 'accept') {
      if (!userId) {
        return NextResponse.json(
          { error: 'User ID is required for accepting invitation' },
          { status: 400 }
        );
      }

      // Accept the invitation and get invitation details
      const { data: result, error } = await supabase
        .rpc('accept_coach_invitation', { 
          invitation_token: token,
          user_id: userId 
        });

      if (error) {
        console.error('Error accepting coach invitation:', error);
        return NextResponse.json(
          { error: 'Failed to accept invitation' },
          { status: 500 }
        );
      }

      if (!result || !result.success) {
        return NextResponse.json(
          { error: result?.error || 'Failed to accept invitation' },
          { status: 400 }
        );
      }

      const invitationData = result.invitation;

      // Create the coach profile with the correct tenant and role
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          tenant_id: invitationData.tenant_id,
          email: invitationData.email,
          first_name: invitationData.first_name,
          last_name: invitationData.last_name,
          role: 'coach', // Automatically assign coach role
          is_active: true,
          settings: {}, // Empty settings object - they can fill this out in their profile
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        console.error('Error creating coach profile:', profileError);
        
        // If profile creation fails, we should mark the invitation as failed
        // But for now, just return the error
        return NextResponse.json(
          { error: 'Failed to create coach profile' },
          { status: 500 }
        );
      }

      // Send welcome email to the new coach
      try {
        const welcomeResult = await emailService.sendWelcomeEmail({
          email: invitationData.email,
          firstName: invitationData.first_name,
          role: 'coach',
        });
        
        if (!welcomeResult.success) {
          console.error('Failed to send coach welcome email:', welcomeResult.error);
        } else {
          console.log('Coach welcome email sent successfully to:', invitationData.email);
        }
      } catch (emailError) {
        console.error('Error sending coach welcome email:', emailError);
        // Don't fail the request - profile is created, email just failed
      }

      return NextResponse.json({
        success: true,
        message: 'Coach invitation accepted and profile created successfully',
        profile: {
          id: userId,
          email: invitationData.email,
          first_name: invitationData.first_name,
          last_name: invitationData.last_name,
          role: 'coach',
          tenant_id: invitationData.tenant_id
        }
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "validate" or "accept"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in coach invitation handler:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 