# Community Platform - Testing Checklist
**Date**: January 6, 2026
**Version**: 1.0.0

This document provides a systematic approach to testing all community features after migrations are deployed.

---

## 🎯 Pre-Testing Requirements

Before starting tests, ensure:

- [x] ✅ Migration 034 completed
- [ ] Migration 030 completed (Media Support)
- [ ] Migration 031 completed (Member Features)
- [ ] Migration 032 completed (Comment Fixes)
- [ ] Migration 033 completed (Notification Preferences RLS)
- [ ] Storage buckets verified
- [ ] Application deployed/running
- [ ] Test user accounts created (regular user + admin)

---

## 📋 PHASE 1: Basic Functionality Testing

### **Test 1.1: Community Page Load**
**Priority**: CRITICAL

**Steps**:
1. Navigate to `/dashboard/community`
2. Wait for page to fully load
3. Check browser console for errors

**Expected Results**:
- ✅ Page loads without errors
- ✅ No JavaScript errors in console
- ✅ Layout renders correctly
- ✅ Navigation elements visible

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 1.2: Stats Cards Removed**
**Priority**: HIGH

**Steps**:
1. View community page
2. Look for stats cards at top (Members, Total Posts, Active Today)

**Expected Results**:
- ✅ Stats cards NOT visible
- ✅ Clean, modern layout
- ✅ No empty space where cards were

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 1.3: Search Bar Functionality**
**Priority**: HIGH

**Steps**:
1. Locate search bar in header
2. Type search query
3. Press Enter or click search

**Expected Results**:
- ✅ Search bar visible and functional
- ✅ Results filter based on query
- ✅ Real-time search works (if implemented)

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 1.4: Create New Post (Basic)**
**Priority**: CRITICAL

**Steps**:
1. Click "Create Post" or similar button
2. Enter title: "Test Post"
3. Enter content: "This is a test post for deployment verification"
4. Click Submit/Post

**Expected Results**:
- ✅ Modal/form opens
- ✅ Can enter title and content
- ✅ Submit button works
- ✅ Post appears in feed immediately
- ✅ No errors in console

**Status**: [ ] PASS / [ ] FAIL
**Post ID**: _____________________________________________
**Notes**: _____________________________________________

---

### **Test 1.5: View Posts in Feed**
**Priority**: CRITICAL

**Steps**:
1. Scroll through community feed
2. View multiple posts
3. Check post metadata (author, date, counts)

**Expected Results**:
- ✅ Posts display correctly
- ✅ Author names visible
- ✅ Timestamps show correctly
- ✅ Like/comment counts visible
- ✅ Images/media render (if present)

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

## 📋 PHASE 2: Media Features Testing

### **Test 2.1: Image Upload - Drag and Drop**
**Priority**: HIGH

**Steps**:
1. Create new post
2. Drag image file into upload area
3. Drop file
4. Observe upload progress
5. Submit post

**Expected Results**:
- ✅ Drag-drop zone visible and responsive
- ✅ Progress bar shows during upload
- ✅ Image preview displays after upload
- ✅ Can upload multiple images (test with 2-3)
- ✅ Images appear in published post

**Test Image Sizes**:
- [ ] Small (< 1MB) - _____________________________________________
- [ ] Medium (2-5MB) - _____________________________________________
- [ ] Large (> 10MB) - _____________________________________________

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 2.2: Image Upload - Click to Browse**
**Priority**: HIGH

**Steps**:
1. Create new post
2. Click "Upload Image" or browse button
3. Select image from file picker
4. Wait for upload
5. Submit post

**Expected Results**:
- ✅ File picker opens
- ✅ Can select image files
- ✅ Upload completes successfully
- ✅ Image displays correctly in post

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 2.3: Image Removal Before Posting**
**Priority**: MEDIUM

**Steps**:
1. Upload 2-3 images
2. Click remove/delete on one image
3. Verify image removed from preview
4. Submit post with remaining images

**Expected Results**:
- ✅ Remove button visible on each image
- ✅ Clicking removes image from preview
- ✅ Only remaining images appear in post
- ✅ Removed image NOT uploaded to storage

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 2.4: Video Embed - YouTube**
**Priority**: HIGH

**Steps**:
1. Create new post
2. Find video embed input
3. Paste YouTube URL: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
4. Wait for thumbnail to load
5. Submit post
6. Click to play video in feed

