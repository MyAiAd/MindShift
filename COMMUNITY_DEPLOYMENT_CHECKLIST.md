# Community Social Platform - Deployment Checklist

## 🎯 **Pre-Deployment Tasks**

### **Database Migrations**
- [ ] Run Migration 030 (Media Support)
  ```sql
  -- In Supabase Dashboard: SQL Editor
  -- Paste contents of: supabase/migrations/030_community_media_support.sql
  -- Click "Run"
  ```
- [ ] Run Migration 031 (Member Features)
  ```sql
  -- In Supabase Dashboard: SQL Editor
  -- Paste contents of: supabase/migrations/031_community_member_features.sql
  -- Click "Run"
  ```
- [ ] Run Migration 032 (Comment Fixes)
  ```sql
  -- In Supabase Dashboard: SQL Editor
  -- Paste contents of: supabase/migrations/032_fix_community_comments.sql
  -- Click "Run"
  ```

### **Verify Storage Buckets**
- [ ] Check `community-media` bucket exists
  - [ ] Public access enabled
  - [ ] 50MB file size limit
  - [ ] Allowed MIME types: image/jpeg, image/png, image/gif, image/webp
- [ ] Check `community-attachments` bucket exists
  - [ ] Private access (requires authentication)
  - [ ] 100MB file size limit
  - [ ] Allowed MIME types: PDF, DOC, DOCX, XLS, XLSX, TXT

---

## 🧪 **Testing Checklist**

### **Phase 1: Basic Functionality**
- [ ] Community page loads without errors
- [ ] Stats cards are removed (clean layout)
- [ ] Search bar works
- [ ] Can create new post with title and content
- [ ] Posts display in feed

### **Phase 2: Media Features**
- [ ] **Image Upload**
  - [ ] Drag-and-drop works
  - [ ] Click to browse works
  - [ ] Multiple images upload (test with 2-3 images)
  - [ ] Progress bar shows during upload
  - [ ] Images display in grid preview
  - [ ] Can remove images before posting
  - [ ] Images appear in published post
  
- [ ] **Video Embeds**
  - [ ] Can paste YouTube URL
  - [ ] Can paste Vimeo URL
  - [ ] Can paste Wistia URL
  - [ ] Video thumbnail fetches automatically
  - [ ] Provider badge shows (YouTube=red, Vimeo=blue)
  - [ ] Can remove video before posting
  - [ ] Videos display in published post
  
- [ ] **File Attachments**
  - [ ] Can upload PDF
  - [ ] Can upload DOC/DOCX
  - [ ] Can upload XLS/XLSX
  - [ ] Can upload TXT
  - [ ] Progress shows during upload
  - [ ] File icon, name, and size display correctly
  - [ ] Can download attached file
  - [ ] Can remove file before posting
  
- [ ] **Tag Selection**
  - [ ] Tag dropdown opens
  - [ ] Can search existing tags
  - [ ] Can create new tag
  - [ ] Selected tags show as colored chips
  - [ ] Can remove selected tag
  - [ ] Max 5 tags enforced

### **Phase 3: Member Directory**
- [ ] **Members Button & Directory**
  - [ ] "Members" button visible in header (top-right)
  - [ ] Click opens member directory modal
  - [ ] Member count shows correctly
  - [ ] Members list displays
  
- [ ] **Member Cards**
  - [ ] Avatar or initials show
  - [ ] Name displays correctly
  - [ ] Role badge shows (if admin/coach)
  - [ ] Activity status shows (🟢 online, 🟡 recent, ⚪ offline)
  - [ ] Member stats show (posts, comments)
  - [ ] Join date displays
  - [ ] Last active time shows
  
- [ ] **Search Functionality**
  - [ ] Can search by first name
  - [ ] Can search by last name
  - [ ] Can search by email
  - [ ] Results filter in real-time
  
- [ ] **Messaging Integration**
  - [ ] "Message" button visible on member cards
  - [ ] Click routes to `/dashboard/team/message`
  - [ ] User ID passed correctly in URL
  - [ ] Modal closes after clicking Message
  
