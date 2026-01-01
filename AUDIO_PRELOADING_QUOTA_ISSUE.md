# Audio Preloading Issue - Quota Exceeded (Not a Bug)

## Summary

✅ **The preloader code is working correctly**  
❌ **The ElevenLabs API is rejecting requests due to quota limits**

## What's Actually Happening

```
🎵 V4: Starting audio preload for 17 unique segments...
  ↓
17 TTS requests sent to /api/tts
  ↓
/api/tts tries to call ElevenLabs API
  ↓
ElevenLabs: "quota_exceeded - You have 10 credits, need 632 per request"
  ↓
16/17 requests fail with 500 error
  ↓
1 request succeeds (was already in browser cache)
  ↓
✅ V4 Audio preload complete!
   Successfully cached: 1 new segment(s)
   Failed: 16 segment(s)
```

## The Error

From your server logs:
```json
{
  "status": "quota_exceeded",
  "message": "This request exceeds your quota of 30010. 
              You have 10 credits remaining, 
              while 632 credits are required for this request."
}
```

**Translation:**
- Monthly quota: 30,010 credits
- Used: 30,000 credits
- Remaining: 10 credits
- Cost per request: 632 credits (for longer text segments)
- Result: Insufficient credits for preloading

## Why This Happens

1. **ElevenLabs charges per character**
   - Longer therapy scripts = more characters = more credits
   - Your intro messages are verbose (doctor's exact wording)
   - Example: "Mind Shifting is not like counselling, therapy or..." = ~100+ characters

2. **Preloader attempts all 17 segments at once**
   - On page load, tries to cache common phrases
   - Each segment is a full therapy instruction
   - 17 segments × 632 credits = 10,744 credits needed
   - You only have 10 credits left

3. **No fallback to cheaper provider**
   - Currently hardcoded to use ElevenLabs
   - OpenAI TTS also over quota (from earlier logs)
   - No graceful degradation

## Solutions

### Option 1: Top Up ElevenLabs Credits (Immediate)

**Cost:** ~$5-10/month for therapy app usage

1. Go to: https://elevenlabs.io/app/subscription
2. View current usage and quota
3. Purchase additional credits or upgrade plan
4. Reload page - preloading will work

**Recommended Plan:**
- **Creator**: $22/month, 100,000 credits
- Should handle ~150-200 preload sessions per month
- Better voice quality than free tier

### Option 2: Switch to OpenAI TTS (Cheaper)

**Cost:** ~$0.015 per 1,000 characters (much cheaper)

**Update the preloader to use OpenAI:**

```typescript
// In components/voice/useNaturalVoice.ts or wherever preloader is
const response = await fetch('/api/tts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: segment,
    provider: 'openai',  // ← Change from 'elevenlabs' to 'openai'
    voice: 'alloy'       // Options: alloy, echo, fable, onyx, nova, shimmer
  })
});
```

**Pros:**
- Much cheaper (10-20x less than ElevenLabs)
- Higher quotas on paid plans
- Fast response times

**Cons:**
- Voice quality slightly less natural than ElevenLabs
- Fewer voice customization options

### Option 3: Implement Smart Caching (Best Long-term)

Update `/workspace/app/api/tts/route.ts` to cache more aggressively:

**Current Implementation (Lines 42-52):**
```typescript
// Check if cached file exists
if (fs.existsSync(cacheFile)) {
  console.log(`TTS Cache HIT: ${hash}`);
  const fileBuffer = fs.readFileSync(cacheFile);
  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=31536000', // ✅ Already caches forever
      'X-TTS-Cache': 'HIT',
    },
  });
}
```

**Recommendation:**
The caching is already good! The issue is:
1. First-time users always hit the API (cache is empty)
2. Vercel serverless functions use temp storage (cache gets cleared)

**Better Solution: Use Vercel Blob Storage or CDN**

```typescript
// Store generated audio in Vercel Blob or S3
// Serve from CDN instead of regenerating each time
// Only generates once globally, not once per user/session
```

### Option 4: Reduce Preload Segments (Quick Fix)

Instead of preloading 17 segments, preload only the most common:

```typescript
// Only preload critical segments
const CRITICAL_SEGMENTS = [
  V4_STATIC_AUDIO_TEXTS.INITIAL_WELCOME,  // First thing users hear
  "Tell me what the problem is in a few words",  // Most common
  "Please close your eyes and keep them closed",  // Common intro
  // Skip the rest - load on demand
];
```

**Pros:**
- Reduces credits needed by ~10x
- Still gives smooth experience for common paths
- Less common phrases load on-demand

**Cons:**
- Slight delay on less common phrases
- Not all audio is instant

### Option 5: Disable Preloading (Emergency Only)

**Only if you need to preserve credits immediately:**

Comment out the preloader in `/workspace/app/dashboard/sessions/treatment-v4/page.tsx`:

```typescript
// Dynamic import for audio preloader
const V4AudioPreloader = dynamic(() => import('@/components/treatment/v4/V4AudioPreloader'), {
  ssr: false,
  loading: () => null,
});

// In the render:
{/* V4 Audio Preloader - DISABLED DUE TO QUOTA */}
{/* <V4AudioPreloader /> */}
```

**Impact:**
- ✅ Saves all credits
- ✅ App still works
- ❌ Audio loads on-demand (slight delay)
- ❌ User experience less smooth

## Recommended Action Plan

### Immediate (Today):
1. **Top up ElevenLabs credits** ($10-20 should last a few weeks)
2. **Monitor usage** at https://elevenlabs.io/app/usage

### Short-term (This Week):
1. **Implement reduced preloading** (Option 4)
   - Only preload 5 most common segments
   - Reduces cost by 70% while maintaining UX

### Long-term (This Month):
1. **Switch to OpenAI TTS** (Option 2)
   - 10-20x cheaper than ElevenLabs
   - Still high quality
   - More sustainable for scaling
   
2. **Or upgrade to ElevenLabs Creator plan** ($22/month)
   - If you prefer their voice quality
   - 100,000 credits should be plenty

3. **Implement CDN caching** (Option 3)
   - Store generated audio in Vercel Blob
   - Only generate each phrase once globally
   - Serve from CDN (instant, no API calls)

## Cost Comparison

| Provider | Cost | Quality | Quota | Sustainability |
|----------|------|---------|-------|----------------|
| **ElevenLabs Free** | $0 | ★★★★★ | 30K credits/mo | ❌ Not enough |
| **ElevenLabs Creator** | $22/mo | ★★★★★ | 100K credits/mo | ✅ Good |
| **OpenAI TTS** | ~$5-10/mo | ★★★★☆ | High | ✅✅ Excellent |
| **Google Cloud TTS** | ~$2-5/mo | ★★★★☆ | Very High | ✅✅ Excellent |

## How to Check Your Current Usage

### ElevenLabs:
1. Go to: https://elevenlabs.io/app/subscription
2. View "Character Usage" and "Monthly Quota"
3. Check when quota resets

### OpenAI:
1. Go to: https://platform.openai.com/usage
2. View TTS API usage
3. Check spending limits

## Code Locations

### TTS API Route:
- **File**: `/workspace/app/api/tts/route.ts`
- **ElevenLabs code**: Lines 13-101
- **OpenAI code**: Lines 104-132
- **Caching logic**: Lines 26-52

### Audio Preloader:
- **File**: `/workspace/components/treatment/v4/V4AudioPreloader.tsx`
- **Used in**: `/workspace/app/dashboard/sessions/treatment-v4/page.tsx`

### Natural Voice Hook:
- **File**: `/workspace/components/voice/useNaturalVoice.ts`
- **Provider setting**: Look for `voiceProvider: 'elevenlabs'`

## Testing After Fix

After adding credits or switching providers:

1. **Clear browser cache**: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
2. **Load treatment page**: `/dashboard/sessions/treatment-v4`
3. **Check console**: Should see:
   ```
   ✅ V4 Audio preload complete!
      Successfully cached: 17 new segment(s)  ← All succeed now
      Failed: 0 segment(s)
   ```

## Summary

**What it looks like:**
```
❌ Audio preloading is broken
```

**What it actually is:**
```
✅ Audio preloading works correctly
❌ API quota is exhausted
💡 Top up credits or switch providers
```

The preloader is doing exactly what it's supposed to do - the issue is purely a billing/quota limitation with your TTS provider.

**Quick Fix:** Add $10-20 of ElevenLabs credits  
**Best Fix:** Switch to OpenAI TTS (cheaper, scalable)  
**Emergency Fix:** Disable preloading temporarily
