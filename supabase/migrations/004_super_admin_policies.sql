-- Super Admin RLS Policies Migration
-- This migration adds comprehensive super admin policies to all tables

-- Add super admin policies to all tables that need them

-- Tenants table - super admins can access all tenants
DO $$ BEGIN
    DROP POLICY IF EXISTS "Super admins can manage all tenants" ON tenants;
    CREATE POLICY "Super admins can manage all tenants" ON tenants
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Profiles table - super admins can access all profiles
DO $$ BEGIN
    DROP POLICY IF EXISTS "Super admins can manage all profiles" ON profiles;
    CREATE POLICY "Super admins can manage all profiles" ON profiles
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Tenant invitations - super admins can access all
DO $$ BEGIN
    DROP POLICY IF EXISTS "Super admins can manage all tenant invitations" ON tenant_invitations;
    CREATE POLICY "Super admins can manage all tenant invitations" ON tenant_invitations
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Assessments - super admins can access all
DO $$ BEGIN
    DROP POLICY IF EXISTS "Super admins can manage all assessments" ON assessments;
    CREATE POLICY "Super admins can manage all assessments" ON assessments
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Assessment responses - super admins can access all
DO $$ BEGIN
    DROP POLICY IF EXISTS "Super admins can manage all assessment responses" ON assessment_responses;
    CREATE POLICY "Super admins can manage all assessment responses" ON assessment_responses
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Coaching sessions - super admins can access all
DO $$ BEGIN
    DROP POLICY IF EXISTS "Super admins can manage all coaching sessions" ON coaching_sessions;
    CREATE POLICY "Super admins can manage all coaching sessions" ON coaching_sessions
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Goals - super admins can access all
DO $$ BEGIN
    DROP POLICY IF EXISTS "Super admins can manage all goals" ON goals;
    CREATE POLICY "Super admins can manage all goals" ON goals
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Goal milestones - super admins can access all
DO $$ BEGIN
    DROP POLICY IF EXISTS "Super admins can manage all goal milestones" ON goal_milestones;
    CREATE POLICY "Super admins can manage all goal milestones" ON goal_milestones
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Progress entries - super admins can access all
DO $$ BEGIN
    DROP POLICY IF EXISTS "Super admins can manage all progress entries" ON progress_entries;
    CREATE POLICY "Super admins can manage all progress entries" ON progress_entries
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- AI insights - super admins can access all
DO $$ BEGIN
    DROP POLICY IF EXISTS "Super admins can manage all ai insights" ON ai_insights;
    CREATE POLICY "Super admins can manage all ai insights" ON ai_insights
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Audit logs - super admins can access all
DO $$ BEGIN
    DROP POLICY IF EXISTS "Super admins can view all audit logs" ON audit_logs;
    CREATE POLICY "Super admins can view all audit logs" ON audit_logs
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- User subscriptions - super admins can access all
DO $$ BEGIN
    DROP POLICY IF EXISTS "Super admins can manage all user subscriptions" ON user_subscriptions;
    CREATE POLICY "Super admins can manage all user subscriptions" ON user_subscriptions
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Subscription history - super admins can access all
DO $$ BEGIN
    DROP POLICY IF EXISTS "Super admins can view all subscription history" ON subscription_history;
    CREATE POLICY "Super admins can view all subscription history" ON subscription_history
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$; 