import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { pushService } from '@/services/push/push.service';

// Message types
export interface ClientMessage {
  id: string;
  tenant_id: string;
  sender_id: string;
  receiver_id: string;
  thread_id?: string;
  message_type: 'direct_message' | 'system_notification' | 'automated_reminder' | 'goal_checkin' | 'session_reminder' | 'progress_update';
  subject?: string;
  message_content: string;
  status: 'sent' | 'delivered' | 'read' | 'archived';
  template_used?: string;
  metadata?: Record<string, any>;
  created_at: string;
  delivered_at?: string;
  read_at?: string;
  archived_at?: string;
  sender_name?: string;
  receiver_name?: string;
}

export interface MessageWithParticipants extends ClientMessage {
  sender: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  receiver: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

// GET /api/messages - Get messages for the current user
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const threadId = searchParams.get("thread_id");
    const withParticipants = searchParams.get("with_participants") === "true";

    let query = supabase
      .from("client_messages")
      .select(`
        *,
        ${withParticipants ? `
          sender:profiles!client_messages_sender_id_fkey(id, first_name, last_name, email),
          receiver:profiles!client_messages_receiver_id_fkey(id, first_name, last_name, email)
        ` : ''}
      `)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by thread if specified
    if (threadId) {
      query = query.eq("thread_id", threadId);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error("Error fetching messages:", error);
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
    }

    return NextResponse.json({ messages: messages || [] });
  } catch (error) {
    console.error("Error in GET /api/messages:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/messages - Send a new message
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      receiver_id,
      message_content,
      subject,
      message_type = 'direct_message',
      template_used,
      metadata = {}
    } = body;

    // Validate required fields
    if (!receiver_id || !message_content) {
      return NextResponse.json({ 
        error: "Missing required fields: receiver_id, message_content" 
      }, { status: 400 });
    }

    // Use the database function to send the message
    const { data: messageId, error } = await supabase
      .rpc('send_client_message', {
        p_sender_id: user.id,
        p_receiver_id: receiver_id,
        p_message_content: message_content,
        p_subject: subject,
        p_message_type: message_type,
        p_template_used: template_used,
        p_metadata: metadata
      });

    if (error) {
      console.error("Error sending message:", error);
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
    }

    // Fetch the created message with participant details
    const { data: message, error: fetchError } = await supabase
      .from("client_messages")
      .select(`
        *,
        sender:profiles!client_messages_sender_id_fkey(id, first_name, last_name, email),
        receiver:profiles!client_messages_receiver_id_fkey(id, first_name, last_name, email)
      `)
      .eq("id", messageId)
      .single();

    if (fetchError) {
      console.error("Error fetching sent message:", fetchError);
      return NextResponse.json({ error: "Message sent but failed to retrieve details" }, { status: 200 });
    }

    // Send push notification to receiver (non-blocking)
    if (message?.receiver && message?.sender) {
      const senderName = `${message.sender.first_name} ${message.sender.last_name}`.trim() || 'Someone';
      
      // Send notification asynchronously (don't block the response)
      pushService.sendToUser(
        message.receiver_id,
        {
          title: `💬 New message from ${senderName}`,
          body: message.message_content.length > 100 
            ? message.message_content.substring(0, 97) + '...'
            : message.message_content,
          icon: '/brain.png',
          badge: '/brain.png',
          tag: 'new-message',
          actions: [
            { action: 'reply', title: 'Reply' },
            { action: 'mark_read', title: 'Mark as Read' }
          ],
          data: {
            url: '/dashboard/team/message',
            messageId: message.id,
            senderId: message.sender_id
          }
        },
        {
          notificationType: 'new_messages',
          relatedEntityType: 'message',
          relatedEntityId: message.id
        }
      ).catch(error => {
        // Log error but don't fail the message sending
        console.error('Failed to send message notification:', error);
      });
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/messages:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/messages - Update a message (mark as read, archive, etc.)
export async function PUT(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { message_id, action } = body;

    if (!message_id || !action) {
      return NextResponse.json({ 
        error: "Missing required fields: message_id, action" 
      }, { status: 400 });
    }

    switch (action) {
      case 'mark_as_read':
        const { data: success, error } = await supabase
          .rpc('mark_message_as_read', {
            p_message_id: message_id,
            p_user_id: user.id
          });

        if (error) {
          console.error("Error marking message as read:", error);
          return NextResponse.json({ error: "Failed to mark message as read" }, { status: 500 });
        }

        return NextResponse.json({ success });

      case 'archive':
        const { error: archiveError } = await supabase
          .from("client_messages")
          .update({ 
            status: 'archived',
            archived_at: new Date().toISOString()
          })
          .eq("id", message_id);

        if (archiveError) {
          console.error("Error archiving message:", archiveError);
          return NextResponse.json({ error: "Failed to archive message" }, { status: 500 });
        }

        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in PUT /api/messages:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 