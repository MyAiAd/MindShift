# V4 Session Migration Fix

## Problem

When users attempted to start a v4 session, they received an immediate **500 Internal Server Error** from `/api/treatment-v4`:

```
[error] V4 Start session error: Error: Invalid step: problem_shifting_intro_dynamic
    at w.processUserInput (/var/task/.next/server/chunks/5370.js:69:1946)
```

### Root Cause

The issue occurred because:

1. **Session Persistence**: The session was previously created using v2/v3 and stored in the database with:
   - Phase: `introduction`
   - Step: `problem_shifting_intro_dynamic`

2. **Phase/Step Mismatch in V4**: In v4, step `problem_shifting_intro_dynamic` belongs to the `problem_shifting` phase, not the `introduction` phase
   - v2/v3: Steps could exist in wrong phases (less strict phase boundaries)
   - v4: Each step must be in its correct phase (strict modular architecture)

3. **Step Name Changes in V4**: V4 also refactored many steps to split them into "static" (auto-advancing, instructions-only) and "dynamic" (user interaction) pairs
   - v2/v3: `problem_shifting_intro` (single step)
   - v4: `problem_shifting_intro_static` + `problem_shifting_intro_dynamic` (two steps)

4. **No Migration**: When v4 loaded the old session from the database, it tried to find step `problem_shifting_intro_dynamic` in the `introduction` phase, but this step doesn't exist there

5. **Step Not Found**: The `processUserInput` method threw an "Invalid step" error at line 123 of `base-state-machine.ts`

## Solution

Added automatic step name AND phase migration in `lib/v4/base-state-machine.ts`:

### Implementation

1. **Migration Function** (`migrateContextToV4`):
   - Maps all v2/v3 step names to their v4 equivalents
   - Maps steps to their correct v4 phase
   - Logs migrations for debugging
   - Returns boolean indicating if migration occurred

2. **Integration Point**:
   - Called in `processUserInput()` immediately after loading context from database
   - Migrates both `currentStep` and `currentPhase` in the context
   - Saves migrated context back to database
   - Proceeds with v4 processing using migrated step/phase

### Step Name Migrations

The following v2/v3 step names are automatically migrated to v4:

| V2/V3 Step Name | V4 Step Name |
|----------------|--------------|
| `problem_shifting_intro` | `problem_shifting_intro_static` |
| `identity_shifting_intro` | `identity_shifting_intro_static` |
| `belief_shifting_intro` | `belief_shifting_intro_static` |
| `blockage_shifting_intro` | `blockage_shifting_intro_static` |
| `reality_shifting_intro` | `reality_shifting_intro_static` |
| `trauma_identity_step` | `trauma_identity_step_static` |
| `mind_shifting_explanation` | `mind_shifting_explanation_static` |

### Phase Migrations

Steps are automatically assigned to their correct v4 phase:

| Step Name Pattern | Correct V4 Phase |
|------------------|------------------|
| `problem_shifting_intro_*` | `problem_shifting` |
| `body_sensation_check` | `problem_shifting` |
| `what_needs_to_happen_step` | `problem_shifting` |
| `feel_solution_state` | `problem_shifting` |
| `feel_good_state` | `problem_shifting` |
| `what_happens_step` | `problem_shifting` |
| `check_if_still_problem` | `problem_shifting` |
| `identity_shifting_intro_*` | `identity_shifting` |
| `belief_shifting_intro_*` | `belief_shifting` |
| `blockage_shifting_intro_*` | `blockage_shifting` |
| `reality_shifting_intro_*` | `reality_shifting` |
| `trauma_identity_step_*` | `trauma_shifting` |

## Code Changes

**File**: `lib/v4/base-state-machine.ts`

### Added Migration Function

