import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// Helper function to check admin permissions
async function checkAdminPermissions(supabase: any) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return { error: 'Unauthorized', status: 401 };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single();

  if (!profile || !['tenant_admin', 'super_admin'].includes(profile.role)) {
    return { error: 'Insufficient permissions', status: 403 };
  }

  return { user, profile };
}

// GET - List customers with search, filter, pagination
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const authResult = await checkAdminPermissions(supabase);
    
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user, profile } = authResult;
    const { searchParams } = new URL(request.url);
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100); // Max 100 per page
    const offset = (page - 1) * limit;
    
    // Filter parameters
    const search = searchParams.get('search') || '';
    const subscriptionStatus = searchParams.get('subscription_status') || '';
    const subscriptionTier = searchParams.get('subscription_tier') || '';
    const tenantId = searchParams.get('tenant_id') || '';
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrder = searchParams.get('sort_order') || 'desc';

    // Build base query
    let query = supabase
      .from('profiles')
      .select(`
        id,
        email,
        first_name,
        last_name,
        role,
        subscription_tier,
        tenant_id,
        is_active,
        created_at,
        updated_at,
        tenants!tenant_id (
          id,
          name,
          slug
        ),
        user_subscriptions!user_id (
          id,
          status,
          current_tier,
          current_period_end,
          cancel_at_period_end,
          created_at,
          subscription_plans (
            name,
            tier,
            price_monthly
          )
        )
      `)
      .neq('role', 'super_admin'); // Don't show super admin in customer list

    // Apply tenant filtering for tenant admins
    if (profile.role === 'tenant_admin') {
      query = query.eq('tenant_id', profile.tenant_id);
    } else if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    // Apply search filter
    if (search) {
      query = query.or(`email.ilike.%${search}%, first_name.ilike.%${search}%, last_name.ilike.%${search}%`);
    }

    // Apply subscription filters
    if (subscriptionTier) {
      query = query.eq('subscription_tier', subscriptionTier);
    }

    // Build count query with same filters
    let countQuery = supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .neq('role', 'super_admin');

    // Apply same filters to count query
    if (profile.role === 'tenant_admin') {
      countQuery = countQuery.eq('tenant_id', profile.tenant_id);
    } else if (tenantId) {
      countQuery = countQuery.eq('tenant_id', tenantId);
    }

    if (search) {
      countQuery = countQuery.or(`email.ilike.%${search}%, first_name.ilike.%${search}%, last_name.ilike.%${search}%`);
    }

    if (subscriptionTier) {
      countQuery = countQuery.eq('subscription_tier', subscriptionTier);
    }

    // Get total count for pagination
    const { count } = await countQuery;

    // Apply sorting and pagination
    const { data: customers, error } = await query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching customers:', error);
      return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
    }

    // Log admin action
    await supabase.rpc('log_admin_action', {
      p_action: 'list_customers',
      p_resource_type: 'customers',
      p_resource_id: null,
      p_new_data: {
        filters: { search, subscriptionStatus, subscriptionTier, tenantId },
        pagination: { page, limit }
      }
    });

    return NextResponse.json({
      customers,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Error in customers API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create customer note or admin action
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const authResult = await checkAdminPermissions(supabase);
    
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user, profile } = authResult;
    const body = await request.json();
    const { action, customerId, ...actionData } = body;

    switch (action) {
      case 'create_note': {
        const { noteType, priority, title, content, isInternal, tags, followUpDate } = actionData;
        
        // Validate required fields
        if (!customerId || !title || !content) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Get customer to verify tenant access
        const { data: customer } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', customerId)
          .single();

        if (!customer) {
          return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        // Check tenant access for tenant admins
        if (profile.role === 'tenant_admin' && customer.tenant_id !== profile.tenant_id) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { data: note, error } = await supabase
          .from('customer_notes')
          .insert({
            tenant_id: customer.tenant_id,
            customer_user_id: customerId,
            admin_user_id: user.id,
            note_type: noteType || 'general',
            priority: priority || 'normal',
            title,
            content,
            is_internal: isInternal !== false, // Default to true
            tags: tags || [],
            follow_up_date: followUpDate
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating note:', error);
          return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
        }

        // Log admin action
        await supabase.rpc('log_admin_action', {
          p_action: 'create_customer_note',
          p_resource_type: 'customer_note',
          p_resource_id: note.id,
          p_new_data: { customerId, noteType, title }
        });

        return NextResponse.json({ note });
      }

      case 'add_note': {
        const { customer_id, content, priority, follow_up_date, note_type, tags } = actionData;
        
        if (!customer_id || !content) {
          return NextResponse.json({ error: 'Customer ID and content are required' }, { status: 400 });
        }

        // Get customer to verify tenant access
        const { data: customer } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', customer_id)
          .single();

        if (!customer) {
          return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        // Check tenant access for tenant admins
        if (profile.role === 'tenant_admin' && customer.tenant_id !== profile.tenant_id) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Add customer note
        const { error } = await supabase
          .from('customer_notes')
          .insert({
            customer_user_id: customer_id,
            admin_user_id: user.id,
            tenant_id: customer.tenant_id,
            note_type: note_type || 'note',
            priority: priority || 'medium',
            title: note_type === 'email' ? 'Email Communication' : 'Customer Note',
            content,
            is_internal: true,
            is_pinned: false,
            tags: tags || [],
            follow_up_date: follow_up_date ? new Date(follow_up_date).toISOString() : null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (error) {
          console.error('Error adding note:', error);
          return NextResponse.json({ error: 'Failed to add note' }, { status: 500 });
        }

        // Log admin action
        await supabase.rpc('log_admin_action', {
          p_action: 'add_customer_note',
          p_resource_type: 'customer',
          p_resource_id: customer_id,
          p_new_data: { content, priority, note_type }
        });

        return NextResponse.json({ message: 'Note added successfully' });
      }

      case 'resolve_note': {
        const { note_id } = actionData;
        
        if (!note_id) {
          return NextResponse.json({ error: 'Note ID is required' }, { status: 400 });
        }

        // Get note to verify access
        const { data: note } = await supabase
          .from('customer_notes')
          .select('tenant_id, customer_user_id')
          .eq('id', note_id)
          .single();

        if (!note) {
          return NextResponse.json({ error: 'Note not found' }, { status: 404 });
        }

        // Check tenant access for tenant admins
        if (profile.role === 'tenant_admin' && note.tenant_id !== profile.tenant_id) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Mark note as resolved
        const { error } = await supabase
          .from('customer_notes')
          .update({
            resolved_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', note_id);

        if (error) {
          console.error('Error resolving note:', error);
          return NextResponse.json({ error: 'Failed to resolve note' }, { status: 500 });
        }

        // Log admin action
        await supabase.rpc('log_admin_action', {
          p_action: 'resolve_customer_note',
          p_resource_type: 'customer',
          p_resource_id: note.customer_user_id,
          p_new_data: { note_id }
        });

        return NextResponse.json({ message: 'Note resolved successfully' });
      }

      case 'update_status': {
        const { isActive } = actionData;
        
        if (!customerId || typeof isActive !== 'boolean') {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Get customer to verify tenant access
        const { data: customer } = await supabase
          .from('profiles')
          .select('tenant_id, is_active')
          .eq('id', customerId)
          .single();

        if (!customer) {
          return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        // Check tenant access for tenant admins
        if (profile.role === 'tenant_admin' && customer.tenant_id !== profile.tenant_id) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { data: updatedCustomer, error } = await supabase
          .from('profiles')
          .update({ is_active: isActive })
          .eq('id', customerId)
          .select()
          .single();

        if (error) {
          console.error('Error updating customer status:', error);
          return NextResponse.json({ error: 'Failed to update customer status' }, { status: 500 });
        }

        // Log admin action
        await supabase.rpc('log_admin_action', {
          p_action: 'update_customer_status',
          p_resource_type: 'customer',
          p_resource_id: customerId,
          p_old_data: { is_active: customer.is_active },
          p_new_data: { is_active: isActive }
        });

        return NextResponse.json({ customer: updatedCustomer });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in customers POST API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 