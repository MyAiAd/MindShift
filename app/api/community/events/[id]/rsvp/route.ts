import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// GET /api/community/events/[id]/rsvp - Get RSVP status for the current user
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const eventId = params.id;

    // Verify event exists and user has access
    const { data: event, error: eventError } = await supabase
      .from('community_events')
      .select('id, tenant_id, status, max_attendees, going_count')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Get user's RSVP status
    const { data: rsvp, error: rsvpError } = await supabase
      .from('community_event_rsvps')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .single();

    if (rsvpError && rsvpError.code !== 'PGRST116') {
      console.error('Error fetching RSVP:', rsvpError);
      return NextResponse.json(
        { error: 'Failed to fetch RSVP status' },
        { status: 500 }
      );
    }

    // Calculate availability
    const isAtCapacity = event.max_attendees ? event.going_count >= event.max_attendees : false;

    return NextResponse.json({ 
      rsvp: rsvp || null,
      eventCapacity: {
        maxAttendees: event.max_attendees,
        currentGoing: event.going_count,
        isAtCapacity,
        spotsRemaining: event.max_attendees ? Math.max(0, event.max_attendees - event.going_count) : null
      }
    });
  } catch (error) {
    console.error('Error fetching RSVP status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/community/events/[id]/rsvp - Create or update RSVP
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const eventId = params.id;
    const body = await request.json();
    const { status, notes } = body;

    // Validate required fields
    if (!status) {
      return NextResponse.json(
        { error: 'Missing required field: status' },
        { status: 400 }
      );
    }

    // Validate status value
    const validStatuses = ['going', 'maybe', 'not_going'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: going, maybe, not_going' },
        { status: 400 }
      );
    }

    // Verify event exists and is available for RSVP
    const { data: event, error: eventError } = await supabase
      .from('community_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Verify tenant access
    if (profile.role !== 'super_admin' && event.tenant_id !== profile.tenant_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if event is available for RSVPs
    if (!['published', 'live'].includes(event.status)) {
      return NextResponse.json({ 
        error: 'Event is not available for RSVPs' 
      }, { status: 400 });
    }

    // Check if event is in the past
    if (new Date(event.starts_at) < new Date()) {
      return NextResponse.json({ 
        error: 'Cannot RSVP to past events' 
      }, { status: 400 });
    }

    // Use database function to check capacity and handle waitlist
    let finalStatus = status;
    if (status === 'going') {
      try {
        const { data: capacityResult, error: capacityError } = await supabase
          .rpc('check_event_capacity', {
            p_event_id: eventId,
            p_user_id: user.id,
            p_desired_status: status
          });

        if (capacityError) {
          if (capacityError.message.includes('at capacity')) {
            return NextResponse.json({ 
              error: 'Event is at capacity. Waitlist is not enabled.' 
            }, { status: 409 });
          }
          throw capacityError;
        }

        finalStatus = capacityResult;
      } catch (error) {
        console.error('Error checking capacity:', error);
        return NextResponse.json(
          { error: 'Failed to process RSVP' },
          { status: 500 }
        );
      }
    }

    // Create or update RSVP
    const rsvpData = {
      tenant_id: profile.tenant_id,
      event_id: eventId,
      user_id: user.id,
      status: finalStatus,
      notes: notes?.trim() || null,
    };

    const { data: rsvp, error: rsvpError } = await supabase
      .from('community_event_rsvps')
      .upsert(rsvpData, {
        onConflict: 'event_id,user_id'
      })
      .select(`
        *,
        event:community_events!event_id(id, title, starts_at),
        user:profiles!user_id(id, first_name, last_name, email)
      `)
      .single();

    if (rsvpError) {
      console.error('Error creating/updating RSVP:', rsvpError);
      return NextResponse.json(
        { error: 'Failed to update RSVP' },
        { status: 500 }
      );
    }

    // Send notification to event creator if user is going
    if (finalStatus === 'going' && event.created_by !== user.id) {
      await supabase.rpc('send_community_notification', {
        p_tenant_id: profile.tenant_id,
        p_recipient_id: event.created_by,
        p_sender_id: user.id,
        p_message_type: 'system_notification',
        p_subject: 'New RSVP for your event',
        p_content: `${profile.first_name} ${profile.last_name} is attending your event "${event.title}"`,
        p_metadata: {
          event_id: eventId,
          event_title: event.title,
          rsvp_status: finalStatus
        }
      });
    }

    // Return success with waitlist information if applicable
    const response: any = { 
      rsvp,
      message: 'RSVP updated successfully'
    };

    if (status === 'going' && finalStatus === 'waitlist') {
      response.message = 'Event is at capacity. You have been added to the waitlist.';
      response.waitlisted = true;
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error in RSVP creation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/community/events/[id]/rsvp - Remove RSVP
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const eventId = params.id;

    // Verify RSVP exists
    const { data: existingRsvp, error: rsvpError } = await supabase
      .from('community_event_rsvps')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .single();

    if (rsvpError || !existingRsvp) {
      return NextResponse.json({ error: 'RSVP not found' }, { status: 404 });
    }

    // Delete RSVP
    const { error: deleteError } = await supabase
      .from('community_event_rsvps')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting RSVP:', deleteError);
      return NextResponse.json(
        { error: 'Failed to remove RSVP' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      message: 'RSVP removed successfully'
    });
  } catch (error) {
    console.error('Error removing RSVP:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 