import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/database-server";

// Types
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, any>;
  subscription_tier: string;
  status: 'active' | 'inactive' | 'suspended' | 'trial';
  created_at: string;
  updated_at: string;
  customer_count?: number;
  active_subscriptions?: number;
  monthly_revenue?: number;
}

// Helper function to check admin permissions
async function checkAdminPermissions(supabase: any) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return { error: 'Authentication required', status: 401 };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { error: 'Profile not found', status: 404 };
  }

  if (profile.role !== 'super_admin') {
    return { error: 'Super admin access required', status: 403 };
  }

  return { user, profile };
}

// GET /api/admin/tenants - Get all tenants (super admin only)
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const authResult = await checkAdminPermissions(supabase);
    
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get('include_stats') === 'true';

    // Get all tenants
    let query = supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: tenants, error } = await query;

    if (error) {
      console.error('Error fetching tenants:', error);
      return NextResponse.json({ error: 'Failed to fetch tenants' }, { status: 500 });
    }

    // If stats are requested, add additional data
    if (includeStats && tenants) {
      const tenantsWithStats = await Promise.all(
        tenants.map(async (tenant: any) => {
          // Get customer count
          const { count: customerCount } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id)
            .neq('role', 'super_admin');

          // Get active subscriptions count
          const { count: activeSubscriptions } = await supabase
            .from('user_subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id)
            .eq('status', 'active');

          // Get monthly revenue (approximate)
          const { data: revenueData } = await supabase
            .from('user_subscriptions')
            .select(`
              subscription_plans(price_monthly)
            `)
            .eq('tenant_id', tenant.id)
            .eq('status', 'active');

          const monthlyRevenue = revenueData?.reduce((sum: number, sub: any) => {
            return sum + (sub.subscription_plans?.price_monthly || 0);
          }, 0) || 0;

          return {
            ...tenant,
            customer_count: customerCount || 0,
            active_subscriptions: activeSubscriptions || 0,
            monthly_revenue: monthlyRevenue
          };
        })
      );

      return NextResponse.json({ tenants: tenantsWithStats });
    }

    return NextResponse.json({ tenants });

  } catch (error) {
    console.error('Error in tenants API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/tenants - Create new tenant (super admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const authResult = await checkAdminPermissions(supabase);
    
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;
    const body = await request.json();
    const { name, slug, settings = {}, subscription_tier = 'trial' } = body;

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    // Check if slug already exists
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existingTenant) {
      return NextResponse.json({ error: 'Tenant with this slug already exists' }, { status: 409 });
    }

    // Create tenant
    const { data: tenant, error } = await supabase
      .from('tenants')
      .insert({
        name,
        slug,
        settings,
        subscription_tier,
        status: 'trial',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating tenant:', error);
      return NextResponse.json({ error: 'Failed to create tenant' }, { status: 500 });
    }

    // Log admin action
    await supabase.rpc('log_admin_action', {
      p_action: 'create_tenant',
      p_resource_type: 'tenant',
      p_resource_id: tenant.id,
      p_new_data: { name, slug, subscription_tier }
    });

    return NextResponse.json({ tenant }, { status: 201 });

  } catch (error) {
    console.error('Error in tenant creation API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/tenants - Update tenant (super admin only)
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const authResult = await checkAdminPermissions(supabase);
    
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;
    const body = await request.json();
    const { id, name, slug, settings, subscription_tier, status } = body;

    if (!id) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (settings !== undefined) updateData.settings = settings;
    if (subscription_tier !== undefined) updateData.subscription_tier = subscription_tier;
    if (status !== undefined) updateData.status = status;

    // Update tenant
    const { data: tenant, error } = await supabase
      .from('tenants')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating tenant:', error);
      return NextResponse.json({ error: 'Failed to update tenant' }, { status: 500 });
    }

    // Log admin action
    await supabase.rpc('log_admin_action', {
      p_action: 'update_tenant',
      p_resource_type: 'tenant',
      p_resource_id: id,
      p_new_data: updateData
    });

    return NextResponse.json({ tenant });

  } catch (error) {
    console.error('Error in tenant update API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/tenants - Delete tenant (super admin only)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const authResult = await checkAdminPermissions(supabase);
    
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    // Check if tenant has customers
    const { count: customerCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', id)
      .neq('role', 'super_admin');

    if (customerCount && customerCount > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete tenant with existing customers. Please migrate or delete customers first.' 
      }, { status: 409 });
    }

    // Delete tenant
    const { error } = await supabase
      .from('tenants')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting tenant:', error);
      return NextResponse.json({ error: 'Failed to delete tenant' }, { status: 500 });
    }

    // Log admin action
    await supabase.rpc('log_admin_action', {
      p_action: 'delete_tenant',
      p_resource_type: 'tenant',
      p_resource_id: id,
      p_new_data: {}
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in tenant deletion API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 