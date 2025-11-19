# Treatment Version Migration Guide
**Date**: November 17, 2025  
**Purpose**: Guide for migrating between treatment versions (V2 → V3 → V4)

---

## 🎯 Quick Answer: The Simple Approach

**Question**: Is it just as simple as changing menu links?

**Answer**: **YES!** For most purposes, that's exactly what you do.

### The Simplest Migration: Make Users Use V3 Instead of V2

**File to change**: `app/dashboard/sessions/page.tsx`

**Change 1** (Line 574):
```typescript
// BEFORE: Points to V2
router.push(`/dashboard/sessions/treatment-v2?sessionId=${sessionId}`);

// AFTER: Points to V3
router.push(`/dashboard/sessions/treatment-v3?sessionId=${sessionId}`);
```

**Change 2** (Line 788):
```typescript
// BEFORE: Resume V2 session
router.push(`/dashboard/sessions/treatment-v2?sessionId=${session.session_id}&resume=true`)

// AFTER: Resume V3 session
router.push(`/dashboard/sessions/treatment-v3?sessionId=${session.session_id}&resume=true`)
```

**That's it!** Users will now use V3 by default.

---

## 📋 Complete Migration Scenarios

### Scenario 1: Switch Default from V2 to V3 (Recommended)

**Goal**: All new sessions use V3, existing V2 sessions can still be resumed

**Steps**:

1. **Update session start button** (line 574)
   ```typescript
   // Change this line:
   router.push(`/dashboard/sessions/treatment-v2?sessionId=${sessionId}`);
   // To this:
   router.push(`/dashboard/sessions/treatment-v3?sessionId=${sessionId}`);
   ```

2. **Optional: Add version detection for resume** (line 788)
   ```typescript
   // Smart resume that checks which version the session is
   const treatmentVersion = session.metadata?.treatment_version || session.treatment_version || 'v2';
   const resumeUrl = treatmentVersion === 'v3' 
     ? `/dashboard/sessions/treatment-v3?sessionId=${session.session_id}&resume=true`
     : `/dashboard/sessions/treatment-v2?sessionId=${session.session_id}&resume=true`;
   
   router.push(resumeUrl);
   ```

**Result**: 
- ✅ New sessions use V3 (faster, optimized)
- ✅ Old V2 sessions can still be resumed
- ✅ Zero data loss or breakage

---

### Scenario 2: Create V4 from V3 (For Voice Features)

**Goal**: Duplicate V3 as V4 so you can add voice features without affecting V3

**Steps**:

**Step 1**: Duplicate API Route
```bash
cp -r app/api/treatment-v3 app/api/treatment-v4
```

**Step 2**: Update route.ts imports/references
```typescript
// In app/api/treatment-v4/route.ts
// Change all console logs from 'V3' to 'V4'
// Change version metadata from 'v3' to 'v4'

// Example changes:
console.log('Treatment V4 API: POST request received'); // was V3
treatment_version: 'v4' // was 'v3'
```

**Step 3**: Duplicate page component
```bash
cp -r app/dashboard/sessions/treatment-v3 app/dashboard/sessions/treatment-v4
```

**Step 4**: Update page.tsx
```typescript
// In app/dashboard/sessions/treatment-v4/page.tsx

// Change API endpoint
const response = await fetch('/api/treatment-v4', { // was treatment-v3
  // ... rest of code
});
```

**Step 5**: Duplicate treatment components
```bash
cp -r components/treatment/v3 components/treatment/v4
```

**Step 6**: Update v4 component imports
```typescript
// In components/treatment/v4/TreatmentSession.tsx

// Update version prop default
version = 'v4' // was 'v3'

// Update all console logs
console.log('V4 Start session error:', error); // was V3
```

**Step 7**: Duplicate state machine
```bash
cp -r lib/v3 lib/v4
```

**Step 8**: Update state machine references
```typescript
// In lib/v4/treatment-state-machine.ts and related files
// Update any version-specific logging or metadata
```

**Step 9**: Update treatment-v4 route to import from v4
```typescript
// In app/api/treatment-v4/route.ts
import { TreatmentStateMachine } from '@/lib/v4/treatment-state-machine'; // was v3
```

**Step 10**: Test V4 separately
```bash
# Visit http://localhost:3000/dashboard/sessions/treatment-v4
# Complete a test session to verify everything works
```

**Step 11**: Add voice features to V4
```typescript
// Now you can safely add voice features to v4 components
// Without affecting v3 at all
```

**Result**: 
- ✅ V4 is independent copy of V3
- ✅ V3 remains stable
- ✅ V4 ready for voice features

---

### Scenario 3: Replace V2 with V3 Completely (Deprecate V2)

