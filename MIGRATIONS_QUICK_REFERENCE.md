# Quick Reference: Migration SQL Commands
**Date**: January 6, 2026
**Project**: MindShifting Community Platform
**Supabase Project ID**: kdxwfaynzemmdonkmttf

---

## 🔗 Quick Links

**Direct SQL Editor Link**: https://supabase.com/dashboard/project/kdxwfaynzemmdonkmttf/sql/new

---

## ✅ Migration Status

- [x] **Migration 034** - Notification Preferences Duplicate Fix ✅ **COMPLETED**
- [ ] **Migration 030** - Media Support (REQUIRED NEXT)
- [ ] **Migration 031** - Member Features
- [ ] **Migration 032** - Comment Fixes
- [ ] **Migration 033** - Notification Preferences RLS

---

## 📍 Migration Files Location

All migration files are in: `/home/sage/Code/MindShifting/supabase/migrations/`

---

## 🚀 MIGRATION 030: Media Support

**File**: `supabase/migrations/030_community_media_support.sql`

**Copy and paste this entire file into Supabase SQL Editor**

This migration:
- Adds media columns to community_posts
- Creates storage buckets for images and files
- Sets up RLS policies
- Creates performance indexes

**Expected Duration**: ~5-10 seconds

---

## 🚀 MIGRATION 031: Member Features

**File**: `supabase/migrations/031_community_member_features.sql`

**Copy and paste this entire file into Supabase SQL Editor**

This migration:
- Adds profile fields (bio, avatar, location, etc.)
- Creates community_blocks table
- Adds helper functions for member stats
- Creates activity tracking triggers

**Expected Duration**: ~5-10 seconds

---

## 🚀 MIGRATION 032: Comment Fixes

**File**: `supabase/migrations/032_fix_community_comments.sql`

**Copy and paste this entire file into Supabase SQL Editor**

This migration:
- Fixes RLS policies for comments
- Allows users to create comments
- Improves performance
- Adds helpful indexes

**Expected Duration**: ~3-5 seconds

---

## 🚀 MIGRATION 033: Notification Preferences RLS

**File**: `supabase/migrations/033_fix_notification_preferences_rls.sql`

**Copy and paste this entire file into Supabase SQL Editor**

This migration:
- Fixes RLS for notification preferences
- Allows system functions to create defaults
- Prevents comment creation errors

**Expected Duration**: ~2-3 seconds

---

## 🔍 Verification Queries

After running all migrations, run these queries to verify:

### Check new community_posts columns:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'community_posts' 
AND column_name IN ('media_urls', 'video_embeds', 'attachments');
```

**Expected**: 3 rows returned

---

### Check new profiles columns:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('bio', 'avatar_url', 'location', 'website', 'community_joined_at', 'last_active_at');
```

**Expected**: 6 rows returned

---

### Check storage buckets:
```sql
SELECT id, name, public, file_size_limit 
FROM storage.buckets 
WHERE id IN ('community-media', 'community-attachments');
```

**Expected**: 2 rows returned
- community-media: public=true, limit=52428800 (50MB)
- community-attachments: public=false, limit=104857600 (100MB)

---

### Check community_blocks table:
```sql
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'community_blocks'
) as table_exists;
```

**Expected**: true

---

### Check functions exist:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('is_user_blocked', 'get_member_stats', 'update_last_active', 'send_community_notification');
```

**Expected**: 4 rows returned

---

## ⚠️ Important Notes

1. **All migrations are IDEMPOTENT** - Safe to run multiple times
2. **Run in order**: 030 → 031 → 032 → 033
3. **Wait for "Success"** message after each migration
4. **Don't panic** if you see "already exists" messages - that's normal!
5. **Check verification queries** after all migrations complete

---

## 🐛 Common Issues

### "permission denied for schema storage"
**Solution**: You need database owner or admin privileges. Contact Supabase support or use the Dashboard SQL Editor.

### "relation already exists"
**Solution**: This is normal! The migration is idempotent and skips existing objects.

### "column already exists"
**Solution**: This is normal! The migration checks before creating.

### Migration times out
**Solution**: 
1. Refresh the page
2. Try running the migration again (it's safe!)
3. If still timing out, contact me for help

---

## 📋 Execution Checklist

Use this to track your progress:

```
□ Open Supabase SQL Editor
□ Copy Migration 030 SQL
□ Paste into editor
□ Click RUN
□ Wait for success message
□ ✓ Migration 030 complete

□ Copy Migration 031 SQL
□ Paste into editor
□ Click RUN
□ Wait for success message
□ ✓ Migration 031 complete

□ Copy Migration 032 SQL
□ Paste into editor
□ Click RUN
□ Wait for success message
□ ✓ Migration 032 complete

□ Copy Migration 033 SQL
□ Paste into editor
□ Click RUN
□ Wait for success message
□ ✓ Migration 033 complete

□ Run verification queries
□ Check storage buckets in Dashboard
□ ✓ All verifications passed

□ Test comment creation in app
□ ✓ Comments work!

🎉 ALL MIGRATIONS COMPLETE!
```

---

## 🎯 What's Next After Migrations?

1. **Verify storage buckets** in Supabase Dashboard → Storage
2. **Test basic functionality** using TESTING_CHECKLIST.md
3. **Check browser console** for any errors
4. **Test comment creation** on a post
5. **Test image upload** on a new post
6. **Open member directory** and verify it loads
7. **Report any issues** immediately

---

## 📞 Support

If you encounter any issues during migration:

1. **Take a screenshot** of the error
2. **Copy the exact error message**
3. **Note which migration failed**
4. **Share all above information** and I'll help troubleshoot

---

**Good luck! You've got this! 🚀**

