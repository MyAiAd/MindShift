-- Debug the available slots issue
-- Let's test the function directly and see what happens

-- First, let's see what availability data exists for the super admin
SELECT 'Checking availability records for super admin:' as debug_step;
SELECT ca.*, p.email, p.role, p.tenant_id as profile_tenant_id 
FROM coach_availability ca 
JOIN profiles p ON ca.coach_id = p.id 
WHERE p.role = 'super_admin';

-- Check if there are any tenants
SELECT 'Checking available tenants:' as debug_step;
SELECT id, name, slug, status FROM tenants LIMIT 5;

-- Test the function with super admin ID
SELECT 'Testing get_coach_available_slots function:' as debug_step;
SELECT get_coach_available_slots(
    (SELECT id FROM profiles WHERE role = 'super_admin' LIMIT 1),
    CURRENT_DATE + INTERVAL '1 day',
    60,
    'UTC'
) as function_result;
