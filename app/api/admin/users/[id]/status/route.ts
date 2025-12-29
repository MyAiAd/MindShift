import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user profile and check admin role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    if (!['tenant_admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const userId = params.id;
    const body = await request.json();
    const isActive = body.is_active;

    // Validate status
    if (typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid status - must be boolean' },
        { status: 400 }
      );
    }

    // Get target user
    const { data: targetUser, error: targetUserError } = await supabase
      .from('profiles')
      .select('is_active, tenant_id, role')
      .eq('id', userId)
      .single();

    if (targetUserError || !targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check tenant access
    if (profile.role !== 'super_admin' && targetUser.tenant_id !== profile.tenant_id) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot modify users from other tenants' },
        { status: 403 }
      );
    }

    // Prevent users from deactivating themselves
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'Cannot change your own status' },
        { status: 400 }
      );
    }

    // Prevent tenant_admins from deactivating super_admins
    if (targetUser.role === 'super_admin' && profile.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Forbidden - Cannot modify super admin status' },
        { status: 403 }
      );
    }

    // Update user status
    const { data: updatedUser, error: updateError } = await supabase
      .from('profiles')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating user status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update user status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
    });

  } catch (error) {
    console.error('Error in change status API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
