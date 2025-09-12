import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check role and tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status'); // upcoming, completed, cancelled
    const type = searchParams.get('type'); // coach, client (for filtering by role)

    // Build query for coaching sessions with coach and client details
    let query = supabase
      .from('coaching_sessions')
      .select(`
        *,
        coach:profiles!coach_id(id, first_name, last_name, email),
        client:profiles!client_id(id, first_name, last_name, email)
      `)
      .order('scheduled_at', { ascending: false })
      .limit(limit);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    // Filter by role type if specified
    if (type === 'coach') {
      query = query.eq('coach_id', user.id);
    } else if (type === 'client') {
      query = query.eq('client_id', user.id);
    }

    // RLS will automatically filter based on user permissions
    // Super admins see everything, others see only their sessions or tenant sessions
    const { data: sessions, error } = await query;

    if (error) {
      console.error('Error fetching coaching sessions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch coaching sessions' },
        { status: 500 }
      );
    }

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Error in coaching sessions fetch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check role and tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { 
      title, 
      description, 
      coachId, 
      clientId, 
      scheduledAt, 
      durationMinutes = 60,
      meetingLink,
      meetingType = 'video'
    } = body;

    // Validate required fields
    if (!title || !coachId || !clientId || !scheduledAt) {
      return NextResponse.json(
        { error: 'Missing required fields: title, coachId, clientId, scheduledAt' },
        { status: 400 }
      );
    }

    // Verify coach and client exist and belong to the same tenant (unless super admin)
    if (profile.role !== 'super_admin') {
      const { data: coachProfile } = await supabase
        .from('profiles')
        .select('tenant_id, role')
        .eq('id', coachId)
        .single();

      const { data: clientProfile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', clientId)
        .single();

      if (!coachProfile || !clientProfile) {
        return NextResponse.json({ error: 'Coach or client not found' }, { status: 404 });
      }

      // Check tenant isolation
      if (coachProfile.tenant_id !== profile.tenant_id || clientProfile.tenant_id !== profile.tenant_id) {
        return NextResponse.json({ error: 'Cannot schedule sessions across different tenants' }, { status: 403 });
      }

      // Verify coach has appropriate role
      if (!['coach', 'manager', 'tenant_admin'].includes(coachProfile.role)) {
        return NextResponse.json({ error: 'Selected coach does not have coaching permissions' }, { status: 400 });
      }
    }

    // Create coaching session
    const sessionData = {
      tenant_id: profile.tenant_id,
      coach_id: coachId,
      client_id: clientId,
      title,
      description: description || null,
      scheduled_at: scheduledAt,
      duration_minutes: durationMinutes,
      status: 'scheduled',
      notes: null,
      recording_url: null,
      meeting_link: meetingLink || null,
      meeting_type: meetingType,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: session, error: insertError } = await supabase
      .from('coaching_sessions')
      .insert(sessionData)
      .select(`
        *,
        coach:profiles!coach_id(id, first_name, last_name, email),
        client:profiles!client_id(id, first_name, last_name, email)
      `)
      .single();

    if (insertError) {
      console.error('Error creating coaching session:', insertError);
      return NextResponse.json(
        { error: 'Failed to create coaching session' },
        { status: 500 }
      );
    }

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error('Error in coaching session creation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      id, 
      status, 
      notes, 
      recordingUrl, 
      meetingLink,
      rescheduledAt 
    } = body;

    // Validate required fields
    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (recordingUrl !== undefined) updateData.recording_url = recordingUrl;
    if (meetingLink !== undefined) updateData.meeting_link = meetingLink;
    if (rescheduledAt) {
      updateData.scheduled_at = rescheduledAt;
      updateData.status = 'scheduled'; // Reset to scheduled when rescheduled
    }

    // Update coaching session (RLS will ensure only authorized users can update)
    const { data: session, error: updateError } = await supabase
      .from('coaching_sessions')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        coach:profiles!coach_id(id, first_name, last_name, email),
        client:profiles!client_id(id, first_name, last_name, email)
      `)
      .single();

    if (updateError) {
      console.error('Error updating coaching session:', updateError);
      return NextResponse.json(
        { error: 'Failed to update coaching session' },
        { status: 500 }
      );
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Error in coaching session update:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check role and tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing required field: sessionId' },
        { status: 400 }
      );
    }

    // First, verify the session exists and user has permission to delete it
    const { data: session, error: fetchError } = await supabase
      .from('coaching_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (fetchError || !session) {
      return NextResponse.json(
        { error: 'Coaching session not found' },
        { status: 404 }
      );
    }

    // Check permissions: coaches can delete their sessions, clients can delete their sessions, 
    // managers/tenant_admins can delete sessions in their tenant, super admins can delete any
    const hasPermission = 
      session.coach_id === user.id ||
      session.client_id === user.id ||
      (profile.role === 'super_admin') ||
      (profile.role === 'tenant_admin' && session.tenant_id === profile.tenant_id) ||
      (profile.role === 'manager' && session.tenant_id === profile.tenant_id);

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Delete the coaching session
    const { error: deleteError } = await supabase
      .from('coaching_sessions')
      .delete()
      .eq('id', sessionId);

    if (deleteError) {
      console.error('Error deleting coaching session:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete coaching session' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Coaching session deleted successfully' });
  } catch (error) {
    console.error('Error in coaching session deletion:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 