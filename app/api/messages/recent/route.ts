import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export interface RecentMessage {
  message_id: string;
  sender_name: string;
  receiver_name: string;
  message_preview: string;
  message_type: 'direct_message' | 'system_notification' | 'automated_reminder' | 'goal_checkin' | 'session_reminder' | 'progress_update';
  status: 'sent' | 'delivered' | 'read' | 'archived';
  created_at: string;
  is_sender: boolean;
}

// GET /api/messages/recent - Get recent messages for the current user
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    // Use the database function to get recent messages
    const { data: messages, error } = await supabase
      .rpc('get_recent_messages', {
        p_user_id: user.id,
        p_limit: limit
      });

    if (error) {
      console.error("Error fetching recent messages:", error);
      return NextResponse.json({ error: "Failed to fetch recent messages" }, { status: 500 });
    }

    return NextResponse.json({ messages: messages || [] });
  } catch (error) {
    console.error("Error in GET /api/messages/recent:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 