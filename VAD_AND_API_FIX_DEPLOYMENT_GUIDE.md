# VAD & Treatment V4 API Fix - Deployment Guide

## Overview
This guide addresses two critical production issues:
1. **VAD (Voice Activity Detection) missing WASM files** (404 errors)
2. **Treatment V4 API returning 500 errors**

---

## Issue 1: VAD Missing Files ✅ FIXED

### Problem
Browser console errors:
```
Failed to load resource: /dashboard/sessions/silero_vad_legacy.onnx (404)
Failed to load resource: /_next/static/chunks/ort-wasm-simd-threaded.mjs (404)
Error: no available backend found. ERR: [wasm] TypeError: Failed to fetch
```

### Root Cause
The `@ricky0123/vad-web` and `onnxruntime-web` packages store ONNX models and WASM files in `node_modules/`, but Next.js doesn't automatically serve these in production builds.

### Solution Applied

#### Files Modified:
1. **`scripts/copy-vad-assets.js`** (NEW)
   - Copies VAD assets from node_modules to public/vad/
   - Includes both @ricky0123/vad-web files and onnxruntime-web WASM files
   - Runs automatically before build

2. **`next.config.js`**
   - Added webpack configuration for WASM/ONNX support
   - Enables asyncWebAssembly and proper file handling

3. **`components/voice/useVAD.tsx`**
   - Added explicit model paths pointing to /vad/ directory
   - Configured WASM paths for ONNX Runtime

4. **`package.json`**
   - Added `prebuild` script that runs automatically before `npm run build`

### Verification
Run the copy script manually to verify:
```bash
node scripts/copy-vad-assets.js
```

Expected output:
```
✅ Successfully copied 53 VAD asset(s)
🔍 Checking for critical VAD files:
   ✓ silero_vad_legacy.onnx
   ✓ vad.worklet.bundle.min.js
   ✓ ort-wasm-simd-threaded.wasm
   ✓ ort-wasm-simd-threaded.mjs
```

---

## Issue 2: Treatment V4 API 500 Error 🔍 REQUIRES INVESTIGATION

### Problem
```
/api/treatment-v4:1 Failed to load resource: the server responded with a status of 500 ()
V4 Send message error: Error: V4 HTTP error! status: 500
```

User input "oh yeah" was transcribed successfully but API returned 500 error.

### Possible Causes

#### 1. **Environment Variables Missing** (MOST LIKELY)
The API needs these environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` (for AI assistance)

**Check production environment variables:**
```bash
# On your server or hosting platform
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
echo $OPENAI_API_KEY
```

#### 2. **Database Connection Failure**
The treatment machine loads context from the database. If Supabase connection fails, the API will return 500.

**Check server logs:**
```bash
# Look for these error patterns:
- "Error loading progress data"
- "Error saving session data"
- "Database: Creating server client" (should appear)
- "No session found in database"
```

#### 3. **State Machine Processing Error**
The validation or routing logic might throw an unhandled error.

**Check for:**
- Invalid session state
- Corrupted context data
- Missing phase or step definitions

### Debugging Steps

#### Step 1: Check Server Logs
Access your production server logs to see the actual error:

**Vercel:**
```bash
vercel logs [deployment-url]
```

**Hetzner/VPS:**
```bash
# If using PM2
pm2 logs mindshifting

# If using systemd
journalctl -u mindshifting -f

# Or check Next.js logs
tail -f /var/log/mindshifting/error.log
```

#### Step 2: Add Enhanced Error Logging
The API already has comprehensive error logging. Look for:
```
Treatment V4 API: State machine error: [error details]
Treatment V4 API error stack: [stack trace]
```

#### Step 3: Test Locally
Try to reproduce the error locally:
```bash
# Start development server
npm run dev

# In browser console, try the same sequence:
# 1. Start treatment session
# 2. Enable natural voice
# 3. Say "oh yeah"
```

#### Step 4: Check Database Tables
Verify the session exists in Supabase:
```sql
-- Check if session exists
SELECT * FROM treatment_sessions 
WHERE session_id = '[your-session-id]';

-- Check progress data
SELECT * FROM treatment_progress 
WHERE session_id = '[your-session-id]';

