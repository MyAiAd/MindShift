# V2 to V3 Fix Roadmap
## Complete Action Plan for Bringing V3 to Production Parity

**Date**: November 9, 2025  
**Status**: ✅ ANALYSIS COMPLETE, READY FOR IMPLEMENTATION  

---

## 📚 Documentation Suite

This roadmap synthesizes findings from three comprehensive analyses:

1. **V2_V3_ARCHITECTURE_DIVERGENCE_ANALYSIS.md** (35 min read)
   - High-level architectural differences
   - Root cause of the "1" display bug
   - Execution flow comparisons
   - 25 test scenarios

2. **V2_V3_ORCHESTRATION_COMPLETENESS_AUDIT.md** (20 min read)
   - Quantitative comparison (90 vs 91 case statements, 48 handlers)
   - Case statement inventory
   - Missing routing paths identified

3. **V2_V3_HANDLER_BY_HANDLER_COMPARISON.md** (45 min read)
   - Detailed line-by-line logic comparison
   - 7 critical handlers analyzed
   - 180+ lines of missing logic documented
   - 3 showstoppers, 4 critical issues, 1 critical bug found

**Total documentation**: ~100 minutes of reading, 3 documents, 2,437 lines

---

## 🎯 Executive Summary

### The Bottom Line

V3 is **NOT production-ready**. While it has:
- ✅ Superior modular architecture
- ✅ All step definitions synced with v2
- ✅ All scripted responses correct
- ✅ All validation rules correct

It is missing:
- ❌ 68 lines of digging deeper logic
- ❌ 33 lines of trauma redirect logic
- ❌ ~80 lines of edge case handling
- ❌ Critical metadata clearing
- ❌ 1 critical routing bug

### Impact Assessment

| Feature | V2 | V3 | Production Ready? |
|---------|-----|-----|-------------------|
| Basic session | ✅ | ⚠️ | Maybe |
| Digging deeper | ✅ | ❌ | **NO** |
| Trauma Shifting | ✅ | ❌ | **NO** |
| Goal setting | ✅ | ⚠️ | Maybe |
| Metadata management | ✅ | ❌ | **NO** |

---

## 🔴 Critical Issues Summary

### Issue #1: Digging Deeper Broken (SHOWSTOPPER)

**Handler**: `handleChooseMethod`  
**Missing**: 68 lines  
**Impact**: CATASTROPHIC

**Problem**:
- Doesn't check `context.metadata.isDiggingDeeperMethodSelection` flag
- Doesn't clear previous modality metadata
- Doesn't use new problem from digging deeper
- Always asks for problem description (even when already provided)

**User Experience**:
- References WRONG problem statement
- Carries stale metadata (`currentBelief`, `cycleCount`) from previous session
- Treatment applies to wrong problem
- **Patient safety risk**

**Fix Required**:
```typescript
// V2 lines 5700-5767 must be ported to v3 handleChooseMethod
// Add check for isDiggingDeeperMethodSelection flag
// Add clearPreviousModalityMetadata() call
// Add multiple problem source handling
```

**Estimated effort**: 4-6 hours

---

### Issue #2: Trauma Redirect Broken (SHOWSTOPPER)

**Handler**: `handleConfirmStatement`  
**Missing**: 33 lines  
**Impact**: CATASTROPHIC

**Problem**:
- Doesn't check if came from `trauma_problem_redirect`
- Always routes to `work_type_description` on "no" (wrong for goals/trauma)
- Doesn't clear old responses
- Doesn't update phase correctly

**User Experience**:
- Can't correct incorrect trauma statements
- Routes to wrong step
- Trauma flow breaks completely

**Fix Required**:
```typescript
// V2 lines 5994-6041 must be ported to v3 handleConfirmStatement
// Add trauma_problem_redirect check
// Add workType-based routing
// Add metadata clearing
// Add database persistence
```

**Estimated effort**: 2-3 hours

---

### Issue #3: Trauma Routing Bug (CRITICAL BUG)

**Handler**: `handleRouteToMethod`  
**Bug**: ONE incorrect line  
**Impact**: CRITICAL

**Problem**:
```typescript
// V3 line 597 (WRONG):
return 'trauma_identity_step';

// Should be (V2 line 6056):
return 'trauma_dissolve_step_a';
```

**User Experience**:
- Skips entire trauma dissolve sequence
- Trauma Shifting doesn't work correctly

**Fix Required**: Change 1 line

**Estimated effort**: 5 minutes

---

### Issue #4: `readyForTreatment` Flag Dependency (CRITICAL RISK)

**Handler**: `handleWorkTypeDescription`  
**Risk**: NEW dependency not in v2  
**Impact**: CRITICAL

