# V2-V3 Parity Testing Guide

**Date**: November 9, 2025  
**Purpose**: Comprehensive testing checklist to verify V2-V3 parity  
**Status**: Ready for testing

---

## 🎯 Testing Objectives

1. **Verify V3 behaves identically to V2** for all treatment flows
2. **Confirm V2 is unchanged** and still works perfectly
3. **Test all edge cases** including multi-level digging deeper
4. **Validate patient safety** in all scenarios

---

## 🔐 Pre-Testing Verification

### V2 Protection Check
```bash
# Verify V2 is untouched
git diff lib/v2/treatment-state-machine.ts | wc -l
# Expected: 0

git status lib/v2/treatment-state-machine.ts  
# Expected: "nothing to commit, working tree clean"
```

✅ **VERIFIED**: V2 has 0 modifications

---

## 📋 Phase 6: Comprehensive Testing

### 6.1 Test All 6 Modality Flows

#### Test 1: Problem Shifting
**V2 URL**: `/dashboard/sessions/treatment`  
**V3 URL**: `/dashboard/sessions/treatment-v3`

**Flow**:
1. Select "Problem" (1)
2. Select "Problem Shifting" (1)
3. Enter problem: "I feel anxious"
4. Confirm: "yes"
5. Feel problem → what needs to happen
6. Feel solution state
7. Check if still problem: "no"
8. Digging deeper start: "no"
9. Integration

**Expected**: V2 and V3 produce identical prompts and flow

**Test Variations**:
- [ ] Problem with cycling (answer "yes" to still problem)
- [ ] Problem with digging deeper (answer "yes" to dig deeper)
- [ ] Problem with multiple cycles (3+)

---

#### Test 2: Identity Shifting  
**Flow**:
1. Select "Problem" (1)
2. Select "Identity Shifting" (2)
3. Enter problem: "I feel like a failure"
4. Confirm: "yes"
5. Identify the identity: "failure"
6. Dissolve steps A-F
7. Future check: "yes" → should use bridge phrase
8. Dissolve again (bridge phrase should appear)
9. Future check: "no"
10. Scenario check: "no"
11. Identity check: "no"
12. Problem check: "no"

**Critical to verify**:
- [ ] Bridge phrases appear correctly ("Put yourself in the future...")
- [ ] Bridge phrases don't repeat on same cycle
- [ ] Future/scenario checks route correctly
- [ ] Problem check routes to digging deeper

---

#### Test 3: Belief Shifting
**Flow**:
1. Select "Problem" (1)
2. Select "Belief Shifting" (3)  
3. Enter problem: "I can't succeed"
4. Go through intro
5. Belief steps A-F
6. Belief check 1: "no"
7. Belief check 2: "no"
8. Belief check 3: "no"
9. Belief check 4: "no"
10. Problem check: "no"

**Critical to verify**:
- [ ] All 4 belief checks happen in order
- [ ] Cycling back works (if answer "yes" to any check)
- [ ] Problem check routes correctly

---

#### Test 4: Blockage Shifting
**Flow**:
1. Select "Problem" (1)
2. Select "Blockage Shifting" (4)
3. Enter problem: "I feel stuck"
4. Blockage steps A-E
5. Check if still problem: "no problem" or "gone"

**Critical to verify**:
- [ ] Step E resolution detection works
- [ ] Permission optimization works

---

#### Test 5: Reality Shifting (Goal)
**Flow**:
1. Select "Goal" (2)
2. Enter goal: "I want to start a business by December"
3. Goal confirmation
4. Reality shifting intro
5. Column A loop (feel doubt, why not possible, etc)
6. Column B loop (checking questions, cycle B2-B4)
7. Integration

**Critical to verify**:
- [ ] Goal with deadline is parsed correctly
- [ ] Goal without deadline works
- [ ] Both column loops work

---

