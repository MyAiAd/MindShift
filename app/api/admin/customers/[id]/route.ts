import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// Helper function to get action description
function getActionDescription(action: string, oldData: any, newData: any): string {
  switch (action) {
    case 'view_customer_details':
      return 'Viewed customer details';
    case 'update_customer':
      return 'Updated customer information';
    case 'add_note':
      return 'Added customer note';
    case 'extend_trial':
      return 'Extended trial period';
    case 'pause_subscription':
      return 'Paused subscription';
    case 'reactivate_subscription':
      return 'Reactivated subscription';
    case 'manual_status_change':
      return 'Manually changed subscription status';
    default:
      return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}

// Helper function to get action details
function getActionDetails(action: string, oldData: any, newData: any): string {
  if (!oldData && !newData) return '';
  
  switch (action) {
    case 'update_customer':
      const changes = [];
      if (oldData && newData) {
        if (oldData.first_name !== newData.first_name) {
          changes.push(`Name: ${oldData.first_name} → ${newData.first_name}`);
        }
        if (oldData.email !== newData.email) {
          changes.push(`Email: ${oldData.email} → ${newData.email}`);
        }
        if (oldData.is_active !== newData.is_active) {
          changes.push(`Status: ${oldData.is_active ? 'Active' : 'Inactive'} → ${newData.is_active ? 'Active' : 'Inactive'}`);
        }
      }
      return changes.join(', ');
    case 'extend_trial':
      return newData?.trial_days ? `Extended by ${newData.trial_days} days` : '';
    case 'manual_status_change':
      return newData?.new_status ? `Changed to: ${newData.new_status}` : '';
    default:
      return JSON.stringify(newData || oldData, null, 2);
  }
}

// Helper function to check admin permissions (reused from parent)
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

// GET - Get individual customer details
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
    const { searchParams } = new URL(request.url);
    const includeLogs = searchParams.get('include_logs') === 'true';

    // Get customer details
    const { data: customer, error: customerError } = await supabase
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
          slug,
          status
        )
      `)
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Check tenant access for tenant admins
    if (profile.role === 'tenant_admin' && customer.tenant_id !== profile.tenant_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get subscription details
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select(`
        id,
        status,
        current_tier,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        cancelled_at,
        trial_ends_at,
        stripe_subscription_id,
        stripe_customer_id,
        created_at,
        updated_at,
        subscription_plans (
          id,
          name,
          tier,
          description,
          price_monthly,
          price_yearly,
          features,
          limits
        )
      `)
      .eq('user_id', customerId)
      .single();

    // Get subscription history
    const { data: subscriptionHistory } = await supabase
      .from('subscription_changes')
      .select(`
        id,
        change_type,
        change_reason,
        from_tier,
        to_tier,
        amount_change_cents,
        effective_date,
        notes,
        created_at,
        admin_user_id,
        subscription_plans!from_plan_id (
          name,
          tier
        ),
        to_plan:subscription_plans!to_plan_id (
          name,
          tier
        )
      `)
      .eq('user_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Get customer notes
    const { data: notes } = await supabase
      .from('customer_notes')
      .select(`
        id,
        note_type,
        priority,
        title,
        content,
        is_internal,
        is_pinned,
        tags,
        follow_up_date,
        resolved_at,
        created_at,
        updated_at,
        admin_profiles:profiles!admin_user_id (
          first_name,
          last_name,
          email
        )
      `)
      .eq('customer_user_id', customerId)
      .order('created_at', { ascending: false })
      .limit(50);

    // Get billing information
    const { data: billingInfo } = await supabase
      .from('customer_billing_info')
      .select('*')
      .eq('user_id', customerId)
      .eq('is_active', true)
      .single();

    // Get recent payment transactions
    const { data: transactions } = await supabase
      .from('payment_transactions')
      .select(`
        id,
        transaction_type,
        status,
        amount_cents,
        currency_code,
        description,
        payment_method_type,
        payment_method_last4,
        processor,
        processed_at,
        created_at
      `)
      .eq('user_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Get customer analytics
    const { data: analytics } = await supabase
      .rpc('get_customer_analytics', {
        p_tenant_id: customer.tenant_id,
        p_days: 90
      });

    // Get admin logs if requested
    let adminLogs: any[] = [];
    if (includeLogs) {
      const { data: logs } = await supabase
        .from('audit_logs')
        .select(`
          id,
          action,
          resource_type,
          resource_id,
          old_data,
          new_data,
          created_at,
          admin_profiles:profiles!admin_user_id (
            first_name,
            last_name,
            email
          )
        `)
        .eq('resource_type', 'customer')
        .eq('resource_id', customerId)
        .order('created_at', { ascending: false })
        .limit(50);

      adminLogs = logs ? logs.map(log => ({
        ...log,
        description: getActionDescription(log.action, log.old_data, log.new_data),
        performed_by: log.admin_profiles && Array.isArray(log.admin_profiles) && log.admin_profiles[0]
          ? `${log.admin_profiles[0].first_name} ${log.admin_profiles[0].last_name}` 
          : 'System',
        details: getActionDetails(log.action, log.old_data, log.new_data)
      })) : [];
    }

    // Log admin action
    await supabase.rpc('log_admin_action', {
      p_action: 'view_customer_details',
      p_resource_type: 'customer',
      p_resource_id: customerId,
      p_new_data: { viewed_sections: ['profile', 'subscription', 'billing', 'notes'] }
    });

    return NextResponse.json({
      customer,
      subscription,
      subscriptionHistory: subscriptionHistory || [],
      notes: notes || [],
      billingInfo,
      transactions: transactions || [],
      analytics: analytics?.[0] || null,
      admin_logs: adminLogs
    });

  } catch (error) {
    console.error('Error fetching customer details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update customer details
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

    // Get customer to verify tenant access
    const { data: customer } = await supabase
      .from('profiles')
      .select('tenant_id, first_name, last_name, email, is_active')
      .eq('id', customerId)
      .single();

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Check tenant access for tenant admins
    if (profile.role === 'tenant_admin' && customer.tenant_id !== profile.tenant_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { first_name, last_name, email, is_active } = body;
    const updateData: any = {};

    // Only update provided fields
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (email !== undefined) updateData.email = email;
    if (is_active !== undefined) updateData.is_active = is_active;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data: updatedCustomer, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', customerId)
      .select()
      .single();

    if (error) {
      console.error('Error updating customer:', error);
      return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
    }

    // Log admin action
    await supabase.rpc('log_admin_action', {
      p_action: 'update_customer',
      p_resource_type: 'customer',
      p_resource_id: customerId,
      p_old_data: customer,
      p_new_data: updateData
    });

    return NextResponse.json({ customer: updatedCustomer });

  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 