**Expected Results**:
- ✅ Video URL input field visible
- ✅ YouTube URL recognized
- ✅ Thumbnail fetches and displays
- ✅ Provider badge shows "YouTube" (red)
- ✅ Video embeds in post
- ✅ Click opens video player

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 2.5: Video Embed - Vimeo**
**Priority**: MEDIUM

**Steps**:
1. Create new post
2. Paste Vimeo URL
3. Wait for thumbnail
4. Submit and test playback

**Test URL**: (Find a public Vimeo video)

**Expected Results**:
- ✅ Vimeo URL recognized
- ✅ Thumbnail fetches
- ✅ Provider badge shows "Vimeo" (blue)
- ✅ Video plays correctly

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 2.6: Video Embed - Wistia**
**Priority**: MEDIUM

**Steps**:
1. Create new post
2. Paste Wistia URL
3. Wait for thumbnail
4. Submit and test playback

**Test URL**: (Find a public Wistia video or skip if unavailable)

**Expected Results**:
- ✅ Wistia URL recognized
- ✅ Thumbnail fetches
- ✅ Video plays correctly

**Status**: [ ] PASS / [ ] FAIL / [ ] SKIPPED
**Notes**: _____________________________________________

---

### **Test 2.7: File Attachment - PDF**
**Priority**: HIGH

**Steps**:
1. Create new post
2. Upload PDF file (< 100MB)
3. Check file preview shows correctly
4. Submit post
5. Click download link in post

**Expected Results**:
- ✅ PDF uploads successfully
- ✅ File icon displays (📄)
- ✅ Filename and size show correctly
- ✅ Download link works
- ✅ File downloads successfully

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 2.8: File Attachment - Document (DOC/DOCX)**
**Priority**: MEDIUM

**Steps**:
1. Upload .doc or .docx file
2. Verify upload and display
3. Test download

**Expected Results**:
- ✅ Document uploads
- ✅ File icon displays (📝)
- ✅ Download works

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 2.9: File Attachment - Spreadsheet (XLS/XLSX)**
**Priority**: MEDIUM

**Steps**:
1. Upload .xls or .xlsx file
2. Verify upload and display
3. Test download

**Expected Results**:
- ✅ Spreadsheet uploads
- ✅ File icon displays (📊)
- ✅ Download works

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 2.10: File Attachment - Text File**
**Priority**: LOW

**Steps**:
1. Upload .txt file
2. Verify upload and display
3. Test download

**Expected Results**:
- ✅ Text file uploads
- ✅ File icon displays (📃)
- ✅ Download works

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 2.11: File Size Limit Enforcement**
**Priority**: HIGH

**Steps**:
1. Try to upload image > 50MB
2. Try to upload attachment > 100MB

**Expected Results**:
- ✅ Error message for oversized image
- ✅ Error message for oversized attachment
- ✅ Upload prevented/rejected
- ✅ User-friendly error message

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 2.12: File Type Restrictions**
**Priority**: HIGH

**Steps**:
1. Try to upload disallowed file type (e.g., .exe, .zip)

**Expected Results**:
- ✅ Upload rejected
- ✅ Clear error message about allowed types
- ✅ No file appears in upload list

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 2.13: Tag Selection**
**Priority**: HIGH

**Steps**:
1. Create new post
2. Open tag dropdown
3. Search for existing tag
4. Select 2-3 tags
5. Try to create new tag
6. Submit post

**Expected Results**:
- ✅ Tag dropdown opens
- ✅ Search filters tags in real-time
- ✅ Can select multiple tags
- ✅ Selected tags show as colored chips
- ✅ Can remove selected tag (X button)
- ✅ Can create new tag if allowed
- ✅ Max 5 tags enforced
- ✅ Tags display on published post

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

## 📋 PHASE 3: Member Directory Testing

### **Test 3.1: Members Button Visibility**
**Priority**: HIGH

**Steps**:
1. View community page header
2. Look for "Members" button (typically top-right)

**Expected Results**:
- ✅ Members button visible
- ✅ Button shows member count (e.g., "Members (24)")
- ✅ Button styled consistently with design

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 3.2: Member Directory Opens**
**Priority**: CRITICAL

**Steps**:
1. Click "Members" button
2. Wait for modal/directory to open

**Expected Results**:
- ✅ Modal opens smoothly
- ✅ Member list loads
- ✅ Member count displays correctly
- ✅ Close button visible and functional

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 3.3: Member Cards Display**
**Priority**: HIGH

