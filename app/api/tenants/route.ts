import { NextRequest, NextResponse } from 'next/server';
import { TenantInsert } from '@/lib/database';
import { createServerClient } from '@/lib/database-server';
import { emailService } from '@/services/email/email.service';

export async function POST(request: NextRequest) {
  try {
    console.log('API: Creating server client for tenant creation');
    const supabase = createServerClient();
    
    // Get the current user
    console.log('API: Getting user from server client');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('API: Auth result - user:', !!user, 'error:', authError?.message);
    if (user) {
      console.log('API: User details:', { id: user.id, email: user.email });
    }
    
    if (authError || !user) {
      console.log('API: Returning 401 - no user or auth error');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, slug, domain, adminEmail, adminFirstName, adminLastName } = body;

    // Validate required fields
    if (!name || !slug || !adminEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: name, slug, adminEmail' },
        { status: 400 }
      );
    }

    // Check if slug is already taken
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existingTenant) {
      return NextResponse.json(
        { error: 'Tenant slug already exists' },
        { status: 409 }
      );
    }

    // Check if domain is already taken (if provided)
    if (domain) {
      const { data: existingDomain } = await supabase
        .from('tenants')
        .select('id')
        .eq('domain', domain)
        .single();

      if (existingDomain) {
        return NextResponse.json(
          { error: 'Domain already exists' },
          { status: 409 }
        );
      }
    }

    // Use the database function to create tenant
    const { data: tenantId, error: createError } = await supabase
      .rpc('create_tenant', {
        tenant_name: name,
        tenant_slug: slug,
        admin_email: adminEmail,
        tenant_domain: domain || null,
        admin_first_name: adminFirstName || null,
        admin_last_name: adminLastName || null,
      });

    if (createError) {
      console.error('Error creating tenant:', createError);
      return NextResponse.json(
        { error: 'Failed to create tenant' },
        { status: 500 }
      );
    }

    // Get the created tenant data
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    // Send welcome email to the new user
    try {
      const welcomeResult = await emailService.sendWelcomeEmail({
        email: adminEmail,
        firstName: adminFirstName,
        role: 'tenant_admin',
      });
      
      if (!welcomeResult.success) {
        console.error('Failed to send welcome email:', welcomeResult.error);
        // Don't fail the request - tenant is created, email just failed
      } else {
        console.log('Welcome email sent successfully to:', adminEmail);
      }
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
      // Don't fail the request
    }

    return NextResponse.json({ tenant, tenantId }, { status: 201 });
  } catch (error) {
    console.error('Error in tenant creation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
      .select('*, tenants(*)')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Super admins can see all tenants, others only their own
    let query = supabase.from('tenants').select('*');
    
    if (profile.role !== 'super_admin') {
      query = query.eq('id', profile.tenant_id);
    }

    const { data: tenants, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tenants:', error);
      return NextResponse.json(
        { error: 'Failed to fetch tenants' },
        { status: 500 }
      );
    }

    return NextResponse.json({ tenants });
  } catch (error) {
    console.error('Error in tenant fetch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 