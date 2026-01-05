-- ===============================================
-- REMOVE PROBLEMATIC EMAIL CONFIRMATION TRIGGER
-- ===============================================
-- Migration 055: Remove trigger that blocks email confirmation
-- VERSION: 2025-01-05-v2
--
-- After extensive testing, the trigger on auth.users causes email
-- confirmation to fail with "Error confirming user" even when wrapped
-- in complete exception handling.
--
-- DECISION: Remove the trigger and rely solely on the RPC function.
-- The frontend already has fallback logic that calls
-- handle_new_user_registration() when a profile is missing.
--
-- TRADE-OFF: Profiles are created slightly later (on first app load
-- after login) instead of during email confirmation. This is acceptable
-- and more reliable than a trigger that blocks user signups.
-- ===============================================

BEGIN;

-- Drop the problematic trigger
DROP TRIGGER IF EXISTS handle_new_user_profile_update ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_profile_insert ON auth.users;

-- Drop the trigger function (no longer needed)
DROP FUNCTION IF EXISTS handle_new_user_profile();

-- Keep the RPC function - this is what creates profiles now
-- (Already exists from migration 052, just confirming it's the source of truth)

COMMIT;

-- ===============================================
-- VERIFICATION
-- ===============================================
-- After this migration:
-- 1. Email confirmation will succeed immediately
-- 2. User can log in successfully
-- 3. Profile will be created when user first loads the app
-- 4. Frontend handles this via handle_new_user_registration RPC call
--
-- This is the correct, reliable approach.
-- ===============================================
