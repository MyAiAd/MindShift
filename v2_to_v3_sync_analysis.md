# V2 to V3 Synchronization Analysis

## Overview
V2 has received significant updates that are not reflected in V3. This document analyzes the differences and proposes a sync strategy.

## Current Architecture

### V2 Architecture
- **Single File**: `lib/v2/treatment-state-machine.ts` (~8,076 lines)
- **All modalities defined in one file** within `initializePhases()` method
- **Modalities included**:
  - Problem Shifting
  - Identity Shifting
  - Belief Shifting
  - Blockage Shifting
  - Reality Shifting
  - Trauma Shifting
  - Digging Deeper
  - Integration

### V3 Architecture  
- **Separated Files**: Individual files in `lib/v3/treatment-modalities/`
- **Base State Machine**: `lib/v3/base-state-machine.ts`
- **V3 State Machine**: `lib/v3/treatment-state-machine.ts`
- **Each modality in own file**:
  - `problem-shifting.ts` (259 lines)
  - `identity-shifting.ts` (469 lines)
  - `belief-shifting.ts` (361 lines)
  - `blockage-shifting.ts` (261 lines)
  - `reality-shifting.ts` (488 lines)
  - `trauma-shifting.ts` (370 lines)
  - `digging-deeper.ts` (429 lines)
  - `integration.ts` (830 lines)
  - Plus: `introduction.ts`, `method-selection.ts`, `work-type-selection.ts`, `discovery.ts`

## Sync Strategy

### Phase 1: Systematic Comparison
For each modality, compare:
1. **Scripted responses** - Exact wording matters
2. **Step sequences** - Order and step IDs
3. **Validation rules** - MinLength, error messages
4. **NextStep logic** - Routing between steps
5. **Context handling** - Metadata usage
6. **AI triggers** - When AI should intervene

### Phase 2: File-by-File Update
Update each V3 modality file to match V2:

#### Priority Order:
1. **Problem Shifting** - Core modality
2. **Identity Shifting** - Core modality
3. **Belief Shifting** - Core modality  
4. **Blockage Shifting** - Core modality
5. **Reality Shifting** - Goals workflow
6. **Trauma Shifting** - Trauma workflow
7. **Digging Deeper** - Cross-modality functionality
8. **Integration** - Final phase

### Phase 3: Routing Logic
Update `lib/v3/treatment-state-machine.ts` to match v2's `determineNextStep()` logic

### Phase 4: Testing
Test each modality individually to ensure parity

## Key Differences to Address

### 1. Problem Shifting Integration
V2 has modality-specific integration steps:
- `problem_integration_awareness_1` through `problem_integration_awareness_5`
- `problem_integration_action_1` through `problem_integration_action_3`

### 2. Blockage Shifting Integration
V2 has modality-specific integration steps:
- `blockage_integration_awareness_1` through `blockage_integration_awareness_5`
- `blockage_integration_action_1` through `blockage_integration_action_3`

### 3. Identity Shifting Enhancements
V2 has sophisticated identity processing logic:
- `processIdentityResponse()` method
- Enhanced metadata tracking
- "What kind of me?" clarification logic

### 4. Context Metadata Handling
V2 has evolved metadata usage:
- `metadata.currentDiggingProblem`
- `metadata.newDiggingProblem`
- `metadata.skipIntroInstructions`
- `metadata.originalProblemStatement`
- `metadata.identityResponse` object

### 5. Digging Deeper Enhancements
V2 has more sophisticated digging deeper:
- `returnToDiggingStep` tracking
- Method selection routing
- Enhanced problem restating

## Implementation Approach

### Option 1: Systematic Port (Recommended)
- Read v2 modality definition
- Compare with v3 modality file
- Update v3 file to match v2
- Test each modality
- Repeat for all modalities

### Option 2: Full Extraction
- Extract all v2 logic into a comparison tool
- Generate diff report
- Apply changes systematically

### Option 3: Hybrid
- Use v2 as source of truth
- Copy step-by-step logic
- Preserve v3 class structure
- Test thoroughly

## Questions for Approval

1. **Scope**: Should we sync ALL modalities or focus on specific ones first?
2. **Testing**: Should we create test cases to verify parity?
3. **Validation**: Should I create a comparison report showing exact differences before making changes?
4. **Backup**: Should we create a v3 backup before starting?

## Next Steps

Once approved, I will:
1. Create detailed comparison for each modality
2. Update each v3 modality file systematically
3. Update v3 state machine routing logic
4. Test to ensure no v2 impact
5. Provide summary of all changes made

## Estimated Scope

- **Files to modify**: ~12 files in v3
- **Lines to review**: ~8,000 lines in v2
- **Expected time**: Requires careful attention to detail for each modality
- **Risk to v2**: ZERO - we only modify v3 files

## Safety Guarantees

✅ No v2 files will be touched
✅ V2 remains production-ready
✅ V3 updates are isolated
✅ Can be rolled back if needed

