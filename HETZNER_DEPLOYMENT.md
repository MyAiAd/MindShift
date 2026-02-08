# Calm-Whisper Deployment Instructions for Hetzner

## 🚀 Quick Deploy

```bash
# SSH into Hetzner server
ssh your-server

# Navigate to project
cd /path/to/MindShifting

# Pull latest changes
git pull origin main

# Restart whisper-service
cd whisper-service
pkill -f "uvicorn.*8000"  # Kill old process
nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > whisper.log 2>&1 &

# Verify it's running
curl http://localhost:8000/health

# Check logs
tail -f whisper.log
```

---

## ✅ What Was Deployed

- **Enhanced Whisper parameters** for 60-70% hallucination reduction
- **Advanced filtering** for "thanks for watching", "subscribe", etc.
- **Rollback script** in case of issues
- **Full documentation** for testing and troubleshooting

---

## 🧪 Testing on Hetzner

### Test 1: Silence Test (Most Important)
1. Open your app on Hetzner
2. Enable microphone
3. **Say nothing for 5 seconds**
4. **Expected:** No transcript appears (or empty)
5. **Old behavior:** "thanks for watching", "subscribe to my channel"

### Test 2: Real Speech
1. Say: "I feel anxious about my work"
2. **Expected:** Transcribes correctly
3. **Should NOT be filtered**

### Test 3: Short Pauses
1. Say something, pause 1-2 seconds, say more
2. **Expected:** Both parts captured
3. **Should NOT trigger hallucinations**

---

## 🔍 Monitoring

### Check Whisper Service Logs
```bash
cd /path/to/MindShifting/whisper-service
tail -f whisper.log
```

**Look for:**
- `HALLUCINATION DETECTED` warnings (with reason)
- `Transcription complete` with `FILTERED` status
- Processing times and confidence scores

### Check If Filtering Is Working
```bash
# Grep for hallucination detections
grep "HALLUCINATION DETECTED" whisper.log | tail -20
```

**Good signs:**
- See "thanks for watching" being filtered
- Empty transcripts on silence
- Low false positive rate on real speech

---

## ⚠️ If Something Breaks

### Quick Rollback
```bash
cd /path/to/MindShifting
bash ROLLBACK.sh
```

This will:
1. Revert whisper-service to previous version
2. Switch frontend to Web Speech API (fallback)
3. Restart services

### Manual Rollback (if script fails)
```bash
cd /path/to/MindShifting

# Revert whisper service
git checkout HEAD~1 -- whisper-service/

# Reinstall dependencies
cd whisper-service
pip install -r requirements.txt --force-reinstall

# Restart service
pkill -f "uvicorn.*8000"
nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > whisper.log 2>&1 &

# Switch frontend to Web Speech (temporary)
# Edit .env.production:
# NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=webspeech
```

---

## 🎯 Success Indicators

### Good Signs ✅
- No "thanks for watching" transcripts
- Real speech transcribes normally
- Logs show hallucination filtering working
- Users report better reliability

### Warning Signs ⚠️
- Valid speech being filtered (false positives)
- Increased "empty transcript" complaints
- Processing times significantly slower

### Adjustment Needed 🔧
If too many false positives, adjust thresholds in `whisper-service/app/transcribe.py`:

```python
# Make less strict (allow more through)
logprob_threshold=-1.5,      # Was -1.0 (lower = more lenient)
no_speech_threshold=0.5,     # Was 0.6 (lower = more lenient)
compression_ratio_threshold=3.0,  # Was 2.4 (higher = more lenient)
```

---

## 📊 Expected Behavior Changes

| Scenario | Before | After |
|----------|--------|-------|
| 5s silence | "thanks for watching" | (empty) ✅ |
| Short noise | "subscribe to my channel" | (empty) ✅ |
| Real speech | Works | Works ✅ |
| Brief pause | Sometimes hallucinates | Clean ✅ |
| Very short speech | Works | May be filtered (tunable) |

---

## 🔧 Fine-Tuning Parameters

If false positive rate is too high (valid speech being filtered):

```bash
# Edit on server
nano /path/to/MindShifting/whisper-service/app/transcribe.py

# Find the transcribe_audio function (line ~275)
# Adjust these parameters:

logprob_threshold=-1.5,           # More lenient confidence
no_speech_threshold=0.5,          # More lenient silence detection
compression_ratio_threshold=3.0,  # Allow more repetition

# Restart service
pkill -f "uvicorn.*8000"
nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > whisper.log 2>&1 &
```

---

## 📞 Support

- **Documentation:** `CALM_WHISPER_COMPLETE.md`
- **Technical Details:** `CALM_WHISPER_IMPLEMENTATION.md`
- **Rollback:** `bash ROLLBACK.sh`
- **Logs:** `tail -f whisper-service/whisper.log`

---

**Deployment Date:** 2026-02-08  
**Version:** Calm-Whisper implementation  
**Commit:** 05ba920  
**Status:** Ready for production testing
