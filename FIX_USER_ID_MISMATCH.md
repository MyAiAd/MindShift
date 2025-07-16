# Fix User ID Mismatch Guide

## Problem Description
When users see an infinite loading screen and console errors showing:
```
Error: insert or update on table "profiles" violates foreign key constraint "profiles_id_fkey"
Key (id)=(user-id) is not present in table "users"
```

This indicates that the user session contains a user ID that doesn't exist in the `auth.users` table.

## Root Causes
1. **User deleted from auth.users** but session still cached
2. **Email confirmation issues** - user exists but not confirmed
3. **ID mismatch** between session and database
4. **Database inconsistency** after migrations or cleanup

## Solution Applied (Migration 030)

### 1. Enhanced Error Handling
The `handle_new_user_registration` function now:
- Checks if user exists in `auth.users` before inserting profile
- Returns detailed error information instead of throwing exceptions
- Provides debugging information for troubleshooting

### 2. Debug Function Added
```sql
SELECT debug_auth_user_info('user@example.com');
```
This function returns:
- Current session user ID
- Auth.users record for the email
- Whether IDs match
- User confirmation status

### 3. Graceful Failure
Instead of throwing foreign key violations, the function now:
- Returns `{"success": false, "error": "user_not_found"}`
- Provides debugging information
- Logs issues to help identify the problem

## Troubleshooting Steps

### Step 1: Check User Existence
```sql
-- Check if user exists in auth.users
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users 
WHERE email = 'user@example.com';
```

### Step 2: Check Session vs Database
```sql
-- Use the debug function
SELECT debug_auth_user_info('user@example.com');
```

### Step 3: Check Profile Existence
```sql
-- Check if profile exists
SELECT id, email, role, created_at 
FROM profiles 
WHERE email = 'user@example.com';
```

### Step 4: Manual Profile Creation (if needed)
```sql
-- If user exists in auth.users but no profile
INSERT INTO profiles (id, email, role, is_active, created_at, updated_at)
SELECT id, email, 'user', true, NOW(), NOW()
FROM auth.users 
WHERE email = 'user@example.com'
AND id NOT IN (SELECT id FROM profiles);
```

## Prevention

### 1. Proper User Registration Flow
- Ensure user registration completes successfully
- Verify email confirmation works
- Test the complete authentication flow

### 2. Database Consistency
- Always backup before major migrations
- Test migrations on staging first
- Monitor for foreign key violations

### 3. Session Management
- Clear sessions when users are deleted
- Implement proper logout on user deletion
- Handle edge cases in authentication flow

## Common Scenarios

### Scenario 1: User Deleted but Session Persists
**Solution**: Clear browser session storage and force re-authentication

### Scenario 2: Email Not Confirmed
**Solution**: Check `email_confirmed_at` in auth.users and trigger re-confirmation

### Scenario 3: ID Mismatch
**Solution**: Use debug function to identify the mismatch and fix manually

### Scenario 4: Multiple Users with Same Email
**Solution**: Clean up duplicate users and ensure unique email constraints

## Migration History
- **030**: Added auth.users existence check and debug function
- **029**: Fixed subscription_status enum error
- **028**: Comprehensive RLS fix
- **Previous**: Various authentication and profile fixes

## Testing
After applying the fix:
1. Clear browser cache and sessions
2. Try logging in with the problematic user
3. Check console for new error messages (should be more descriptive)
4. Use debug function to understand the issue
5. Take appropriate action based on the error type

## When to Use Manual Intervention
- If debug function shows user exists but with different ID
- If multiple users exist with same email
- If auth.users record exists but profile doesn't
- If you need to merge or clean up user records

## Prevention Checklist
- [ ] Test complete registration flow
- [ ] Verify email confirmation works
- [ ] Check foreign key constraints before major changes
- [ ] Monitor authentication errors
- [ ] Keep auth.users and profiles in sync
- [ ] Test edge cases (deleted users, unconfirmed emails, etc.) 