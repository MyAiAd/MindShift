import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// GET /api/community/events - List events with filtering and pagination
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const eventType = searchParams.get('event_type') || '';
    const createdBy = searchParams.get('created_by') || '';
    const timeframe = searchParams.get('timeframe') || ''; // 'upcoming', 'past', 'today', 'this_week'
    const sortBy = searchParams.get('sort_by') || 'starts_at';
    const sortOrder = searchParams.get('sort_order') || 'asc';

    // Build base query with creator information
    let query = supabase
      .from('community_events')
      .select(`
        *,
        creator:profiles!created_by(id, first_name, last_name, email),
        rsvp_summary:community_event_rsvps(status)
      `)
      .range(offset, offset + limit - 1);

    // Apply tenant filtering (RLS will also enforce this)
    if (profile.role !== 'super_admin') {
      query = query.eq('tenant_id', profile.tenant_id);
    }

    // Apply status filter
    if (status) {
      query = query.eq('status', status);
    } else {
      // Default to published events for non-admins
      if (!['tenant_admin', 'super_admin'].includes(profile.role)) {
        query = query.in('status', ['published', 'live', 'completed']);
      }
    }

    // Apply event type filter
    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    // Filter by creator
    if (createdBy) {
      query = query.eq('created_by', createdBy);
    }

    // Apply timeframe filtering
    const now = new Date().toISOString();
    switch (timeframe) {
      case 'upcoming':
        query = query.gte('starts_at', now);
        break;
      case 'past':
        query = query.lt('ends_at', now);
        break;
      case 'today':
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        query = query.gte('starts_at', todayStart.toISOString())
                    .lte('starts_at', todayEnd.toISOString());
        break;
      case 'this_week':
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        query = query.gte('starts_at', weekStart.toISOString())
                    .lte('starts_at', weekEnd.toISOString());
        break;
    }

    // Apply search
    if (search) {
      query = query.textSearch('title,description', search);
    }

    // Apply sorting
    const sortColumn = sortBy === 'created_at' ? 'created_at' : 
                      sortBy === 'updated_at' ? 'updated_at' : 
                      sortBy === 'title' ? 'title' :
                      sortBy === 'rsvp_count' ? 'rsvp_count' : 'starts_at';
    
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

    const { data: events, error } = await query;

    if (error) {
      console.error('Error fetching events:', error);
      return NextResponse.json(
        { error: 'Failed to fetch events' },
        { status: 500 }
      );
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('community_events')
      .select('id', { count: 'exact', head: true });

    if (profile.role !== 'super_admin') {
      countQuery = countQuery.eq('tenant_id', profile.tenant_id);
    }

    if (status) {
      countQuery = countQuery.eq('status', status);
    } else if (!['tenant_admin', 'super_admin'].includes(profile.role)) {
      countQuery = countQuery.in('status', ['published', 'live', 'completed']);
    }

    if (eventType) {
      countQuery = countQuery.eq('event_type', eventType);
    }

    if (createdBy) {
      countQuery = countQuery.eq('created_by', createdBy);
    }

    // Apply same timeframe filtering to count query
    switch (timeframe) {
      case 'upcoming':
        countQuery = countQuery.gte('starts_at', now);
        break;
      case 'past':
        countQuery = countQuery.lt('ends_at', now);
        break;
      case 'today':
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        countQuery = countQuery.gte('starts_at', todayStart.toISOString())
                               .lte('starts_at', todayEnd.toISOString());
        break;
      case 'this_week':
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        countQuery = countQuery.gte('starts_at', weekStart.toISOString())
                               .lte('starts_at', weekEnd.toISOString());
        break;
    }

    if (search) {
      countQuery = countQuery.textSearch('title,description', search);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Error counting events:', countError);
      return NextResponse.json(
        { error: 'Failed to count events' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      events: events || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error in events fetch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/community/events - Create a new event
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

    // Check if user can create events
    if (!['tenant_admin', 'manager', 'coach', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions to create events' 
      }, { status: 403 });
    }

    const body = await request.json();
    const { 
      title, 
      description, 
      eventType = 'other',
      status = 'draft',
      startsAt, 
      endsAt,
      timezone = 'UTC',
      maxAttendees,
      enableWaitlist = false,
      zoomMeetingId,
      zoomJoinUrl,
      zoomStartUrl,
      meetingPassword,
      recurrencePattern = 'none',
      recurrenceInterval = 1,
      recurrenceCount,
      recurrenceUntil,
      agenda = [],
      resources = [],
      tags = [],
      metadata = {}
    } = body;

    // Validate required fields
    if (!title || !startsAt || !endsAt) {
      return NextResponse.json(
        { error: 'Missing required fields: title, startsAt, endsAt' },
        { status: 400 }
      );
    }

    // Validate event times
    const startTime = new Date(startsAt);
    const endTime = new Date(endsAt);
    
    if (endTime <= startTime) {
      return NextResponse.json(
        { error: 'Event end time must be after start time' },
        { status: 400 }
      );
    }

    // Validate title length
    if (title.length > 255) {
      return NextResponse.json(
        { error: 'Event title must be 255 characters or less' },
        { status: 400 }
      );
    }

    // Validate max attendees
    if (maxAttendees !== null && maxAttendees !== undefined && maxAttendees <= 0) {
      return NextResponse.json(
        { error: 'Max attendees must be greater than 0 or null for unlimited' },
        { status: 400 }
      );
    }

    // Validate recurrence interval
    if (recurrencePattern !== 'none' && recurrenceInterval <= 0) {
      return NextResponse.json(
        { error: 'Recurrence interval must be greater than 0' },
        { status: 400 }
      );
    }

    // Create event data
    const eventData = {
      tenant_id: profile.tenant_id,
      created_by: user.id,
      title: title.trim(),
      description: description?.trim() || null,
      event_type: eventType,
      status,
      starts_at: startsAt,
      ends_at: endsAt,
      timezone,
      max_attendees: maxAttendees || null,
      enable_waitlist: enableWaitlist,
      zoom_meeting_id: zoomMeetingId || null,
      zoom_join_url: zoomJoinUrl || null,
      zoom_start_url: zoomStartUrl || null,
      meeting_password: meetingPassword || null,
      recurrence_pattern: recurrencePattern,
      recurrence_interval: recurrenceInterval,
      recurrence_count: recurrenceCount || null,
      recurrence_until: recurrenceUntil || null,
      agenda,
      resources,
      tags,
      metadata,
    };

    // Insert event
    const { data: event, error: insertError } = await supabase
      .from('community_events')
      .insert(eventData)
      .select(`
        *,
        creator:profiles!created_by(id, first_name, last_name, email)
      `)
      .single();

    if (insertError) {
      console.error('Error creating event:', insertError);
      return NextResponse.json(
        { error: 'Failed to create event' },
        { status: 500 }
      );
    }

    // If event is published, send notifications (handled by database triggers)
    // and create recurring instances if needed
    if (status === 'published' && recurrencePattern !== 'none') {
      // TODO: Implement recurring event creation logic
      // This would create multiple event instances based on the recurrence pattern
    }

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error('Error in event creation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 