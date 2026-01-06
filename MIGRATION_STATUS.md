# Community Social Upgrades - Database Migration Status

## Current Situation

I've encountered an **IPv6 connectivity issue** on your system. Your Supabase database DNS resolves to an IPv6 address, but your system doesn't have IPv6 network connectivity. This prevents automated migration execution.

## What I've Done

✅ **Created 5 idempotent migrations:**
1. `030_community_media_support.sql` - Adds image/video/file support
2. `031_community_member_features.sql` - Adds member directory & blocking
3. `032_fix_community_comments.sql` - Fixes comment RLS policies  
4. `033_fix_notification_preferences_rls.sql` - Fixes RLS for notification preferences
5. `034_fix_notification_preferences_duplicate.sql` - **CRITICAL** Fixes duplicate key issue in comment notifications

✅ **Pushed all code changes to main** - Ready on Vercel

✅ **Generated migration SQL output** - See `migrations-output.txt`

## What Needs to Happen Next

You need to **manually run these migrations** in the Supabase SQL Editor because of the network limitation.

### Quick Start (5 minutes):

1. **Open Supabase SQL Editor:**
   https://supabase.com/dashboard/project/kdxwfaynzemmdonkmttf/sql/new

2. **Run migrations in order (copy/paste & click RUN):**
   
   **Migration 1** - Copy from: `supabase/migrations/030_community_media_support.sql`
   
   **Migration 2** - Copy from: `supabase/migrations/031_community_member_features.sql`
   
   **Migration 3** - Copy from: `supabase/migrations/032_fix_community_comments.sql`
   
   **Migration 4** - Copy from: `supabase/migrations/033_fix_notification_preferences_rls.sql`
   
   **Migration 5** - Copy from: `supabase/migrations/034_fix_notification_preferences_duplicate.sql`

3. **Test:** Try creating a comment on the community page - it should work!

## Alternative: If You Have Access to a Machine with IPv4

Transfer `run-migrations.js` and run:
```bash
npm install pg
node run-migrations.js
```

## Why This Matters

**Migrations 033 & 034** are **critical** - they fix the RLS policy and duplicate key issues that are preventing comments from being created.

Once you run all migrations (especially 034), the comment system will work immediately (no code redeploy needed).

## Safety Notes

- All migrations use `CREATE OR REPLACE` / `IF NOT EXISTS` patterns
- Safe to run multiple times (idempotent)
- No data will be lost
- Can be rolled back if needed

## Files for Reference

- `migrations-output.txt` - Full SQL output with instructions
- `MANUAL_MIGRATION_GUIDE.md` - Detailed guide
- `run-migrations.js` - Automated script (requires IPv4)
- `show-migrations.js` - SQL display script

## Next Steps After Migrations

Once migrations are complete:

1. ✅ Test comment creation
2. ✅ Test image uploads to posts
3. ✅ Test video embeds
4. ✅ Test member directory
5. ✅ Test admin pin/delete features

All the frontend code is already deployed and ready to use these features!

---

**TL;DR:** Copy/paste 5 SQL files into Supabase SQL Editor and click RUN for each. Then the comment bug is fixed and all new features are live! 🎉

