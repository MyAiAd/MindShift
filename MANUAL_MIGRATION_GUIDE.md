# Migration Execution Guide

Due to IPv6 connectivity limitations on your system, the migrations need to be run manually through the Supabase Dashboard.

## Quick Access Links

- **Supabase Dashboard**: https://supabase.com/dashboard
- **SQL Editor**: https://supabase.com/dashboard/project/kdxwfaynzemmdonkmttf/sql/new
- **Project**: kdxwfaynzemmdonkmttf

## Migrations to Run (In Order)

All migrations are **idempotent** - safe to run multiple times.

### Migration 1: Media Support (030)
**File**: `supabase/migrations/030_community_media_support.sql`

This adds support for images, videos, and file attachments to community posts.

### Migration 2: Member Features (031)
**File**: `supabase/migrations/031_community_member_features.sql`

This adds member directory features (bio, avatar, blocking, etc.).

### Migration 3: Comment Fixes (032)
**File**: `supabase/migrations/032_fix_community_comments.sql`

This fixes RLS policies for community comments.

### Migration 4: Notification Preferences Fix (033)
**File**: `supabase/migrations/033_fix_notification_preferences_rls.sql`

This fixes the RLS issue for notification preferences table.

### Migration 5: Duplicate Key Fix (034)
**File**: `supabase/migrations/034_fix_notification_preferences_duplicate.sql`

This fixes the duplicate key constraint error when creating default notification preferences.

## How to Execute

### Option 1: Via Supabase SQL Editor (Recommended)

1. Go to https://supabase.com/dashboard/project/kdxwfaynzemmdonkmttf/sql/new
2. Open each migration file in order (030, 031, 032, 033, 034)
3. Copy the entire contents of the file
4. Paste into the SQL Editor
5. Click "RUN" button
6. Wait for "Success" message
7. Proceed to next migration

### Option 2: Via Command Line Script

Run this to display all SQL:
```bash
node show-migrations.js > migrations-to-run.sql
```

Then copy from the output file into the SQL Editor.

### Option 3: If you have IPv4 connectivity elsewhere

Transfer these files to a machine with IPv4 connectivity and run:
```bash
node run-migrations.js
```

## Verification

After running all migrations, verify:

1. Check that comments can be created (test on community page)
2. Check that new columns exist in `community_posts` table
3. Check that `community_blocks` table exists
4. Check storage buckets exist: `community-media`, `community-attachments`

## Rollback (if needed)

All migrations are idempotent and use `IF NOT EXISTS` / `OR REPLACE` patterns, so they're safe to run multiple times. If you need to roll back, we can create reverse migrations.

## Current Status

- ✅ Migration files created
- ✅ Code deployed to Vercel
- ⏳ **PENDING: Database migrations need to be run manually**
- ⏳ Test comment creation after migrations

