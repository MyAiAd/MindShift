import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// GET /api/community/events/[id] - Get a specific event with RSVP details
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
    const { searchParams } = new URL(request.url);
    const includeRsvps = searchParams.get('include_rsvps') === 'true';

    // Fetch event with creator information
    const { data: event, error } = await supabase
      .from('community_events')
      .select(`
        *,
        creator:profiles!created_by(id, first_name, last_name, email)
      `)
      .eq('id', eventId)
      .single();

    if (error || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Get user's RSVP status for this event
    const { data: userRsvp } = await supabase
      .from('community_event_rsvps')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .single();

    let rsvps = null;
    // Include RSVPs if requested and user has permission
    if (includeRsvps) {
      const canViewRsvps = event.created_by === user.id || 
                          ['tenant_admin', 'super_admin'].includes(profile.role);
      
      if (canViewRsvps) {
        const { data: rsvpData } = await supabase
          .from('community_event_rsvps')
          .select(`
            *,
            user:profiles!user_id(id, first_name, last_name, email)
          `)
          .eq('event_id', eventId)
          .order('created_at', { ascending: true });

        rsvps = rsvpData || [];
      }
    }

    return NextResponse.json({ 
      event,
      userRsvp,
      rsvps 
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/community/events/[id] - Update a specific event
export async function PUT(
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
    const { 
      title, 
      description, 
      eventType,
      status,
      startsAt, 
      endsAt,
      timezone,
      maxAttendees,
      enableWaitlist,
      zoomMeetingId,
      zoomJoinUrl,
      zoomStartUrl,
      meetingPassword,
      agenda,
      resources,
      tags,
      metadata
    } = body;

    // Get existing event to verify ownership
    const { data: existingEvent, error: fetchError } = await supabase
      .from('community_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (fetchError || !existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Check permissions
    const canEdit = existingEvent.created_by === user.id || 
                   ['tenant_admin', 'super_admin'].includes(profile.role);

    if (!canEdit) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Build update data
    const updateData: any = {};
    
    if (title !== undefined) {
      if (title.length > 255) {
        return NextResponse.json(
          { error: 'Event title must be 255 characters or less' },
          { status: 400 }
        );
      }
      updateData.title = title.trim();
    }

    if (description !== undefined) updateData.description = description?.trim() || null;
    if (eventType !== undefined) updateData.event_type = eventType;
    if (status !== undefined) updateData.status = status;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (enableWaitlist !== undefined) updateData.enable_waitlist = enableWaitlist;
    if (zoomMeetingId !== undefined) updateData.zoom_meeting_id = zoomMeetingId || null;
    if (zoomJoinUrl !== undefined) updateData.zoom_join_url = zoomJoinUrl || null;
    if (zoomStartUrl !== undefined) updateData.zoom_start_url = zoomStartUrl || null;
    if (meetingPassword !== undefined) updateData.meeting_password = meetingPassword || null;
    if (agenda !== undefined) updateData.agenda = agenda;
    if (resources !== undefined) updateData.resources = resources;
    if (tags !== undefined) updateData.tags = tags;
    if (metadata !== undefined) updateData.metadata = metadata;

    // Validate event times if being updated
    if (startsAt !== undefined || endsAt !== undefined) {
      const startTime = new Date(startsAt || existingEvent.starts_at);
      const endTime = new Date(endsAt || existingEvent.ends_at);
      
      if (endTime <= startTime) {
        return NextResponse.json(
          { error: 'Event end time must be after start time' },
          { status: 400 }
        );
      }

      if (startsAt !== undefined) updateData.starts_at = startsAt;
      if (endsAt !== undefined) updateData.ends_at = endsAt;
    }

    // Validate max attendees
    if (maxAttendees !== undefined) {
      if (maxAttendees !== null && maxAttendees <= 0) {
        return NextResponse.json(
          { error: 'Max attendees must be greater than 0 or null for unlimited' },
          { status: 400 }
        );
      }
      updateData.max_attendees = maxAttendees;
    }

    // Update event
    const { data: updatedEvent, error: updateError } = await supabase
      .from('community_events')
      .update(updateData)
      .eq('id', eventId)
      .select(`
        *,
        creator:profiles!created_by(id, first_name, last_name, email)
      `)
      .single();

    if (updateError) {
      console.error('Error updating event:', updateError);
      return NextResponse.json(
        { error: 'Failed to update event' },
        { status: 500 }
      );
    }

    // If event was published and has RSVPs, optionally send update notifications
    if (status === 'published' && existingEvent.rsvp_count > 0) {
      // Send update notifications to all RSVPed users
      const { data: rsvps } = await supabase
        .from('community_event_rsvps')
        .select('user_id')
        .eq('event_id', eventId)
        .in('status', ['going', 'maybe']);

      if (rsvps && rsvps.length > 0) {
        // Use the database function to send notifications
        for (const rsvp of rsvps) {
          await supabase.rpc('send_event_notification', {
            p_tenant_id: profile.tenant_id,
            p_event_id: eventId,
            p_notification_type: 'event_updated',
            p_recipient_id: rsvp.user_id
          });
        }
      }
    }

    return NextResponse.json({ event: updatedEvent });
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/community/events/[id] - Delete a specific event
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

    // Get existing event to verify ownership
    const { data: existingEvent, error: fetchError } = await supabase
      .from('community_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (fetchError || !existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Check permissions
    const canDelete = existingEvent.created_by === user.id || 
                     ['tenant_admin', 'super_admin'].includes(profile.role);

    if (!canDelete) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Check if event has RSVPs
    const { data: rsvps, error: rsvpsError } = await supabase
      .from('community_event_rsvps')
      .select('user_id')
      .eq('event_id', eventId)
      .limit(1);

    if (rsvpsError) {
      console.error('Error checking for RSVPs:', rsvpsError);
      return NextResponse.json(
        { error: 'Failed to verify event status' },
        { status: 500 }
      );
    }

    if (rsvps && rsvps.length > 0) {
      // If event has RSVPs, cancel it instead of deleting
      const { error: cancelError } = await supabase
        .from('community_events')
        .update({ status: 'cancelled' })
        .eq('id', eventId);

      if (cancelError) {
        console.error('Error cancelling event:', cancelError);
        return NextResponse.json(
          { error: 'Failed to cancel event' },
          { status: 500 }
        );
      }

      // Send cancellation notifications to all RSVPed users
      const { data: allRsvps } = await supabase
        .from('community_event_rsvps')
        .select('user_id')
        .eq('event_id', eventId);

      if (allRsvps) {
        for (const rsvp of allRsvps) {
          await supabase.rpc('send_event_notification', {
            p_tenant_id: profile.tenant_id,
            p_event_id: eventId,
            p_notification_type: 'event_cancelled',
            p_recipient_id: rsvp.user_id
          });
        }
      }

      return NextResponse.json({ 
        message: 'Event cancelled successfully',
        type: 'cancelled'
      });
    } else {
      // Hard delete if no RSVPs
      const { error: deleteError } = await supabase
        .from('community_events')
        .delete()
        .eq('id', eventId);

      if (deleteError) {
        console.error('Error deleting event:', deleteError);
        return NextResponse.json(
          { error: 'Failed to delete event' },
          { status: 500 }
        );
      }

      return NextResponse.json({ 
        message: 'Event deleted successfully',
        type: 'deleted'
      });
    }
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 