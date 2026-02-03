# Whisper Migration Guide

Complete guide for safely migrating from Web Speech API to self-hosted Whisper transcription service.

## Pre-Deployment Checklist

### 1. Test Locally
- [ ] Whisper service runs: `cd whisper-service && docker-compose up`
- [ ] Health check passes: `curl http://localhost:8000/health`
- [ ] Redis connected (check health response)
- [ ] Model loaded successfully
- [ ] Test transcription: `curl -X POST http://localhost:8000/transcribe -F "audio=@test.wav"`
- [ ] Cache working (send same audio twice, verify second is cached)

### 2. Verify Redis
- [ ] Redis running: `docker-compose exec redis redis-cli ping`
- [ ] Memory limit set: 256MB with LRU eviction
- [ ] Persistent volume configured
- [ ] Health check working

### 3. Check Disk Space
- [ ] Whisper model cached: ~150MB (models directory)
- [ ] Log directory has space: /opt/mindshifting/whisper-service/logs
- [ ] Redis data volume has space
- [ ] Docker images built successfully

## Deployment Steps

### 1. Deploy Whisper Service
```bash
# Run deployment script
./scripts/deploy-whisper.sh

# Or manual deployment:
ssh root@your-server
cd /opt/mindshifting/whisper-service
docker-compose build
docker-compose up -d
docker-compose ps  # Verify both services running
```

### 2. Verify Services Healthy
```bash
# Check health
curl http://your-server:8000/health

# Test transcription
curl -X POST http://your-server:8000/transcribe \
  -F "audio=@test.wav" \
  -H "X-API-Key: your-api-key"

# Check metrics
curl http://your-server:8000/metrics
curl http://your-server:8000/stats
```

### 3. Update Environment Variables
```bash
# Production .env
WHISPER_SERVICE_URL=http://localhost:8000  # or remote URL
WHISPER_API_KEY=<your-secure-api-key>
NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=webspeech  # Start here!
```

### 4. Deploy Next.js App
```bash
# Deploy with webspeech (safe)
vercel --prod

# Verify everything works as before
```

## Feature Flag Rollout Strategy

### Phase 1: 0% (Baseline - webspeech)
**Duration**: 24 hours

```bash
NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=webspeech
```

- Deploy and verify no regressions
- Whisper service running but not used
- Establish baseline metrics

**Success Criteria**:
- Zero impact on existing functionality
- All health checks green
- User experience unchanged

### Phase 2: Developer Testing (whisper)
**Duration**: 2-3 days

- Developers switch locally to `whisper`
- Test all transcription flows
- Verify cache effectiveness
- Performance testing

**Monitoring**:
- Error rates
- Latency (should be <2s)
- Cache hit rate (target >30%)
- Real-time factor (expect ~0.05)

### Phase 3: Canary Rollout (10%)
**Duration**: 24-48 hours

```bash
# Option A: Vercel environment variables (per deployment)
# Option B: Load balancer with A/B testing
# Option C: Gradual environment variable update
```

**Monitor**:
- Error rate <1%
- P95 latency <2s
- Cache hit rate >10%
- User feedback (support tickets)

**Alert Thresholds**:
- Error rate >1% → pause rollout
- P95 latency >5s → investigate
- Service down → immediate rollback

### Phase 4: Gradual Increase
**Schedule**:
- 10% → 25%: Wait 24h, monitor
- 25% → 50%: Wait 48h, monitor
- 50% → 75%: Wait 48h, monitor
- 75% → 100%: Wait 72h, monitor

At each step:
1. Update `NEXT_PUBLIC_TRANSCRIPTION_PROVIDER` percentage
2. Deploy
3. Monitor for alert duration
4. Verify metrics within thresholds
5. Proceed or rollback

### Phase 5: Full Rollout (100%)
**Duration**: Ongoing

```bash
NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=whisper
```

- Monitor for 1 week continuously
- Document performance improvements
- Celebrate success! 🎉

## Rollback Procedure

