-- Test the slots function directly to see if it's working
-- Replace the UUID below with your actual super admin ID

-- First, let's get your super admin ID
SELECT 'Your super admin profile:' as step;
SELECT id, email, role, tenant_id FROM profiles WHERE role = 'super_admin';

-- Check if you have any availability records
SELECT 'Your availability records:' as step;
SELECT ca.*, t.name as tenant_name 
FROM coach_availability ca 
JOIN profiles p ON ca.coach_id = p.id 
LEFT JOIN tenants t ON ca.tenant_id = t.id
WHERE p.role = 'super_admin';

-- Test the function directly (replace the UUID with your actual ID)
SELECT 'Testing slots function for tomorrow:' as step;
SELECT get_coach_available_slots(
    (SELECT id FROM profiles WHERE role = 'super_admin' LIMIT 1),
    CURRENT_DATE + INTERVAL '1 day',
    60,
    'UTC'
) as result;
