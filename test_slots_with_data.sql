-- Test the slots function now that we have availability data
SELECT 'Testing slots function with real availability data:' as step;
SELECT get_coach_available_slots(
    'e3b0c442-98fc-1c14-9afb-92266f7e1234'::UUID,
    (CURRENT_DATE + INTERVAL '1 day')::DATE,
    60,
    'UTC'
) as slots_result;

-- Also test for a few different days to make sure it works
SELECT 'Testing for Tuesday (day 2):' as step;
SELECT get_coach_available_slots(
    'e3b0c442-98fc-1c14-9afb-92266f7e1234'::UUID,
    (CURRENT_DATE + INTERVAL '2 days')::DATE,
    60,
    'UTC'
) as slots_result;
