# Documentation Index

Complete list of all documentation files in the MindShifting project, organized by category.

**Last Updated**: 2026-01-08

---

## 🔊 Audio Rendering & TTS Documentation

### Core Audio Documentation
1. **`STATIC_AUDIO_SOLUTION.md`** ⭐ Main Guide
   - Complete technical guide for pre-generating static audio files
   - Explains cost comparison: Dynamic vs Static
   - Implementation steps for zero-cost audio delivery
   - **Format**: Now uses Opus (30% smaller than MP3)

2. **`QUICK_START_STATIC_AUDIO.md`** ⚡ Quick Start
   - 3-step setup guide (5 minutes)
   - Quick commands for audio generation
   - Verification steps

3. **`public/audio/v4/static/README.md`** 📁 Directory Guide
   - Directory-specific documentation
   - Generation instructions
   - Troubleshooting

4. **`ELEVENLABS_API_SETUP.md`** 🔑 API Configuration
   - Secure API key setup methods
   - Credit requirements and checking
   - Troubleshooting guide
   - Includes note about Paroli migration option

5. **`.audio-generation-reference.md`** 📋 Quick Reference
   - Quick copy-paste commands
   - Common operations
   - Links to full documentation
   - **Note**: This file is in .gitignore for security

6. **`TTS_FIX_GUIDE.md`**
   - Troubleshooting TTS issues
   - API error handling
   - Quota management

7. **`AUDIO_PRELOADING_QUOTA_ISSUE.md`**
   - Analysis of preloading quota issues
   - Solutions and workarounds

8. **`TTS_STILL_FAILING_INVESTIGATION.md`**
   - Deep dive into TTS failures
   - Investigation logs

---

## 🚀 Paroli Migration Documentation

### Migration Planning
1. **`PAROLI_MIGRATION_SCOPE.md`** ⭐ Complete Migration Plan
   - Technical scope document for self-hosted TTS
   - Pattern 2 (Hybrid Static + Dynamic Streaming)
   - Architecture diagrams and implementation phases
   - Cost analysis: $13/month vs $100s-1000s/month
   - 2-week implementation timeline
   - Infrastructure setup (Hetzner CPX31)
   - Code changes needed (~14 hours)

2. **`PAROLI_QA_SUMMARY.md`** 💡 Q&A Summary
   - Direct answers to key questions
   - Pattern 1 vs Pattern 2 comparison
   - Opus vs MP3 technical comparison
   - Hardware recommendations (Piper High + Hetzner CPU)
   - Stack validation
   - Next steps

3. **`PAROLI_DEPLOYMENT_GUIDE.md`** (To be created)
   - Step-by-step Hetzner server setup
   - Docker deployment instructions
   - Nginx configuration for WebSocket
   - SSL setup

---

## 📚 Project Setup & Configuration

### Initial Setup
1. **`README.md`** - Project overview and getting started
2. **`QUICK_START.md`** - Quick start guide
3. **`QUICK_START_REAL_DATA.md`** - Setup with real data
4. **`ENVIRONMENT_SETUP.md`** - Environment configuration
5. **`DATABASE_SETUP_GUIDE.md`** - Database setup
6. **`SUPABASE_SQL_SETUP.md`** - Supabase SQL configuration

### Production Deployment
7. **`PRODUCTION_SETUP.md`** - Production environment setup
8. **`DEPLOYMENT_SUMMARY.md`** - Deployment overview
9. **`DEPLOYMENT_EXECUTION_GUIDE.md`** - Deployment steps
10. **`FINAL_DEPLOYMENT_STEPS.md`** - Final checklist
11. **`READY_TO_DEPLOY.md`** - Pre-deployment verification
12. **`LAUNCH_READY_GUIDE.md`** - Launch readiness checklist

---

## 🔐 Authentication & Security

### Authentication
1. **`2FA_SETUP_GUIDE.md`** - Two-factor authentication setup
2. **`docs/2FA_IMPLEMENTATION.md`** - 2FA implementation details
3. **`FIRST_USER_SUPER_ADMIN_GUIDE.md`** - Super admin setup
4. **`AUTHENTICATION_AND_DARKMODE_FIXES.md`** - Auth fixes

### Security
5. **`SECURITY.md`** - Security overview
6. **`SECURITY_CHECKLIST.md`** - Security audit checklist
7. **`SETUP_SECURITY.md`** - Security configuration
8. **`COMPLIANCE_SUMMARY.md`** - Compliance documentation

---

## 🎨 UI/UX & Theming

