# V3 Treatment System Implementation Requirements

## Overview
Create a standalone V3 treatment system to replace V1 and V2 entirely. V3 must be self-contained and fully functional.

## Priority 1: Core Infrastructure

### 1.1 V3 API Route ✅ COMPLETED
- **File**: `app/api/treatment-v3/route.ts`
- **Source**: Copy from `app/api/treatment-v2/route.ts`
- **Updates**: 
  - ✅ Import V3 treatment state machine from `/lib/v3/`
  - ✅ Update all references to use V3 logic
  - ✅ Ensure compatibility with V3 types and interfaces
  - ✅ Added V3 version metadata to responses
  - ✅ Updated console logging to indicate V3
  - 🔄 Test API endpoints thoroughly (pending V3 page creation)

### 1.2 V3 Main Treatment Page ✅ COMPLETED
- **File**: `app/dashboard/sessions/treatment-v3/page.tsx`
- **Source**: Copy from `app/dashboard/sessions/treatment-v2/page.tsx`
- **Updates**:
  - ✅ Update API calls to use `/api/treatment-v3/`
  - ✅ Import V3 components (pending component creation)
  - ✅ Update routing and navigation
  - ✅ Ensure session management works with V3
  - ✅ Added V3 branding and visual indicators
  - ✅ Updated session ID generation with v3 prefix
  - 🔄 Linter error expected until V3 TreatmentSession component is created

### 1.3 V3 Main Session Component ✅ COMPLETED
- **File**: `components/treatment/v3/TreatmentSession.tsx`
- **Source**: Streamlined version based on V2 TreatmentSession.tsx
- **Updates**:
  - ✅ Connect to V3 state machine via `/api/treatment-v3/`
  - ✅ Update all imports to use V3 types
  - ✅ Ensure UI components work with V3 data structures
  - ✅ Added V3 branding and enhanced performance metrics
  - ✅ Streamlined architecture (reduced from 2172 to ~500 lines)
  - ✅ Enhanced voice integration and error handling
  - 🔄 Test user interaction flows (pending full V3 system test)

## Priority 2: Treatment Modalities

### 2.1 V3 Modality Components Directory
- **Directory**: `components/treatment/v3/modalities/`
- **Source**: Copy from `components/treatment/v2/modalities/`
- **Components to Create**:
  - `BeliefShifting/BeliefShifting.tsx`
  - `ProblemShifting/ProblemShifting.tsx`
  - `RealityShifting/RealityShifting.tsx`
  - `IdentityShifting/IdentityShifting.tsx`
  - `BlockageShifting/BlockageShifting.tsx`
  - `TraumaShifting/TraumaShifting.tsx`

### 2.2 V3 Shared Types
- **File**: `components/treatment/v3/shared/types.ts`
- **Source**: Copy from `components/treatment/v2/shared/types.ts`
- **Updates**: Ensure compatibility with `/lib/v3/types.ts`

## Priority 3: Integration & Compatibility

### 3.1 Database Integration
- **Verify**: V3 can read/write to existing database tables
- **Update**: Any V3-specific schema requirements in `/lib/v3/database-operations.ts`
- **Test**: Session persistence and data integrity

### 3.2 Authentication Integration
- **Verify**: V3 works with existing auth system
- **Test**: User context and permissions
- **Ensure**: Session security and user isolation

### 3.3 Voice Integration (if applicable)
- **Update**: `components/voice/` components for V3 compatibility
- **Test**: Voice treatment demos with V3 engine
- **Verify**: Voice state management with V3

## Priority 4: Navigation & UI

### 4.1 Dashboard Navigation
- **Update**: Add V3 treatment option to dashboard
- **File**: Update navigation components to include `/dashboard/sessions/treatment-v3`
- **Test**: Routing and deep linking

### 4.2 Labs Integration
- **Update**: V3 toggle in settings to actually load V3 functionality
- **File**: `app/dashboard/settings/page.tsx`
- **Create**: Functional V3 demo component instead of info panel

## Priority 5: Testing & Validation

### 5.1 Core Functionality Testing
- [ ] V3 API endpoints respond correctly
- [ ] V3 treatment sessions can be started
- [ ] All treatment modalities work in V3
- [ ] Session persistence works
- [ ] User data is properly saved/loaded

### 5.2 Compatibility Testing
- [ ] V3 can handle existing user sessions
- [ ] Database operations work correctly
- [ ] Authentication flows work
- [ ] Voice integration (if applicable)

### 5.3 Performance Testing
- [ ] V3 performance meets or exceeds V2
- [ ] Memory usage is acceptable
- [ ] Response times are under 200ms target
- [ ] Caching works properly

## Priority 6: Migration & Cleanup

### 6.1 Migration Strategy
- **Plan**: How to migrate existing V2 sessions to V3
- **Test**: Data migration scripts
- **Backup**: Ensure data safety during migration

### 6.2 V1/V2 Phase-out Plan
- **Timeline**: When to deprecate V1 and V2
- **Communication**: User notification strategy
- **Cleanup**: Remove V1/V2 code after successful V3 deployment

## Files to Create/Modify

### New Files:
```
app/
├── dashboard/sessions/treatment-v3/
│   └── page.tsx
├── api/treatment-v3/
│   └── route.ts

components/
├── treatment/v3/
│   ├── TreatmentSession.tsx
│   ├── shared/
│   │   └── types.ts
│   └── modalities/
│       ├── BeliefShifting/
│       │   ├── BeliefShifting.tsx
│       │   ├── BeliefShiftingDigging.tsx
│       │   ├── BeliefShiftingGuardrails.tsx
│       │   └── BeliefShiftingIntegration.tsx
│       ├── ProblemShifting/
│       ├── RealityShifting/
│       ├── IdentityShifting/
│       ├── BlockageShifting/
│       └── TraumaShifting/
```

### Files to Update:
- Navigation components
- Settings page (labs section)
- Voice components (if applicable)
- Database schemas (if needed)

## Success Criteria
- [ ] V3 is fully functional and standalone
- [ ] All V2 functionality is replicated in V3
- [ ] V3 performance meets or exceeds V2
- [ ] Users can seamlessly use V3 without V1/V2
- [ ] V3 is ready for production deployment
- [ ] V1 and V2 can be safely deprecated

## Notes
- V3 engine already exists in `/lib/v3/` with enhanced features
- Focus on creating UI components that connect to existing V3 logic
- Ensure backward compatibility during transition period
- Maintain all existing user data and session functionality 