import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET - Fetch coach invitations for the current tenant
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check permissions
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if user has admin permissions
    if (!['tenant_admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Admin permissions required' }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build query for coach invitations
    let query = supabase
      .from('coach_invitations')
      .select(`
        id,
        email,
        first_name,
        last_name,
        status,
        expires_at,
        created_at,
        accepted_at,
        invited_by:profiles!invited_by(first_name, last_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply status filter
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Apply tenant filtering (super admins can see all, others only their tenant)
    if (profile.role !== 'super_admin') {
      query = query.eq('tenant_id', profile.tenant_id);
    }

    const { data: invitations, error } = await query;

    if (error) {
      console.error('Error fetching coach invitations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch coach invitations' },
        { status: 500 }
      );
    }

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('Error in coach invitations fetch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new coach invitation
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check permissions
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if user has admin permissions
    if (!['tenant_admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Admin permissions required' }, { status: 403 });
    }

    const body = await request.json();
    const { email, firstName, lastName, tenantId } = body;

    // Validate required fields
    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Use the database function to create invitation
    const { data: result, error: inviteError } = await supabase
      .rpc('create_coach_invitation', {
        invitation_email: email.trim().toLowerCase(),
        invitation_first_name: firstName?.trim() || null,
        invitation_last_name: lastName?.trim() || null,
        inviter_tenant_id: tenantId || null
      });

    if (inviteError) {
      console.error('Error creating coach invitation:', inviteError);
      return NextResponse.json(
        { error: 'Failed to create coach invitation' },
        { status: 500 }
      );
    }

    // Check if the function returned an error
    if (result && !result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Return success with invitation details
    return NextResponse.json({ 
      invitation: result,
      message: 'Coach invitation sent successfully'
    });
  } catch (error) {
    console.error('Error in coach invitation creation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Revoke a coach invitation
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check permissions
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if user has admin permissions
    if (!['tenant_admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Admin permissions required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get('id');

    if (!invitationId) {
      return NextResponse.json(
        { error: 'Invitation ID is required' },
        { status: 400 }
      );
    }

    // Build update query with tenant filtering
    let query = supabase
      .from('coach_invitations')
      .update({ 
        status: 'revoked', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', invitationId)
      .eq('status', 'pending'); // Only allow revoking pending invitations

    // Apply tenant filtering (super admins can revoke any, others only their tenant)
    if (profile.role !== 'super_admin') {
      query = query.eq('tenant_id', profile.tenant_id);
    }

    const { data: updatedInvitation, error: updateError } = await query
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Invitation not found or cannot be revoked' }, { status: 404 });
      }
      console.error('Error revoking coach invitation:', updateError);
      return NextResponse.json(
        { error: 'Failed to revoke coach invitation' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      message: 'Coach invitation revoked successfully',
      invitation: updatedInvitation
    });
  } catch (error) {
    console.error('Error in coach invitation revocation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 