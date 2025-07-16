-- Add super admin policies for treatment system tables

-- Super admin can access all treatment sessions
CREATE POLICY "Super admin can access all treatment sessions" ON treatment_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Super admin can access all treatment interactions  
CREATE POLICY "Super admin can access all treatment interactions" ON treatment_interactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Super admin can access all treatment progress
CREATE POLICY "Super admin can access all treatment progress" ON treatment_progress
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Also add tenant admin policies for treatment sessions within their tenant
CREATE POLICY "Tenant admin can access tenant treatment sessions" ON treatment_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles up
            WHERE up.id = auth.uid() 
            AND up.role = 'tenant_admin'
            AND up.tenant_id = treatment_sessions.tenant_id
        )
    );

-- Tenant admin can access treatment interactions for sessions in their tenant
CREATE POLICY "Tenant admin can access tenant treatment interactions" ON treatment_interactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM treatment_sessions ts
            JOIN profiles up ON up.tenant_id = ts.tenant_id
            WHERE ts.session_id = treatment_interactions.session_id 
            AND up.id = auth.uid()
            AND up.role = 'tenant_admin'
        )
    );

-- Tenant admin can access treatment progress for sessions in their tenant
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