**Problem**:
V3 added a new flag that gates routing:
```typescript
if (context.metadata.readyForTreatment) {
  // Route to treatment
} else {
  return 'work_type_description';  // STUCK IN LOOP!
}
```

**Question**: WHERE is this flag set to `true`?  
**Risk**: If not set properly, infinite loop

**Verification needed**: Search codebase for where `readyForTreatment = true` is set

**Fix Required**: Either remove flag OR ensure it's set correctly in step definitions

**Estimated effort**: 1-2 hours (if correct) OR 3-4 hours (if needs redesign)

---

## 📋 Complete Fix Checklist

### Phase 1: Critical Fixes (REQUIRED FOR PRODUCTION)

- [ ] **Fix #1**: Port digging deeper logic to `handleChooseMethod` (4-6 hours)
  - [ ] Add `isDiggingDeeperMethodSelection` check
  - [ ] Port 6 problem source handling
  - [ ] Add `clearPreviousModalityMetadata()` call
  - [ ] Add skip-description logic for existing problems
  - [ ] Test: Complete treatment → Dig deeper → New problem → Verify correct problem used

- [ ] **Fix #2**: Port trauma redirect to `handleConfirmStatement` (2-3 hours)
  - [ ] Add `trauma_problem_redirect` check
  - [ ] Add workType-based routing ("no" response)
  - [ ] Add metadata clearing
  - [ ] Add database persistence
  - [ ] Test: Trauma redirect → Say "no" → Verify goes back to trauma_problem_redirect

- [ ] **Fix #3**: Fix trauma routing bug in `handleRouteToMethod` (5 min)
  - [ ] Change line 597 from `trauma_identity_step` to `trauma_dissolve_step_a`
  - [ ] Test: Select negative experience → Verify goes to dissolve step

- [ ] **Fix #4**: Verify/fix `readyForTreatment` flag (1-4 hours)
  - [ ] Search where flag is set
  - [ ] Verify it's set correctly
  - [ ] Remove if unnecessary OR fix if broken
  - [ ] Test: Select method → Enter problem → Verify routes correctly

**Phase 1 Total**: 8-14 hours

---

### Phase 2: Handler Completeness Review (RECOMMENDED)

- [ ] Review remaining 41 handlers (not yet analyzed)
- [ ] Document any additional missing logic
- [ ] Prioritize findings
- [ ] Implement fixes

**Phase 2 Estimate**: 20-30 hours (analysis + fixes)

---

### Phase 3: Integration Testing (REQUIRED)

Run all 25 test scenarios documented in V2_V3_ARCHITECTURE_DIVERGENCE_ANALYSIS.md:

#### Basic Flow Tests
- [ ] User selects "Problem" → Shows method selection
- [ ] User selects "Problem Shifting" → Asks for problem
- [ ] User enters problem → Starts Problem Shifting
- [ ] User selects "Goal" → Asks for goal
- [ ] User selects "Negative Experience" → Starts Trauma

#### Method Selection Tests
- [ ] Identity Shifting works
- [ ] Belief Shifting works
- [ ] Blockage Shifting works

#### Digging Deeper Tests (CRITICAL)
- [ ] Complete treatment → Dig deeper → Future problem check
- [ ] Dig deeper → New problem → Method selection
- [ ] Dig deeper → Uses correct problem statement
- [ ] Return from digging → Preserves original problem

#### Integration Tests
- [ ] Problem Shifting → Integration questions
- [ ] Identity Shifting → Integration questions
- [ ] Reality Shifting → Integration questions
- [ ] Action followup works

#### Context Tests
- [ ] Problem statement preserved
- [ ] Original vs current problem tracked
- [ ] Method selection remembered
- [ ] Metadata properly cleared

#### Edge Cases
- [ ] "No" to confirmation → Goes back correctly
- [ ] Multiple problems → Shows selection
- [ ] Invalid input → Shows clarification
- [ ] Goal with deadline → Extracted automatically
- [ ] Trauma redirect → Routes correctly

**Phase 3 Estimate**: 8-10 hours

---

## 🎯 Recommended Implementation Order

### Sprint 1: Showstoppers (1-2 days)
1. Fix #3: Trauma routing bug (5 min) ← Quick win
2. Fix #1: Digging deeper logic (4-6 hours)
3. Fix #2: Trauma redirect (2-3 hours)
4. Test: Basic digging deeper flow

**Deliverable**: Digging deeper and trauma redirect work

---

### Sprint 2: Critical Dependencies (0.5-1 day)
5. Fix #4: `readyForTreatment` flag (1-4 hours)
6. Add `clearPreviousModalityMetadata()` function
7. Add database persistence calls
8. Test: All basic flows