### Dark Mode & Themes
1. **`DARK_MODE_FIXES.md`** - Dark mode fixes
2. **`DARK_MODE_CONSISTENCY_FIX.md`** - Consistency improvements
3. **`DARK_MODE_FIX_SUMMARY.md`** - Fix summary
4. **`SOLARIZED_DARK_MAPPING.md`** - Solarized dark theme
5. **`MULTI_THEME_IMPLEMENTATION_GUIDE.md`** - Multiple theme support
6. **`THEME_TESTING_GUIDE.md`** - Theme testing
7. **`docs/GLASS_THEME_IMPLEMENTATION.md`** - Glass theme (frosted glass effect)

### Mobile & Responsive
8. **`MOBILE_FIRST_IMPLEMENTATION_CHECKLIST.md`** - Mobile-first implementation
9. **`MOBILE_FIRST_CHECKLIST_PASS2.md`** - Mobile pass 2
10. **`MOBILE_FIRST_CHECKLIST_PASS3.md`** - Mobile pass 3
11. **`MOBILE_TRANSFORMATION_SUMMARY.md`** - Mobile transformation
12. **`MOBILE_TESTING_REPORT.md`** - Mobile testing results
13. **`MOBILE_AUTH_OPTIMIZATION.md`** - Mobile auth optimization
14. **`MOBILE_AUTH_VISUAL_GUIDE.md`** - Mobile auth visual guide
15. **`MOBILE_COMPONENTS.md`** - Mobile components
16. **`MOBILE_FORM_COMPONENTS.md`** - Mobile form components
17. **`MOBILE_FEATURES.md`** - Mobile features
18. **`MOBILE_SIDEBAR_AUTO_CLOSE.md`** - Mobile sidebar behavior
19. **`MOBILE_ISSUES_BEFORE.md`** - Pre-fix mobile issues
20. **`PWA_MOBILE_IMPROVEMENT_PLAN.md`** - PWA improvements
21. **`GESTURES.md`** - Gesture support

### UI Components
22. **`UI_COMPONENT_LIBRARY_RESEARCH.md`** - Component library research
23. **`SHADCN_IMPLEMENTATION_LOG.md`** - shadcn/ui implementation
24. **`BUTTON_FIX_QUICK_REFERENCE.md`** - Button fixes

---

## 🧠 Treatment System (V2, V3, V4)

### V2/V3 Migration & Sync
1. **`v2_to_v3_sync_analysis.md`** - Sync analysis
2. **`V2_V3_COMPREHENSIVE_SYNC_DOCUMENT.md`** - Comprehensive sync doc
3. **`V2_V3_COMPREHENSIVE_SYNC_DOCUMENT_FINAL.md`** - Final sync doc
4. **`V2_V3_SYNC_SUMMARY.md`** - Sync summary
5. **`V2_V3_ARCHITECTURE_DIVERGENCE_ANALYSIS.md`** - Architecture analysis
6. **`V2_V3_FIX_IMPLEMENTATION_PLAN.md`** - Fix plan
7. **`V2_V3_FIX_ROADMAP.md`** - Fix roadmap
8. **`V2_V3_HANDLER_BY_HANDLER_COMPARISON.md`** - Handler comparison
9. **`V2_V3_ORCHESTRATION_COMPLETENESS_AUDIT.md`** - Completeness audit
10. **`V2_V3_PARITY_VERIFICATION_REPORT.md`** - Parity verification
11. **`V2_V3_PERFORMANCE_ANALYSIS.md`** - Performance analysis
12. **`v2_v3_problem_shifting_comparison.md`** - Problem shifting comparison
13. **`V2_V3_TESTING_GUIDE.md`** - Testing guide
14. **`V2_V3_USERINPUT_FLOW_ISSUES.md`** - User input flow issues
15. **`V2_VALIDATION_PATTERN_REFERENCE.md`** - V2 validation patterns

### V3 Specific
16. **`V3_CRITICAL_ISSUES_REPORT.md`** - Critical issues
17. **`V3_IMPLEMENTATION_REQUIREMENTS.md`** - Implementation requirements
18. **`V3_OPTIMIZATION_COMPLETE.md`** - Optimization summary
19. **`V3_OPTIMIZATION_TESTING_CHECKLIST.md`** - Optimization testing
20. **`V3_PERFORMANCE_OPTIMIZATION_SAFE_PLAN.md`** - Performance plan
21. **`V3_WORK_TYPE_DESCRIPTION_ANALYSIS.md`** - Work type analysis

