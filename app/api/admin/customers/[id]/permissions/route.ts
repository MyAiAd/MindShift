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

// GET - Get customer permissions
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const authResult = await checkAdminPermissions(supabase);
    
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user, profile } = authResult;
    const customerId = params.id;

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

    // Get current feature access permissions
    const { data: featureAccess } = await supabase
      .from('feature_access')
      .select('feature_key, enabled')
      .eq('user_id', customerId);

    // Convert to object format for easier frontend handling
    const permissions: any = {};
    if (featureAccess) {
      featureAccess.forEach((access: any) => {
        permissions[access.feature_key] = access.enabled;
      });
    }

    // Add default permissions for features not explicitly set
    const defaultFeatures = [
      'goal_setting',
      'progress_tracking', 
      'treatment_sessions',
      'ai_assistance',
      'team_management',
      'advanced_analytics',
      'custom_treatments',
      'data_export'
    ];

    defaultFeatures.forEach(feature => {
      if (!(feature in permissions)) {
        permissions[feature] = false; // Default to disabled
      }
    });

    return NextResponse.json({ permissions });

  } catch (error) {
    console.error('Error fetching customer permissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update customer permissions
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const authResult = await checkAdminPermissions(supabase);
    
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user, profile } = authResult;
    const customerId = params.id;
    const body = await request.json();
    const { feature_key, enabled } = body;

    if (!feature_key || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
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

    // Update or insert feature access
    const { data: existingAccess } = await supabase
      .from('feature_access')
      .select('id')
      .eq('user_id', customerId)
      .eq('feature_key', feature_key)
      .single();

    if (existingAccess) {
      // Update existing access
      const { error } = await supabase
        .from('feature_access')
        .update({ 
          enabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAccess.id);

      if (error) {
        console.error('Error updating feature access:', error);
        return NextResponse.json({ error: 'Failed to update permissions' }, { status: 500 });
      }
    } else {
      // Insert new access record
      const { error } = await supabase
        .from('feature_access')
        .insert({
          user_id: customerId,
          feature_key,
          enabled,
          tenant_id: customer.tenant_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error inserting feature access:', error);
        return NextResponse.json({ error: 'Failed to update permissions' }, { status: 500 });
      }
    }

    // Log admin action
    await supabase.rpc('log_admin_action', {
      p_action: 'update_customer_permissions',
      p_resource_type: 'customer',
      p_resource_id: customerId,
      p_new_data: { feature_key, enabled }
    });

    return NextResponse.json({ 
      message: `Permission ${enabled ? 'granted' : 'revoked'} for ${feature_key}`,
      feature_key,
      enabled
    });

  } catch (error) {
    console.error('Error updating customer permissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 