-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE user_role AS ENUM ('super_admin', 'tenant_admin', 'manager', 'coach', 'user');
CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'trial', 'expired');
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'unpaid', 'trialing');

-- Tenants table (organizations/companies)
CREATE TABLE tenants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255) UNIQUE,
    logo_url TEXT,
    status tenant_status DEFAULT 'trial',
    settings JSONB DEFAULT '{}',
    subscription_id VARCHAR(255),
    subscription_status subscription_status DEFAULT 'trialing',
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table (extends auth.users)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    role user_role DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}',
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tenant invitations
CREATE TABLE tenant_invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'user',
    invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mindset assessments
CREATE TABLE assessments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    questions JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assessment responses
CREATE TABLE assessment_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    responses JSONB NOT NULL,
    score NUMERIC,
    analysis JSONB,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Coaching sessions
CREATE TABLE coaching_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    coach_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    client_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    status VARCHAR(50) DEFAULT 'scheduled',
    notes TEXT,
    recording_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Goals and objectives
CREATE TABLE goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    target_date DATE,
    status VARCHAR(50) DEFAULT 'active',
    progress NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Goal milestones
CREATE TABLE goal_milestones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    target_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Progress tracking
CREATE TABLE progress_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    mood_score INTEGER CHECK (mood_score >= 1 AND mood_score <= 10),
    energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 10),
    confidence_level INTEGER CHECK (confidence_level >= 1 AND confidence_level <= 10),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI insights and recommendations
CREATE TABLE ai_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    confidence_score NUMERIC,
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs
CREATE TABLE audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_profiles_tenant_id ON profiles(tenant_id);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_assessments_tenant_id ON assessments(tenant_id);
CREATE INDEX idx_assessment_responses_tenant_id ON assessment_responses(tenant_id);
CREATE INDEX idx_coaching_sessions_tenant_id ON coaching_sessions(tenant_id);
CREATE INDEX idx_goals_tenant_id ON goals(tenant_id);
CREATE INDEX idx_progress_entries_tenant_id ON progress_entries(tenant_id);
CREATE INDEX idx_ai_insights_tenant_id ON ai_insights(tenant_id);
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Tenants policies
CREATE POLICY "Users can view their own tenant" ON tenants
    FOR SELECT USING (
        id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Tenant admins can update their tenant" ON tenants
    FOR UPDATE USING (
        id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid() AND role IN ('tenant_admin', 'super_admin')
        )
    );

-- Profiles policies
CREATE POLICY "Users can view profiles in their tenant" ON profiles
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Tenant admins can manage profiles in their tenant" ON profiles
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid() AND role IN ('tenant_admin', 'super_admin')
        )
    );

-- Assessments policies
CREATE POLICY "Users can view assessments in their tenant" ON assessments
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Coaches and admins can manage assessments" ON assessments
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid() AND role IN ('coach', 'manager', 'tenant_admin', 'super_admin')
        )
    );

-- Assessment responses policies
CREATE POLICY "Users can view their own responses" ON assessment_responses
    FOR SELECT USING (
        user_id = auth.uid() OR
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid() AND role IN ('coach', 'manager', 'tenant_admin', 'super_admin')
        )
    );

CREATE POLICY "Users can create their own responses" ON assessment_responses
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Coaching sessions policies
CREATE POLICY "Users can view their coaching sessions" ON coaching_sessions
    FOR SELECT USING (
        coach_id = auth.uid() OR 
        client_id = auth.uid() OR
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid() AND role IN ('manager', 'tenant_admin', 'super_admin')
        )
    );

CREATE POLICY "Coaches can manage their sessions" ON coaching_sessions
    FOR ALL USING (
        coach_id = auth.uid() OR
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid() AND role IN ('manager', 'tenant_admin', 'super_admin')
        )
    );

-- Goals policies
CREATE POLICY "Users can view their own goals" ON goals
    FOR SELECT USING (
        user_id = auth.uid() OR
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid() AND role IN ('coach', 'manager', 'tenant_admin', 'super_admin')
        )
    );

CREATE POLICY "Users can manage their own goals" ON goals
    FOR ALL USING (
        user_id = auth.uid() OR
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid() AND role IN ('coach', 'manager', 'tenant_admin', 'super_admin')
        )
    );

-- Goal milestones policies
CREATE POLICY "Users can view milestones for their goals" ON goal_milestones
    FOR SELECT USING (
        goal_id IN (
            SELECT id FROM goals WHERE user_id = auth.uid()
        ) OR
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid() AND role IN ('coach', 'manager', 'tenant_admin', 'super_admin')
        )
    );

CREATE POLICY "Users can manage milestones for their goals" ON goal_milestones
    FOR ALL USING (
        goal_id IN (
            SELECT id FROM goals WHERE user_id = auth.uid()
        ) OR
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid() AND role IN ('coach', 'manager', 'tenant_admin', 'super_admin')
        )
    );

-- Progress entries policies
CREATE POLICY "Users can view their own progress" ON progress_entries
    FOR SELECT USING (
        user_id = auth.uid() OR
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid() AND role IN ('coach', 'manager', 'tenant_admin', 'super_admin')
        )
    );

CREATE POLICY "Users can manage their own progress" ON progress_entries
    FOR ALL USING (
        user_id = auth.uid() OR
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid() AND role IN ('coach', 'manager', 'tenant_admin', 'super_admin')
        )
    );

-- AI insights policies
CREATE POLICY "Users can view their own insights" ON ai_insights
    FOR SELECT USING (
        user_id = auth.uid() OR
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid() AND role IN ('coach', 'manager', 'tenant_admin', 'super_admin')
        )
    );

CREATE POLICY "System can create insights" ON ai_insights
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Audit logs policies
CREATE POLICY "Admins can view audit logs" ON audit_logs
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles 
            WHERE id = auth.uid() AND role IN ('tenant_admin', 'super_admin')
        )
    );

CREATE POLICY "System can create audit logs" ON audit_logs
    FOR INSERT WITH CHECK (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assessments_updated_at BEFORE UPDATE ON assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coaching_sessions_updated_at BEFORE UPDATE ON coaching_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 