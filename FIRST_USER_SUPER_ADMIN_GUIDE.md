# First User Super Admin Setup Guide

## Overview
This guide explains how the first user registration automatically becomes a super admin in the MyAi system.

## How It Works

### Automatic Super Admin Creation
When the first user registers in the system:
1. The system checks if there are any existing confirmed users
2. If this is the first user, they automatically get:
   - Role: `super_admin`
   - Default tenant: "Super Admin Organization" (slug: `super-admin`)
   - Subscription status: `active`
   - Trial period: 10 years
   - Full access to all features

### Function: `handle_new_user_registration`
This function is called automatically when a new user registers and handles:
- Checking if user is first in system
- Creating super admin tenant if needed
- Setting appropriate role and permissions
- Creating audit log entry

## Database Changes

### Migration 023: `023_first_user_super_admin.sql`
- Created the `handle_new_user_registration` function
- Added proper RLS policies for super admin access
- Set up automatic tenant creation for super admins

### Migration 029: `029_fix_subscription_status_enum.sql`
- Fixed enum value error where `'premium'` was invalid
- Changed to use `'active'` as valid subscription_status
- Valid enum values: `'active'`, `'canceled'`, `'past_due'`, `'unpaid'`, `'trialing'`

## Current Status
✅ Super admin setup is working correctly
✅ Subscription status enum error fixed
✅ First user automatically becomes super admin with proper permissions

## Testing
To test the super admin setup:
1. Clear all existing users from the system
2. Register a new user
3. They should automatically become super admin
4. Check their role in the profiles table

## Troubleshooting

### 400 Error: Invalid subscription_status enum
**FIXED**: This was caused by using `'premium'` as subscription_status value
- **Solution**: Changed to `'active'` in migration 029
- **Valid values**: `'active'`, `'canceled'`, `'past_due'`, `'unpaid'`, `'trialing'`

### No Profile Found Error
If you get "No profile found" errors:
1. Check that the user exists in `auth.users`
2. Verify the `handle_new_user_registration` function was called
3. Check the `profiles` table for the user record

### RLS Policy Issues
If super admin can't access resources:
1. Check the RLS policies allow super admin access
2. Verify the user's role is set to `'super_admin'`
3. Check that policies use the correct column names

## Migration History
- **023**: Initial super admin setup
- **024**: Fix RLS recursion issues
- **025**: Final RLS recursion fix
- **026**: Disable email confirmations
- **027**: Update site URL for production
- **028**: Comprehensive RLS fix
- **029**: Fix subscription_status enum error 