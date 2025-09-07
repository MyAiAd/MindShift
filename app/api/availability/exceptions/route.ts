import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST - Add availability exception
export async function POST(request: NextRequest) {
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
      exceptionDate,
      startTime = null,
      endTime = null,
      isAvailable = false,
      reason = null,
      allDay = false
    } = body;

    // Validate required fields
    if (!exceptionDate) {
      return NextResponse.json({ 
        error: 'exceptionDate is required (YYYY-MM-DD format)' 
      }, { status: 400 });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(exceptionDate)) {
      return NextResponse.json({ 
        error: 'Invalid date format. Use YYYY-MM-DD' 
      }, { status: 400 });
    }

    // Validate that if not all day, both start and end times are provided
    if (!allDay && (!startTime || !endTime)) {
      return NextResponse.json({ 
        error: 'startTime and endTime are required when allDay is false' 
      }, { status: 400 });
    }

    // Validate time format if provided
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (startTime && !timeRegex.test(startTime)) {
      return NextResponse.json({ 
        error: 'Invalid startTime format. Use HH:MM format' 
      }, { status: 400 });
    }

    if (endTime && !timeRegex.test(endTime)) {
      return NextResponse.json({ 
        error: 'Invalid endTime format. Use HH:MM format' 
      }, { status: 400 });
    }

    // Check that end time is after start time
    if (startTime && endTime && startTime >= endTime) {
      return NextResponse.json({ 
        error: 'End time must be after start time' 
      }, { status: 400 });
    }

    // Check permissions
    if (profile.role !== 'super_admin' && coachId !== user.id) {
      if (profile.role !== 'tenant_admin') {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
      
      // Tenant admins can only manage exceptions for coaches in their tenant
      const { data: coachProfile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', coachId)
        .single();

      if (!coachProfile || coachProfile.tenant_id !== profile.tenant_id) {
        return NextResponse.json({ error: 'Coach not found or access denied' }, { status: 403 });
      }
    }

    // Use the database function to add exception
    const { data: result, error: exceptionError } = await supabase
      .rpc('add_availability_exception', {
        p_coach_id: coachId,
        p_exception_date: exceptionDate,
        p_start_time: startTime,
        p_end_time: endTime,
        p_is_available: isAvailable,
        p_reason: reason,
        p_all_day: allDay
      });

    if (exceptionError) {
      console.error('Error adding availability exception:', exceptionError);
      return NextResponse.json(
        { error: 'Failed to add availability exception' },
        { status: 500 }
      );
    }

    // Check if the function returned an error
    if (result && !result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to add availability exception' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      exception_id: result.exception_id,
      message: result.message || 'Availability exception added successfully'
    });

  } catch (error) {
    console.error('Error in exceptions POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Remove availability exception
export async function DELETE(request: NextRequest) {
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
    const exceptionId = searchParams.get('id');

    if (!exceptionId) {
      return NextResponse.json({ 
        error: 'Exception ID is required' 
      }, { status: 400 });
    }

    // Get the exception to check permissions
    const { data: exception, error: fetchError } = await supabase
      .from('coach_availability_exceptions')
      .select('coach_id, tenant_id')
      .eq('id', exceptionId)
      .single();

    if (fetchError || !exception) {
      return NextResponse.json({ error: 'Exception not found' }, { status: 404 });
    }

    // Check permissions
    if (profile.role !== 'super_admin' && exception.coach_id !== user.id) {
      if (profile.role !== 'tenant_admin' || exception.tenant_id !== profile.tenant_id) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }

    // Delete the exception
    const { error: deleteError } = await supabase
      .from('coach_availability_exceptions')
      .delete()
      .eq('id', exceptionId);

    if (deleteError) {
      console.error('Error deleting availability exception:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete availability exception' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Availability exception deleted successfully'
    });

  } catch (error) {
    console.error('Error in exceptions DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 