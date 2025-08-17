import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('DEBUG: Current user ID:', user.id);

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    console.log('DEBUG: User profile:', profile);
    console.log('DEBUG: Profile error:', profileError);

    // Check if treatment_sessions table exists and has data
    const { data: allTreatmentSessions, error: allTreatmentError } = await supabase
      .from('treatment_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    console.log('DEBUG: All treatment sessions:', allTreatmentSessions);
    console.log('DEBUG: All treatment sessions error:', allTreatmentError);

    // Check treatment sessions for current user
    const { data: userTreatmentSessions, error: userTreatmentError } = await supabase
      .from('treatment_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    console.log('DEBUG: User treatment sessions:', userTreatmentSessions);
    console.log('DEBUG: User treatment sessions error:', userTreatmentError);

    // Try the original query with join
    const { data: treatmentSessionsWithProfiles, error: joinError } = await supabase
      .from('treatment_sessions')
      .select(`
        *,
        profiles!treatment_sessions_user_id_fkey(id, first_name, last_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('DEBUG: Treatment sessions with profiles (original query):', treatmentSessionsWithProfiles);
    console.log('DEBUG: Join error:', joinError);

    // Try the new approach: fetch separately then combine
    const { data: sessionsForNewApproach, error: newApproachError } = await supabase
      .from('treatment_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3);

    let sessionsWithManualJoin = [];
    if (sessionsForNewApproach && sessionsForNewApproach.length > 0) {
      sessionsWithManualJoin = await Promise.all(
        sessionsForNewApproach.map(async (session) => {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email')
            .eq('id', session.user_id)
            .single();

          return {
            ...session,
            profiles: profileData || { id: session.user_id, first_name: 'Unknown', last_name: 'User', email: 'unknown@example.com' },
            profileFetchError: profileError
          };
        })
      );
    }

    console.log('DEBUG: Treatment sessions with manual profile fetch:', sessionsWithManualJoin);

    return NextResponse.json({
      debug: {
        userId: user.id,
        profile,
        profileError,
        allTreatmentSessions: allTreatmentSessions?.length || 0,
        allTreatmentError,
        userTreatmentSessions: userTreatmentSessions?.length || 0,
        userTreatmentError,
        treatmentSessionsWithProfiles: treatmentSessionsWithProfiles?.length || 0,
        joinError,
        sessionsWithManualJoin: sessionsWithManualJoin?.length || 0,
        newApproachError,
        latestSession: allTreatmentSessions?.[0] || null
      }
    });
  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json(
      { error: 'Debug API failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 