-- Create or replace function to update treatment session statistics
CREATE OR REPLACE FUNCTION update_session_stats(
    p_session_id VARCHAR,
    p_used_ai BOOLEAN,
    p_response_time INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE treatment_sessions 
    SET 
        -- Update response counts
        scripted_responses = CASE 
            WHEN p_used_ai THEN scripted_responses 
            ELSE scripted_responses + 1 
        END,
        ai_responses = CASE 
            WHEN p_used_ai THEN ai_responses + 1 
            ELSE ai_responses 
        END,
        -- Update average response time
        avg_response_time = (
            (avg_response_time * (scripted_responses + ai_responses) + p_response_time) / 
            (scripted_responses + ai_responses + 1)
        ),
        -- Update last activity
        updated_at = NOW()
    WHERE session_id = p_session_id;
END;
$$; 