### V4 Specific
22. **`V4_BUTTON_SELECTION_FIX.md`** - Button selection fix
23. **`V4_PRODUCTION_SWITCH_SUMMARY.md`** - Production switch
24. **`V4_READY_FOR_VOICE.md`** - Voice readiness
25. **`V4_SESSION_MIGRATION_FIX.md`** - Session migration
26. **`v4_ai_usage_audit.md`** - AI usage audit
27. **`v4_hardcoded_intro_steps_audit.md`** - Hardcoded steps audit
28. **`v4_step_not_advancing_issue.md`** - Step advancement issue

### Treatment Bug Fixes
29. **`identity_bridge_digging_deeper_analysis.md`**
30. **`identity_bridge_fix_issue_analysis.md`**
31. **`identity_bridge_fix_plan.md`**
32. **`identity_bridge_phrase_bug_analysis.md`**
33. **`identity_bridge_surgical_analysis.md`**
34. **`identity_bridge_why_5_locations.md`**
35. **`identity_step_e_bug_analysis.md`**
36. **`problem_shifting_step_c_bug_analysis.md`**
37. **`trauma_digging_scenario_check_bug_analysis.md`**
38. **`triple_nesting_fix.md`**

### Migration & Modalities
39. **`TREATMENT_VERSION_MIGRATION_GUIDE.md`** - Version migration
40. **`ALL_MODALITIES_PROTECTED.md`** - Modality protection

---

## 🗄️ Database & Migrations

1. **`MIGRATIONS_QUICK_REFERENCE.md`** - Quick migration reference
2. **`MIGRATION_STATUS.md`** - Migration status tracking
3. **`MANUAL_MIGRATION_GUIDE.md`** - Manual migration steps
4. **`FIX_EXISTING_USER.md`** - User fix guide
5. **`FIX_USER_ID_MISMATCH.md`** - User ID mismatch fix

---

## 👥 Community & Admin Features

### Community
1. **`COMMUNITY_DEPLOYMENT_CHECKLIST.md`** - Community deployment
2. **`COMMUNITY_SOCIAL_UPGRADES.md`** - Social features
3. **`COMMUNITY_TAGS_FIX.md`** - Tags fix
4. **`TAG_CREATION_FIX_SUMMARY.md`** - Tag creation fixes
5. **`TAG_EDIT_DEPLOYMENT_STEPS.md`** - Tag edit deployment
6. **`TAG_EDIT_FIX.md`** - Tag edit fix
7. **`TAG_FIX_COMPLETE.md`** - Tag fixes complete
8. **`FIX_TAG_CREATION_NOW.md`** - Immediate tag creation fix
9. **`DEPLOY_TAG_FIX.md`** - Tag fix deployment
10. **`SUPER_ADMIN_TAG_FIX.md`** - Super admin tag fix

### Admin Area
11. **`ADMIN_AREA_REQUIREMENTS.md`** - Admin requirements
12. **`ADMIN_BUILD_PROGRESS.md`** - Admin build progress
13. **`ADMIN_BUILD_SAFETY_PLAN.md`** - Admin safety plan

### Coaching
14. **`COACH_PROFILE_IMPLEMENTATION_SUMMARY.md`** - Coach profiles

---

## 📧 Email System

1. **`EMAIL_CONFIGURATION_FIX.md`** - Email configuration
2. **`EMAIL_CONFIRMATION_GUIDE.md`** - Email confirmation setup
3. **`EMAIL_SYSTEM_FRONTEND_IMPLEMENTATION.md`** - Frontend email system
4. **`RESEND_CONFIGURATION_STEPS.md`** - Resend configuration
5. **`RESEND_EMAIL_SETUP.md`** - Resend email setup
6. **`RESEND_INTEGRATION_GUIDE.md`** - Resend integration
7. **`RESEND_SETUP.md`** - Resend setup
8. **`TEST_RESEND_SETUP.md`** - Test Resend setup
9. **`SUPABASE_EMAIL_TEMPLATE_FIX.md`** - Email template fix

---

## 🧪 Testing & Quality Assurance

1. **`TESTING_CHECKLIST.md`** - Testing checklist
2. **`UPDATED_TEST_GUIDE.md`** - Updated testing guide
3. **`CROSS_DEVICE_TESTING.md`** - Cross-device testing
4. **`ACCESSIBILITY_TESTING_GUIDE.md`** - Accessibility testing
5. **`LIGHTHOUSE_AUDIT_GUIDE.md`** - Lighthouse audits

---

## 🏗️ Architecture & Implementation

1. **`ARCHITECTURE_ANALYSIS.md`** - Architecture overview
2. **`IMPLEMENTATION_SUMMARY.md`** - Implementation summary
3. **`TRANSFORMATION_SUMMARY.md`** - Transformation summary
4. **`WORK_COMPLETED_SUMMARY.md`** - Work completed
5. **`CHANGES_MADE.md`** - Changes log
6. **`FEATURE_COMPLETION_ROADMAP.md`** - Feature roadmap
7. **`docs/METRICS_IMPLEMENTATION_ROADMAP.md`** - Metrics roadmap

