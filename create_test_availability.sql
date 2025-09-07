-- Temporarily create availability data directly in the database for testing
-- This bypasses authentication issues

-- First check if there are any tenants
SELECT 'Available tenants:' as step;
SELECT id, name FROM tenants LIMIT 3;

-- Get the first tenant ID for testing
DO $$
DECLARE
    test_tenant_id UUID;
    super_admin_id UUID := 'e3b0c442-98fc-1c14-9afb-92266f7e1234';
BEGIN
    -- Get first available tenant
    SELECT id INTO test_tenant_id FROM tenants LIMIT 1;
    
    IF test_tenant_id IS NOT NULL THEN
        -- Delete any existing availability for super admin
        DELETE FROM coach_availability WHERE coach_id = super_admin_id;
        
        -- Create availability for Monday through Friday, 9 AM to 5 PM
        INSERT INTO coach_availability (coach_id, tenant_id, day_of_week, start_time, end_time, timezone, is_available, buffer_minutes)
        VALUES 
            (super_admin_id, test_tenant_id, 1, '09:00', '17:00', 'UTC', true, 15), -- Monday
            (super_admin_id, test_tenant_id, 2, '09:00', '17:00', 'UTC', true, 15), -- Tuesday
            (super_admin_id, test_tenant_id, 3, '09:00', '17:00', 'UTC', true, 15), -- Wednesday
            (super_admin_id, test_tenant_id, 4, '09:00', '17:00', 'UTC', true, 15), -- Thursday
            (super_admin_id, test_tenant_id, 5, '09:00', '17:00', 'UTC', true, 15); -- Friday
            
        RAISE NOTICE 'Created availability for super admin with tenant %', test_tenant_id;
    ELSE
        RAISE NOTICE 'No tenants found - creating a test tenant first';
        
        -- Create a test tenant
        INSERT INTO tenants (name, slug, status) 
        VALUES ('Test Tenant', 'test-tenant', 'active')
        RETURNING id INTO test_tenant_id;
        
        -- Create availability with the new tenant
        INSERT INTO coach_availability (coach_id, tenant_id, day_of_week, start_time, end_time, timezone, is_available, buffer_minutes)
        VALUES 
            (super_admin_id, test_tenant_id, 1, '09:00', '17:00', 'UTC', true, 15), -- Monday
            (super_admin_id, test_tenant_id, 2, '09:00', '17:00', 'UTC', true, 15), -- Tuesday
            (super_admin_id, test_tenant_id, 3, '09:00', '17:00', 'UTC', true, 15), -- Wednesday
            (super_admin_id, test_tenant_id, 4, '09:00', '17:00', 'UTC', true, 15), -- Thursday
            (super_admin_id, test_tenant_id, 5, '09:00', '17:00', 'UTC', true, 15); -- Friday
            
        RAISE NOTICE 'Created test tenant and availability';
    END IF;
END $$;

-- Verify the availability was created
SELECT 'Created availability records:' as step;
SELECT ca.*, t.name as tenant_name,
    CASE ca.day_of_week 
        WHEN 0 THEN 'Sunday'
        WHEN 1 THEN 'Monday'
        WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday'
        WHEN 4 THEN 'Thursday'
        WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday'
    END as day_name
FROM coach_availability ca 
JOIN tenants t ON ca.tenant_id = t.id
WHERE ca.coach_id = 'e3b0c442-98fc-1c14-9afb-92266f7e1234'::UUID;