**Steps**:
1. Open member directory
2. Examine member cards

**Expected Results**:
- ✅ Avatar or initials show for each member
- ✅ Full name displays
- ✅ Role badge shows (if admin/coach)
- ✅ Activity status indicator (🟢 online, 🟡 recent, ⚪ offline)
- ✅ Member stats show (posts, comments)
- ✅ Join date displays
- ✅ Last active time shows

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 3.4: Member Search**
**Priority**: HIGH

**Steps**:
1. Open member directory
2. Type in search box
3. Test search by first name
4. Test search by last name
5. Test search by email (if visible)

**Expected Results**:
- ✅ Search box visible at top
- ✅ Results filter in real-time
- ✅ Searches first names correctly
- ✅ Searches last names correctly
- ✅ Searches email if applicable
- ✅ Shows "No members found" when no matches

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 3.5: Message Button**
**Priority**: HIGH

**Steps**:
1. Open member directory
2. Find another user's card
3. Click "Message" button
4. Verify routing

**Expected Results**:
- ✅ Message button visible on member cards
- ✅ Routes to `/dashboard/team/message` or messaging page
- ✅ User ID passed in URL or context
- ✅ Modal closes after clicking

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 3.6: Block User**
**Priority**: CRITICAL

**Steps**:
1. Open member directory
2. Find test user
3. Click "Block" button
4. Confirm in dialog
5. Verify status changes

**Expected Results**:
- ✅ Block button visible
- ✅ Confirmation dialog appears
- ✅ Clear warning message
- ✅ Can cancel or confirm
- ✅ Member shows as "Blocked" after confirming
- ✅ "Unblock" button appears
- ✅ Status updates immediately

**Status**: [ ] PASS / [ ] FAIL
**Blocked User**: _____________________________________________
**Notes**: _____________________________________________

---

### **Test 3.7: Unblock User**
**Priority**: HIGH

**Steps**:
1. Find previously blocked user
2. Click "Unblock" button
3. Verify status changes

**Expected Results**:
- ✅ Unblock button visible on blocked users
- ✅ Click unblocks immediately (or shows confirmation)
- ✅ Member returns to normal status
- ✅ "Block" button reappears
- ✅ Status updates immediately

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 3.8: Blocked User Content Hidden**
**Priority**: HIGH

**Steps**:
1. Block a user who has posts/comments
2. Return to community feed
3. Check if their content is visible

**Expected Results**:
- ✅ Blocked user's posts NOT visible in feed
- ✅ Blocked user's comments NOT visible
- ✅ No errors when content is filtered

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

## 📋 PHASE 4: Admin Controls Testing

**Note**: These tests require an admin account (super_admin, tenant_admin, or manager role)

### **Test 4.1: Admin Menu Visibility**
**Priority**: CRITICAL

**Steps**:
1. Log in as admin
2. View posts in feed
3. Look for admin menu (⋮) on posts

**Expected Results**:
- ✅ Admin sees ⋮ menu on ALL posts
- ✅ Post authors see ⋮ menu on own posts
- ✅ Regular users DON'T see menu on others' posts

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 4.2: Pin Post**
**Priority**: HIGH

**Steps**:
1. As admin, click ⋮ menu on a post
2. Click "Pin Post"
3. Verify post moves to pinned section

**Expected Results**:
- ✅ "Pin Post" option visible in menu
- ✅ Post moves to "Pinned Posts" section at top
- ✅ 📌 icon shows on pinned post
- ✅ Pinned section clearly labeled
- ✅ Post no longer in regular feed

**Status**: [ ] PASS / [ ] FAIL
**Pinned Post ID**: _____________________________________________
**Notes**: _____________________________________________

---

### **Test 4.3: Unpin Post**
**Priority**: HIGH

**Steps**:
1. Click ⋮ menu on pinned post
2. Click "Unpin Post"
3. Verify post returns to regular feed

**Expected Results**:
- ✅ "Unpin Post" option visible (instead of "Pin")
- ✅ Post returns to regular feed position
- ✅ 📌 icon removed
- ✅ Post sorted by date with others

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 4.4: Delete Post (Admin)**
**Priority**: CRITICAL

**Steps**:
1. As admin, find another user's post
2. Click ⋮ menu
3. Click "Delete Post"
4. Read confirmation dialog
5. Confirm deletion

