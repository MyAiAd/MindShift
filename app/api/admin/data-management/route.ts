import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import { parse } from 'csv-parse/sync';

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

// Helper function to generate realistic test data
function generateTestCustomer(index: number, tenantId: string) {
  const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Chris', 'Lisa', 'Matt', 'Anna'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
  const tiers = ['trial', 'level_1', 'level_2'];
  
  const firstName = firstNames[index % firstNames.length];
  const lastName = lastNames[Math.floor(index / firstNames.length) % lastNames.length];
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@example.com`;
  const subscriptionTier = tiers[index % tiers.length];
  
  return {
    email,
    first_name: firstName,
    last_name: lastName,
    role: 'user',
    subscription_tier: subscriptionTier,
    tenant_id: tenantId,
    is_active: Math.random() > 0.1, // 90% active
    created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(), // Random date within last year
  };
}

// GET - Export customer data
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const authResult = await checkAdminPermissions(supabase);
    
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user, profile } = authResult;
    const { searchParams } = new URL(request.url);
    const exportType = searchParams.get('type') || 'customers';
    const format = searchParams.get('format') || 'json';
    const tenantId = searchParams.get('tenant_id');

    // Determine tenant scope
    const targetTenantId = profile.role === 'tenant_admin' ? profile.tenant_id : tenantId;

    switch (exportType) {
      case 'customers': {
        // Export customer data
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
              name,
              slug
            ),
            user_subscriptions!user_id (
              status,
              current_tier,
              current_period_start,
              current_period_end,
              created_at,
              subscription_plans (
                name,
                tier,
                price_monthly
              )
            )
          `)
          .neq('role', 'super_admin')
          .order('created_at', { ascending: false });

        if (targetTenantId) {
          query = query.eq('tenant_id', targetTenantId);
        }

        const { data: customers, error } = await query;

        if (error) {
          console.error('Error exporting customers:', error);
          return NextResponse.json({ error: 'Failed to export customers' }, { status: 500 });
        }

        // Log admin action
        await supabase.rpc('log_admin_action', {
          p_action: 'export_customer_data',
          p_resource_type: 'customers',
          p_resource_id: null,
          p_new_data: { count: customers?.length || 0, format, tenant_id: targetTenantId }
        });

        if (format === 'csv') {
          // Convert to CSV
          const csvHeaders = [
            'ID', 'Email', 'First Name', 'Last Name', 'Role', 'Subscription Tier', 
            'Tenant', 'Is Active', 'Created At', 'Current Subscription Status'
          ];
          
          const csvRows = customers?.map(customer => [
            customer.id,
            customer.email,
            customer.first_name || '',
            customer.last_name || '',
            customer.role,
            customer.subscription_tier,
            Array.isArray(customer.tenants) ? (customer.tenants[0] as any)?.name || '' : (customer.tenants as any)?.name || '',
            customer.is_active,
            customer.created_at,
            customer.user_subscriptions?.[0]?.status || 'none'
          ]) || [];

          const csvContent = [csvHeaders, ...csvRows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');

          return new Response(csvContent, {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename="customers-${new Date().toISOString().split('T')[0]}.csv"`
            }
          });
        }

        return NextResponse.json({ customers });
      }

      case 'subscription_plans': {
        // Export subscription plans
        const { data: plans, error } = await supabase
          .from('subscription_plans')
          .select('*')
          .order('tier', { ascending: true });

        if (error) {
          console.error('Error exporting subscription plans:', error);
          return NextResponse.json({ error: 'Failed to export subscription plans' }, { status: 500 });
        }

        return NextResponse.json({ plans });
      }

      case 'analytics_summary': {
        // Export analytics summary
        const { data: analytics } = await supabase
          .rpc('get_customer_analytics', {
            p_tenant_id: targetTenantId,
            p_days: 90
          });

        return NextResponse.json({ analytics: analytics?.[0] || {} });
      }

      default:
        return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in data export API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Import data, seed plans, generate test data
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const authResult = await checkAdminPermissions(supabase);
    
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user, profile } = authResult;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'import_customers': {
        const body = await request.json();
        const { customers, tenant_id } = body;

        if (!customers || !Array.isArray(customers)) {
          return NextResponse.json({ error: 'Invalid customer data' }, { status: 400 });
        }

        // Determine target tenant
        const targetTenantId = profile.role === 'tenant_admin' ? profile.tenant_id : tenant_id;
        
        if (!targetTenantId) {
          return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
        }

        const results = {
          imported: 0,
          skipped: 0,
          errors: [] as any[]
        };

        for (const customerData of customers) {
          try {
            // Validate required fields
            if (!customerData.email) {
              results.errors.push({ email: customerData.email, error: 'Email is required' });
              results.skipped++;
              continue;
            }

            // Check if customer already exists
            const { data: existing } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', customerData.email)
              .single();

            if (existing) {
              results.errors.push({ email: customerData.email, error: 'Customer already exists' });
              results.skipped++;
              continue;
            }

            // Insert customer
            const { error } = await supabase
              .from('profiles')
              .insert({
                email: customerData.email,
                first_name: customerData.first_name || null,
                last_name: customerData.last_name || null,
                role: customerData.role || 'user',
                subscription_tier: customerData.subscription_tier || 'trial',
                tenant_id: targetTenantId,
                is_active: customerData.is_active !== false,
                created_at: customerData.created_at || new Date().toISOString()
              });

            if (error) {
              results.errors.push({ email: customerData.email, error: error.message });
              results.skipped++;
            } else {
              results.imported++;
            }

          } catch (error) {
            results.errors.push({ 
              email: customerData.email, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
            results.skipped++;
          }
        }

        // Log admin action
        await supabase.rpc('log_admin_action', {
          p_action: 'import_customer_data',
          p_resource_type: 'customers',
          p_resource_id: null,
          p_new_data: { results, tenant_id: targetTenantId }
        });

        return NextResponse.json({ results });
      }

      case 'seed_subscription_plans': {
        // Only super admins can seed subscription plans
        if (profile.role !== 'super_admin') {
          return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
        }

        const defaultPlans = [
          {
            name: 'Trial Plan',
            tier: 'trial',
            description: 'Free trial with basic features',
            price_monthly: 0,
            price_yearly: 0,
            features: ['Basic progress tracking', 'Limited goals', 'Community support'],
            limits: { goals: 3, sessions_per_month: 5 },
            status: 'active'
          },
          {
            name: 'Essential MyAi',
            tier: 'level_1',
            description: 'Perfect for individuals starting their mental health journey',
            price_monthly: 29.00,
            price_yearly: 299.00,
            features: ['Unlimited goals', 'Advanced analytics', 'AI insights', 'Priority support'],
            limits: { goals: -1, sessions_per_month: 20 },
            status: 'active'
          },
          {
            name: 'Complete MyAi',
            tier: 'level_2',
            description: 'Full featured plan for serious practitioners',
            price_monthly: 49.00,
            price_yearly: 499.00,
            features: ['Everything in Essential', 'Team management', 'Custom treatments', 'White-label options'],
            limits: { goals: -1, sessions_per_month: -1 },
            status: 'active'
          }
        ];

        const results = {
          created: 0,
          updated: 0,
          errors: [] as any[]
        };

        for (const plan of defaultPlans) {
          try {
            // Check if plan exists
            const { data: existing } = await supabase
              .from('subscription_plans')
              .select('id')
              .eq('tier', plan.tier)
              .single();

            if (existing) {
              // Update existing plan
              const { error } = await supabase
                .from('subscription_plans')
                .update({
                  ...plan,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existing.id);

              if (error) {
                results.errors.push({ tier: plan.tier, error: error.message });
              } else {
                results.updated++;
              }
            } else {
              // Create new plan
              const { error } = await supabase
                .from('subscription_plans')
                .insert({
                  ...plan,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });

              if (error) {
                results.errors.push({ tier: plan.tier, error: error.message });
              } else {
                results.created++;
              }
            }

          } catch (error) {
            results.errors.push({ 
              tier: plan.tier, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
          }
        }

        // Log admin action
        await supabase.rpc('log_admin_action', {
          p_action: 'seed_subscription_plans',
          p_resource_type: 'subscription_plans',
          p_resource_id: null,
          p_new_data: { results }
        });

        return NextResponse.json({ results });
      }

      case 'generate_test_data': {
        const body = await request.json();
        const { count = 50, tenant_id } = body;

        // Limit test data generation
        if (count > 200) {
          return NextResponse.json({ error: 'Maximum 200 test customers allowed' }, { status: 400 });
        }

        let targetTenantId = profile.role === 'tenant_admin' ? profile.tenant_id : tenant_id;
        
        // Handle special filter options - for test data generation, we only allow specific tenants
        if (targetTenantId && targetTenantId.startsWith('filter:')) {
          return NextResponse.json({ error: 'Please select a specific tenant for test data generation' }, { status: 400 });
        }
        
        if (!targetTenantId) {
          return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
        }

        const results = {
          customers_created: 0,
          subscriptions_created: 0,
          notes_created: 0,
          errors: [] as any[]
        };

        // Generate test customers
        for (let i = 0; i < count; i++) {
          try {
            const testCustomer = generateTestCustomer(i, targetTenantId);
            
            const { data: customer, error: customerError } = await supabase
              .from('profiles')
              .insert(testCustomer)
              .select()
              .single();

            if (customerError) {
              results.errors.push({ index: i, error: customerError.message });
              continue;
            }

            results.customers_created++;

            // Create subscription if not trial
            if (testCustomer.subscription_tier !== 'trial' && Math.random() > 0.3) {
              // Get subscription plan
              const { data: plan } = await supabase
                .from('subscription_plans')
                .select('id')
                .eq('tier', testCustomer.subscription_tier)
                .single();

              if (plan) {
                const { error: subError } = await supabase
                  .from('user_subscriptions')
                  .insert({
                    user_id: customer.id,
                    tenant_id: targetTenantId,
                    plan_id: plan.id,
                    status: Math.random() > 0.1 ? 'active' : 'past_due',
                    current_tier: testCustomer.subscription_tier,
                    current_period_start: new Date().toISOString(),
                    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
                    created_at: testCustomer.created_at
                  });

                if (!subError) {
                  results.subscriptions_created++;
                }
              }
            }

            // Create some test notes (30% chance)
            if (Math.random() > 0.7) {
              const noteTypes = ['note', 'email', 'call'];
              const priorities = ['low', 'medium', 'high'];
              const noteContents = [
                'Initial onboarding call completed successfully.',
                'Customer expressed interest in upgrading subscription.',
                'Resolved billing inquiry about payment method.',
                'Follow-up needed regarding feature request.',
                'Customer reported positive progress with goals.'
              ];

              const { error: noteError } = await supabase
                .from('customer_notes')
                .insert({
                  customer_user_id: customer.id,
                  admin_user_id: user.id,
                  tenant_id: targetTenantId,
                  note_type: noteTypes[Math.floor(Math.random() * noteTypes.length)],
                  priority: priorities[Math.floor(Math.random() * priorities.length)],
                  title: 'Test Customer Note',
                  content: noteContents[Math.floor(Math.random() * noteContents.length)],
                  is_internal: true,
                  created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString() // Random date within last 30 days
                });

              if (!noteError) {
                results.notes_created++;
              }
            }

          } catch (error) {
            results.errors.push({ 
              index: i, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
          }
        }

        // Log admin action
        await supabase.rpc('log_admin_action', {
          p_action: 'generate_test_data',
          p_resource_type: 'test_data',
          p_resource_id: null,
          p_new_data: { results, count, tenant_id: targetTenantId }
        });

        return NextResponse.json({ results });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in data management API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Clean up test data
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const authResult = await checkAdminPermissions(supabase);
    
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user, profile } = authResult;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'cleanup_test_data': {
        const { tenant_id } = await request.json();
        
        let targetTenantId = profile.role === 'tenant_admin' ? profile.tenant_id : tenant_id;
        
        // Handle special filter options
        let query = supabase
          .from('profiles')
          .select('id')
          .like('email', '%@example.com')
          .neq('role', 'super_admin');

        if (targetTenantId) {
          if (targetTenantId.startsWith('filter:')) {
            // Handle subscription tier filters
            const filterType = targetTenantId.replace('filter:', '');
            switch (filterType) {
              case 'trial':
                query = query.eq('subscription_tier', 'trial');
                break;
              case 'level_1':
                query = query.eq('subscription_tier', 'level_1');
                break;
              case 'level_2':
                query = query.eq('subscription_tier', 'level_2');
                break;
              case 'super_admin':
                // This should never happen as we exclude super_admin above, but just in case
                return NextResponse.json({ error: 'Cannot delete super admin accounts' }, { status: 400 });
              default:
                return NextResponse.json({ error: 'Invalid filter type' }, { status: 400 });
            }
          } else {
            // Regular tenant ID
            query = query.eq('tenant_id', targetTenantId);
          }
        }

        const { data: testCustomers } = await query;

        let deleted = 0;
        if (testCustomers) {
          for (const customer of testCustomers) {
            // Delete related data first (cascading should handle this, but being explicit)
            await supabase.from('customer_notes').delete().eq('customer_user_id', customer.id);
            await supabase.from('user_subscriptions').delete().eq('user_id', customer.id);
            
            // Delete customer
            const { error } = await supabase
              .from('profiles')
              .delete()
              .eq('id', customer.id);
            
            if (!error) deleted++;
          }
        }

        // Log admin action
        await supabase.rpc('log_admin_action', {
          p_action: 'cleanup_test_data',
          p_resource_type: 'test_data',
          p_resource_id: null,
          p_new_data: { deleted_count: deleted, tenant_id: targetTenantId }
        });

        return NextResponse.json({ deleted_count: deleted });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in data cleanup API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 