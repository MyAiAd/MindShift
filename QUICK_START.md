# 🚀 QUICK MIGRATION REFERENCE CARD

**COPY THIS TO YOUR DASHBOARD:**
https://supabase.com/dashboard/project/kdxwfaynzemmdonkmttf/sql/new

---

## ✅ CHECKLIST - Run These 5 Migrations in Order:

### [ ] Migration 1 of 5
**File:** `supabase/migrations/030_community_media_support.sql`
- Adds: Image/video/file support for posts
- Action: Copy entire file → Paste in SQL Editor → Click RUN

### [ ] Migration 2 of 5
**File:** `supabase/migrations/031_community_member_features.sql`
- Adds: Member directory, blocking, profiles
- Action: Copy entire file → Paste in SQL Editor → Click RUN

### [ ] Migration 3 of 5
**File:** `supabase/migrations/032_fix_community_comments.sql`
- Fixes: Comment RLS policies
- Action: Copy entire file → Paste in SQL Editor → Click RUN

### [ ] Migration 4 of 5
**File:** `supabase/migrations/033_fix_notification_preferences_rls.sql`
- Fixes: Notification preferences RLS
- Action: Copy entire file → Paste in SQL Editor → Click RUN

### [ ] Migration 5 of 5 ⭐ CRITICAL
**File:** `supabase/migrations/034_fix_notification_preferences_duplicate.sql`
- Fixes: **THE COMMENT BUG** (duplicate key error)
- Action: Copy entire file → Paste in SQL Editor → Click RUN

---

## 🎯 After Running All 5:

✅ Comments will work immediately
✅ No code redeploy needed
✅ All new features active

---

## ⚡ Fastest Method:

1. Open SQL Editor (link above)
2. Open your code editor side-by-side
3. For each file (in order):
   - Select all (Ctrl+A / Cmd+A)
   - Copy (Ctrl+C / Cmd+C)
   - Paste in SQL Editor
   - Click RUN
   - Wait for "Success ✓"
   - Move to next file

**Total time: ~3-5 minutes**

---

## ⚠️ Important Notes:

- All migrations are IDEMPOTENT (safe to run multiple times)
- If you see "already exists" errors, that's OK - skip to next
- Migration 034 is the most critical for fixing comments
- No rollback needed - these are additive changes only

---

## 🧪 Test After Completion:

Go to: https://mind-shift-app.vercel.app/dashboard/community
Try: Adding a comment to any post
Expected: Comment posts successfully ✅

---

**Need Help?** Check these docs:
- `MIGRATION_STATUS.md` - Full status
- `MANUAL_MIGRATION_GUIDE.md` - Detailed guide
- `migrations-output.txt` - Raw SQL output

