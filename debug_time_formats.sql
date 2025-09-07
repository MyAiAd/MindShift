-- Check what time format is stored in the database
SELECT 'Current availability data format:' as step;
SELECT 
    day_of_week,
    start_time,
    end_time,
    start_time::text as start_time_text,
    end_time::text as end_time_text,
    LENGTH(start_time::text) as start_length,
    LENGTH(end_time::text) as end_length
FROM coach_availability 
WHERE coach_id = 'e3b0c442-98fc-1c14-9afb-92266f7e1234'::UUID
LIMIT 3;
