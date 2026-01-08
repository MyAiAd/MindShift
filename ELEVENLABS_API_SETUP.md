# ElevenLabs API Key Setup

## Security Notice

**IMPORTANT**: Never commit API keys to git repositories, even temporarily. Git history retains all commits, and anyone with repository access can extract old keys.

## Setup Methods

### Method 1: Environment Variable (Recommended for One-Time Generation)

For one-time audio generation, set the API key as a temporary environment variable:

```bash
export ELEVENLABS_API_KEY=your_api_key_here
node scripts/generate-static-audio.js rachel
```

This keeps the key out of files and git history.

### Method 2: .env.local File (Recommended for Development)

For repeated use during development:

1. Create a `.env.local` file in the project root (already in `.gitignore`):
   ```bash
   echo "ELEVENLABS_API_KEY=your_api_key_here" > .env.local
   ```

2. Update the generation script to load from `.env.local`:
   ```javascript
   require('dotenv').config({ path: '.env.local' });
   const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
   ```

3. Run the script:
   ```bash
   node scripts/generate-static-audio.js rachel
   ```

### Method 3: Secure Note (For Team Reference)

Store the API key in:
- Your password manager (1Password, LastPass, Bitwarden)
- Encrypted team vault (AWS Secrets Manager, HashiCorp Vault)
- Secure team documentation (Notion with access controls)

**Never store in**:
- Git repository
- Plain text files in the project
- Slack/Discord messages
- Email

## Getting Your API Key

1. Log in to [ElevenLabs](https://elevenlabs.io/)
2. Go to Profile Settings
3. Navigate to API Keys section
4. Copy your API key
5. Check your credit balance (need ~10,000 credits for all audio segments)

## Credit Requirements

- **INITIAL_WELCOME**: ~69 credits (short intro)
- **Full regeneration**: ~10,000 credits (all 17 segments)
- **Cost**: ~$1-2 USD for complete generation

## Checking Your Credits

Before running the generation script:

```bash
curl -H "xi-api-key: your_api_key_here" https://api.elevenlabs.io/v1/user
```

Look for the `character_count` and `character_limit` in the response.

## Quick Reference Commands

### Generate Rachel Voice (Default)
```bash
export ELEVENLABS_API_KEY=your_api_key_here
node scripts/generate-static-audio.js rachel
```

### Generate Adam Voice
```bash
export ELEVENLABS_API_KEY=your_api_key_here
node scripts/generate-static-audio.js adam
```

### Check Generated Files
```bash
ls -lh public/audio/v4/static/rachel/
cat public/audio/v4/static/rachel/manifest.json
```

### Commit New Audio
```bash
git add public/audio/v4/static/rachel/
git commit -m "feat: update static audio for [segment name]"
git push
```

## Troubleshooting

### "quota_exceeded" Error
```json
{"detail":{"status":"quota_exceeded","message":"This request exceeds your quota..."}}
```

**Solution**: Add credits to your ElevenLabs account
1. Go to [ElevenLabs Billing](https://elevenlabs.io/app/billing)
2. Purchase additional credits
3. Wait a few minutes for credits to process
4. Re-run the generation script

### "API key not configured" Error
```
❌ Error: ELEVENLABS_API_KEY environment variable is not set
```

**Solution**: Set the environment variable before running:
```bash
export ELEVENLABS_API_KEY=your_api_key_here
```

### "unauthorized" Error
```json
{"detail":"Unauthorized"}
```

**Solution**: Check that your API key is correct and hasn't expired

## Rotating API Keys

If you need to change the API key before production:

1. Generate new API key in ElevenLabs dashboard
2. Update your secure storage location
3. Test with the generation script
4. Revoke the old API key
5. Update team documentation

## Production Considerations

- Static audio files are served from `/public/audio/v4/static/`
- No API key needed in production (files are pre-generated)
- Users download audio files directly (no API calls)
- Cost: $0 per user after initial generation

## Future: Self-Hosted TTS (Zero Cost)

For complete cost elimination, consider migrating to self-hosted Paroli + Piper:
- **Repository**: https://github.com/MyAiAd/paroli
- **Cost**: ~$13/month hosting (vs $100s-1000s/month API costs)
- **Format**: Opus (better compression and latency than MP3)
- **Quality**: 8/10 (vs 10/10 for ElevenLabs, but $0 ongoing cost)
- **See**: `PAROLI_MIGRATION_SCOPE.md` for full migration plan