```typescript
/**
 * Migrate old v2/v3 step/phase to v4 equivalents
 * This ensures sessions created in older versions can continue in v4
 */
private migrateContextToV4(context: TreatmentContext): boolean {
  let migrated = false;
  const originalStep = context.currentStep;
  const originalPhase = context.currentPhase;

  // Step name migrations
  const stepMigrationMap: Record<string, string> = {
    'problem_shifting_intro': 'problem_shifting_intro_static',
    'identity_shifting_intro': 'identity_shifting_intro_static',
    'belief_shifting_intro': 'belief_shifting_intro_static',
    'blockage_shifting_intro': 'blockage_shifting_intro_static',
    'reality_shifting_intro': 'reality_shifting_intro_static',
    'trauma_identity_step': 'trauma_identity_step_static',
    'mind_shifting_explanation': 'mind_shifting_explanation_static',
  };

  // Step-to-Phase mapping: Maps step names to their correct v4 phase
  const stepToPhaseMap: Record<string, string> = {
    'problem_shifting_intro_static': 'problem_shifting',
    'problem_shifting_intro_dynamic': 'problem_shifting',
    'body_sensation_check': 'problem_shifting',
    'what_needs_to_happen_step': 'problem_shifting',
    'feel_solution_state': 'problem_shifting',
    'feel_good_state': 'problem_shifting',
    'what_happens_step': 'problem_shifting',
    'check_if_still_problem': 'problem_shifting',
    'identity_shifting_intro_static': 'identity_shifting',
    'identity_shifting_intro_dynamic': 'identity_shifting',
    'belief_shifting_intro_static': 'belief_shifting',
    'belief_shifting_intro_dynamic': 'belief_shifting',
    'blockage_shifting_intro_static': 'blockage_shifting',
    'blockage_shifting_intro_dynamic': 'blockage_shifting',
    'reality_shifting_intro_static': 'reality_shifting',
    'reality_shifting_intro_dynamic': 'reality_shifting',
    'trauma_identity_step_static': 'trauma_shifting',
    'trauma_identity_step_dynamic': 'trauma_shifting',
  };

  // Migrate step name if needed
  const migratedStep = stepMigrationMap[context.currentStep] || context.currentStep;
  if (migratedStep !== context.currentStep) {
    console.log(`🔄 STEP_MIGRATION: Migrating step "${context.currentStep}" → "${migratedStep}"`);
    context.currentStep = migratedStep;
    migrated = true;
  }

  // Migrate phase if step belongs to a different phase
  const correctPhase = stepToPhaseMap[context.currentStep];
  if (correctPhase && correctPhase !== context.currentPhase) {
    console.log(`🔄 PHASE_MIGRATION: Migrating phase "${context.currentPhase}" → "${correctPhase}" for step "${context.currentStep}"`);
    context.currentPhase = correctPhase;
    migrated = true;
  }
  
  if (migrated) {
    console.log(`🔄 CONTEXT_MIGRATED: Session ${context.sessionId}:`, {
      step: `${originalStep} → ${context.currentStep}`,
      phase: `${originalPhase} → ${context.currentPhase}`
    });
  }
  
  return migrated;
}
```

### Integrated into processUserInput

```typescript
async processUserInput(
  sessionId: string,
  userInput: string,
  context?: Partial<TreatmentContext>,
  bypassValidation?: boolean
): Promise<ProcessingResult> {
  // Load context from database
  await this.getOrCreateContextAsync(sessionId, context);

  // Migrate step name and phase if needed (NEW)
  const treatmentContext = this.getOrCreateContext(sessionId, context);
  const wasMigrated = this.migrateContextToV4(treatmentContext);
  
  if (wasMigrated) {
    // Save the migrated context back to database
    await DatabaseOperations.saveContextToDatabase(treatmentContext);
  }

  // Continue with normal processing...
}
```

## Benefits

1. **Complete Backward Compatibility**: Users can continue sessions that were started in v2/v3, even if they're mid-treatment
2. **Seamless Migration**: Automatic, no user intervention required
3. **Database Persistence**: Migrated step/phase names are saved, so migration only happens once per session
4. **Debugging Support**: Clear console logs show when and what migrations occur
5. **Future-Proof**: Easy to add more step/phase migrations as needed
6. **Modular Architecture Preserved**: V4's strict phase boundaries are maintained while supporting legacy data

## Testing

After deployment, test by:

1. Starting a v4 session that was previously created in v2/v3
2. Check server logs for migration messages:
   ```
   🔄 PHASE_MIGRATION: Migrating phase "introduction" → "problem_shifting" for step "problem_shifting_intro_dynamic"
   🔄 CONTEXT_MIGRATED: Session session-xxx: {
     step: 'problem_shifting_intro_dynamic → problem_shifting_intro_dynamic',
     phase: 'introduction → problem_shifting'
   }
   ```
3. Verify session continues without 500 errors
4. Confirm audio preloading works
5. Test voice recognition and feedback loop prevention

## Related Files

- **Fixed**: `lib/v4/base-state-machine.ts`
- **Related**: `lib/v4/treatment-state-machine.ts`
- **Related**: `lib/v4/treatment-modalities/problem-shifting.ts`
- **API Route**: `app/api/treatment-v4/route.ts`
- **Frontend**: `components/treatment/v4/TreatmentSession.tsx`

## Next Steps

1. Monitor Vercel logs for successful migrations
2. Verify no new 500 errors occur
3. Test voice features (audio preload, speech recognition, feedback loop prevention)
4. Consider adding migration for other step/phase combinations if needed (check logs for "Invalid step" or "Invalid phase" errors)

## Additional Context

This fix was part of a larger effort to:
- Make v4 the default "Sessions" experience
- Move v2/v3 to the "Labs" area
- Implement voice features (audio preload, speech recognition)
- Fix audio feedback loops (mic hearing AI voice)
- Add play button overlay for session start

All voice-related fixes and the v4 production switch are documented in:
- `VOICE_FIXES_AND_INVESTIGATION.md`
- `V4_PRODUCTION_SWITCH_SUMMARY.md`
