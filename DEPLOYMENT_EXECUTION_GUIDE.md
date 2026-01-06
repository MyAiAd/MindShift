# Community Platform - Deployment Execution Guide
**Date**: January 6, 2026
**Status**: Migration 034 Complete ✅ | Remaining: 030, 031, 032, 033

---

## 🎯 Quick Access Links

- **Supabase Dashboard**: https://supabase.com/dashboard
- **SQL Editor**: https://supabase.com/dashboard/project/kdxwfaynzemmdonkmttf/sql/new
- **Storage**: https://supabase.com/dashboard/project/kdxwfaynzemmdonkmttf/storage/buckets
- **Project**: kdxwfaynzemmdonkmttf

---

## 📋 Migration Execution Order

### ✅ Migration 034 - COMPLETED
**Status**: Already executed successfully by user

### 🔄 Remaining Migrations (Execute in this order)

#### **Step 1: Migration 030 - Media Support** ⚡ CRITICAL

**What it does**:
- Adds media_urls, video_embeds, and attachments columns to community_posts
- Creates storage buckets: community-media (public) and community-attachments (private)
- Sets up RLS policies for storage
- Creates performance indexes

**File**: `supabase/migrations/030_community_media_support.sql`

**Instructions**:
1. Open SQL Editor: https://supabase.com/dashboard/project/kdxwfaynzemmdonkmttf/sql/new
2. Copy the ENTIRE contents of `supabase/migrations/030_community_media_support.sql`
3. Paste into SQL Editor
4. Click "RUN" button
5. Wait for "Success" message
6. ✅ Check: Look for "Query executed successfully" or similar confirmation

**Expected Results**:
- 3 new columns added to community_posts table
- 2 storage buckets created
- Multiple RLS policies created
- 3 indexes created

---

#### **Step 2: Migration 031 - Member Features** ⚡ CRITICAL

**What it does**:
- Adds profile fields: bio, avatar_url, location, website, community_joined_at, last_active_at
- Creates community_blocks table for user blocking
- Adds helper functions: is_user_blocked(), get_member_stats()
- Creates triggers to update last_active_at automatically

**File**: `supabase/migrations/031_community_member_features.sql`

**Instructions**:
1. Open SQL Editor (same link as above)
2. Copy the ENTIRE contents of `supabase/migrations/031_community_member_features.sql`
3. Paste into SQL Editor
4. Click "RUN" button
5. Wait for "Success" message

**Expected Results**:
- 6 new columns added to profiles table
- 1 new table created (community_blocks)
- 2 functions created
- 2 triggers created
- Multiple indexes created

---

#### **Step 3: Migration 032 - Comment Fixes** ⚡ CRITICAL

**What it does**:
- Fixes RLS policies for community_comments table
- Allows users to create and view comments properly
- Improves performance with optimized policies
- Adds helpful indexes

**File**: `supabase/migrations/032_fix_community_comments.sql`

**Instructions**:
1. Open SQL Editor
2. Copy the ENTIRE contents of `supabase/migrations/032_fix_community_comments.sql`
3. Paste into SQL Editor
4. Click "RUN" button
5. Wait for "Success" message

**Expected Results**:
- RLS policies dropped and recreated
- 2 new indexes created
- Default status set to 'published'

---

#### **Step 4: Migration 033 - Notification Preferences RLS** ⚡ CRITICAL

**What it does**:
- Fixes RLS policies for community_notification_preferences
- Allows SECURITY DEFINER functions to create default preferences
- Prevents errors when users create comments

**File**: `supabase/migrations/033_fix_notification_preferences_rls.sql`

**Instructions**:
1. Open SQL Editor
2. Copy the ENTIRE contents of `supabase/migrations/033_fix_notification_preferences_rls.sql`
3. Paste into SQL Editor
4. Click "RUN" button
5. Wait for "Success" message

**Expected Results**:
- Old policies dropped
- 4 new policies created (insert, update, delete, system)

---

## 🔍 Post-Migration Verification

### **Check 1: Verify Storage Buckets**

1. Go to: https://supabase.com/dashboard/project/kdxwfaynzemmdonkmttf/storage/buckets

2. **Verify `community-media` bucket**:
   - ✅ Exists
   - ✅ Public: **true**
   - ✅ File size limit: **50 MB**
   - ✅ Allowed MIME types: image/jpeg, image/png, image/gif, image/webp

3. **Verify `community-attachments` bucket**:
   - ✅ Exists
   - ✅ Public: **false** (Private)
   - ✅ File size limit: **100 MB**
   - ✅ Allowed MIME types: PDF, DOC, DOCX, XLS, XLSX, TXT

### **Check 2: Verify Database Tables**

Run this query in SQL Editor:

```sql
-- Check new columns in community_posts
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'community_posts'
AND column_name IN ('media_urls', 'video_embeds', 'attachments');

-- Check new columns in profiles
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('bio', 'avatar_url', 'location', 'website', 'community_joined_at', 'last_active_at');

-- Check community_blocks table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'community_blocks'
) as community_blocks_exists;
```

Expected results:
- 3 columns from community_posts should show up
- 6 columns from profiles should show up
- community_blocks_exists should return `true`

### **Check 3: Test Comment Creation**

After migrations are complete, test in the application:

1. Go to: `/dashboard/community`
2. Find any post
3. Try to add a comment
4. ✅ Comment should be created successfully
5. ✅ No errors in browser console

---

## 🐛 Troubleshooting

### **Issue: "permission denied for table X"**
**Solution**: Ensure you're running the SQL as the database owner or with sufficient privileges.

### **Issue: "relation already exists"**
**Solution**: This is normal! Migrations are idempotent. The migration will skip existing objects.

### **Issue: "column already exists"**
**Solution**: This is normal! The migration checks for existence before creating.

### **Issue: Storage bucket creation fails**
**Solution**: 
1. Check if buckets already exist manually
2. If they do, the migration will skip creation (ON CONFLICT DO NOTHING)
3. Verify permissions are correct

### **Issue: Migration times out**
**Solution**: 
1. Break the migration into smaller parts
2. Run each DO block separately
3. Contact me if you need help splitting it up

---

## 📊 Migration Progress Tracker

Mark each as you complete:

- [x] Migration 034 - Notification Preferences Duplicate Fix ✅
- [ ] Migration 030 - Media Support
- [ ] Migration 031 - Member Features  
- [ ] Migration 032 - Comment Fixes
- [ ] Migration 033 - Notification Preferences RLS
- [ ] Storage Buckets Verified
- [ ] Database Tables Verified
- [ ] Comment Creation Tested

---

## ⏭️ Next Steps After Migrations

Once all migrations are complete:

1. **Test Basic Functionality** (Phase 1 of checklist)
   - Community page loads
   - Can create posts
   - Can add comments
   - Search works

2. **Test Media Features** (Phase 2 of checklist)
   - Image upload
   - Video embeds
   - File attachments
   - Tag selection

3. **Test Member Directory** (Phase 3 of checklist)
   - Members button visible
   - Directory opens
   - Search works
   - Block/unblock works

4. **Test Admin Controls** (Phase 4 of checklist)
   - Pin/unpin posts
   - Delete posts
   - Admin menu visible

---

## 🆘 Need Help?

If you encounter any issues:

1. **Check the error message** - Copy the exact error text
2. **Check browser console** - Look for JavaScript errors
3. **Check Supabase logs** - Go to Logs section in dashboard
4. **Report back** - Share the error message and I'll help troubleshoot

---

**Ready to proceed?** Start with Migration 030 and work your way down! 🚀

