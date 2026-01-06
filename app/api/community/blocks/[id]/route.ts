import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// DELETE /api/community/blocks/[id] - Unblock a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const blockedUserId = params.id;

    // Delete the block (RLS ensures user can only delete their own blocks)
    const { error: deleteError } = await supabase
      .from('community_blocks')
      .delete()
      .eq('blocker_id', user.id)
      .eq('blocked_id', blockedUserId);

    if (deleteError) {
      console.error('Error deleting block:', deleteError);
      return NextResponse.json(
        { error: 'Failed to unblock user' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/community/blocks/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