---

## 🔧 Build & Deployment Fixes

1. **`BUILD_FIX_DIALOG_DEPENDENCY.md`** - Dialog dependency fix
2. **`BUILD_FIX_LOG.md`** - Build fix log
3. **`CACHE_FIX_IMPLEMENTATION_SUMMARY.md`** - Cache fix

---

## 🎵 Voice & Audio Fixes

1. **`VOICE_FIXES_AND_INVESTIGATION.md`** - Voice fixes
2. **`voiceAdd.md`** - Voice addition

---

## 📊 Phase Completion Logs

1. **`PHASE2_COMPLETION_LOG.md`** - Phase 2 completion
2. **`PHASE3_COMPLETION_LOG.md`** - Phase 3 completion
3. **`PHASE4_COMPLETION_LOG.md`** - Phase 4 completion

---

## 🗂️ Orphaned Documentation

Files in the `orphaned/` directory (may be outdated):

1. **`orphaned/COMMUNITY_FEATURES_IMPLEMENTATION.md`**
2. **`orphaned/GAMIFICATION_FEATURES.md`**
3. **`orphaned/PROTOCOL_IMPLEMENTATION_SUMMARY.md`**
4. **`orphaned/STRIPE_SETUP.md`**

---

## 💳 Payment Integration

1. **`STRIPE_SETUP_GUIDE.md`** - Stripe setup

---

## 🗺️ Routes & Navigation

1. **`ROUTES_REFERENCE.md`** - Application routes

---

## 🧹 Data Management

1. **`SAMPLE_DATA_REMOVAL_SUMMARY.md`** - Sample data cleanup
2. **`SURGICAL_REPAIR_COMPLETE.md`** - Surgical repairs

---

## 📝 Templates

1. **`TEMPLATE_README.md`** - README template

---

## 📑 Quick Reference: Audio & Migration Docs Only

### Audio Rendering (Current System)
```
STATIC_AUDIO_SOLUTION.md                 ⭐ Main guide (Opus format)
QUICK_START_STATIC_AUDIO.md              ⚡ Quick start
public/audio/v4/static/README.md         📁 Directory guide
ELEVENLABS_API_SETUP.md                  🔑 API setup
.audio-generation-reference.md           📋 Quick commands
TTS_FIX_GUIDE.md                         🔧 Troubleshooting
AUDIO_PRELOADING_QUOTA_ISSUE.md          📊 Quota issues
TTS_STILL_FAILING_INVESTIGATION.md       🔍 Deep investigation
```

### Paroli Migration (Future System)
```
PAROLI_MIGRATION_SCOPE.md                ⭐ Complete migration plan
PAROLI_QA_SUMMARY.md                     💡 Q&A and recommendations
PAROLI_DEPLOYMENT_GUIDE.md               🚀 Server setup (to be created)
```

---

## 📈 Documentation Statistics

- **Total markdown files**: 152
- **Audio/TTS documentation**: 8 files
- **Paroli migration docs**: 2 files (+ 1 to be created)
- **Treatment system docs**: 40 files
- **Mobile/UI docs**: 22 files
- **Setup/deployment docs**: 25+ files

---

## 🎯 Most Important Documents for New Developers

1. **`README.md`** - Start here
2. **`QUICK_START.md`** - Get running quickly
3. **`STATIC_AUDIO_SOLUTION.md`** - Understand audio system
4. **`PAROLI_MIGRATION_SCOPE.md`** - Future TTS strategy
5. **`ARCHITECTURE_ANALYSIS.md`** - System architecture
6. **`ROUTES_REFERENCE.md`** - Application structure
7. **`SECURITY_CHECKLIST.md`** - Security requirements

---

## 🔄 Recently Updated (Last 7 Days)

- `STATIC_AUDIO_SOLUTION.md` - Updated to Opus format
- `QUICK_START_STATIC_AUDIO.md` - Updated to Opus format
- `public/audio/v4/static/README.md` - Updated to Opus format
- `ELEVENLABS_API_SETUP.md` - Added Paroli section
- `.audio-generation-reference.md` - Added migration reference
- `PAROLI_MIGRATION_SCOPE.md` - Created
- `PAROLI_QA_SUMMARY.md` - Created
- `DOCUMENTATION_INDEX.md` - Created (this file)

---

**Maintenance Note**: This index should be updated whenever new documentation files are created or existing files are significantly updated.
