import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

// GET /api/community/notifications/preferences - Get user's notification preferences
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

    // Get user's notification preferences
    const { data: preferences, error } = await supabase
      .from('community_notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching notification preferences:', error);
      return NextResponse.json(
        { error: 'Failed to fetch notification preferences' },
        { status: 500 }
      );
    }

    // If no preferences found, return defaults
    if (!preferences) {
      const defaultPreferences = {
        email_notifications: true,
        in_app_notifications: true,
        notify_on_comments: true,
        notify_on_replies: true,
        notify_on_likes: false,
        notify_on_new_posts: false,
        notify_on_mentions: true
      };

      return NextResponse.json({ preferences: defaultPreferences });
    }

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Error in notification preferences fetch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/community/notifications/preferences - Update user's notification preferences
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

    const body = await request.json();
    const {
      emailNotifications,
      inAppNotifications,
      notifyOnComments,
      notifyOnReplies,
      notifyOnLikes,
      notifyOnNewPosts,
      notifyOnMentions
    } = body;

    // Build update data with snake_case field names for database
    const updateData: any = {};
    
    if (emailNotifications !== undefined) updateData.email_notifications = emailNotifications;
    if (inAppNotifications !== undefined) updateData.in_app_notifications = inAppNotifications;
    if (notifyOnComments !== undefined) updateData.notify_on_comments = notifyOnComments;
    if (notifyOnReplies !== undefined) updateData.notify_on_replies = notifyOnReplies;
    if (notifyOnLikes !== undefined) updateData.notify_on_likes = notifyOnLikes;
    if (notifyOnNewPosts !== undefined) updateData.notify_on_new_posts = notifyOnNewPosts;
    if (notifyOnMentions !== undefined) updateData.notify_on_mentions = notifyOnMentions;

    // Validate that at least one field is being updated
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid preferences provided for update' },
        { status: 400 }
      );
    }

    // Upsert preferences (create if not exists, update if exists)
    const { data: preferences, error: upsertError } = await supabase
      .from('community_notification_preferences')
      .upsert({
        tenant_id: profile.tenant_id,
        user_id: user.id,
        ...updateData
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (upsertError) {
      console.error('Error updating notification preferences:', upsertError);
      return NextResponse.json(
        { error: 'Failed to update notification preferences' },
        { status: 500 }
      );
    }

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Error in notification preferences update:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 