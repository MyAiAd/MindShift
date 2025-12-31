# V4 Session Migration Fix

## Problem

When users attempted to start a v4 session, they received an immediate **500 Internal Server Error** from `/api/treatment-v4`:

```
[error] V4 Start session error: Error: Invalid step: problem_shifting_intro_dynamic
    at w.processUserInput (/var/task/.next/server/chunks/5370.js:69:1946)
```

### Root Cause

The issue occurred because:

1. **Session Persistence**: The session was previously created using v2/v3 and stored in the database with step name `problem_shifting_intro_dynamic`
2. **Step Name Changes in V4**: V4 refactored many steps to split them into "static" (auto-advancing, instructions-only) and "dynamic" (user interaction) pairs
   - v2/v3: `problem_shifting_intro` (single step)
   - v4: `problem_shifting_intro_static` + `problem_shifting_intro_dynamic` (two steps)
3. **No Migration**: When v4 loaded the old session from the database, it tried to find step `problem_shifting_intro_dynamic` in its phase definitions
4. **Step Not Found**: Since this exact step name didn't exist in v4's definitions, the `processUserInput` method threw an "Invalid step" error at line 76-77 of `base-state-machine.ts`

## Solution

Added automatic step name migration in `lib/v4/base-state-machine.ts`:

### Implementation

1. **Migration Function** (`migrateStepNameToV4`):
   - Maps all v2/v3 step names to their v4 equivalents
   - Logs migrations for debugging
   - Returns unchanged name if no migration needed

2. **Integration Point**:
   - Called in `processUserInput()` immediately after loading context from database
   - Migrates the `currentStep` in the context
   - Saves migrated context back to database
   - Proceeds with v4 processing using migrated step name

### Step Migrations

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

## Code Changes

**File**: `lib/v4/base-state-machine.ts`

### Added Migration Function

```typescript
/**
 * Migrate old v2/v3 step names to v4 equivalents
 * This ensures sessions created in older versions can continue in v4
 */
private migrateStepNameToV4(stepName: string): string {
  const stepMigrationMap: Record<string, string> = {
    'problem_shifting_intro': 'problem_shifting_intro_static',
    'identity_shifting_intro': 'identity_shifting_intro_static',
    'belief_shifting_intro': 'belief_shifting_intro_static',
    'blockage_shifting_intro': 'blockage_shifting_intro_static',
    'reality_shifting_intro': 'reality_shifting_intro_static',
    'trauma_identity_step': 'trauma_identity_step_static',
    'mind_shifting_explanation': 'mind_shifting_explanation_static',
  };

  const migratedStep = stepMigrationMap[stepName] || stepName;
  
  if (migratedStep !== stepName) {
    console.log(`🔄 STEP_MIGRATION: Migrating step "${stepName}" → "${migratedStep}"`);
  }
  
  return migratedStep;
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

  // Migrate step name if needed (NEW)
  const treatmentContext = this.getOrCreateContext(sessionId, context);
  const originalStep = treatmentContext.currentStep;
  treatmentContext.currentStep = this.migrateStepNameToV4(treatmentContext.currentStep);
  
  if (originalStep !== treatmentContext.currentStep) {
    console.log(`🔄 CONTEXT_MIGRATED: Session ${sessionId} step migrated from "${originalStep}" to "${treatmentContext.currentStep}"`);
    // Save the migrated context back to database
    await DatabaseOperations.saveContextToDatabase(treatmentContext);
  }

  // Continue with normal processing...
}
```

## Benefits

1. **Backward Compatibility**: Users can continue sessions that were started in v2/v3
2. **Seamless Migration**: Automatic, no user intervention required
3. **Database Persistence**: Migrated step names are saved, so migration only happens once per session
4. **Debugging Support**: Clear console logs show when and what migrations occur
5. **Future-Proof**: Easy to add more step migrations as needed

## Testing

After deployment, test by:

1. Starting a v4 session that was previously created in v2/v3
2. Check server logs for migration messages:
   ```
   🔄 STEP_MIGRATION: Migrating step "problem_shifting_intro" → "problem_shifting_intro_static"
   🔄 CONTEXT_MIGRATED: Session session-xxx step migrated from "problem_shifting_intro" to "problem_shifting_intro_static"
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
4. Consider adding migration for other step names if needed (check logs for "Invalid step" errors)

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