#### Test 6: Trauma Shifting
**Flow**:
1. Select "Negative Experience" (3)
2. Enter experience: "Car accident last year"
3. Trauma shifting intro: "yes"
4. Identity step
5. Dissolve steps A-E
6. Future identity check
7. Future scenario check
8. Future projection steps
9. Experience check: "no"
10. Trauma dig deeper: "no"
11. Trauma dig deeper 2: "no"

**Critical to verify**:
- [ ] Future projection steps (5 steps) exist
- [ ] Trauma dig deeper has 2 questions
- [ ] Experience check clears responses correctly

---

### 6.2 Digging Deeper Testing

#### Test 7: Single-Level Digging Deeper
**Flow**:
1. Complete Problem Shifting
2. Answer "yes" to dig deeper
3. Future problem: "yes" → enter new problem
4. Method selection: choose any method
5. Complete that method
6. Should return to "Would you like to dig deeper?"

**Critical to verify**:
- [ ] New problem is stored correctly
- [ ] Return point preserved
- [ ] Original problem still accessible

---

#### Test 8: Multi-Level Digging Deeper (2 levels)
**Flow**:
1. Complete Problem Shifting → dig deeper: "yes"
2. Future problem: "yes" → Problem 2
3. Complete treatment → dig deeper: "yes"  
4. Scenario check: "yes" → Problem 3
5. Complete treatment → should return to scenario check
6. Scenario check: "no" → should return to future problem check
7. Future problem: "no" → should return to original dig deeper

**Critical to verify**:
- [ ] Each return point preserved
- [ ] Metadata doesn't leak between levels
- [ ] clearPreviousModalityMetadata called

---

#### Test 9: Scenario Checks (3 iterations)
**Flow**:
1. Dig deeper → future problem: "no"
2. Scenario check 1: "yes" → enter scenario problem 1
3. Complete → return to scenario check 1: "no"
4. Scenario check 2: "yes" → enter scenario problem 2
5. Complete → return to scenario check 2: "no"
6. Scenario check 3: "yes" → enter scenario problem 3
7. Complete → return to scenario check 3: "no"
8. Anything else check 1

**Critical to verify**:
- [ ] All 3 scenario checks available
- [ ] Each returns correctly
- [ ] Problems stored separately

---

#### Test 10: Anything Else Checks (2 iterations)
**Flow**:
1. After scenarios → anything else 1: "yes"
2. Enter problem → complete treatment
3. Anything else 2: "yes"
4. Enter problem → complete treatment
5. Anything else 3: "yes" or "no"

**Critical to verify**:
- [ ] 2 anything else iterations work
- [ ] Problems stored correctly
- [ ] Routes to integration

---

### 6.3 Edge Case Testing

#### Test 11: Confirmation Flow
**Flow**:
1. Enter problem
2. Confirm: "no"
3. Restate problem
4. Confirm: "yes"

**Critical to verify**:
- [ ] Restatement works for all work types
- [ ] Confirmation routing correct

---

#### Test 12: Trauma Problem Redirect
**Flow**:
1. Trauma shifting intro: "no"
2. Should redirect to problem statement capture
3. Enter problem
4. Route to method selection

**Critical to verify**:
- [ ] Problem constructed correctly
- [ ] Database persistence works

---

#### Test 13: Cross-Modality Digging
**Flow**:
1. Start with Problem Shifting
2. Dig deeper → use Identity Shifting
3. Dig deeper again → use Belief Shifting
4. Should return correctly through all levels

**Critical to verify**:
- [ ] Metadata cleared between modalities
- [ ] Return points preserved
- [ ] No contamination

---

### 6.4 Permission Optimization Testing

#### Test 14: Permission Asked Once
**Flow**:
1. Complete any modality
2. Dig deeper: "yes" (permission granted)
3. Complete nested problem
4. Should NOT ask permission again
5. Should go directly to future_problem_check

**Critical to verify**:
- [ ] Permission only asked once
- [ ] Works for all modalities
- [ ] returnToDiggingStep handled correctly

---

