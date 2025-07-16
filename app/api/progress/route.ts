import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import { ProgressEntryInsert, ProgressEntryUpdate } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    console.log('API: Creating server client for progress entry creation');
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
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
    const { goalId, entryDate, moodScore, energyLevel, confidenceLevel, notes } = body;

    // Validate required fields
    if (!goalId || !entryDate) {
      return NextResponse.json(
        { error: 'Missing required fields: goalId, entryDate' },
        { status: 400 }
      );
    }

    // Verify the goal belongs to the user (or user is super admin)
    const { data: goal } = await supabase
      .from('goals')
      .select('*')
      .eq('id', goalId)
      .single();

    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    if (profile.role !== 'super_admin' && goal.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create progress entry
    const progressData: ProgressEntryInsert = {
      tenant_id: profile.tenant_id,
      user_id: goal.user_id, // Use goal's user_id to allow super admin to create for others
      goal_id: goalId,
      entry_date: entryDate,
      mood_score: moodScore || null,
      energy_level: energyLevel || null,
      confidence_level: confidenceLevel || null,
      notes: notes || null,
    };

    const { data: progressEntry, error: insertError } = await supabase
      .from('progress_entries')
      .insert(progressData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating progress entry:', insertError);
      return NextResponse.json(
        { error: 'Failed to create progress entry' },
        { status: 500 }
      );
    }

    return NextResponse.json({ progressEntry }, { status: 201 });
  } catch (error) {
    console.error('Error in progress entry creation:', error);
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

    const { searchParams } = new URL(request.url);
    const goalId = searchParams.get('goalId');
    const limit = searchParams.get('limit') || '50';

    // Build query for progress entries with goal details
    let query = supabase
      .from('progress_entries')
      .select(`
        *,
        goals (
          id,
          title,
          description,
          status,
          progress
        )
      `)
      .order('entry_date', { ascending: false })
      .limit(parseInt(limit));

    // Super admins can see all entries, others only their own
    if (profile.role !== 'super_admin') {
      query = query.eq('user_id', user.id);
    }

    // Filter by goal if specified
    if (goalId) {
      query = query.eq('goal_id', goalId);
    }

    const { data: progressEntries, error } = await query;

    if (error) {
      console.error('Error fetching progress entries:', error);
      return NextResponse.json(
        { error: 'Failed to fetch progress entries' },
        { status: 500 }
      );
    }

    return NextResponse.json({ progressEntries });
  } catch (error) {
    console.error('Error in progress entry fetch:', error);
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
    const { id, moodScore, energyLevel, confidenceLevel, notes } = body;

    // Validate required fields
    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: ProgressEntryUpdate = {
      mood_score: moodScore || null,
      energy_level: energyLevel || null,
      confidence_level: confidenceLevel || null,
      notes: notes || null,
    };

    // Update progress entry (RLS will ensure only user's own entries or super admin can update)
    const { data: progressEntry, error: updateError } = await supabase
      .from('progress_entries')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating progress entry:', updateError);
      return NextResponse.json(
        { error: 'Failed to update progress entry' },
        { status: 500 }
      );
    }

    return NextResponse.json({ progressEntry });
  } catch (error) {
    console.error('Error in progress entry update:', error);
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required parameter: id' },
        { status: 400 }
      );
    }

    // Delete progress entry (RLS will ensure only user's own entries or super admin can delete)
    const { error: deleteError } = await supabase
      .from('progress_entries')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting progress entry:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete progress entry' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Progress entry deleted successfully' });
  } catch (error) {
    console.error('Error in progress entry deletion:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 