**Expected Results**:
- ✅ "Delete Post" option visible
- ✅ Confirmation dialog appears
- ✅ Clear warning message
- ✅ Can cancel deletion
- ✅ Post removed from feed after confirmation
- ✅ Post detail modal closes if open
- ✅ Database record deleted or marked as deleted

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 4.5: Delete Own Post (Regular User)**
**Priority**: HIGH

**Steps**:
1. As regular user, view own post
2. Click ⋮ menu
3. Delete own post

**Expected Results**:
- ✅ Regular user can delete own posts
- ✅ Cannot delete others' posts
- ✅ Confirmation dialog works
- ✅ Post removed successfully

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

## 📋 PHASE 5: Comments System Testing

### **Test 5.1: View Comments**
**Priority**: CRITICAL

**Steps**:
1. Find post with existing comments
2. View comments section
3. Expand if collapsed

**Expected Results**:
- ✅ Comments visible below post or in detail view
- ✅ Comment count matches actual number
- ✅ Comments load without errors
- ✅ Author names display correctly
- ✅ Timestamps display correctly

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 5.2: Add New Comment**
**Priority**: CRITICAL

**Steps**:
1. Find any post
2. Type comment in input box
3. Click submit/post comment
4. Verify comment appears

**Expected Results**:
- ✅ Comment input box visible
- ✅ Can type text
- ✅ Submit button enabled when text entered
- ✅ Comment appears immediately after submit
- ✅ Comment count increments
- ✅ Input box clears after submit
- ✅ No errors in console

**Test Comment**: "Testing comment functionality for deployment - timestamp: [YYYY-MM-DD HH:MM]"

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 5.3: Empty Comment Validation**
**Priority**: MEDIUM

**Steps**:
1. Try to submit empty comment
2. Try to submit comment with only spaces

**Expected Results**:
- ✅ Submit button disabled OR
- ✅ Error message shown
- ✅ Empty comment NOT posted
- ✅ Whitespace-only comment NOT posted

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 5.4: Comment Error Handling**
**Priority**: HIGH

**Steps**:
1. Open browser dev tools Network tab
2. Add comment while simulating offline or slow network
3. Observe error handling

**Expected Results**:
- ✅ Error message displays if comment fails
- ✅ User notified of issue
- ✅ Can retry commenting
- ✅ No silent failures

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

## 📋 PHASE 6: Security & Permissions Testing

### **Test 6.1: Tenant Isolation - Members**
**Priority**: CRITICAL

**Steps**:
1. Have users from 2 different tenants (if possible)
2. Check member directory for each
3. Verify users only see members from their tenant

**Expected Results**:
- ✅ Users only see members from their tenant
- ✅ Cannot search for users in other tenants
- ✅ Cannot message users in other tenants

**Status**: [ ] PASS / [ ] FAIL / [ ] NOT TESTABLE
**Notes**: _____________________________________________

---

### **Test 6.2: Tenant Isolation - Posts**
**Priority**: CRITICAL

**Steps**:
1. Create posts as users from different tenants
2. Verify each user only sees posts from their tenant

**Expected Results**:
- ✅ Users only see posts from their tenant
- ✅ Cannot view posts from other tenants
- ✅ Search only returns results from own tenant

**Status**: [ ] PASS / [ ] FAIL / [ ] NOT TESTABLE
**Notes**: _____________________________________________

---

### **Test 6.3: Storage Access Control**
**Priority**: HIGH

**Steps**:
1. Upload image as User A
2. Try to access image URL as User B (different tenant)
3. Try to access attachment URL as User B

**Expected Results**:
- ✅ Public images (community-media) accessible to all
- ✅ Private files (community-attachments) require auth
- ✅ Users cannot delete others' uploads
- ✅ Proper error messages for unauthorized access

**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 6.4: File Size Limits Enforced (Server-Side)**
**Priority**: MEDIUM

**Steps**:
1. Attempt to bypass client-side validation
2. Use curl or Postman to upload oversized file

**Expected Results**:
- ✅ Server rejects oversized uploads
- ✅ Storage bucket enforces limits
- ✅ Proper error response returned

**Status**: [ ] PASS / [ ] FAIL / [ ] NOT TESTABLE
**Notes**: _____________________________________________

---

### **Test 6.5: MIME Type Restrictions (Server-Side)**
**Priority**: MEDIUM

**Steps**:
1. Attempt to upload disallowed file type via API
2. Check if server/storage rejects it

