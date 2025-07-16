import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// GET /api/notifications/history - Get user's notification history
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const type = url.searchParams.get('type');
    const deliveryMethod = url.searchParams.get('delivery_method');
    const status = url.searchParams.get('status');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('notification_history')
      .select(`
        id,
        notification_type,
        title,
        body,
        delivery_method,
        delivery_status,
        related_entity_type,
        related_entity_id,
        scheduled_for,
        sent_at,
        delivered_at,
        clicked_at,
        created_at
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (type) {
      query = query.eq('notification_type', type);
    }
    if (deliveryMethod) {
      query = query.eq('delivery_method', deliveryMethod);
    }
    if (status) {
      query = query.eq('delivery_status', status);
    }
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('Error fetching notification history:', error);
      return NextResponse.json({ error: 'Failed to fetch notification history' }, { status: 500 });
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('notification_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Apply same filters to count
    if (type) countQuery = countQuery.eq('notification_type', type);
    if (deliveryMethod) countQuery = countQuery.eq('delivery_method', deliveryMethod);
    if (status) countQuery = countQuery.eq('delivery_status', status);
    if (startDate) countQuery = countQuery.gte('created_at', startDate);
    if (endDate) countQuery = countQuery.lte('created_at', endDate);

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Error counting notifications:', countError);
      return NextResponse.json({ error: 'Failed to count notifications' }, { status: 500 });
    }

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      notifications,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error in GET /api/notifications/history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/notifications/history - Record notification interaction (click, delivery, etc.)
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId, action, timestamp } = body;

    if (!notificationId || !action) {
      return NextResponse.json({ 
        error: 'Notification ID and action are required' 
      }, { status: 400 });
    }

    const validActions = ['delivered', 'clicked'];
    if (!validActions.includes(action)) {
      return NextResponse.json({ 
        error: 'Invalid action. Must be one of: delivered, clicked' 
      }, { status: 400 });
    }

    const updateData: any = {};
    
    if (action === 'delivered') {
      updateData.delivery_status = 'delivered';
      updateData.delivered_at = timestamp || new Date().toISOString();
    } else if (action === 'clicked') {
      updateData.delivery_status = 'clicked';
      updateData.clicked_at = timestamp || new Date().toISOString();
    }

    // Update notification history
    const { data: notification, error } = await supabase
      .from('notification_history')
      .update(updateData)
      .eq('id', notificationId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating notification history:', error);
      return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
    }

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      message: 'Notification updated successfully',
      notification 
    });
  } catch (error) {
    console.error('Error in POST /api/notifications/history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 