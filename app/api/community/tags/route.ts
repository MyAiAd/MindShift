import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// GET /api/community/tags - List tags with optional filtering
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
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sort_by') || 'use_count';
    const sortOrder = searchParams.get('sort_order') || 'desc';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500); // Max 500 tags

    // Build query
    let query = supabase
      .from('community_tags')
      .select(`
        *,
        creator:profiles!created_by(id, first_name, last_name, email)
      `)
      .limit(limit);

    // Apply tenant filtering (RLS will also enforce this)
    if (profile.role !== 'super_admin') {
      query = query.eq('tenant_id', profile.tenant_id);
    }

    // Apply search filter
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    // Apply sorting
    const sortColumn = sortBy === 'name' ? 'name' :
                      sortBy === 'created_at' ? 'created_at' :
                      sortBy === 'updated_at' ? 'updated_at' : 'use_count';
    
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

    const { data: tags, error } = await query;

    if (error) {
      console.error('Error fetching tags:', error);
      return NextResponse.json(
        { error: 'Failed to fetch tags' },
        { status: 500 }
      );
    }

    console.log('GET tags - returning:', { count: tags?.length || 0 });
    return NextResponse.json({ tags: tags || [] });
  } catch (error) {
    console.error('Error in tags fetch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/community/tags - Create a new tag
export async function POST(request: NextRequest) {
  console.log('POST /api/community/tags - Request received');
  try {
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('User authenticated:', { userId: user?.id, hasError: !!authError });
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check role and tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    console.log('Profile fetched:', { 
      hasProfile: !!profile, 
      tenantId: profile?.tenant_id, 
      role: profile?.role 
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, color } = body;
    console.log('Request body:', { name, description, color });

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      );
    }

    // Validate tag name format (alphanumeric, spaces, hyphens, underscores)
    const tagName = name.trim().toLowerCase();
    if (!/^[a-z0-9\s\-_]+$/i.test(tagName)) {
      return NextResponse.json(
        { error: 'Tag name can only contain letters, numbers, spaces, hyphens, and underscores' },
        { status: 400 }
      );
    }

    if (tagName.length > 50) {
      return NextResponse.json(
        { error: 'Tag name must be 50 characters or less' },
        { status: 400 }
      );
    }

    // Validate color format if provided
    if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
      return NextResponse.json(
        { error: 'Color must be in hex format (#RRGGBB)' },
        { status: 400 }
      );
    }

    // Check if tag already exists in this tenant
    const { data: existingTag } = await supabase
      .from('community_tags')
      .select('id')
      .eq('tenant_id', profile.tenant_id)
      .eq('name', tagName)
      .single();

    if (existingTag) {
      return NextResponse.json(
        { error: 'A tag with this name already exists' },
        { status: 409 }
      );
    }

    // Create tag data
    const tagData = {
      tenant_id: profile.tenant_id,
      name: tagName,
      description: description?.trim() || null,
      color: color || null,
      created_by: user.id,
    };

    // Insert tag
    const { data: tag, error: insertError } = await supabase
      .from('community_tags')
      .insert(tagData)
      .select(`
        *,
        creator:profiles!created_by(id, first_name, last_name, email)
      `)
      .single();

    if (insertError) {
      console.error('Error creating tag:', insertError);
      console.error('Tag data attempted:', tagData);
      console.error('User profile:', profile);
      return NextResponse.json(
        { error: insertError.message || 'Failed to create tag', details: insertError },
        { status: 500 }
      );
    }

    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    console.error('Error in tag creation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 