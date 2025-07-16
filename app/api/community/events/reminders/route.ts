import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// GET /api/community/events/reminders - Get pending reminders (for background jobs)
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
    const eventId = searchParams.get('event_id');
    const due = searchParams.get('due') === 'true'; // Get only due reminders
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

    // Build query for reminders
    let query = supabase
      .from('community_event_reminders')
      .select(`
        *,
        event:community_events!event_id(id, title, starts_at, status),
        user:profiles!user_id(id, first_name, last_name, email)
      `)
      .limit(limit);

    // Apply tenant filtering (RLS will also enforce this)
    if (profile.role !== 'super_admin') {
      query = query.eq('tenant_id', profile.tenant_id);
    }

    // Filter by event if specified
    if (eventId) {
      query = query.eq('event_id', eventId);
    }

    // Filter by due reminders if requested
    if (due) {
      const now = new Date().toISOString();
      query = query.lte('remind_at', now).is('sent_at', null);
    } else {
      // Otherwise, only show unsent reminders
      query = query.is('sent_at', null);
    }

    // Order by reminder time
    query = query.order('remind_at', { ascending: true });

    const { data: reminders, error } = await query;

    if (error) {
      console.error('Error fetching reminders:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reminders' },
        { status: 500 }
      );
    }

    return NextResponse.json({ reminders: reminders || [] });
  } catch (error) {
    console.error('Error in reminders fetch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/community/events/reminders - Create custom reminder or mark reminder as sent
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
      action, 
      eventId, 
      userId, 
      reminderType, 
      remindAt, 
      messageTemplate,
      reminderId 
    } = body;

    // Validate action
    if (!['create', 'mark_sent'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "create" or "mark_sent"' },
        { status: 400 }
      );
    }

    if (action === 'create') {
      // Validate required fields for creating reminder
      if (!eventId || !reminderType || !remindAt) {
        return NextResponse.json(
          { error: 'Missing required fields: eventId, reminderType, remindAt' },
          { status: 400 }
        );
      }

      // Verify event exists and user has permission
      const { data: event, error: eventError } = await supabase
        .from('community_events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (eventError || !event) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }

      // Check permissions - only event creators, admins, or the user themselves can create reminders
      const canCreateReminder = event.created_by === user.id || 
                               ['tenant_admin', 'super_admin'].includes(profile.role) ||
                               (!userId || userId === user.id);

      if (!canCreateReminder) {
        return NextResponse.json({ 
          error: 'Insufficient permissions to create reminder' 
        }, { status: 403 });
      }

      // Validate remind time is before event start
      const remindTime = new Date(remindAt);
      const eventStart = new Date(event.starts_at);
      
      if (remindTime >= eventStart) {
        return NextResponse.json(
          { error: 'Reminder time must be before event start time' },
          { status: 400 }
        );
      }

      // Create reminder data
      const reminderData = {
        tenant_id: profile.tenant_id,
        event_id: eventId,
        user_id: userId || user.id,
        reminder_type: reminderType,
        remind_at: remindAt,
        message_template: messageTemplate || null,
        metadata: {
          created_by: user.id,
          custom: reminderType === 'custom'
        }
      };

      // Insert reminder
      const { data: reminder, error: insertError } = await supabase
        .from('community_event_reminders')
        .insert(reminderData)
        .select(`
          *,
          event:community_events!event_id(id, title, starts_at),
          user:profiles!user_id(id, first_name, last_name, email)
        `)
        .single();

      if (insertError) {
        // Handle unique constraint violation
        if (insertError.code === '23505') {
          return NextResponse.json(
            { error: 'A reminder of this type already exists for this user and event' },
            { status: 409 }
          );
        }
        
        console.error('Error creating reminder:', insertError);
        return NextResponse.json(
          { error: 'Failed to create reminder' },
          { status: 500 }
        );
      }

      return NextResponse.json({ reminder }, { status: 201 });

    } else if (action === 'mark_sent') {
      // Mark reminder as sent (for background job processing)
      if (!reminderId) {
        return NextResponse.json(
          { error: 'Missing required field: reminderId' },
          { status: 400 }
        );
      }

      // Verify reminder exists and user has permission
      const { data: reminder, error: reminderError } = await supabase
        .from('community_event_reminders')
        .select('*')
        .eq('id', reminderId)
        .single();

      if (reminderError || !reminder) {
        return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });
      }

      // Check permissions - only system/admins or event creators can mark as sent
      const canMarkSent = ['tenant_admin', 'super_admin'].includes(profile.role) ||
                         reminder.metadata?.created_by === user.id;

      if (!canMarkSent) {
        return NextResponse.json({ 
          error: 'Insufficient permissions to mark reminder as sent' 
        }, { status: 403 });
      }

      // Update reminder
      const { data: updatedReminder, error: updateError } = await supabase
        .from('community_event_reminders')
        .update({ 
          sent_at: new Date().toISOString(),
          metadata: {
            ...reminder.metadata,
            marked_sent_by: user.id
          }
        })
        .eq('id', reminderId)
        .select()
        .single();

      if (updateError) {
        console.error('Error marking reminder as sent:', updateError);
        return NextResponse.json(
          { error: 'Failed to mark reminder as sent' },
          { status: 500 }
        );
      }

      return NextResponse.json({ 
        reminder: updatedReminder,
        message: 'Reminder marked as sent'
      });
    }
  } catch (error) {
    console.error('Error in reminder creation/update:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/community/events/reminders - Bulk process reminders (for background jobs)
export async function PUT(request: NextRequest) {
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

    // Only admins can bulk process reminders
    if (!['tenant_admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions for bulk operations' 
      }, { status: 403 });
    }

    const body = await request.json();
    const { action, reminderIds, sendNotifications = true } = body;

    if (action !== 'process_due') {
      return NextResponse.json(
        { error: 'Invalid action. Only "process_due" is supported' },
        { status: 400 }
      );
    }

    // Get due reminders (either specified IDs or all due reminders)
    let query = supabase
      .from('community_event_reminders')
      .select(`
        *,
        event:community_events!event_id(id, title, starts_at, created_by),
        user:profiles!user_id(id, first_name, last_name, email)
      `)
      .lte('remind_at', new Date().toISOString())
      .is('sent_at', null);

    if (profile.role !== 'super_admin') {
      query = query.eq('tenant_id', profile.tenant_id);
    }

    if (reminderIds && reminderIds.length > 0) {
      query = query.in('id', reminderIds);
    }

    const { data: dueReminders, error: reminderError } = await query;

    if (reminderError) {
      console.error('Error fetching due reminders:', reminderError);
      return NextResponse.json(
        { error: 'Failed to fetch due reminders' },
        { status: 500 }
      );
    }

    if (!dueReminders || dueReminders.length === 0) {
      return NextResponse.json({ 
        message: 'No due reminders to process',
        processed: 0
      });
    }

    const processedReminders = [];
    const errors = [];

    // Process each reminder
    for (const reminder of dueReminders) {
      try {
        // Send notification if enabled
        if (sendNotifications && reminder.user && reminder.event) {
          await supabase.rpc('send_event_notification', {
            p_tenant_id: reminder.tenant_id,
            p_event_id: reminder.event_id,
            p_notification_type: 'event_reminder',
            p_recipient_id: reminder.user_id
          });
        }

        // Mark reminder as sent
        const { error: updateError } = await supabase
          .from('community_event_reminders')
          .update({ 
            sent_at: new Date().toISOString(),
            metadata: {
              ...reminder.metadata,
              processed_by: user.id,
              processed_at: new Date().toISOString()
            }
          })
          .eq('id', reminder.id);

        if (updateError) {
          throw updateError;
        }

        processedReminders.push(reminder.id);
             } catch (error) {
         console.error(`Error processing reminder ${reminder.id}:`, error);
         errors.push({
           reminderId: reminder.id,
           error: error instanceof Error ? error.message : 'Unknown error'
         });
       }
    }

    return NextResponse.json({
      message: `Processed ${processedReminders.length} reminders`,
      processed: processedReminders.length,
      errors: errors.length > 0 ? errors : undefined,
      processedIds: processedReminders
    });
  } catch (error) {
    console.error('Error in bulk reminder processing:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 