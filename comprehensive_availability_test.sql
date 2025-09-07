-- Comprehensive test to understand the availability issue

-- 1. Check if ANY availability records exist in the system
SELECT '=== Step 1: All availability records ===' as step;
SELECT COUNT(*) as total_availability_records FROM coach_availability;
SELECT ca.*, p.email, p.role 
FROM coach_availability ca 
JOIN profiles p ON ca.coach_id = p.id
LIMIT 5;

-- 2. Check available tenants
SELECT '=== Step 2: Available tenants ===' as step;
SELECT id, name, slug, status FROM tenants LIMIT 3;

-- 3. Check your super admin profile
SELECT '=== Step 3: Super admin profile ===' as step;
SELECT id, email, role, tenant_id, first_name, last_name 
FROM profiles 
WHERE role = 'super_admin';

-- 4. Try to manually create availability using the function
SELECT '=== Step 4: Creating test availability ===' as step;
SELECT update_coach_availability(
    'e3b0c442-98fc-1c14-9afb-92266f7e1234'::UUID,
    '[{
        "day_of_week": 1,
        "start_time": "09:00",
        "end_time": "17:00",
        "is_available": true,
        "buffer_minutes": 15
    }]'::jsonb,
    'UTC'
) as create_result;

-- 5. Check if the record was actually created
SELECT '=== Step 5: Verify creation ===' as step;
SELECT COUNT(*) as availability_count FROM coach_availability 
WHERE coach_id = 'e3b0c442-98fc-1c14-9afb-92266f7e1234'::UUID;

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
LEFT JOIN tenants t ON ca.tenant_id = t.id
WHERE ca.coach_id = 'e3b0c442-98fc-1c14-9afb-92266f7e1234'::UUID;

-- 6. Test the slots function after creation
SELECT '=== Step 6: Test slots function ===' as step;
SELECT get_coach_available_slots(
    'e3b0c442-98fc-1c14-9afb-92266f7e1234'::UUID,
    (CURRENT_DATE + INTERVAL '1 day')::DATE,
    60,
    'UTC'
) as slots_result;

-- 7. Check what day tomorrow actually is
SELECT '=== Step 7: Date information ===' as step;
SELECT 
    CURRENT_DATE as today,
    (CURRENT_DATE + INTERVAL '1 day')::DATE as tomorrow,
    EXTRACT(DOW FROM CURRENT_DATE + INTERVAL '1 day') as tomorrow_dow,
    TO_CHAR(CURRENT_DATE + INTERVAL '1 day', 'Day') as tomorrow_name;
