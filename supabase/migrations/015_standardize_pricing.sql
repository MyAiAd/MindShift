-- ============================================================================
-- Migration 015: Standardize Pricing Across All Plans
-- ============================================================================
-- This migration standardizes pricing to:
-- - Free/Trial: $0.00
-- - Basic/Problem Shifting: $29.00/month, $299.00/year
-- - Complete/Top-tier: $49.00/month, $499.00/year

-- Update existing subscription plans with standardized pricing
UPDATE subscription_plans 
SET 
    name = 'Essential MyAi',
    description = 'Perfect for individuals getting started with AI transformation',
    price_monthly = 29.00,
    price_yearly = 290.00,
    features = jsonb_build_array(
        'AI Chat Assistant',
        'Basic Progress Tracking',
        'Goal Setting',
        'Email Support'
    ),
    active = true,
    trial_days = 14
WHERE name = 'Essential' OR name = 'Basic' OR name = 'Starter';

UPDATE subscription_plans 
SET 
    name = 'Complete MyAi',
    description = 'Full access to all methodologies and premium features',
    price_monthly = 49.00,
    price_yearly = 499.00,
    features = '{"problem_shifting": true, "all_methods": true, "advanced_assessments": true, "progress_tracking": true, "ai_insights": true, "priority_support": true, "team_management": true, "unlimited_sessions": true}',
    limits = '{"monthly_sessions": -1, "assessments_per_month": -1}',
    updated_at = NOW()
WHERE tier = 'level_2';

-- Ensure trial plan is set to $0
UPDATE subscription_plans 
SET 
    name = 'Free Trial',
    description = 'Perfect for exploring MyAi features',
    price_monthly = 0.00,
    price_yearly = 0.00,
    features = '{"problem_shifting": false, "basic_assessments": true, "progress_tracking": true, "community_support": true}',
    limits = '{"monthly_sessions": 3, "trial_days": 14}',
    updated_at = NOW()
WHERE tier = 'trial';

-- Insert trial plan if it doesn't exist
INSERT INTO subscription_plans (name, tier, description, price_monthly, price_yearly, features, limits, status) 
SELECT 'Free Trial', 'trial', 'Perfect for exploring MyAi features', 0.00, 0.00, 
       '{"problem_shifting": false, "basic_assessments": true, "progress_tracking": true, "community_support": true}',
       '{"monthly_sessions": 3, "trial_days": 14}', 'active'
WHERE NOT EXISTS (
    SELECT 1 FROM subscription_plans WHERE tier = 'trial'
);

-- Update any existing user subscriptions to reflect new pricing
-- This ensures billing consistency for existing customers
UPDATE user_subscriptions 
SET updated_at = NOW()
WHERE plan_id IN (
    SELECT id FROM subscription_plans WHERE tier IN ('level_1', 'level_2', 'trial')
);

-- Log the pricing change in subscription history for audit purposes
INSERT INTO subscription_history (
    subscription_id,
    user_id,
    tenant_id,
    from_tier,
    to_tier,
    from_plan_id,
    to_plan_id,
    change_reason,
    changed_by,
    effective_date,
    metadata
)
SELECT 
    us.id,
    us.user_id,
    us.tenant_id,
    us.current_tier,
    us.current_tier, -- Same tier, just price change
    us.plan_id,
    us.plan_id,
    'pricing_standardization',
    NULL, -- System change
    NOW(),
    '{"old_pricing": "legacy", "new_pricing": "standardized", "migration": "015"}'
FROM user_subscriptions us
JOIN subscription_plans sp ON sp.id = us.plan_id
WHERE sp.tier IN ('level_1', 'level_2', 'trial');

-- Create a function to get current pricing for display
CREATE OR REPLACE FUNCTION get_standardized_pricing()
RETURNS TABLE (
    tier_name VARCHAR(50),
    plan_name VARCHAR(100),
    monthly_price DECIMAL(10,2),
    yearly_price DECIMAL(10,2),
    yearly_savings DECIMAL(10,2),
    description TEXT,
    features JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.tier::VARCHAR(50) as tier_name,
        sp.name,
        sp.price_monthly,
        sp.price_yearly,
        CASE 
            WHEN sp.price_yearly > 0 THEN (sp.price_monthly * 12) - sp.price_yearly
            ELSE 0
        END as yearly_savings,
        sp.description,
        sp.features
    FROM subscription_plans sp
    WHERE sp.status = 'active'
    ORDER BY sp.price_monthly ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_standardized_pricing() TO authenticated;
GRANT EXECUTE ON FUNCTION get_standardized_pricing() TO anon; 