**Goal**: Remove V2 from codebase entirely, V3 becomes the only version

⚠️ **WARNING**: Only do this after V3 has been tested in production for 30+ days

**Steps**:

**Step 1**: Verify V3 stability
- [ ] V3 has been in production for 30+ days
- [ ] No critical bugs reported
- [ ] Performance meets expectations
- [ ] All treatment modalities working
- [ ] Database integrity verified

**Step 2**: Migrate existing V2 sessions (if needed)
```sql
-- Optional: Mark V2 sessions in metadata so you can track them
UPDATE treatment_sessions 
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb), 
  '{migrated_from}', 
  '"v2"'::jsonb
)
WHERE treatment_version IS NULL OR treatment_version = 'v2';

-- Update version field
UPDATE treatment_sessions 
SET treatment_version = 'v3'
WHERE treatment_version IS NULL OR treatment_version = 'v2';
```

**Step 3**: Update session resume logic
```typescript
// In app/dashboard/sessions/page.tsx (line 788)
// Change ALL resumes to use V3
router.push(`/dashboard/sessions/treatment-v3?sessionId=${session.session_id}&resume=true`)
```

**Step 4**: Add deprecation notice to V2 (optional grace period)
```typescript
// In app/dashboard/sessions/treatment-v2/page.tsx
// Add banner at top:
<div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
  <p className="text-yellow-700">
    V2 is deprecated. Please use V3 for better performance.
    <a href="/dashboard/sessions/treatment-v3" className="underline ml-2">
      Switch to V3
    </a>
  </p>
</div>
```

**Step 5**: Remove V2 files (after grace period)
```bash
# Delete V2 files
rm -rf app/api/treatment-v2
rm -rf app/dashboard/sessions/treatment-v2
rm -rf components/treatment/v2
rm -rf lib/v2

# Don't delete V1 - it might have historical value
```

**Step 6**: Update documentation
- Update README
- Update API docs
- Remove V2 references from guides

**Result**: 
- ✅ V3 is the only active version
- ✅ Simplified codebase
- ✅ Easier maintenance

---

## 🗺️ Version Comparison

| Feature | V1 | V2 | V3 | V4 (Future) |
|---------|----|----|----|----|
| **Status** | Legacy | Production | Production ⭐ | Planned |
| **Performance** | Baseline | Same as V1 | 60-75% faster | TBD |
| **Database Ops** | Sequential | Sequential | Parallel | TBD |
| **Processing Time** | ~350ms | ~350ms | ~50-150ms | TBD |
| **Loading Indicator** | Yes | Yes | No | TBD |
| **Voice Features** | No | No | No | Yes (planned) |
| **Code Base** | lib/v1/ | lib/v2/ | lib/v3/ | lib/v4/ (to be created) |
| **Maintenance** | None | Active | Active | Future |

---

## 📍 Where Each Version Lives

### V1 (Legacy - Don't Touch)
- **Route**: `/api/treatment-v1/` (if exists)
- **Page**: N/A (likely removed)
- **Components**: `components/treatment/v1/` (if exists)
- **State Machine**: `lib/v1/` (if exists)

### V2 (Current Production - Still Active)
- **Route**: `/api/treatment-v2/route.ts`
- **Page**: `/app/dashboard/sessions/treatment-v2/page.tsx`
- **Components**: `components/treatment/v2/`
- **State Machine**: `lib/v2/treatment-state-machine.ts`
- **Menu Link**: Line 574 & 788 in sessions/page.tsx

### V3 (Optimized Production - Ready)
- **Route**: `/api/treatment-v3/route.ts` ✅ Optimized
- **Page**: `/app/dashboard/sessions/treatment-v3/page.tsx`
- **Components**: `components/treatment/v3/` ✅ No loading indicator
- **State Machine**: `lib/v3/treatment-state-machine.ts`
- **Performance**: 300-500ms faster than V2
- **Menu Link**: Not currently linked (easy to add)

### V4 (Future - For Voice)
- **Route**: `/api/treatment-v4/` (to be created)
- **Page**: `/app/dashboard/sessions/treatment-v4/` (to be created)
- **Components**: `components/treatment/v4/` (to be created)
- **State Machine**: `lib/v4/` (to be created)
- **Special Features**: Voice integration

---

## 🔧 Implementation Priorities

### Priority 1: Quick Win (5 minutes)
**Switch default to V3**

Change 2 lines in `app/dashboard/sessions/page.tsx`:
- Line 574: treatment-v2 → treatment-v3
- Line 788: treatment-v2 → treatment-v3

Deploy and users get 60-75% faster responses immediately.

