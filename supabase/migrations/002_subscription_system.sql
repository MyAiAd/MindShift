-- MyAi Subscription System Migration
-- Adds membership tiers, subscription management, and access control

-- Add subscription tier enum
DO $$ BEGIN
    CREATE TYPE subscription_tier AS ENUM ('level_1', 'level_2', 'trial', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add subscription plan status enum
DO $$ BEGIN
    CREATE TYPE plan_status AS ENUM ('active', 'inactive', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Subscription plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    tier subscription_tier NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) NOT NULL,
    price_yearly DECIMAL(10,2),
    features JSONB DEFAULT '{}',
    limits JSONB DEFAULT '{}',
    status plan_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    plan_id UUID REFERENCES subscription_plans(id) ON DELETE RESTRICT NOT NULL,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255),
    current_tier subscription_tier NOT NULL,
    status subscription_status NOT NULL DEFAULT 'trialing',
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, tenant_id)
);

-- Subscription history for tracking changes
CREATE TABLE IF NOT EXISTS subscription_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    from_tier subscription_tier,
    to_tier subscription_tier NOT NULL,
    from_plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
    to_plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
    change_reason VARCHAR(100) NOT NULL,
    changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Access control features table
CREATE TABLE IF NOT EXISTS feature_access (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    feature_key VARCHAR(100) NOT NULL UNIQUE,
    feature_name VARCHAR(255) NOT NULL,
    description TEXT,
    required_tier subscription_tier NOT NULL,
    is_core_feature BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add subscription info to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS current_subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS subscription_tier subscription_tier DEFAULT 'trial';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_tenant_id ON user_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_id ON user_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_subscription_id ON subscription_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_user_id ON subscription_history(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON profiles(subscription_tier);

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_access ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans
DO $$ BEGIN
    DROP POLICY IF EXISTS "Everyone can view active subscription plans" ON subscription_plans;
    CREATE POLICY "Everyone can view active subscription plans" ON subscription_plans
        FOR SELECT USING (status = 'active');
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Admins can manage subscription plans" ON subscription_plans;
    CREATE POLICY "Admins can manage subscription plans" ON subscription_plans
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role IN ('super_admin')
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- RLS Policies for user_subscriptions
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can view their own subscription" ON user_subscriptions;
    CREATE POLICY "Users can view their own subscription" ON user_subscriptions
        FOR SELECT USING (
            user_id = auth.uid() OR
            tenant_id IN (
                SELECT tenant_id FROM profiles 
                WHERE id = auth.uid() AND role IN ('tenant_admin', 'super_admin')
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can update their own subscription" ON user_subscriptions;
    CREATE POLICY "Users can update their own subscription" ON user_subscriptions
        FOR UPDATE USING (
            user_id = auth.uid() OR
            tenant_id IN (
                SELECT tenant_id FROM profiles 
                WHERE id = auth.uid() AND role IN ('tenant_admin', 'super_admin')
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- RLS Policies for subscription_history
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can view their subscription history" ON subscription_history;
    CREATE POLICY "Users can view their subscription history" ON subscription_history
        FOR SELECT USING (
            user_id = auth.uid() OR
            tenant_id IN (
                SELECT tenant_id FROM profiles 
                WHERE id = auth.uid() AND role IN ('tenant_admin', 'super_admin')
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- RLS Policies for feature_access
DO $$ BEGIN
    DROP POLICY IF EXISTS "Everyone can view feature access requirements" ON feature_access;
    CREATE POLICY "Everyone can view feature access requirements" ON feature_access
        FOR SELECT USING (true);
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Admins can manage feature access" ON feature_access;
    CREATE POLICY "Admins can manage feature access" ON feature_access
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role IN ('super_admin')
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Insert default subscription plans
INSERT INTO subscription_plans (name, tier, description, price_monthly, price_yearly, features, limits) 
VALUES 
(
    'Problem Shifting Access',
    'level_1',
    'Access to Problem Shifting methodology only',
    29.99,
    299.99,
    '{"problem_shifting": true, "basic_assessments": true, "progress_tracking": true}',
    '{"monthly_sessions": 5, "assessments_per_month": 10}'
),
(
    'Complete MyAi Access',
    'level_2', 
    'Access to all methodologies and premium features',
    79.99,
    799.99,
    '{"problem_shifting": true, "all_methods": true, "advanced_assessments": true, "progress_tracking": true, "ai_insights": true, "priority_support": true}',
    '{"monthly_sessions": -1, "assessments_per_month": -1}'
)
ON CONFLICT DO NOTHING;

-- Insert feature access requirements
INSERT INTO feature_access (feature_key, feature_name, description, required_tier, is_core_feature) 
VALUES 
('problem_shifting', 'Problem Shifting', 'Core Problem Shifting methodology', 'level_1', true),
('advanced_methods', 'Advanced Methods', 'All transformation methodologies beyond Problem Shifting', 'level_2', false),
('ai_insights', 'AI Insights', 'Advanced AI-powered insights and recommendations', 'level_2', false),
('unlimited_sessions', 'Unlimited Sessions', 'Unlimited coaching sessions per month', 'level_2', false),
('priority_support', 'Priority Support', 'Priority customer support', 'level_2', false),
('advanced_analytics', 'Advanced Analytics', 'Detailed progress analytics and reports', 'level_2', false),
('team_management', 'Team Management', 'Manage team members and assign coaches', 'level_2', false)
ON CONFLICT DO NOTHING;

-- Function to check user feature access
CREATE OR REPLACE FUNCTION check_user_feature_access(
    user_id_param UUID,
    feature_key_param VARCHAR(100)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_tier subscription_tier;
    required_tier subscription_tier;
BEGIN
    -- Get user's current subscription tier
    SELECT subscription_tier INTO user_tier
    FROM profiles 
    WHERE id = user_id_param;
    
    -- Get required tier for feature
    SELECT fa.required_tier INTO required_tier
    FROM feature_access fa
    WHERE fa.feature_key = feature_key_param;
    
    -- If feature doesn't exist, deny access
    IF required_tier IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- If user has no subscription (trial), only allow trial features
    IF user_tier IS NULL OR user_tier = 'trial' THEN
        RETURN required_tier = 'trial';
    END IF;
    
    -- If user is cancelled, deny access
    IF user_tier = 'cancelled' THEN
        RETURN FALSE;
    END IF;
    
    -- Check tier hierarchy: level_2 can access level_1 features
    IF user_tier = 'level_2' THEN
        RETURN required_tier IN ('trial', 'level_1', 'level_2');
    ELSIF user_tier = 'level_1' THEN
        RETURN required_tier IN ('trial', 'level_1');
    END IF;
    
    RETURN FALSE;
END;
$$;

-- RLS Policies for subscription_plans
DO $$ BEGIN
    DROP POLICY IF EXISTS "Everyone can view active subscription plans" ON subscription_plans;
    CREATE POLICY "Everyone can view active subscription plans" ON subscription_plans
        FOR SELECT USING (status = 'active');
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Admins can manage subscription plans" ON subscription_plans;
    CREATE POLICY "Admins can manage subscription plans" ON subscription_plans
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role IN ('super_admin')
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- RLS Policies for user_subscriptions
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can view their own subscription" ON user_subscriptions;
    CREATE POLICY "Users can view their own subscription" ON user_subscriptions
        FOR SELECT USING (
            user_id = auth.uid() OR
            tenant_id IN (
                SELECT tenant_id FROM profiles 
                WHERE id = auth.uid() AND role IN ('tenant_admin', 'super_admin')
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can update their own subscription" ON user_subscriptions;
    CREATE POLICY "Users can update their own subscription" ON user_subscriptions
        FOR UPDATE USING (
            user_id = auth.uid() OR
            tenant_id IN (
                SELECT tenant_id FROM profiles 
                WHERE id = auth.uid() AND role IN ('tenant_admin', 'super_admin')
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- RLS Policies for subscription_history
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can view their subscription history" ON subscription_history;
    CREATE POLICY "Users can view their subscription history" ON subscription_history
        FOR SELECT USING (
            user_id = auth.uid() OR
            tenant_id IN (
                SELECT tenant_id FROM profiles 
                WHERE id = auth.uid() AND role IN ('tenant_admin', 'super_admin')
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- RLS Policies for feature_access
DO $$ BEGIN
    DROP POLICY IF EXISTS "Everyone can view feature access requirements" ON feature_access;
    CREATE POLICY "Everyone can view feature access requirements" ON feature_access
        FOR SELECT USING (true);
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Admins can manage feature access" ON feature_access;
    CREATE POLICY "Admins can manage feature access" ON feature_access
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role IN ('super_admin')
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Function to update user subscription
CREATE OR REPLACE FUNCTION update_user_subscription(
    user_id_param UUID,
    new_plan_id_param UUID,
    stripe_subscription_id_param VARCHAR(255) DEFAULT NULL,
    change_reason_param VARCHAR(100) DEFAULT 'manual'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_sub user_subscriptions%ROWTYPE;
    new_plan subscription_plans%ROWTYPE;
    user_tenant_id UUID;
    new_subscription_id UUID;
BEGIN
    -- Get user's tenant
    SELECT tenant_id INTO user_tenant_id
    FROM profiles 
    WHERE id = user_id_param;
    
    -- Get new plan details
    SELECT * INTO new_plan
    FROM subscription_plans 
    WHERE id = new_plan_id_param;
    
    IF new_plan.id IS NULL THEN
        RAISE EXCEPTION 'Invalid plan ID';
    END IF;
    
    -- Get current subscription
    SELECT * INTO current_sub
    FROM user_subscriptions 
    WHERE user_id = user_id_param AND tenant_id = user_tenant_id;
    
    -- Create or update subscription
    IF current_sub.id IS NULL THEN
        -- Create new subscription
        INSERT INTO user_subscriptions (
            user_id, tenant_id, plan_id, current_tier, status,
            stripe_subscription_id, current_period_start, current_period_end, trial_ends_at
        ) VALUES (
            user_id_param, user_tenant_id, new_plan.id, new_plan.tier, 'active',
            stripe_subscription_id_param, NOW(), NOW() + INTERVAL '1 month', 
            CASE WHEN new_plan.tier = 'trial' THEN NOW() + INTERVAL '14 days' ELSE NULL END
        ) RETURNING id INTO new_subscription_id;
        
        -- Record history
        INSERT INTO subscription_history (
            subscription_id, user_id, tenant_id, to_tier, to_plan_id,
            change_reason, changed_by, effective_date
        ) VALUES (
            new_subscription_id, user_id_param, user_tenant_id, new_plan.tier, new_plan.id,
            change_reason_param, auth.uid(), NOW()
        );
    ELSE
        -- Update existing subscription
        UPDATE user_subscriptions SET
            plan_id = new_plan.id,
            current_tier = new_plan.tier,
            stripe_subscription_id = COALESCE(stripe_subscription_id_param, stripe_subscription_id),
            updated_at = NOW(),
            cancel_at_period_end = FALSE,
            cancelled_at = NULL
        WHERE id = current_sub.id;
        
        new_subscription_id := current_sub.id;
        
        -- Record history
        INSERT INTO subscription_history (
            subscription_id, user_id, tenant_id, from_tier, to_tier, 
            from_plan_id, to_plan_id, change_reason, changed_by, effective_date
        ) VALUES (
            current_sub.id, user_id_param, user_tenant_id, current_sub.current_tier, new_plan.tier,
            current_sub.plan_id, new_plan.id, change_reason_param, auth.uid(), NOW()
        );
    END IF;
    
    -- Update profile subscription info
    UPDATE profiles SET
        current_subscription_id = new_subscription_id,
        subscription_tier = new_plan.tier,
        updated_at = NOW()
    WHERE id = user_id_param;
    
    RETURN new_subscription_id;
END;
$$;

-- Function to cancel subscription
CREATE OR REPLACE FUNCTION cancel_user_subscription(
    user_id_param UUID,
    cancel_immediately BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_sub user_subscriptions%ROWTYPE;
    user_tenant_id UUID;
BEGIN
    -- Get user's tenant
    SELECT tenant_id INTO user_tenant_id
    FROM profiles 
    WHERE id = user_id_param;
    
    -- Get current subscription
    SELECT * INTO current_sub
    FROM user_subscriptions 
    WHERE user_id = user_id_param AND tenant_id = user_tenant_id;
    
    IF current_sub.id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    IF cancel_immediately THEN
        -- Cancel immediately
        UPDATE user_subscriptions SET
            status = 'canceled',
            current_tier = 'cancelled',
            cancelled_at = NOW(),
            updated_at = NOW()
        WHERE id = current_sub.id;
        
        -- Update profile
        UPDATE profiles SET
            subscription_tier = 'cancelled',
            updated_at = NOW()
        WHERE id = user_id_param;
    ELSE
        -- Cancel at period end
        UPDATE user_subscriptions SET
            cancel_at_period_end = TRUE,
            updated_at = NOW()
        WHERE id = current_sub.id;
    END IF;
    
    -- Record history
    INSERT INTO subscription_history (
        subscription_id, user_id, tenant_id, from_tier, to_tier,
        from_plan_id, change_reason, changed_by, effective_date
    ) VALUES (
        current_sub.id, user_id_param, user_tenant_id, current_sub.current_tier, 'cancelled',
        current_sub.plan_id, 'cancellation', auth.uid(), NOW()
    );
    
    RETURN TRUE;
END;
$$;

-- Add updated_at triggers
DO $$ BEGIN
    DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
    CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
    CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$; 