- [ ] **Block/Unblock**
  - [ ] "Block" button visible
  - [ ] Confirmation dialog appears
  - [ ] Can confirm block
  - [ ] Member shows as "Blocked"
  - [ ] "Unblock" button appears
  - [ ] Can unblock user
  - [ ] Status updates immediately

### **Phase 4: Admin Controls**
- [ ] **Admin Menu Visibility**
  - [ ] Post authors see ⋮ menu on their own posts
  - [ ] Admins see ⋮ menu on ALL posts
  - [ ] Regular users don't see menu on others' posts
  
- [ ] **Pin/Unpin (Admin Only)**
  - [ ] Admin can click "Pin Post"
  - [ ] Post moves to "Pinned Posts" section
  - [ ] 📌 icon shows on pinned post
  - [ ] Admin can click "Unpin Post"
  - [ ] Post returns to regular feed
  
- [ ] **Delete Post**
  - [ ] Authors can delete own posts
  - [ ] Admins can delete any post
  - [ ] Confirmation dialog appears
  - [ ] Warning message clear
  - [ ] Can cancel deletion
  - [ ] Can confirm deletion
  - [ ] Post removed from feed
  - [ ] Detail modal closes if open

### **Phase 5: Comments System**
- [ ] Can view comments on a post
- [ ] Can add new comment
- [ ] Comment appears immediately
- [ ] Comment count updates
- [ ] Error messages show if comment fails
- [ ] Can't add empty comment

---

## 🔐 **Security & Permissions Testing**

### **Tenant Isolation**
- [ ] Users only see members from their tenant
- [ ] Users only see posts from their tenant
- [ ] Can't block users from other tenants
- [ ] Storage files respect tenant boundaries

### **Role-Based Access**
- [ ] **Regular Users**
  - [ ] Can create posts
  - [ ] Can edit/delete own posts only
  - [ ] Cannot pin posts
  - [ ] Can comment
  - [ ] Can like posts
  - [ ] Can view members
  - [ ] Can message members
  - [ ] Can block users
  
- [ ] **Admins (tenant_admin, manager, super_admin)**
  - [ ] All regular user permissions
  - [ ] Can pin/unpin ANY post
  - [ ] Can delete ANY post
  - [ ] Can edit ANY post (when implemented)
  - [ ] Can view all blocks (if super_admin)

### **Storage Security**
- [ ] Public images accessible without auth
- [ ] Private files require authentication
- [ ] Users can only delete their own uploads
- [ ] File size limits enforced
- [ ] MIME type restrictions work

---

## 📱 **Cross-Device Testing**

### **Desktop**
- [ ] Chrome - Latest version
- [ ] Firefox - Latest version
- [ ] Safari - Latest version
- [ ] Edge - Latest version

### **Mobile**
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] Responsive layout works
- [ ] Touch interactions work
- [ ] Modals display correctly
- [ ] Upload works on mobile

### **Tablets**
- [ ] iPad Safari
- [ ] Android tablet

---

## 🐛 **Known Issues to Watch For**

### **Potential Issues**
- [ ] Image compression on very large files (>10MB)
- [ ] Video thumbnail fetching failures (API limits)
- [ ] Storage quota limits (monitor usage)
- [ ] RLS policy performance on large datasets
- [ ] Comment nesting issues (if adding replies later)

### **Browser Compatibility**
- [ ] Safari video autoplay restrictions
- [ ] File upload on older browsers
- [ ] WebP image support on older devices

---

## 🚀 **Performance Monitoring**

### **Metrics to Track**
- [ ] Page load time (target: <3 seconds)
- [ ] Image upload time (target: <10 seconds for 5MB)
- [ ] Member directory load time (target: <2 seconds)
- [ ] Search responsiveness (target: instant)
- [ ] Modal open time (target: <500ms)

### **Database Performance**
- [ ] Check slow queries in Supabase dashboard
- [ ] Monitor RLS policy execution time
- [ ] Watch for N+1 query problems
- [ ] Check index usage