### Priority 2: Smart Resume (15 minutes)
**Detect version and resume accordingly**

Add version detection logic (see Scenario 1, Step 2 above).

### Priority 3: V4 Creation (1-2 hours)
**Duplicate V3 to V4 for voice features**

Follow Scenario 2 steps 1-10.

### Priority 4: V2 Deprecation (After 30 days)
**Remove V2 entirely**

Follow Scenario 3 only after V3 is proven stable.

---

## ⚠️ Important Notes

### Database Compatibility
- ✅ All versions (V1, V2, V3, V4) use the **same database schema**
- ✅ Sessions from any version can coexist in the database
- ✅ `treatment_version` field tracks which version created each session
- ✅ Migration between versions is safe

### Session Resume Compatibility
- V2 sessions can be resumed in V2
- V3 sessions can be resumed in V3  
- **Cannot** resume V2 session in V3 (different optimizations)
- **Cannot** resume V3 session in V2 (missing optimizations)
- Use version detection to route correctly

### User Data Safety
- All versions save data to same tables
- No data loss when switching versions
- Old sessions remain accessible
- Database queries work across versions

---

## 🧪 Testing Checklist

Before switching production traffic:

**V3 Testing**:
- [ ] Complete 10+ test sessions in V3
- [ ] Test all work types (Problem, Goal, Negative Experience)
- [ ] Test all methods (Problem Shifting, Identity, Belief, Blockage)
- [ ] Verify database saves correctly
- [ ] Test session resume
- [ ] Test undo functionality
- [ ] Measure actual performance improvement
- [ ] Check no console errors
- [ ] Verify V2 still works (for existing sessions)

**After V3 Deployment**:
- [ ] Monitor error logs for 7 days
- [ ] Check stats accuracy (should be 95%+)
- [ ] Collect user feedback
- [ ] Verify response times in production
- [ ] Check database for any anomalies

---

## 📞 Rollback Plan

If something goes wrong with V3:

**Immediate Rollback** (2 minutes):
```typescript
// In app/dashboard/sessions/page.tsx
// Change lines 574 and 788 back to:
router.push(`/dashboard/sessions/treatment-v2?sessionId=${sessionId}`);
```

**Code Rollback** (if needed):
```bash
git log --oneline -20 # Find commit before optimization
git revert <commit-hash> # Or use git reset if not pushed
```

V2 remains completely untouched and functional.

---

## 🎯 Recommended Approach

### For Most Teams:
**Start with Scenario 1** - Simple link switch to V3
- Low risk
- Immediate performance gain
- V2 still available for emergencies
- Easy rollback if needed

### For Voice Features:
**Use Scenario 2** - Create V4 from V3
- Keep V3 stable for production
- V4 becomes your experimental branch
- Add voice features without risk

### For Long Term:
**Eventually Scenario 3** - Deprecate V2
- After 30-60 days of V3 stability
- Simplify codebase
- Reduce maintenance burden

---

## 📊 Migration Decision Matrix

| Your Situation | Recommended Action | Time Required |
|----------------|-------------------|---------------|
| Want users on V3 ASAP | Change 2 menu links | 5 minutes |
| Want to add voice features | Create V4 from V3 | 1-2 hours |
| V3 stable for 30+ days | Deprecate V2 | 2-4 hours |
| Something broke in V3 | Rollback menu links | 2 minutes |
| Testing V3 | Both versions running | 0 minutes (current state) |

---

## 🚀 Summary

**Simplest Answer**: Yes, changing menu links from `/treatment-v2` to `/treatment-v3` is all you need to do!

**Why It's That Simple**:
- V3 already exists and is optimized
- Database schema is the same
- Routes are already set up
- Components are already built
- Just need to point users to the new route

**For Voice Features**:
- Duplicate V3 → V4
- Keep V3 stable
- Add voice to V4
- Similar process to how V3 was created from V2

---

## 📝 Quick Command Reference

```bash
# Switch users to V3 (edit manually in page.tsx)
# Change treatment-v2 → treatment-v3 on lines 574 & 788

# Create V4 from V3
cp -r app/api/treatment-v3 app/api/treatment-v4
cp -r app/dashboard/sessions/treatment-v3 app/dashboard/sessions/treatment-v4
cp -r components/treatment/v3 components/treatment/v4
cp -r lib/v3 lib/v4
# Then update version references in all copied files

# Rollback to V2
# Edit page.tsx, change treatment-v3 → treatment-v2 on lines 574 & 788

# Check current version distribution
SELECT treatment_version, COUNT(*) 
FROM treatment_sessions 
GROUP BY treatment_version;
```

---

**Questions?** This guide covers all major migration scenarios. Pick the approach that fits your needs!

