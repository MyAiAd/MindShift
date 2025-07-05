-- ============================================================================
-- Migration 012: Stripe Integration
-- ============================================================================
-- This migration adds Stripe-specific tables and enhancements for:
-- 1. Stripe webhook event storage and idempotency
-- 2. Enhanced payment transaction tracking
-- 3. Stripe customer and subscription metadata

-- Stripe webhook events table for idempotency and audit
CREATE TABLE stripe_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_event_id VARCHAR(255) UNIQUE NOT NULL, -- Stripe's evt_xxx ID for idempotency
    event_type VARCHAR(100) NOT NULL, -- customer.subscription.updated, etc.
    api_version VARCHAR(20), -- Stripe API version
    processed_at TIMESTAMPTZ NULL, -- When we successfully processed it
    failed_at TIMESTAMPTZ NULL, -- When processing failed
    retry_count INTEGER DEFAULT 0, -- Number of processing attempts
    data JSONB NOT NULL, -- Full Stripe event data
    processing_error TEXT NULL, -- Error message if processing failed
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- Extracted from metadata
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Extracted from customer
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the indexes separately (PostgreSQL syntax)
CREATE INDEX idx_stripe_events_stripe_id ON stripe_events(stripe_event_id);
CREATE INDEX idx_stripe_events_type ON stripe_events(event_type);
CREATE INDEX idx_stripe_events_processed ON stripe_events(processed_at);
CREATE INDEX idx_stripe_events_failed ON stripe_events(failed_at);
CREATE INDEX idx_stripe_events_tenant ON stripe_events(tenant_id);
CREATE INDEX idx_stripe_events_user ON stripe_events(user_id);
CREATE INDEX idx_stripe_events_created ON stripe_events(created_at);

-- Add Stripe-specific columns to existing tables
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(255), -- Stripe price ID (price_xxx)
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id VARCHAR(255), -- For tracking checkout sessions
ADD COLUMN IF NOT EXISTS stripe_invoice_id VARCHAR(255), -- Latest invoice ID
ADD COLUMN IF NOT EXISTS stripe_payment_method_id VARCHAR(255), -- Default payment method
ADD COLUMN IF NOT EXISTS billing_cycle_anchor TIMESTAMPTZ, -- When billing cycle starts
ADD COLUMN IF NOT EXISTS proration_behavior VARCHAR(50) DEFAULT 'create_prorations'; -- create_prorations, none, always_invoice

ALTER TABLE payment_transactions
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255), -- Stripe PaymentIntent ID
ADD COLUMN IF NOT EXISTS stripe_invoice_id VARCHAR(255), -- Stripe Invoice ID
ADD COLUMN IF NOT EXISTS stripe_charge_id VARCHAR(255), -- Stripe Charge ID
ADD COLUMN IF NOT EXISTS payment_method_type VARCHAR(50), -- card, bank_transfer, etc.
ADD COLUMN IF NOT EXISTS card_last4 VARCHAR(4), -- Last 4 digits of card
ADD COLUMN IF NOT EXISTS card_brand VARCHAR(20), -- visa, mastercard, etc.
ADD COLUMN IF NOT EXISTS failure_code VARCHAR(100), -- Stripe failure code
ADD COLUMN IF NOT EXISTS failure_message TEXT; -- Human readable failure message

ALTER TABLE customer_billing_info
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) UNIQUE, -- Stripe customer ID
ADD COLUMN IF NOT EXISTS default_payment_method_id VARCHAR(255), -- Stripe payment method ID
ADD COLUMN IF NOT EXISTS payment_method_type VARCHAR(50), -- card, bank_transfer, etc.
ADD COLUMN IF NOT EXISTS card_fingerprint VARCHAR(255), -- Unique card identifier
ADD COLUMN IF NOT EXISTS invoice_settings JSONB DEFAULT '{}'; -- Customer invoice preferences

-- Stripe webhook processing status enum
DO $$ BEGIN
    CREATE TYPE stripe_processing_status AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'skipped');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- Enhanced Functions for Stripe Integration
-- ============================================================================