### **Storage Performance**
- [ ] Monitor bucket size growth
- [ ] Check bandwidth usage
- [ ] Verify CDN caching working
- [ ] Watch for orphaned files

---

## ✅ **Post-Launch Checklist**

### **Week 1**
- [ ] Monitor error logs daily
- [ ] Check user feedback/reports
- [ ] Verify all uploads working
- [ ] Confirm member search working
- [ ] Test admin actions working
- [ ] Review performance metrics
- [ ] Check storage usage

### **Week 2-4**
- [ ] Analyze user engagement
- [ ] Review most used features
- [ ] Identify pain points
- [ ] Plan feature enhancements
- [ ] Optimize slow queries
- [ ] Clean up orphaned files

---

## 🎓 **Training & Documentation**

### **For Admins**
- [ ] How to pin important posts
- [ ] How to moderate content (delete)
- [ ] How to manage community tags
- [ ] How to view member directory
- [ ] Understanding member blocks

### **For Users**
- [ ] How to create posts with media
- [ ] How to add images (drag-drop)
- [ ] How to embed videos (paste links)
- [ ] How to attach files
- [ ] How to use tags
- [ ] How to find members
- [ ] How to message members
- [ ] How to block users

---

## 📊 **Success Criteria**

### **Must Have (Before Launch)**
- ✅ All migrations run successfully
- ✅ Storage buckets configured
- ✅ No build errors
- ✅ Basic post creation works
- ✅ Comments work
- ✅ Member directory loads
- ✅ Mobile responsive

### **Should Have (Week 1)**
- [ ] Media uploads working smoothly
- [ ] Video embeds working (3 providers)
- [ ] File attachments working
- [ ] Member search fast
- [ ] Admin controls functional
- [ ] No critical bugs

### **Nice to Have (Future)**
- [ ] Rich text editor
- [ ] @mentions
- [ ] Emoji reactions
- [ ] Post bookmarking
- [ ] Advanced moderation
- [ ] Content reporting
- [ ] Analytics dashboard

---

## 🔄 **Rollback Plan**

### **If Critical Issues Found**
1. **Document the issue**
   - Take screenshots
   - Note error messages
   - Record steps to reproduce

2. **Assess severity**
   - Critical: Blocks all users
   - High: Affects core features
   - Medium: Affects some features
   - Low: Minor UX issues

3. **Rollback if needed**
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

4. **Revert migrations if necessary**
   ```sql
   -- In Supabase: Carefully drop tables/columns
   -- Only if absolutely necessary
   ```

---

## 📝 **Issue Reporting Template**

When reporting issues:

```markdown
**Issue Title**: [Brief description]

**Severity**: Critical / High / Medium / Low

**Steps to Reproduce**:
1. Go to...
2. Click on...
3. See error...

**Expected Behavior**: 
What should happen

**Actual Behavior**: 
What actually happens

**Environment**:
- Browser: [Chrome 120]
- Device: [Desktop/Mobile]
- OS: [Windows/Mac/iOS/Android]
- User Role: [Admin/User]

**Screenshots**: 
[Attach if possible]

**Error Messages**: 
[Copy exact error from console]
```

---

## 🎯 **Completion Status**

### **Development** ✅
- [x] Phase 1: UI/UX & Bug Fixes
- [x] Phase 2: Media Support
- [x] Phase 3: Member Directory
- [x] Phase 4: Admin Controls
- [x] All code pushed to main
- [x] Build errors fixed

### **Deployment** 🚧
- [ ] Migrations run
- [ ] Storage configured
- [ ] Build successful
- [ ] Deployed to production

### **Testing** ⏳
- [ ] All test cases passed
- [ ] Cross-device tested
- [ ] Security verified
- [ ] Performance acceptable

### **Launch** 📅
- [ ] User training complete
- [ ] Documentation ready
- [ ] Support prepared
- [ ] Monitoring active

---

**Last Updated**: [Date]
**Version**: 1.0.0
**Status**: Ready for Testing

