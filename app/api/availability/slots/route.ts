import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET - Get available time slots for a coach on a specific date
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
    const coachId = searchParams.get('coachId');
    const date = searchParams.get('date'); // YYYY-MM-DD format
    const durationMinutes = parseInt(searchParams.get('duration') || '60');
    const timezone = searchParams.get('timezone') || 'UTC';

    // Validate required parameters
    if (!coachId) {
      return NextResponse.json({ 
        error: 'coachId parameter is required' 
      }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ 
        error: 'date parameter is required (YYYY-MM-DD format)' 
      }, { status: 400 });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json({ 
        error: 'Invalid date format. Use YYYY-MM-DD' 
      }, { status: 400 });
    }

    // Validate date is not in the past
    const requestedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (requestedDate < today) {
      return NextResponse.json({ 
        error: 'Cannot get slots for past dates' 
      }, { status: 400 });
    }

    // Validate duration
    if (isNaN(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) {
      return NextResponse.json({ 
        error: 'Duration must be between 15 and 480 minutes' 
      }, { status: 400 });
    }

    // Check permissions - users can view slots for coaches in their tenant
    if (profile.role !== 'super_admin') {
      const { data: coachProfile } = await supabase
        .from('profiles')
        .select('tenant_id, role')
        .eq('id', coachId)
        .single();

      if (!coachProfile) {
        return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
      }

      if (coachProfile.tenant_id !== profile.tenant_id) {
        return NextResponse.json({ error: 'Cannot view slots for coaches in other tenants' }, { status: 403 });
      }

      // Verify the coach has coaching permissions
      if (!['coach', 'manager', 'tenant_admin', 'super_admin'].includes(coachProfile.role)) {
        return NextResponse.json({ error: 'Selected user is not a coach' }, { status: 400 });
      }
    }

    // Use the database function to get available slots
    const { data: slotsData, error: slotsError } = await supabase
      .rpc('get_coach_available_slots', {
        p_coach_id: coachId,
        p_date: date,
        p_duration_minutes: durationMinutes,
        p_timezone: timezone
      });

    if (slotsError) {
      console.error('Error fetching available slots:', slotsError);
      return NextResponse.json(
        { error: 'Failed to fetch available slots' },
        { status: 500 }
      );
    }

    // Check if the function returned an error
    if (slotsData && !slotsData.success) {
      return NextResponse.json(
        { error: slotsData.message || 'Failed to get available slots' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      ...slotsData,
      duration_minutes: durationMinutes,
      timezone
    });

  } catch (error) {
    console.error('Error in slots GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 