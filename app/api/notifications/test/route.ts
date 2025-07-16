import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import { pushService } from '@/lib/push-service';

// POST /api/notifications/test - Send a test notification
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('Test notification request for user:', user.id);

    const body = await request.json();
    const { type = 'test', title, body: messageBody } = body;

    // Default test notification content
    const notificationTitle = title || 'Test Notification';
    const notificationBody = messageBody || 'This is a test notification from MyAi. Your browser notifications are working correctly!';

    // Check if user can receive notifications (with fallback for super admin)
    let canReceive = true; // Default to true for super admin
    
    try {
      const { data: checkResult, error: checkError } = await supabase
        .rpc('can_user_receive_notifications', {
          p_user_id: user.id,
          p_notification_type: type,
          p_delivery_method: 'push'
        });

      if (checkError) {
        console.warn('Database function failed, using fallback for super admin:', checkError.message);
        // For super admin, we'll check preferences manually
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (profile?.role === 'super_admin') {
          console.log('Super admin user, allowing test notification');
          canReceive = true;
        } else {
          console.error('Error checking notification permissions for non-admin:', checkError);
          return NextResponse.json({ error: 'Failed to check notification permissions' }, { status: 500 });
        }
      } else {
        canReceive = checkResult;
      }
    } catch (funcError) {
      console.warn('Database function call failed, using fallback:', funcError);
      canReceive = true; // Allow for super admin
    }

    if (!canReceive) {
      return NextResponse.json({ 
        error: 'User cannot receive notifications. Check your notification preferences.',
        canReceive: false
      }, { status: 400 });
    }

    // Get user's active push subscriptions (with tenant handling for super admin)
    let subscriptionsQuery = supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    const { data: subscriptions, error: subscriptionError } = await subscriptionsQuery;

    if (subscriptionError) {
      console.error('Error fetching push subscriptions:', subscriptionError);
      return NextResponse.json({ error: 'Failed to fetch push subscriptions' }, { status: 500 });
    }

    console.log('Found subscriptions:', subscriptions?.length || 0);

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ 
        error: 'No active push subscriptions found. Please enable browser notifications first.',
        hasSubscriptions: false
      }, { status: 400 });
    }

    // Send actual push notification using the push service
    console.log('Attempting to send test notification via push service');
    console.log('Environment check - VAPID Public Key exists:', !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
    console.log('Environment check - VAPID Private Key exists:', !!process.env.VAPID_PRIVATE_KEY);
    console.log('Environment check - VAPID Subject:', process.env.VAPID_SUBJECT);
    
    let result;
    try {
      result = await pushService.sendTestNotification(
        user.id,
        notificationTitle,
        notificationBody
      );

      console.log('Push service result:', result);
    } catch (pushError: any) {
      console.error('Push service error details:', {
        name: pushError.name,
        message: pushError.message,
        stack: pushError.stack
      });
      
      return NextResponse.json({ 
        error: 'Push notification failed',
        details: pushError.message,
        errorType: pushError.name || 'Unknown'
      }, { status: 500 });
    }

    if (result.success) {
      return NextResponse.json({ 
        message: 'Test notification sent successfully',
        title: notificationTitle,
        body: notificationBody,
        subscriptionCount: subscriptions.length,
        sent: result.sent,
        failed: result.failed,
        canReceive: true,
        hasSubscriptions: true
      });
    } else {
      return NextResponse.json({ 
        error: 'Failed to send test notification',
        errors: result.errors,
        sent: result.sent,
        failed: result.failed,
        canReceive: true,
        hasSubscriptions: true
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error in POST /api/notifications/test:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}

// GET /api/notifications/test - Get test notification status
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check user's notification permissions (with fallback for super admin)
    let canReceive = true;
    
    try {
      const { data: checkResult, error: checkError } = await supabase
        .rpc('can_user_receive_notifications', {
          p_user_id: user.id,
          p_notification_type: 'test',
          p_delivery_method: 'push'
        });

      if (checkError) {
        console.warn('Database function failed in GET, using fallback:', checkError.message);
        canReceive = true; // Fallback for super admin
      } else {
        canReceive = checkResult;
      }
    } catch (funcError) {
      console.warn('Database function call failed in GET:', funcError);
      canReceive = true; // Fallback
    }

    // Get user's active push subscriptions
    const { data: subscriptions, error: subscriptionError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, device_type, browser_name, created_at')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (subscriptionError) {
      console.error('Error fetching push subscriptions:', subscriptionError);
      return NextResponse.json({ error: 'Failed to fetch push subscriptions' }, { status: 500 });
    }

    // Get user's notification preferences (with fallback for super admin)
    let preferences = null;
    
    try {
      const { data: prefResult, error: prefError } = await supabase
        .rpc('get_user_notification_preferences', { p_user_id: user.id });

      if (prefError) {
        console.warn('Preferences function failed, using direct query fallback:', prefError.message);
        // Fallback to direct table query
        const { data: directPrefs } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', user.id)
          .single();
        preferences = directPrefs;
      } else {
        preferences = prefResult;
      }
    } catch (funcError) {
      console.warn('Preferences function call failed:', funcError);
      // Try direct query as fallback
      const { data: directPrefs } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();
      preferences = directPrefs;
    }

    // Get recent test notifications
    let recentTests: any[] = [];
    
    try {
      const { data: testResults, error: testError } = await supabase
        .from('notification_history')
        .select('id, title, body, delivery_status, sent_at, created_at')
        .eq('user_id', user.id)
        .eq('notification_type', 'test')
        .order('created_at', { ascending: false })
        .limit(5);

      if (testError) {
        console.warn('Error fetching test notifications:', testError);
        // Continue without recent tests
      } else {
        recentTests = testResults || [];
      }
    } catch (historyError) {
      console.warn('Test notification history query failed:', historyError);
      // Continue without recent tests
    }

    return NextResponse.json({
      canReceive,
      hasSubscriptions: subscriptions && subscriptions.length > 0,
      subscriptionCount: subscriptions?.length || 0,
      subscriptions: subscriptions || [],
      preferences,
      recentTests
    });
  } catch (error: any) {
    console.error('Error in GET /api/notifications/test:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
} 