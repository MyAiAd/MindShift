-- Fix incomplete RLS policy for treatment_progress table
-- The policy was missing the closing parenthesis and proper FOR ALL clause

-- Drop the existing incomplete policy
DROP POLICY IF EXISTS "Users can access own treatment progress" ON treatment_progress;

-- Create the complete policy
CREATE POLICY "Users can access own treatment progress" ON treatment_progress
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM treatment_sessions ts 
            WHERE ts.session_id = treatment_progress.session_id 
            AND ts.user_id = auth.uid()
        )
    );

-- Also ensure the super admin and tenant admin policies work properly for treatment_progress
-- (These were added in migration 007 but let's make sure they're complete)

-- Fix the tenant admin policy that was incomplete
DROP POLICY IF EXISTS "Tenant admin can access tenant treatment progress" ON treatment_progress;

CREATE POLICY "Tenant admin can access tenant treatment progress" ON treatment_progress
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM treatment_sessions ts
            JOIN profiles up ON up.tenant_id = ts.tenant_id
            WHERE ts.session_id = treatment_progress.session_id 
            AND up.id = auth.uid()
            AND up.role = 'tenant_admin'
        )
    ); 