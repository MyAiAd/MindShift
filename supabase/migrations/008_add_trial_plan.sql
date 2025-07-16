-- Add missing trial plan and update existing plans to match pricing page

-- Update existing plans to match pricing page exactly
UPDATE subscription_plans 
SET 
    description = 'Perfect for getting started with mindset transformation',
    price_monthly = 29.00,
    price_yearly = 299.00,
    features = '{"problem_shifting": true, "basic_assessments": true, "progress_tracking": true, "email_support": true, "mobile_app": true}',
    limits = '{"monthly_sessions": 10, "assessments_per_month": -1}',
    updated_at = NOW()
WHERE tier = 'level_1';

UPDATE subscription_plans 
SET 
    description = 'Full access to all methodologies and premium features',
    price_monthly = 79.00,
    price_yearly = 799.00,
    features = '{"problem_shifting": true, "all_methods": true, "advanced_assessments": true, "progress_tracking": true, "ai_insights": true, "priority_support": true, "team_management": true, "unlimited_sessions": true}',
    limits = '{"monthly_sessions": -1, "assessments_per_month": -1}',
    updated_at = NOW()
WHERE tier = 'level_2';

-- Insert trial plan if it doesn't already exist
INSERT INTO subscription_plans (name, tier, description, price_monthly, price_yearly, features, limits, status) 
SELECT 'Free Trial', 'trial', 'Perfect for exploring MyAi', 0.00, 0.00, 
       '{"problem_shifting": false, "basic_assessments": true, "progress_tracking": true, "community_support": true}',
       '{"monthly_sessions": 3, "trial_days": 14}', 'active'
WHERE NOT EXISTS (
    SELECT 1 FROM subscription_plans WHERE tier = 'trial'
); 