import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET - Fetch current coach profile settings
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
      .select('id, first_name, last_name, email, role, settings, tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if user has coach permissions
    if (!['coach', 'manager', 'tenant_admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Coach permissions required' }, { status: 403 });
    }

    // Extract coach-specific settings
    const settings = profile.settings || {};
    const coachProfile = {
      id: profile.id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      email: profile.email,
      role: profile.role,
      specialties: settings.specialties || [],
      preferredMeetingTypes: settings.preferred_meeting_types || [],
      bio: settings.bio || '',
      credentials: settings.credentials || '',
      availabilityNotes: settings.availability_notes || ''
    };

    return NextResponse.json({ profile: coachProfile });
  } catch (error) {
    console.error('Error fetching coach profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update coach profile settings
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to verify permissions
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if user has coach permissions
    if (!['coach', 'manager', 'tenant_admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Coach permissions required' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      specialties, 
      preferredMeetingTypes, 
      bio, 
      credentials, 
      availabilityNotes 
    } = body;

    // Validate specialties if provided
    const validSpecialties = [
      'Goal Setting',
      'Confidence Building',
      'Stress Management',
      'Career Development',
      'Relationship Coaching',
      'Performance Coaching',
      'Life Transition Support',
      'Mindfulness Training',
      'General Coaching',
      'Custom Session'
    ];

    if (specialties && Array.isArray(specialties)) {
      const invalidSpecialties = specialties.filter(s => !validSpecialties.includes(s));
      if (invalidSpecialties.length > 0) {
        return NextResponse.json({ 
          error: `Invalid specialties: ${invalidSpecialties.join(', ')}` 
        }, { status: 400 });
      }
    }

    // Validate meeting types if provided
    const validMeetingTypes = ['video', 'phone', 'zoom', 'google_meet', 'teams', 'in_person'];
    
    if (preferredMeetingTypes && Array.isArray(preferredMeetingTypes)) {
      const invalidMeetingTypes = preferredMeetingTypes.filter(t => !validMeetingTypes.includes(t));
      if (invalidMeetingTypes.length > 0) {
        return NextResponse.json({ 
          error: `Invalid meeting types: ${invalidMeetingTypes.join(', ')}` 
        }, { status: 400 });
      }
    }

    // Use the database function to update coach profile
    const { data: result, error: updateError } = await supabase
      .rpc('update_coach_profile', {
        coach_specialties: specialties || null,
        coach_bio: bio !== undefined ? bio : null,
        coach_meeting_types: preferredMeetingTypes || null,
        coach_credentials: credentials !== undefined ? credentials : null,
        coach_availability_notes: availabilityNotes !== undefined ? availabilityNotes : null
      });

    if (updateError) {
      console.error('Error updating coach profile:', updateError);
      return NextResponse.json(
        { error: 'Failed to update coach profile' },
        { status: 500 }
      );
    }

    // Check if the function returned an error
    if (result && !result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Fetch updated profile to return
    const { data: updatedProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, role, settings')
      .eq('id', user.id)
      .single();

    if (fetchError) {
      console.error('Error fetching updated profile:', fetchError);
      return NextResponse.json(
        { error: 'Profile updated but failed to fetch updated data' },
        { status: 500 }
      );
    }

    // Format response
    const settings = updatedProfile.settings || {};
    const coachProfile = {
      id: updatedProfile.id,
      firstName: updatedProfile.first_name,
      lastName: updatedProfile.last_name,
      email: updatedProfile.email,
      role: updatedProfile.role,
      specialties: settings.specialties || [],
      preferredMeetingTypes: settings.preferred_meeting_types || [],
      bio: settings.bio || '',
      credentials: settings.credentials || '',
      availabilityNotes: settings.availability_notes || ''
    };

    return NextResponse.json({ 
      profile: coachProfile,
      message: 'Coach profile updated successfully'
    });
  } catch (error) {
    console.error('Error in coach profile update:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 