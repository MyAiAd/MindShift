import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/tutorials/categories - Fetch all categories for the user's tenant
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check tenant
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Fetch categories
    const { data: categories, error: categoriesError } = await supabase
      .from('tutorial_categories')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .order('display_order');

    if (categoriesError) {
      throw categoriesError;
    }

    return NextResponse.json({ categories }, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching tutorial categories:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tutorial categories' },
      { status: 500 }
    );
  }
}

// POST /api/tutorials/categories - Create a new category (admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if user is admin
    if (!['tenant_admin', 'manager', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, display_order, icon, color } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      );
    }

    // Create category
    const { data: category, error: categoryError } = await supabase
      .from('tutorial_categories')
      .insert({
        tenant_id: profile.tenant_id,
        name,
        description,
        display_order: display_order || 0,
        icon,
        color
      })
      .select()
      .single();

    if (categoryError) {
      throw categoryError;
    }

    return NextResponse.json({ category }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating tutorial category:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create tutorial category' },
      { status: 500 }
    );
  }
}