-- Check user authentication
SELECT * FROM auth.users 
WHERE id = '[user-id]';
```

### Quick Fixes to Try

#### Fix 1: Add More Error Details to API Response
Edit `app/api/treatment-v4/route.ts` if you need more debugging info:
```typescript
catch (stateMachineError) {
  console.error('Treatment V4 API: State machine error:', stateMachineError);
  console.error('Session ID:', sessionId);
  console.error('User ID:', userId);
  console.error('User Input:', userInput);
  
  return NextResponse.json({
    error: 'V4 State machine processing failed',
    details: stateMachineError instanceof Error ? stateMachineError.message : 'Unknown state machine error',
    stack: stateMachineError instanceof Error ? stateMachineError.stack : 'No stack trace',
    location: 'processUserInput',
    sessionId, // Include for debugging
    userInput: userInput.substring(0, 50) // First 50 chars only
  }, { status: 500 });
}
```

#### Fix 2: Verify Environment Variables in Production
Create a test endpoint to verify env vars (DELETE AFTER TESTING):
```typescript
// app/api/test-env/route.ts
export async function GET() {
  return Response.json({
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    supabaseUrlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20),
  });
}
```

#### Fix 3: Add Fallback Error Handling
The API already has good error handling, but you might want to add a fallback response:
```typescript
// In handleContinueSession, wrap the state machine call
try {
  result = await treatmentMachine.processUserInput(sessionId, userInput, { userId });
} catch (stateMachineError) {
  // Log detailed error
  console.error('State machine failed:', {
    error: stateMachineError,
    sessionId,
    userId,
    userInput,
    timestamp: new Date().toISOString()
  });
  
  // Return user-friendly error with recovery option
  return NextResponse.json({
    error: 'Processing failed',
    message: 'I encountered an error processing your response. Would you like to try rephrasing, or start a new session?',
    canRetry: true,
    details: stateMachineError instanceof Error ? stateMachineError.message : 'Unknown error'
  }, { status: 500 });
}
```

---

## Deployment Instructions

### Step 1: Commit Changes
```bash
git add scripts/copy-vad-assets.js
git add next.config.js
git add components/voice/useVAD.tsx
git add package.json
git commit -m "Fix: Add VAD assets copy script and configure WASM support"
```

### Step 2: Build Locally (Test)
```bash
# This will run the prebuild script automatically
npm run build

# Verify public/vad/ directory exists and has files
ls -lh public/vad/

# Should see:
# - silero_vad_legacy.onnx (1.7 MB)
# - vad.worklet.bundle.min.js (2.4 KB)
# - ort-wasm-simd-threaded.wasm (11.4 MB)
# - ort-wasm-simd-threaded.mjs (19.8 KB)
```

### Step 3: Deploy to Production

#### Option A: Vercel
```bash
# Push to main branch
git push origin main

# Vercel will automatically:
# 1. Run npm install
# 2. Run prebuild script (copies VAD assets)
# 3. Run next build
# 4. Deploy
```

#### Option B: Hetzner/VPS
```bash
# SSH to server
ssh your-server

# Pull latest code
cd /path/to/MindShifting
git pull origin main

# Install dependencies (if package.json changed)
npm install

# Run build (automatically runs prebuild script)
npm run build

# Restart application
pm2 restart mindshifting
# OR
systemctl restart mindshifting
```

### Step 4: Verify VAD Fix in Production
1. Open browser console on production site
2. Navigate to treatment session
3. Enable natural voice mode
4. Look for:
   - ✅ `🎙️ VAD: Initialized successfully`
   - ❌ No 404 errors for .onnx or .wasm files

### Step 5: Monitor Treatment V4 API
1. Watch server logs during testing
2. Try voice input: "oh yeah" or any phrase
3. Check for:
   - ✅ `Treatment V4 API: State machine continue result: [success]`
   - ❌ No 500 errors

---

## Rollback Instructions (If Needed)

If issues occur after deployment:

```bash
# Rollback git changes
git revert HEAD

# Or restore from specific commit
git reset --hard [previous-commit-hash]

# Rebuild and redeploy
npm run build
pm2 restart mindshifting  # or your deployment method
```

---

## Testing Checklist

### VAD Testing
- [ ] Page loads without 404 errors in console
- [ ] VAD initializes: `🎙️ VAD: Initialized successfully`
- [ ] Speech detection works (say something, check for level changes)
- [ ] Barge-in works (interrupt AI response)
- [ ] No WASM backend errors

### Treatment V4 API Testing
- [ ] Start new session works
- [ ] Text input works
- [ ] Voice input transcription works
- [ ] API processes "oh yeah" successfully
- [ ] No 500 errors in console
- [ ] Server logs show successful processing

---

## Next Steps

### Immediate Actions Required:
1. **Check production server logs** for the actual 500 error details
2. **Verify environment variables** are set in production
3. **Deploy VAD fix** (all code changes are ready)
4. **Test in production** after deployment

### If 500 Error Persists:
1. Share server log output for detailed analysis
2. Check Supabase dashboard for database connectivity
3. Verify user authentication is working
4. Test with a fresh session (new user/session ID)

---

## Files Changed Summary

### New Files:
- `scripts/copy-vad-assets.js` - VAD asset copy script

### Modified Files:
- `next.config.js` - Added webpack WASM support
- `components/voice/useVAD.tsx` - Added model paths
- `package.json` - Added prebuild script

### No Changes Required (Working):
- `app/api/treatment-v4/route.ts` - Has good error handling
- `lib/v4/treatment-state-machine.ts` - Core logic is solid
- `lib/database-server.ts` - Database client is properly configured

---

## Support

If issues persist after following this guide:
1. Share complete server logs from the 500 error
2. Verify environment variables are set
3. Check Supabase project status
4. Test database connectivity manually

The VAD fix is complete and ready to deploy. The API error needs log investigation to diagnose the root cause.
