# TTS API 500 Error - Fix Guide

## Problem
The Text-to-Speech (TTS) API is returning 500 Internal Server Errors because the OpenAI API key is not configured.

## Error Pattern
```
POST https://mind-shift-app.vercel.app/api/tts 500 (Internal Server Error)
✗ Failed: "Mind Shifting is not like counselling..." Error: TTS request failed: 500
```

## Root Cause
The `.env.local` file contains a placeholder:
```bash
OPENAI_API_KEY=your_openai_api_key_here
```

## Solution

### Option 1: Configure OpenAI API Key (Recommended)

#### Step 1: Get an OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-...`)

#### Step 2: Set in Vercel (Production)
1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Key**: `OPENAI_API_KEY`
   - **Value**: `sk-...` (your actual key)
   - **Environment**: Production, Preview, Development (select all)
4. Click "Save"
5. **Redeploy** your application for changes to take effect

#### Step 3: Set Locally (Development)
Edit `.env.local`:
```bash
OPENAI_API_KEY=sk-your-actual-key-here
```

Then restart your development server:
```bash
npm run dev
```

### Option 2: Switch to ElevenLabs (Alternative TTS Provider)

If you prefer to use ElevenLabs instead of OpenAI:

#### Step 1: Get ElevenLabs API Key
1. Go to https://elevenlabs.io
2. Sign up and get your API key
3. Copy the key

#### Step 2: Configure Environment
Add to Vercel environment variables:
```bash
ELEVENLABS_API_KEY=your-elevenlabs-key-here
```

#### Step 3: Update TTS Calls
The TTS API already supports ElevenLabs. You'll need to update the client-side code to pass `provider: 'elevenlabs'` in the request body.

## Verification

After setting the API key and redeploying:

1. Visit your deployed app: https://mind-shift-app.vercel.app
2. Start a treatment session
3. The audio should play without errors
4. Check browser console - you should see:
   ```
   ✅ V4 Audio preload complete!
   ```
   Without the 500 errors

## Cost Considerations

### OpenAI TTS Pricing (2024)
- **tts-1 model**: $0.015 per 1,000 characters (~$0.000015 per character)
- **tts-1-hd model**: $0.030 per 1,000 characters (~$0.000030 per character)
- Average treatment session (~2,000 characters): **~$0.03 - $0.06**

### ElevenLabs Pricing (2024)
- **Free tier**: 10,000 characters/month
- **Starter**: $5/month for 30,000 characters
- **Creator**: $22/month for 100,000 characters

## Current TTS Configuration

Your app currently uses:
- **Default provider**: OpenAI
- **Default model**: `tts-1` (standard quality)
- **Default voice**: `alloy`
- **Caching**: Yes (for ElevenLabs only)

## Troubleshooting

### Still getting 500 errors after setting key?

1. **Verify key is correct**:
   ```bash
   # Test locally
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_KEY_HERE"
   ```

2. **Check Vercel deployment logs**:
   - Go to Vercel dashboard → Deployments → Select latest
   - Click "View Function Logs"
   - Look for TTS API errors

3. **Verify environment variable is set**:
   - In Vercel, go to Settings → Environment Variables
   - Confirm `OPENAI_API_KEY` exists and has a value
   - Make sure it's enabled for Production environment

4. **Force redeploy**:
   ```bash
   git commit --allow-empty -m "Force redeploy for env vars"
   git push origin main
   ```

### API Key Security

⚠️ **Never commit API keys to git**
- Keys should only be in `.env.local` (which is in `.gitignore`)
- Use Vercel's environment variables for production
- Rotate keys if accidentally exposed

## Next Steps

1. ✅ Get OpenAI API key
2. ✅ Add to Vercel environment variables
3. ✅ Redeploy application
4. ✅ Test treatment session with audio
5. ✅ Monitor usage and costs in OpenAI dashboard

## Additional Notes

The TTS endpoint (`/app/api/tts/route.ts`) has built-in error handling and will return specific error messages if:
- API key is missing: `"TTS synthesis failed"`
- Text is empty: `"Text is required"`
- Provider-specific errors are logged to console

Current error suggests the OpenAI API is rejecting the request due to invalid authentication (placeholder key).
