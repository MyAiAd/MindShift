import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET - Fetch coach availability
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId') || user.id; // Default to current user

    // Check permissions
    if (profile.role !== 'super_admin' && coachId !== user.id) {
      // Non-super-admin users can only view their own availability or coaches in their tenant
      const { data: coachProfile } = await supabase
        .from('profiles')
        .select('tenant_id, role')
        .eq('id', coachId)
        .single();

      if (!coachProfile || (profile.role !== 'tenant_admin' && coachProfile.tenant_id !== profile.tenant_id)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Use the database function to get availability
    const { data: availabilityData, error: availabilityError } = await supabase
      .rpc('get_coach_availability', {
        p_coach_id: coachId
      });

    if (availabilityError) {
      console.error('Error fetching availability:', availabilityError);
      return NextResponse.json(
        { 
          error: 'Failed to fetch availability',
          details: availabilityError.message,
          code: availabilityError.code,
          hint: availabilityError.hint
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      availability: availabilityData || { weekly_schedule: [], exceptions: [] },
      coachId
    });

  } catch (error) {
    console.error('Error in availability GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update coach availability
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { 
      coachId = user.id,
      weeklySchedule = [],
      timezone = 'UTC'
    } = body;

    // Validate required fields
    if (!Array.isArray(weeklySchedule)) {
      return NextResponse.json({ 
        error: 'Weekly schedule must be an array' 
      }, { status: 400 });
    }

    // Check permissions
    if (profile.role !== 'super_admin' && coachId !== user.id) {
      if (profile.role !== 'tenant_admin') {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
      
      // Tenant admins can only update coaches in their tenant
      const { data: coachProfile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', coachId)
        .single();

      if (!coachProfile || coachProfile.tenant_id !== profile.tenant_id) {
        return NextResponse.json({ error: 'Coach not found or access denied' }, { status: 403 });
      }
    }

    // Validate weekly schedule format
    for (const slot of weeklySchedule) {
      if (!slot.hasOwnProperty('day_of_week') || 
          !slot.hasOwnProperty('start_time') || 
          !slot.hasOwnProperty('end_time')) {
        return NextResponse.json({ 
          error: 'Invalid schedule format. Each slot must have day_of_week, start_time, and end_time' 
        }, { status: 400 });
      }

      const dayOfWeek = parseInt(slot.day_of_week);
      if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        return NextResponse.json({ 
          error: 'day_of_week must be between 0 (Sunday) and 6 (Saturday)' 
        }, { status: 400 });
      }

      // Validate time format (basic check)
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(slot.start_time) || !timeRegex.test(slot.end_time)) {
        return NextResponse.json({ 
          error: 'Invalid time format. Use HH:MM format' 
        }, { status: 400 });
      }

      // Check that end time is after start time
      if (slot.start_time >= slot.end_time) {
        return NextResponse.json({ 
          error: 'End time must be after start time' 
        }, { status: 400 });
      }
    }

    // Use the database function to update availability
    const { data: result, error: updateError } = await supabase
      .rpc('update_coach_availability', {
        p_coach_id: coachId,
        p_weekly_schedule: weeklySchedule,
        p_timezone: timezone
      });

    if (updateError) {
      console.error('Error updating availability:', updateError);
      return NextResponse.json(
        { error: 'Failed to update availability' },
        { status: 500 }
      );
    }

    // Check if the function returned an error
    if (result && !result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update availability' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Availability updated successfully',
      coachId
    });

  } catch (error) {
    console.error('Error in availability PUT:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 