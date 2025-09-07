import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    // Build query for available coaches
    let query = supabase
      .from('profiles')
      .select('id, first_name, last_name, email, role, settings')
      .in('role', ['coach', 'manager', 'tenant_admin'])
      .eq('is_active', true)
      .order('first_name', { ascending: true });

    // Apply tenant filtering (users can only book coaches from their tenant unless super admin)
    if (profile.role !== 'super_admin') {
      query = query.eq('tenant_id', profile.tenant_id);
    }

    const { data: coaches, error } = await query;

    if (error) {
      console.error('Error fetching coaches:', error);
      return NextResponse.json(
        { error: 'Failed to fetch coaches' },
        { status: 500 }
      );
    }

    return NextResponse.json({ coaches });
  } catch (error) {
    console.error('Error in coaches fetch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 