**Expected Results**:
- ✅ Server validates MIME types
- ✅ Storage bucket enforces allowed types
- ✅ Malicious file types rejected

**Status**: [ ] PASS / [ ] FAIL / [ ] NOT TESTABLE
**Notes**: _____________________________________________

---

## 📋 PHASE 7: Cross-Device Testing

### **Test 7.1: Desktop - Chrome**
**Priority**: HIGH

**Steps**:
1. Test all critical features on Chrome (latest)
2. Check responsive layout

**Expected Results**:
- ✅ All features work correctly
- ✅ Layout renders properly
- ✅ No console errors

**Chrome Version**: _____________________________________________
**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 7.2: Desktop - Firefox**
**Priority**: MEDIUM

**Steps**:
1. Test all critical features on Firefox (latest)

**Expected Results**:
- ✅ All features work correctly
- ✅ Layout renders properly

**Firefox Version**: _____________________________________________
**Status**: [ ] PASS / [ ] FAIL
**Notes**: _____________________________________________

---

### **Test 7.3: Desktop - Safari**
**Priority**: MEDIUM

**Steps**:
1. Test on Safari (latest)

**Expected Results**:
- ✅ All features work correctly
- ✅ Video embeds work (note: autoplay restrictions)

**Safari Version**: _____________________________________________
**Status**: [ ] PASS / [ ] FAIL / [ ] NOT AVAILABLE
**Notes**: _____________________________________________

---

### **Test 7.4: Mobile - iOS**
**Priority**: HIGH

**Steps**:
1. Test on iPhone/iPad
2. Test responsive layout
3. Test touch interactions

**Expected Results**:
- ✅ Responsive layout works
- ✅ Touch interactions smooth
- ✅ Modals display correctly
- ✅ Upload works on mobile

**Device**: _____________________________________________
**iOS Version**: _____________________________________________
**Status**: [ ] PASS / [ ] FAIL / [ ] NOT AVAILABLE
**Notes**: _____________________________________________

---

### **Test 7.5: Mobile - Android**
**Priority**: HIGH

**Steps**:
1. Test on Android device
2. Test responsive layout
3. Test file upload

**Expected Results**:
- ✅ Responsive layout works
- ✅ All interactions work
- ✅ File picker works correctly

**Device**: _____________________________________________
**Android Version**: _____________________________________________
**Status**: [ ] PASS / [ ] FAIL / [ ] NOT AVAILABLE
**Notes**: _____________________________________________

---

## 📊 Test Summary

### **Results Overview**

| Phase | Total Tests | Passed | Failed | Skipped |
|-------|-------------|--------|--------|---------|
| Phase 1: Basic | 5 | [ ] | [ ] | [ ] |
| Phase 2: Media | 13 | [ ] | [ ] | [ ] |
| Phase 3: Members | 8 | [ ] | [ ] | [ ] |
| Phase 4: Admin | 5 | [ ] | [ ] | [ ] |
| Phase 5: Comments | 4 | [ ] | [ ] | [ ] |
| Phase 6: Security | 5 | [ ] | [ ] | [ ] |
| Phase 7: Devices | 5 | [ ] | [ ] | [ ] |
| **TOTAL** | **45** | [ ] | [ ] | [ ] |

### **Critical Issues Found**

1. _____________________________________________
2. _____________________________________________
3. _____________________________________________

### **High Priority Issues Found**

1. _____________________________________________
2. _____________________________________________
3. _____________________________________________

### **Medium/Low Priority Issues**

1. _____________________________________________
2. _____________________________________________
3. _____________________________________________

---

## ✅ Sign-Off

**Tested By**: _____________________________________________
**Date**: _____________________________________________
**Overall Status**: [ ] PASS / [ ] FAIL / [ ] CONDITIONAL PASS

**Notes**: 
_____________________________________________
_____________________________________________
_____________________________________________

**Approved for Production**: [ ] YES / [ ] NO / [ ] WITH ISSUES

**Approver**: _____________________________________________
**Date**: _____________________________________________

---

## 📝 Next Steps

After testing:

1. [ ] Address all CRITICAL issues
2. [ ] Address HIGH priority issues
3. [ ] Document known issues for future releases
4. [ ] Update user documentation
5. [ ] Train support team on new features
6. [ ] Monitor production logs post-launch
7. [ ] Schedule follow-up review (1 week post-launch)

---

**END OF TESTING CHECKLIST**