### 6.5 Metadata Testing

#### Test 15: Cycle Count
**Flow**:
1. Problem Shifting with cycling
2. Check console logs for cycleCount
3. Should increment: 0 → 1 → 2 → etc.

**Expected**: `cycleCount` increments correctly

---

#### Test 16: Problem Statement Preservation
**Flow**:
1. Enter originalProblem: "I feel anxious"
2. Dig deeper → newProblem: "I fear judgment"
3. Check metadata:
   - originalProblemStatement: "I feel anxious"
   - currentDiggingProblem: "I fear judgment"
   - problemStatement: "I fear judgment"

**Expected**: All problem fields correct

---

### 6.6 Database Persistence Testing

#### Test 17: Trauma Response Clearing
**Flow**:
1. Complete trauma cycle
2. Experience check: "yes" (cycle again)
3. Check database: trauma responses should be cleared
4. Check console: "Cleared previous identity and dissolve responses"

**Expected**: Database save called after clearing

---

## 🔍 Testing Methodology

### For Each Test:
1. **Run in V2 first** - Document exact prompts and flow
2. **Run in V3 second** - Compare to V2
3. **Compare**:
   - [ ] Prompts are identical (word-for-word)
   - [ ] Flow is identical (same steps)
   - [ ] Buttons/options are identical
   - [ ] Routing is identical
   - [ ] Metadata is identical (check console logs)

### Console Log Monitoring
Enable developer console and watch for:
- `🔍` Routing logs
- `🎯` Work type selection logs
- `🔄` Cycling logs
- `❌` Error logs (should be none)

---

## ✅ Success Criteria

### Must Pass All:
- [ ] All 6 modalities work identically in V2 and V3
- [ ] All digging deeper flows work (1-3 levels)
- [ ] All edge cases handled correctly
- [ ] No console errors in V3
- [ ] V2 still works perfectly (unchanged)
- [ ] All prompts match word-for-word
- [ ] All metadata managed correctly
- [ ] Database persistence works
- [ ] Permission optimization works

---

## 🚨 If Issues Found

### Debugging Steps:
1. **Check console logs** for routing information
2. **Check metadata** in browser dev tools (React DevTools)
3. **Compare handler** in V2 vs V3
4. **Check step definitions** in modality files
5. **Verify** clearPreviousModalityMetadata called

### Common Issues to Watch For:
- ❌ Wrong problem statement used
- ❌ Metadata contamination between modalities
- ❌ Return points lost in digging deeper
- ❌ Permission asked multiple times
- ❌ Responses not cleared on cycling
- ❌ Bridge phrases repeated incorrectly

---

## 📝 Testing Log Template

```markdown
### Test: [Test Name]
**Date**: [Date]
**Tester**: [Name]
**V2 Result**: ✅ Pass / ❌ Fail
**V3 Result**: ✅ Pass / ❌ Fail
**Match**: ✅ Identical / ❌ Differences found

**Differences** (if any):
- [List any differences]

**Console Errors**:
- [List any errors]

**Notes**:
- [Any observations]
```

---

## 🎉 Final Verification

Once all tests pass:

```bash
# Verify V2 still untouched
git diff lib/v2/treatment-state-machine.ts | wc -l
# Expected: 0

# Verify V3 changes committed
git log --oneline -n 10 -- lib/v3/treatment-state-machine.ts
# Should show all Phase 1-4 commits

# Push to production
git push origin main
```

---

## 📊 Testing Completion Checklist

- [ ] All 6 modality tests complete
- [ ] All digging deeper tests complete  
- [ ] All edge case tests complete
- [ ] All permission tests complete
- [ ] All metadata tests complete
- [ ] All database tests complete
- [ ] V2 verified working
- [ ] V3 verified working
- [ ] Parity confirmed
- [ ] Ready for production

---

*Testing Guide Generated: Phase 6*  
*Estimated Testing Time: 2-3 hours*  
*Next: User-driven testing in browser*