**Deliverable**: Core routing works reliably

---

### Sprint 3: Comprehensive Testing (1-2 days)
9. Run all 25 test scenarios
10. Fix any issues found
11. Compare v2 vs v3 output word-for-word
12. Document any remaining differences

**Deliverable**: V3 passes all tests

---

### Sprint 4: Remaining Handlers (2-3 days)
13. Review 41 remaining handlers
14. Fix any issues found
15. Final regression testing

**Deliverable**: Complete v3 parity with v2

---

## 📊 Effort Estimation

| Phase | Optimistic | Realistic | Pessimistic |
|-------|------------|-----------|-------------|
| Sprint 1: Showstoppers | 6 hours | 10 hours | 14 hours |
| Sprint 2: Dependencies | 2 hours | 4 hours | 6 hours |
| Sprint 3: Testing | 6 hours | 10 hours | 16 hours |
| Sprint 4: Remaining | 16 hours | 24 hours | 40 hours |
| **TOTAL** | **30 hours** | **48 hours** | **76 hours** |

**Recommendation**: Budget **6-10 working days** for complete v3 fix

---

## 🚦 Go/No-Go Decision

### Option A: Fix V3 (Recommended if time available)

**Pros**:
- ✅ Better architecture (modular, maintainable)
- ✅ Easier to extend in future
- ✅ Better testability
- ✅ Step definitions already synced

**Cons**:
- ❌ 30-76 hours of work required
- ❌ High risk if fixes incomplete
- ❌ Need comprehensive testing

**Best for**: Long-term maintenance, if you have 2 weeks available

---

### Option B: Continue with V2 (Safest)

**Pros**:
- ✅ Works perfectly NOW
- ✅ Zero risk
- ✅ Zero additional work
- ✅ Battle-tested in production

**Cons**:
- ❌ Harder to maintain (8,076-line file)
- ❌ Harder to extend
- ❌ Harder to test individual components

**Best for**: Immediate production needs, risk-averse situations

---

## 📖 How to Use This Roadmap

### For Decision Makers

1. **Read**: Executive Summary (above)
2. **Review**: Effort Estimation table
3. **Decide**: Option A (fix v3) vs Option B (stay on v2)
4. **Communicate**: Decision to development team

### For Developers

1. **Read**: All 3 analysis documents (100 min)
2. **Start with**: Sprint 1 (showstoppers)
3. **Follow**: Implementation order above
4. **Test**: Each fix individually before moving on
5. **Document**: Any additional issues found

### For QA/Testing

1. **Read**: Phase 3 checklist
2. **Prepare**: 25 test scenarios
3. **Compare**: V2 output vs V3 output for each scenario
4. **Report**: Any word-for-word differences (they matter!)

---

## 🎓 Key Learnings

### What Went Wrong

1. **Incomplete port**: V3 handlers were simplified without preserving all v2 logic
2. **Missing edge cases**: 68+ lines of critical edge case handling lost
3. **New dependencies**: Added `readyForTreatment` flag without full implementation
4. **No comprehensive testing**: V3 wasn't tested against all v2 scenarios

### How to Prevent This

1. **Line-by-line porting**: When refactoring, port ALL logic, even if it seems unnecessary
2. **Preserve edge cases**: Don't simplify away edge case handling
3. **Test everything**: Run comprehensive tests before declaring parity
4. **Document dependencies**: New flags/systems need full documentation

---

## 🏁 Success Criteria

V3 is production-ready when:

- ✅ All 25 test scenarios pass
- ✅ Digging deeper works correctly
- ✅ Trauma redirect works correctly
- ✅ No metadata contamination
- ✅ Word-for-word output matches v2 (except for architectural improvements)
- ✅ All 48 handlers reviewed and fixed
- ✅ No patient safety risks
- ✅ Doctor approves the changes

---

## 📞 Support

**Documentation**:
- V2_V3_ARCHITECTURE_DIVERGENCE_ANALYSIS.md (why v3 fails)
- V2_V3_ORCHESTRATION_COMPLETENESS_AUDIT.md (what's missing)
- V2_V3_HANDLER_BY_HANDLER_COMPARISON.md (detailed logic gaps)
- V2_V3_FIX_ROADMAP.md (this document - how to fix)

**Questions?**
- Review the three analysis documents first
- Check the specific handler comparison for details
- Search v2 code for the corresponding logic

---

**Document Status**: ✅ COMPLETE  
**Next Action**: Decision makers review and choose Option A or B  
**If Option A**: Development team starts with Sprint 1  
**If Option B**: Continue using v2, shelve v3 for future

**Created**: November 9, 2025  
**Est. Read Time**: 15 minutes

