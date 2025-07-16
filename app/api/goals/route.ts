import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import { GoalInsert, GoalUpdate } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    console.log('API: Creating server client for goal creation');
    const supabase = createServerClient();
    
    // Get the current user
    console.log('API: Getting user from server client');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('API: Auth result - user:', !!user, 'error:', authError?.message);
    if (user) {
      console.log('API: User details:', { id: user.id, email: user.email });
    }
    
    if (authError || !user) {
      console.log('API: Returning 401 - no user or auth error');
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
    const { title, description, startDate, targetDate } = body;

    // Validate required fields
    if (!title) {
      return NextResponse.json(
        { error: 'Missing required field: title' },
        { status: 400 }
      );
    }

    // Map frontend fields to database fields
    const goalData: GoalInsert = {
      tenant_id: profile.tenant_id,
      user_id: user.id,
      title,
      description: description || null,
      target_date: targetDate || null,
      status: 'not_started',
      progress: 0,
    };

    // Insert goal
    const { data: goal, error: insertError } = await supabase
      .from('goals')
      .insert(goalData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating goal:', insertError);
      return NextResponse.json(
        { error: 'Failed to create goal' },
        { status: 500 }
      );
    }

    return NextResponse.json({ goal }, { status: 201 });
  } catch (error) {
    console.error('Error in goal creation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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

    // Super admins can see all goals, others only their own
    let query = supabase.from('goals').select('*');
    
    if (profile.role !== 'super_admin') {
      query = query.eq('user_id', user.id);
    }

    const { data: goals, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching goals:', error);
      return NextResponse.json(
        { error: 'Failed to fetch goals' },
        { status: 500 }
      );
    }

    return NextResponse.json({ goals });
  } catch (error) {
    console.error('Error in goal fetch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
    const { id, title, description, status, progress, targetDate } = body;

    // Validate required fields
    if (!id || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: id, title' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: GoalUpdate = {
      title,
      description: description || null,
      status: status || 'not_started',
      progress: progress || 0,
      target_date: targetDate || null,
    };

    // Update goal (RLS will ensure only user's own goals or super admin can update)
    const { data: goal, error: updateError } = await supabase
      .from('goals')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating goal:', updateError);
      return NextResponse.json(
        { error: 'Failed to update goal' },
        { status: 500 }
      );
    }

    return NextResponse.json({ goal });
  } catch (error) {
    console.error('Error in goal update:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required parameter: id' },
        { status: 400 }
      );
    }

    // Delete goal (RLS will ensure only user's own goals or super admin can delete)
    const { error: deleteError } = await supabase
      .from('goals')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting goal:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete goal' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    console.error('Error in goal deletion:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 