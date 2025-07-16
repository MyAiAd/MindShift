-- Customer Management System Migration
-- Adds comprehensive customer management tables for admin operations

-- Customer billing information table (no sensitive payment data)
CREATE TABLE IF NOT EXISTS customer_billing_info (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    billing_name VARCHAR(255),
    billing_company VARCHAR(255),
    billing_address_line1 VARCHAR(255),
    billing_address_line2 VARCHAR(255),
    billing_city VARCHAR(100),
    billing_state VARCHAR(100),
    billing_postal_code VARCHAR(20),
    billing_country VARCHAR(3), -- ISO 3166-1 alpha-3
    tax_id VARCHAR(50), -- VAT/Tax identification number
    payment_method_type VARCHAR(50), -- 'card', 'bank_transfer', 'paypal', etc.
    payment_method_last4 VARCHAR(4), -- Last 4 digits for display
    payment_method_brand VARCHAR(50), -- 'visa', 'mastercard', etc.
    payment_method_expires VARCHAR(7), -- MM/YYYY format
    external_customer_id VARCHAR(255), -- Stripe/PayPal customer ID
    metadata JSONB DEFAULT '{}',
    is_primary BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment transactions table (comprehensive transaction tracking)
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
    external_transaction_id VARCHAR(255), -- Stripe/PayPal transaction ID
    external_payment_intent_id VARCHAR(255), -- Stripe payment intent ID
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
        'payment', 'refund', 'chargeback', 'dispute', 'adjustment', 'credit'
    )),
    status VARCHAR(50) NOT NULL CHECK (status IN (
        'pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded', 'disputed'
    )),
    amount_cents INTEGER NOT NULL, -- Amount in cents to avoid decimal issues
    currency_code VARCHAR(3) NOT NULL DEFAULT 'USD', -- ISO 4217
    description TEXT,
    payment_method_type VARCHAR(50),
    payment_method_last4 VARCHAR(4),
    failure_reason VARCHAR(255),
    failure_code VARCHAR(50),
    processor VARCHAR(50), -- 'stripe', 'paypal', 'square', etc.
    processor_fee_cents INTEGER DEFAULT 0,
    net_amount_cents INTEGER, -- Amount after processor fees
    invoice_id VARCHAR(255),
    receipt_url TEXT,
    metadata JSONB DEFAULT '{}',
    processed_at TIMESTAMP WITH TIME ZONE,
    refunded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer notes table (admin communication and notes)
CREATE TABLE IF NOT EXISTS customer_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    customer_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    admin_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
    note_type VARCHAR(50) NOT NULL CHECK (note_type IN (
        'general', 'support', 'billing', 'technical', 'escalation', 'follow_up'
    )),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT TRUE, -- Internal admin note vs customer-visible
    is_pinned BOOLEAN DEFAULT FALSE, -- Pin important notes to top
    tags TEXT[], -- Array of tags for categorization
    follow_up_date DATE, -- Date for follow-up reminder
    resolved_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription changes table (detailed subscription modification tracking)