-- Function to process Stripe webhook events with idempotency
CREATE OR REPLACE FUNCTION process_stripe_webhook_event(
    p_stripe_event_id VARCHAR(255),
    p_event_type VARCHAR(100),
    p_api_version VARCHAR(20),
    p_event_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_event_record stripe_events%ROWTYPE;
    v_tenant_id UUID;
    v_user_id UUID;
    v_customer_id VARCHAR(255);
    v_subscription_id VARCHAR(255);
    v_result JSONB := '{"status": "pending"}';
BEGIN
    -- Check if event already exists (idempotency)
    SELECT * INTO v_event_record
    FROM stripe_events
    WHERE stripe_event_id = p_stripe_event_id;
    
    IF v_event_record.id IS NOT NULL THEN
        -- Event already processed or being processed
        IF v_event_record.processed_at IS NOT NULL THEN
            RETURN jsonb_build_object(
                'status', 'already_processed',
                'processed_at', v_event_record.processed_at,
                'event_id', v_event_record.id
            );
        ELSE
            RETURN jsonb_build_object(
                'status', 'already_exists',
                'event_id', v_event_record.id
            );
        END IF;
    END IF;
    
    -- Extract customer ID from event data
    v_customer_id := p_event_data->'data'->'object'->>'customer';
    IF v_customer_id IS NULL THEN
        v_customer_id := p_event_data->'data'->'object'->'customer'->>'id';
    END IF;
    
    -- Extract subscription ID from event data
    v_subscription_id := p_event_data->'data'->'object'->>'id';
    IF p_event_type LIKE '%subscription%' THEN
        v_subscription_id := p_event_data->'data'->'object'->>'id';
    ELSIF p_event_type LIKE '%invoice%' THEN
        v_subscription_id := p_event_data->'data'->'object'->>'subscription';
    END IF;
    
    -- Try to find tenant and user from our records
    IF v_customer_id IS NOT NULL THEN
        SELECT cb.user_id, p.tenant_id 
        INTO v_user_id, v_tenant_id
        FROM customer_billing_info cb
        JOIN profiles p ON p.id = cb.user_id
        WHERE cb.stripe_customer_id = v_customer_id;
    END IF;
    
    -- If not found by customer, try by subscription
    IF v_user_id IS NULL AND v_subscription_id IS NOT NULL THEN
        SELECT us.user_id, us.tenant_id
        INTO v_user_id, v_tenant_id
        FROM user_subscriptions us
        WHERE us.stripe_subscription_id = v_subscription_id;
    END IF;
    
    -- Insert the event record
    INSERT INTO stripe_events (
        stripe_event_id,
        event_type,
        api_version,
        data,
        tenant_id,
        user_id
    ) VALUES (
        p_stripe_event_id,
        p_event_type,
        p_api_version,
        p_event_data,
        v_tenant_id,
        v_user_id
    ) RETURNING * INTO v_event_record;
    
    -- Log the webhook receipt
    PERFORM log_security_event(
        'stripe_webhook_received',
        v_user_id,
        v_tenant_id,
        jsonb_build_object(
            'stripe_event_id', p_stripe_event_id,
            'event_type', p_event_type,
            'customer_id', v_customer_id,
            'subscription_id', v_subscription_id
        ),
        NULL,
        NULL,
        'info'
    );
    
    RETURN jsonb_build_object(
        'status', 'received',
        'event_id', v_event_record.id,
        'tenant_id', v_tenant_id,
        'user_id', v_user_id
    );
END;
$$;

-- Function to mark Stripe event as processed
CREATE OR REPLACE FUNCTION mark_stripe_event_processed(
    p_event_id UUID,
    p_success BOOLEAN DEFAULT TRUE,
    p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_success THEN
        UPDATE stripe_events SET
            processed_at = NOW(),
            failed_at = NULL,
            processing_error = NULL
        WHERE id = p_event_id;
    ELSE
        UPDATE stripe_events SET
            failed_at = NOW(),
            retry_count = retry_count + 1,
            processing_error = p_error_message
        WHERE id = p_event_id;
    END IF;
    
    RETURN FOUND;
END;
$$;

-- Function to sync subscription from Stripe data
CREATE OR REPLACE FUNCTION sync_subscription_from_stripe(
    p_stripe_subscription_data JSONB,
    p_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_subscription_id UUID;
    v_stripe_sub_id VARCHAR(255);
    v_stripe_customer_id VARCHAR(255);
    v_user_id UUID := p_user_id;
    v_tenant_id UUID;
    v_status VARCHAR(50);
    v_current_period_start TIMESTAMPTZ;
    v_current_period_end TIMESTAMPTZ;
    v_trial_end TIMESTAMPTZ;
    v_cancel_at_period_end BOOLEAN;
    v_cancelled_at TIMESTAMPTZ;
    v_plan_id UUID;
    v_tier subscription_tier;
BEGIN
    -- Extract data from Stripe subscription object
    v_stripe_sub_id := p_stripe_subscription_data->>'id';
    v_stripe_customer_id := p_stripe_subscription_data->>'customer';
    v_status := p_stripe_subscription_data->>'status';
    v_current_period_start := to_timestamp((p_stripe_subscription_data->>'current_period_start')::bigint);
    v_current_period_end := to_timestamp((p_stripe_subscription_data->>'current_period_end')::bigint);
    v_cancel_at_period_end := (p_stripe_subscription_data->>'cancel_at_period_end')::boolean;
    
    -- Handle trial end
    IF p_stripe_subscription_data->>'trial_end' IS NOT NULL AND p_stripe_subscription_data->>'trial_end' != 'null' THEN
        v_trial_end := to_timestamp((p_stripe_subscription_data->>'trial_end')::bigint);
    END IF;
    
    -- Handle cancellation
    IF p_stripe_subscription_data->>'canceled_at' IS NOT NULL AND p_stripe_subscription_data->>'canceled_at' != 'null' THEN
        v_cancelled_at := to_timestamp((p_stripe_subscription_data->>'canceled_at')::bigint);
    END IF;
    
    -- Find user if not provided
    IF v_user_id IS NULL THEN
        SELECT cb.user_id INTO v_user_id
        FROM customer_billing_info cb
        WHERE cb.stripe_customer_id = v_stripe_customer_id;
    END IF;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Could not find user for Stripe customer %', v_stripe_customer_id;
    END IF;
    
    -- Get user's tenant
    SELECT tenant_id INTO v_tenant_id
    FROM profiles
    WHERE id = v_user_id;
    
    -- Map Stripe status to our status
    CASE v_status
        WHEN 'active' THEN v_status := 'active';
        WHEN 'trialing' THEN v_status := 'trialing';
        WHEN 'past_due' THEN v_status := 'past_due';
        WHEN 'canceled' THEN v_status := 'canceled';
        WHEN 'unpaid' THEN v_status := 'past_due';
        ELSE v_status := 'incomplete';
    END CASE;
    
    -- Determine tier from price ID (we'll enhance this later)
    -- For now, assume level_1 unless it's our level_2 price
    v_tier := 'level_1'; -- Default
    v_plan_id := (SELECT id FROM subscription_plans WHERE tier = v_tier LIMIT 1);
    
    -- Update or insert subscription
    INSERT INTO user_subscriptions (
        user_id,
        tenant_id,
        plan_id,
        stripe_subscription_id,
        stripe_customer_id,
        current_tier,
        status,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        cancelled_at,
        trial_ends_at,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        v_tenant_id,
        v_plan_id,
        v_stripe_sub_id,
        v_stripe_customer_id,
        v_tier,
        v_status::subscription_status,
        v_current_period_start,
        v_current_period_end,
        v_cancel_at_period_end,
        v_cancelled_at,
        v_trial_end,
        NOW(),
        NOW()
    )
    ON CONFLICT (user_id, tenant_id)
    DO UPDATE SET
        stripe_subscription_id = v_stripe_sub_id,
        stripe_customer_id = v_stripe_customer_id,
        current_tier = v_tier,
        status = v_status::subscription_status,
        current_period_start = v_current_period_start,
        current_period_end = v_current_period_end,
        cancel_at_period_end = v_cancel_at_period_end,
        cancelled_at = v_cancelled_at,
        trial_ends_at = v_trial_end,
        updated_at = NOW()
    RETURNING id INTO v_subscription_id;
    
    -- Update profile subscription info
    UPDATE profiles SET
        current_subscription_id = v_subscription_id,
        subscription_tier = v_tier,
        updated_at = NOW()
    WHERE id = v_user_id;
    
    RETURN v_subscription_id;
END;
$$;

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

-- Stripe Events Policies (admin only)
CREATE POLICY "stripe_events_admin_access" ON stripe_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role IN ('tenant_admin', 'super_admin')
        )
    );

-- ============================================================================
-- Additional Indexes for Performance
-- ============================================================================

-- Composite indexes for common webhook queries
CREATE INDEX idx_stripe_events_type_processed ON stripe_events(event_type, processed_at);
CREATE INDEX idx_stripe_events_tenant_type ON stripe_events(tenant_id, event_type) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_stripe_events_failed_retry ON stripe_events(failed_at, retry_count) WHERE failed_at IS NOT NULL;

-- Indexes for enhanced subscription columns
CREATE INDEX idx_user_subscriptions_stripe_sub ON user_subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX idx_user_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_customer_billing_stripe_customer ON customer_billing_info(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ============================================================================
-- Grant Permissions
-- ============================================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON stripe_events TO authenticated;

-- Grant function execution permissions
GRANT EXECUTE ON FUNCTION process_stripe_webhook_event TO authenticated;
GRANT EXECUTE ON FUNCTION mark_stripe_event_processed TO authenticated;
GRANT EXECUTE ON FUNCTION sync_subscription_from_stripe TO authenticated; 