### Immediate Rollback (<5 minutes)

If ANY of these occur:
- Error rate >1%
- Service completely down
- Critical bug reported
- Performance degradation

**Steps**:
```bash
# 1. Revert environment variable
NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=webspeech

# 2. Redeploy
vercel --prod

# 3. Verify rollback successful
curl https://your-site.com/api/transcribe  # Should work

# 4. Check provider indicator (dev mode)
# Should show "WebSpeech"
```

### Post-Rollback Actions
1. Check Whisper service logs: `docker-compose logs whisper`
2. Check Next.js API logs
3. Check Redis connection
4. Verify model loaded correctly
5. Root cause analysis
6. Fix issues
7. Re-test locally
8. Plan new rollout

## Monitoring During Rollout

### Key Metrics Dashboard

1. **Success Rate** (target: >99%)
   - Total requests
   - Successful transcriptions
   - Failed transcriptions

2. **Latency** (target: P95 <2s)
   - P50 latency
   - P95 latency
   - P99 latency

3. **Cache Performance**
   - Hit rate (target: >30%)
   - Misses
   - Total cached items

4. **Real-Time Factor** (target: <0.1)
   - Processing time / audio duration
   - Lower is better
   - CPU-bound metric

5. **Service Health**
   - Whisper uptime
   - Redis uptime
   - Model loaded status

### Logging

All requests logged:
```
[Transcribe] Received audio: 45623 bytes
[Transcribe] Success: 125 chars, 487ms, cached=false, rtf=0.057
```

### Alerts

Set up alerts for:
```bash
# Crontab
*/5 * * * * /opt/mindshifting/scripts/health_check.sh
*/15 * * * * /opt/mindshifting/scripts/check_metrics.sh
```

**Alert Conditions**:
- Service down (3 consecutive failures)
- Response time >5s
- Cache hit rate <10%
- Error rate >1% (5 min window)

## Success Criteria

Migration considered successful when:
- ✅ 95% uptime maintained (7 days)
- ✅ P95 latency <2s consistently
- ✅ Error rate <1% sustained
- ✅ User satisfaction maintained/improved
- ✅ No rollbacks for 1 week
- ✅ Cache hit rate >30%
- ✅ Cost savings realized (if applicable)

## Troubleshooting

### Common Issues

#### "Transcription service not configured"
**Cause**: `WHISPER_SERVICE_URL` not set  
**Fix**: Set in `.env.production`

#### 401 Unauthorized
**Cause**: API key mismatch  
**Fix**: Verify `WHISPER_API_KEY` matches in both services

#### Slow transcriptions
**Cause**: CPU limited or model loading on each request  
**Fix**: 
- Check model preloads on startup
- Increase Docker CPU limits
- Consider GPU acceleration

#### Cache not working
**Cause**: Redis not connected  
**Fix**: `docker-compose up redis` and check logs

#### Service crashes
**Cause**: Out of memory  
**Fix**: Increase Docker memory limits or use smaller model

## Performance Benchmarks

Expected performance (CPU, base model):
- **Latency**: 0.5-2s for 3s audio
- **RTF**: 0.05-0.1 (20x faster than real-time)
- **Cache hit rate**: 30-60% (after warmup)
- **Throughput**: 10-20 req/s (single worker)

## Post-Migration

### Week 1: Intensive Monitoring
- Check metrics hourly
- Review logs daily
- User feedback collection
- Performance tuning

### Week 2-4: Optimization
- Adjust cache TTL based on hit rate
- Fine-tune resource limits
- Optimize model selection
- Document learnings

### Month 2+: Maintenance Mode
- Weekly health checks
- Monthly performance reviews
- Quarterly cost analysis
- Feature enhancements

## Contacts & Escalation

- **On-call Engineer**: [Your contact]
- **Slack Channel**: #whisper-migration
- **Incident Response**: [Runbook link]

---

**Last Updated**: 2026-02-03  
**Version**: 1.0  
**Status**: Ready for Production