CREATE TABLE IF NOT EXISTS subscription_changes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE CASCADE NOT NULL,
    admin_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Who made the change
    change_type VARCHAR(50) NOT NULL CHECK (change_type IN (
        'created', 'upgraded', 'downgraded', 'cancelled', 'reactivated', 'paused', 
        'trial_extended', 'plan_changed', 'billing_updated', 'payment_failed',
        'dunning_started', 'grace_period_started', 'expired'
    )),
    change_reason VARCHAR(100), -- 'user_request', 'admin_override', 'payment_failure', etc.
    from_plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
    to_plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
    from_status VARCHAR(50),
    to_status VARCHAR(50),
    from_tier subscription_tier,
    to_tier subscription_tier,
    amount_change_cents INTEGER, -- Price difference in cents
    proration_amount_cents INTEGER, -- Prorated amount for mid-cycle changes
    effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
    billing_cycle_anchor TIMESTAMP WITH TIME ZONE, -- When billing cycle starts
    trial_end_date TIMESTAMP WITH TIME ZONE,
    cancellation_date TIMESTAMP WITH TIME ZONE,
    external_subscription_id VARCHAR(255), -- Stripe subscription ID
    invoice_id VARCHAR(255), -- Associated invoice
    transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
    notes TEXT, -- Admin notes about the change
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_customer_billing_info_user_id ON customer_billing_info(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_billing_info_tenant_id ON customer_billing_info(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_billing_info_external_customer ON customer_billing_info(external_customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_billing_info_active ON customer_billing_info(is_active) WHERE is_active = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_billing_info_primary_unique ON customer_billing_info(user_id) WHERE is_primary = TRUE;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_tenant_id ON payment_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_subscription_id ON payment_transactions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_type ON payment_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_external_id ON payment_transactions(external_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_processed_at ON payment_transactions(processed_at);

CREATE INDEX IF NOT EXISTS idx_customer_notes_customer_user_id ON customer_notes(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_admin_user_id ON customer_notes(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_tenant_id ON customer_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_type ON customer_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_customer_notes_priority ON customer_notes(priority);
CREATE INDEX IF NOT EXISTS idx_customer_notes_pinned ON customer_notes(is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX IF NOT EXISTS idx_customer_notes_follow_up ON customer_notes(follow_up_date) WHERE follow_up_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_notes_created_at ON customer_notes(created_at);

CREATE INDEX IF NOT EXISTS idx_subscription_changes_user_id ON subscription_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_changes_tenant_id ON subscription_changes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_changes_subscription_id ON subscription_changes(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_changes_admin_user_id ON subscription_changes(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_changes_type ON subscription_changes(change_type);
CREATE INDEX IF NOT EXISTS idx_subscription_changes_effective_date ON subscription_changes(effective_date);
CREATE INDEX IF NOT EXISTS idx_subscription_changes_created_at ON subscription_changes(created_at);

-- Enable RLS on all new tables
ALTER TABLE customer_billing_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_changes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_billing_info
DO $$ BEGIN
    CREATE POLICY "Users can view their own billing info" ON customer_billing_info
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
    CREATE POLICY "Users can manage their own billing info" ON customer_billing_info
        FOR ALL USING (
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
    CREATE POLICY "Super admins can manage all billing info" ON customer_billing_info
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- RLS Policies for payment_transactions
DO $$ BEGIN
    CREATE POLICY "Users can view their own transactions" ON payment_transactions
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
    CREATE POLICY "Admins can manage transactions" ON payment_transactions
        FOR ALL USING (
            tenant_id IN (
                SELECT tenant_id FROM profiles 
                WHERE id = auth.uid() AND role IN ('tenant_admin', 'super_admin')
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Super admins can manage all transactions" ON payment_transactions
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- RLS Policies for customer_notes
DO $$ BEGIN
    CREATE POLICY "Admins can view customer notes in their tenant" ON customer_notes
        FOR SELECT USING (
            tenant_id IN (
                SELECT tenant_id FROM profiles 
                WHERE id = auth.uid() AND role IN ('manager', 'coach', 'tenant_admin', 'super_admin')
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Admins can manage customer notes in their tenant" ON customer_notes
        FOR ALL USING (
            tenant_id IN (
                SELECT tenant_id FROM profiles 
                WHERE id = auth.uid() AND role IN ('manager', 'coach', 'tenant_admin', 'super_admin')
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Super admins can manage all customer notes" ON customer_notes
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- RLS Policies for subscription_changes
DO $$ BEGIN
    CREATE POLICY "Users can view their own subscription changes" ON subscription_changes
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
    CREATE POLICY "Admins can manage subscription changes" ON subscription_changes
        FOR ALL USING (
            tenant_id IN (
                SELECT tenant_id FROM profiles 
                WHERE id = auth.uid() AND role IN ('tenant_admin', 'super_admin')
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY "Super admins can manage all subscription changes" ON subscription_changes
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'super_admin'
            )
        );
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Enhanced audit logging function for admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
    p_action VARCHAR(100),
    p_resource_type VARCHAR(100),
    p_resource_id UUID,
    p_old_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_user_id UUID;
    v_admin_tenant_id UUID;
    v_audit_id UUID;
BEGIN
    -- Get current admin user info
    SELECT id INTO v_admin_user_id FROM auth.users WHERE id = auth.uid();
    
    IF v_admin_user_id IS NULL THEN
        RAISE EXCEPTION 'No authenticated user found';
    END IF;
    
    -- Get admin's tenant (super admin will have NULL tenant_id)
    SELECT tenant_id INTO v_admin_tenant_id 
    FROM profiles 
    WHERE id = v_admin_user_id;
    
    -- Create enhanced audit log entry
    INSERT INTO audit_logs (
        tenant_id,
        user_id,
        action,
        resource_type,
        resource_id,
        old_data,
        new_data,
        ip_address,
        user_agent,
        created_at
    ) VALUES (
        v_admin_tenant_id,
        v_admin_user_id,
        p_action,
        p_resource_type,
        p_resource_id,
        COALESCE(p_old_data, '{}'::jsonb),
        COALESCE(p_new_data, '{}'::jsonb) || 
        CASE WHEN p_notes IS NOT NULL THEN jsonb_build_object('admin_notes', p_notes) ELSE '{}'::jsonb END,
        inet_client_addr(),
        current_setting('request.headers', true)::jsonb ->> 'user-agent',
        NOW()
    ) RETURNING id INTO v_audit_id;
    
    RETURN v_audit_id;
END;
$$;

-- Function to get customer analytics for admin dashboard
CREATE OR REPLACE FUNCTION get_customer_analytics(
    p_tenant_id UUID DEFAULT NULL,
    p_days INTEGER DEFAULT 30
) RETURNS TABLE (
    total_customers INTEGER,
    active_subscriptions INTEGER,
    trial_users INTEGER,
    cancelled_users INTEGER,
    total_revenue_cents BIGINT,
    monthly_recurring_revenue_cents BIGINT,
    churn_rate DECIMAL,
    avg_customer_lifetime_days DECIMAL,
    payment_success_rate DECIMAL,
    support_tickets_count INTEGER
) AS $$
DECLARE
    v_period_start TIMESTAMP := NOW() - INTERVAL '1 day' * p_days;
BEGIN
    RETURN QUERY
    WITH customer_stats AS (
        SELECT 
            COUNT(DISTINCT p.id) as customers,
            COUNT(DISTINCT CASE WHEN us.status = 'active' THEN p.id END) as active_subs,
            COUNT(DISTINCT CASE WHEN p.subscription_tier = 'trial' THEN p.id END) as trials,
            COUNT(DISTINCT CASE WHEN p.subscription_tier = 'cancelled' THEN p.id END) as cancelled
        FROM profiles p
        LEFT JOIN user_subscriptions us ON us.user_id = p.id
        WHERE (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
        AND p.role != 'super_admin'
    ),
    revenue_stats AS (
        SELECT 
            COALESCE(SUM(pt.amount_cents), 0) as total_revenue,
            COALESCE(SUM(CASE WHEN pt.created_at >= DATE_TRUNC('month', CURRENT_DATE) 
                         THEN pt.amount_cents ELSE 0 END), 0) as mrr
        FROM payment_transactions pt
        WHERE pt.status = 'succeeded'
        AND pt.transaction_type = 'payment'
        AND (p_tenant_id IS NULL OR pt.tenant_id = p_tenant_id)
        AND pt.created_at >= v_period_start
    ),
    payment_stats AS (
        SELECT 
            COUNT(*) as total_payments,
            COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as successful_payments
        FROM payment_transactions pt
        WHERE (p_tenant_id IS NULL OR pt.tenant_id = p_tenant_id)
        AND pt.created_at >= v_period_start
    ),
    support_stats AS (
        SELECT COUNT(*) as tickets
        FROM customer_notes cn
        WHERE cn.note_type IN ('support', 'technical', 'escalation')
        AND (p_tenant_id IS NULL OR cn.tenant_id = p_tenant_id)
        AND cn.created_at >= v_period_start
    )
    SELECT 
        cs.customers::INTEGER,
        cs.active_subs::INTEGER,
        cs.trials::INTEGER,
        cs.cancelled::INTEGER,
        rs.total_revenue::BIGINT,
        rs.mrr::BIGINT,
        CASE WHEN cs.customers > 0 THEN 
            ROUND((cs.cancelled::DECIMAL / cs.customers * 100), 2)
        ELSE 0 END as churn_rate,
        30.0 as avg_lifetime, -- Placeholder - would need more complex calculation
        CASE WHEN ps.total_payments > 0 THEN 
            ROUND((ps.successful_payments::DECIMAL / ps.total_payments * 100), 2)
        ELSE 0 END as success_rate,
        ss.tickets::INTEGER
    FROM customer_stats cs, revenue_stats rs, payment_stats ps, support_stats ss;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add updated_at triggers for new tables
DO $$ BEGIN
    CREATE TRIGGER update_customer_billing_info_updated_at 
        BEFORE UPDATE ON customer_billing_info
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_payment_transactions_updated_at 
        BEFORE UPDATE ON payment_transactions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_customer_notes_updated_at 
        BEFORE UPDATE ON customer_notes
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$; 