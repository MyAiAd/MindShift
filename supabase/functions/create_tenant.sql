-- Function to create a new tenant and assign the first user as tenant admin
CREATE OR REPLACE FUNCTION create_tenant(
    tenant_name VARCHAR(255),
    tenant_slug VARCHAR(100),
    admin_email VARCHAR(255),
    tenant_domain VARCHAR(255) DEFAULT NULL,
    admin_first_name VARCHAR(100) DEFAULT NULL,
    admin_last_name VARCHAR(100) DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_tenant_id UUID;
    admin_user_id UUID;
    trial_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Check if tenant slug already exists
    IF EXISTS (SELECT 1 FROM tenants WHERE slug = tenant_slug) THEN
        RAISE EXCEPTION 'Tenant slug already exists';
    END IF;
    
    -- Check if domain already exists (if provided)
    IF tenant_domain IS NOT NULL AND EXISTS (SELECT 1 FROM tenants WHERE domain = tenant_domain) THEN
        RAISE EXCEPTION 'Tenant domain already exists';
    END IF;
    
    -- Set trial end date to 30 days from now
    trial_end_date := NOW() + INTERVAL '30 days';
    
    -- Create the tenant
    INSERT INTO tenants (name, slug, domain, status, subscription_status, trial_ends_at)
    VALUES (tenant_name, tenant_slug, tenant_domain, 'trial', 'trialing', trial_end_date)
    RETURNING id INTO new_tenant_id;
    
    -- Get the admin user ID (assuming they're already authenticated)
    admin_user_id := auth.uid();
    
    -- Create or update the admin profile
    INSERT INTO profiles (id, tenant_id, email, first_name, last_name, role)
    VALUES (admin_user_id, new_tenant_id, admin_email, admin_first_name, admin_last_name, 'tenant_admin')
    ON CONFLICT (id) 
    DO UPDATE SET
        tenant_id = new_tenant_id,
        email = admin_email,
        first_name = COALESCE(admin_first_name, profiles.first_name),
        last_name = COALESCE(admin_last_name, profiles.last_name),
        role = 'tenant_admin',
        updated_at = NOW();
    
    -- Create audit log
    INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, new_data)
    VALUES (
        new_tenant_id,
        admin_user_id,
        'CREATE',
        'tenant',
        new_tenant_id,
        jsonb_build_object(
            'name', tenant_name,
            'slug', tenant_slug,
            'domain', tenant_domain,
            'admin_email', admin_email
        )
    );
    
    RETURN new_tenant_id;
END;
$$; 