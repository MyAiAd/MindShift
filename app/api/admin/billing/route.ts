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

// GET - Get billing data (transactions, analytics, etc.)
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const authResult = await checkAdminPermissions(supabase);
    
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user, profile } = authResult;
    const { searchParams } = new URL(request.url);
    
    const dataType = searchParams.get('type') || 'transactions';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100);
    const offset = (page - 1) * limit;
    
    // Filter parameters
    const customerId = searchParams.get('customer_id') || '';
    const status = searchParams.get('status') || '';
    const transactionType = searchParams.get('transaction_type') || '';
    const processor = searchParams.get('processor') || '';
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';
    const tenantId = searchParams.get('tenant_id') || '';

    switch (dataType) {
      case 'transactions': {
        // Build transaction query
        let query = supabase
          .from('payment_transactions')
          .select(`
            id,
            user_id,
            subscription_id,
            external_transaction_id,
            transaction_type,
            status,
            amount_cents,
            currency_code,
            description,
            payment_method_type,
            payment_method_last4,
            processor,
            processor_fee_cents,
            net_amount_cents,
            processed_at,
            created_at,
            profiles!user_id (
              first_name,
              last_name,
              email
            ),
            user_subscriptions!subscription_id (
              subscription_plans (
                name,
                tier
              )
            )
          `);

        // Apply tenant filtering
        if (profile.role === 'tenant_admin') {
          query = query.eq('tenant_id', profile.tenant_id);
        } else if (tenantId) {
          query = query.eq('tenant_id', tenantId);
        }

        // Apply filters
        if (customerId) query = query.eq('user_id', customerId);
        if (status) query = query.eq('status', status);
        if (transactionType) query = query.eq('transaction_type', transactionType);
        if (processor) query = query.eq('processor', processor);
        if (startDate) query = query.gte('created_at', startDate);
        if (endDate) query = query.lte('created_at', endDate);

        // Get count for pagination
        let countQuery = supabase
          .from('payment_transactions')
          .select('id', { count: 'exact', head: true });

        // Apply same filters to count
        if (profile.role === 'tenant_admin') {
          countQuery = countQuery.eq('tenant_id', profile.tenant_id);
        } else if (tenantId) {
          countQuery = countQuery.eq('tenant_id', tenantId);
        }

        if (customerId) countQuery = countQuery.eq('user_id', customerId);
        if (status) countQuery = countQuery.eq('status', status);
        if (transactionType) countQuery = countQuery.eq('transaction_type', transactionType);
        if (processor) countQuery = countQuery.eq('processor', processor);
        if (startDate) countQuery = countQuery.gte('created_at', startDate);
        if (endDate) countQuery = countQuery.lte('created_at', endDate);

        const { count } = await countQuery;

        // Get transactions with pagination
        const { data: transactions, error } = await query
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) {
          console.error('Error fetching transactions:', error);
          return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
        }

        return NextResponse.json({
          transactions,
          pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit)
          }
        });
      }

      case 'analytics': {
        const days = parseInt(searchParams.get('days') || '30');
        
        // Get billing analytics
        const { data: analytics, error } = await supabase
          .rpc('get_customer_analytics', {
            p_tenant_id: profile.role === 'tenant_admin' ? profile.tenant_id : (tenantId || null),
            p_days: days
          });

        if (error) {
          console.error('Error fetching billing analytics:', error);
          return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
        }

        return NextResponse.json({ analytics: analytics?.[0] || {} });
      }

      case 'revenue_breakdown': {
        const days = parseInt(searchParams.get('days') || '30');
        const periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - days);

        let revenueQuery = supabase
          .from('payment_transactions')
          .select(`
            amount_cents,
            processor_fee_cents,
            currency_code,
            transaction_type,
            status,
            created_at,
            user_subscriptions!subscription_id (
              subscription_plans (
                tier,
                name
              )
            )
          `)
          .eq('status', 'succeeded')
          .eq('transaction_type', 'payment')
          .gte('created_at', periodStart.toISOString());

        // Apply tenant filtering
        if (profile.role === 'tenant_admin') {
          revenueQuery = revenueQuery.eq('tenant_id', profile.tenant_id);
        } else if (tenantId) {
          revenueQuery = revenueQuery.eq('tenant_id', tenantId);
        }

        const { data: revenueData, error: revenueError } = await revenueQuery;

        if (revenueError) {
          console.error('Error fetching revenue breakdown:', revenueError);
          return NextResponse.json({ error: 'Failed to fetch revenue breakdown' }, { status: 500 });
        }

        // Process revenue breakdown
        const breakdown = {
          total_revenue_cents: 0,
          total_fees_cents: 0,
          net_revenue_cents: 0,
          by_tier: {} as Record<string, any>,
          by_processor: {} as Record<string, any>,
          daily_revenue: {} as Record<string, number>
        };

        revenueData?.forEach(transaction => {
          const amount = transaction.amount_cents || 0;
          const fees = transaction.processor_fee_cents || 0;
          const net = amount - fees;
          const date = new Date(transaction.created_at).toISOString().split('T')[0];
          const tier = transaction.user_subscriptions?.[0]?.subscription_plans?.[0]?.tier || 'unknown';

          breakdown.total_revenue_cents += amount;
          breakdown.total_fees_cents += fees;
          breakdown.net_revenue_cents += net;

          // By tier
          if (!breakdown.by_tier[tier]) {
            breakdown.by_tier[tier] = { revenue_cents: 0, count: 0 };
          }
          breakdown.by_tier[tier].revenue_cents += amount;
          breakdown.by_tier[tier].count += 1;

          // Daily revenue
          if (!breakdown.daily_revenue[date]) {
            breakdown.daily_revenue[date] = 0;
          }
          breakdown.daily_revenue[date] += amount;
        });

        return NextResponse.json({ breakdown });
      }

      default:
        return NextResponse.json({ error: 'Invalid data type' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in billing API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create manual transaction or update billing info
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const authResult = await checkAdminPermissions(supabase);
    
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user, profile } = authResult;
    const body = await request.json();
    const { action, ...actionData } = body;

    switch (action) {
      case 'create_manual_transaction': {
        const {
          customerId,
          subscriptionId,
          transactionType,
          amountCents,
          currencyCode = 'USD',
          description,
          notes
        } = actionData;

        // Validate required fields
        if (!customerId || !transactionType || !amountCents) {
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

        const { data: transaction, error } = await supabase
          .from('payment_transactions')
          .insert({
            tenant_id: customer.tenant_id,
            user_id: customerId,
            subscription_id: subscriptionId,
            transaction_type: transactionType,
            status: 'succeeded', // Manual transactions are auto-succeeded
            amount_cents: amountCents,
            currency_code: currencyCode,
            description: description || `Manual ${transactionType} by admin`,
            processor: 'manual',
            net_amount_cents: amountCents, // No fees for manual transactions
            processed_at: new Date().toISOString(),
            metadata: {
              created_by_admin: user.id,
              notes: notes || ''
            }
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating manual transaction:', error);
          return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
        }

        // Log admin action
        await supabase.rpc('log_admin_action', {
          p_action: 'create_manual_transaction',
          p_resource_type: 'payment_transaction',
          p_resource_id: transaction.id,
          p_new_data: { customerId, transactionType, amountCents, description }
        });

        return NextResponse.json({ transaction });
      }

      case 'update_billing_info': {
        const { customerId, billingData } = actionData;

        if (!customerId || !billingData) {
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

        // Update or create billing info
        const { data: billingInfo, error } = await supabase
          .from('customer_billing_info')
          .upsert({
            tenant_id: customer.tenant_id,
            user_id: customerId,
            ...billingData,
            is_primary: true,
            is_active: true
          })
          .select()
          .single();

        if (error) {
          console.error('Error updating billing info:', error);
          return NextResponse.json({ error: 'Failed to update billing info' }, { status: 500 });
        }

        // Log admin action
        await supabase.rpc('log_admin_action', {
          p_action: 'update_billing_info',
          p_resource_type: 'billing_info',
          p_resource_id: billingInfo.id,
          p_new_data: { customerId, fields_updated: Object.keys(billingData) }
        });

        return NextResponse.json({ billingInfo });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in billing POST API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 