-- Test with a proper future date
SELECT 'Current date and time:' as step;
SELECT CURRENT_DATE as today, CURRENT_DATE + INTERVAL '1 day' as tomorrow;

-- Check what day of week tomorrow is
SELECT 'Tomorrow info:' as step;
SELECT 
    (CURRENT_DATE + INTERVAL '1 day')::DATE as tomorrow_date,
    EXTRACT(DOW FROM CURRENT_DATE + INTERVAL '1 day') as day_of_week,
    TO_CHAR(CURRENT_DATE + INTERVAL '1 day', 'Day') as day_name;

-- Check your availability records
SELECT 'Your availability records:' as step;
SELECT 
    ca.*,
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
WHERE ca.coach_id = 'e3b0c442-98fc-1c14-9afb-92266f7e1234'::UUID;

-- Test the function with tomorrow's date
SELECT 'Testing with tomorrow:' as step;
SELECT get_coach_available_slots(
    'e3b0c442-98fc-1c14-9afb-92266f7e1234'::UUID,
    (CURRENT_DATE + INTERVAL '1 day')::DATE,
    60,
    'UTC'
) as result;
