# Ralph Iteration Prompt Template

Copy/paste this for each iteration with your LLM of choice:

---

## Iteration Start Prompt

```
You are Ralph, an autonomous coding agent. Your job is to:

1. Read the PRD and progress log below
2. Pick the highest priority story where passes=false
3. Implement ONLY that story
4. Run quality checks (typecheck, lint, test)
5. Commit if passing: "feat: [Story ID] - [Story Title]"
6. Update PRD (set passes: true)
7. Append progress to progress.txt with learnings

Rules:
- ONE story per iteration
- Read Codebase Patterns in progress.txt first
- ALL commits must pass quality checks
- Frontend stories require browser verification
- Stop when all stories have passes: true (reply with <promise>COMPLETE</promise>)

---

CURRENT PRD.JSON:
```json
{
  "project": "Self-Hosted Whisper Speech-to-Text",
  "branchName": "ralph/whisper-self-hosted",
  "description": "Replace Web Speech API with self-hosted OpenAI Whisper transcription service for reliable, accurate speech recognition with Redis caching and production monitoring",
  "userStories": [
    {
      "id": "US-001",
      "title": "Set up Python environment and dependencies",
      "description": "As a developer, I need a Python virtual environment with all required dependencies so I can run the Whisper service.",
      "acceptanceCriteria": [
        "Create Python 3.10+ virtual environment in project root",
        "Install faster-whisper, FastAPI, uvicorn, and audio processing libraries",
        "Create requirements.txt with pinned versions",
        "Download and cache Whisper base model locally",
        "Verify model loads successfully with test script",
        "Document Python setup in README",
        "Typecheck passes"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-002",
      "title": "Create Whisper service configuration module",
      "description": "As a developer, I need centralized configuration management so service behavior can be controlled via environment variables.",
      "acceptanceCriteria": [
        "Create whisper-service/app/config.py with all configuration parameters",
        "Support environment variables for model selection (base/small), device (cpu), compute type (int8)",
        "Configure audio processing limits (max 30s, min 0.1s)",
        "Configure cache settings (Redis URL, enable/disable, TTL)",
        "Configure API settings (host, port, workers, optional API key)",
        "Add get_config_summary() function for logging",
        "Document all environment variables in comments",
        "Typecheck passes"
      ],
      "priority": 2,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-003",
      "title": "Implement audio preprocessing and validation",
      "description": "As a developer, I need robust audio preprocessing so Whisper receives properly formatted audio regardless of input format.",
      "acceptanceCriteria": [
        "Create whisper-service/app/transcribe.py with preprocess_audio() function",
        "Support reading WAV, MP3, OGG, FLAC audio formats via soundfile",
        "Convert stereo to mono automatically",
        "Resample audio to 16kHz (Whisper's expected sample rate)",
        "Normalize audio to [-1, 1] range",
        "Validate audio duration (min 0.1s, max 30s)",
        "Check for silent audio (RMS < 0.001 threshold with warning)",
        "Return numpy array and sample rate",
        "Raise ValueError with clear messages for invalid audio",
        "Typecheck passes"
      ],
      "priority": 3,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-004",
      "title": "Implement core Whisper transcription logic",
      "description": "As a developer, I need the core transcription function so audio can be converted to text with metadata.",
      "acceptanceCriteria": [
        "Create transcribe_audio() function using faster-whisper",
        "Load Whisper model as singleton (load once, reuse across requests)",
        "Use VAD filter to skip silence automatically",
        "Extract full transcript text from segments",
        "Return segments with timestamps, confidence scores",
        "Calculate real-time factor (processing time / audio duration)",
        "Include processing time breakdown (preprocess, transcribe, total)",
        "Return language detection and probability",
        "Add comprehensive error handling with logging",
        "Typecheck passes"
      ],
      "priority": 4,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-005",
      "title": "Implement Redis caching layer",
      "description": "As a developer, I need Redis-based caching so repeated audio doesn't require re-transcription.",
      "acceptanceCriteria": [
        "Create whisper-service/app/cache.py with RedisCache class",
        "Implement get(), set(), clear() methods for cache operations",
        "Use SHA256 hash of audio data as cache key",
        "Store transcription results as JSON in Redis with TTL (1 hour default)",
        "Add cache hit/miss logging with truncated hash display",
        "Handle Redis connection failures gracefully (log error, continue without cache)",
        "Include cache metadata (cached_at, cache_hit_at timestamps)",
        "Return None for cache misses, full result for hits",
        "Add NoOpCache fallback class when caching disabled",
        "Typecheck passes"
      ],
      "priority": 5,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-006",
      "title": "Create FastAPI application with core endpoints",
      "description": "As a developer, I need a REST API so the Next.js app can send audio and receive transcripts.",
      "acceptanceCriteria": [
        "Create whisper-service/app/main.py with FastAPI application",
        "Implement POST /transcribe endpoint accepting multipart/form-data audio file",
        "Implement GET / health check endpoint returning service status",
        "Implement GET /health detailed health endpoint checking model load status",
        "Implement DELETE /cache endpoint to clear cache (requires API key if configured)",
        "Add CORS middleware allowing localhost:3000 in development",
        "Add request logging middleware with timing",
        "Validate file size (max 10MB) and format (wav, mp3, ogg, flac)",
        "Support optional API key authentication via X-API-Key header",
        "Preload Whisper model on application startup",
        "Return 400 for validation errors, 500 for processing errors with clear messages",
        "Typecheck passes"
      ],
      "priority": 6,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-007",
      "title": "Set up Redis with Docker Compose",
      "description": "As a developer, I need Redis running locally so caching works in development and production.",
      "acceptanceCriteria": [
        "Create whisper-service/docker-compose.yml with Redis service",
        "Configure Redis with maxmemory 256MB and allkeys-lru eviction policy",
        "Expose Redis on port 6379 for local development",
        "Set up persistent volume for Redis data",
        "Add Redis health check to docker-compose",
        "Document Redis setup in whisper-service/README.md",
        "Test Redis connection from Python with redis-cli ping",
        "Verify cache operations work end-to-end"
      ],
      "priority": 7,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-008",
      "title": "Create Whisper service Dockerfile",
      "description": "As a developer, I need a Docker container for the Whisper service so it can run consistently across environments.",
      "acceptanceCriteria": [
        "Create whisper-service/Dockerfile with Python 3.10-slim base",
        "Install system dependencies (libsndfile1, ffmpeg)",
        "Copy requirements.txt and install Python packages",
        "Copy application code to /app directory",
        "Create directories for cache and logs with proper permissions",
        "Pre-download Whisper base model during build (via ARG for configurability)",
        "Expose port 8000",
        "Add health check calling /health endpoint every 30 seconds",
        "Set CMD to run uvicorn with 2 workers",
        "Build successfully with: docker build -t whisper-service .",
        "Container starts and serves requests on http://localhost:8000"
      ],
      "priority": 8,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-009",
      "title": "Add Whisper service to docker-compose with resource limits",
      "description": "As a developer, I need the Whisper service integrated into docker-compose so it runs alongside Redis with proper resource constraints.",
      "acceptanceCriteria": [
        "Add whisper service to docker-compose.yml",
        "Configure environment variables (model=base, device=cpu, compute_type=int8)",
        "Set REDIS_URL to redis://redis:6379/0",
        "Mount volumes for cache, logs, and model persistence",
        "Add depends_on: redis to ensure Redis starts first",
        "Set resource limits: 2 CPU cores, 2GB memory",
        "Set resource reservations: 1 CPU core, 1GB memory",
        "Configure restart: unless-stopped policy",
        "Expose port 8000 to host",
        "Test: docker-compose up -d brings up both services successfully",
        "Test: docker-compose logs -f shows both services healthy"
      ],
      "priority": 9,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-010",
      "title": "Create Next.js API route for transcription proxy",
      "description": "As a developer, I need a Next.js API route so the frontend can send audio to Whisper service securely.",
      "acceptanceCriteria": [
        "Create app/api/transcribe/route.ts with POST handler",
        "Read audio blob from request body",
        "Forward audio to Whisper service at WHISPER_SERVICE_URL (env var)",
        "Add X-API-Key header if WHISPER_API_KEY configured",
        "Handle Whisper service errors gracefully (log, return 500 with error message)",
        "Parse Whisper response JSON",
        "Return transcript in format matching existing interface (transcript, confidence, language, duration)",
        "Add logging for debugging (audio size, processing time, cache status)",
        "Set maxDuration=30 for Vercel timeout handling",
        "Typecheck passes"
      ],
      "priority": 10,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-011",
      "title": "Add environment variables for Whisper configuration",
      "description": "As a developer, I need environment configuration so the Next.js app knows how to reach the Whisper service.",
      "acceptanceCriteria": [
        "Add WHISPER_SERVICE_URL to .env.local (http://localhost:8000)",
        "Add WHISPER_API_KEY to .env.local (optional, for development)",
        "Add WHISPER_SERVICE_URL to .env.production (http://localhost:8000 for integrated setup)",
        "Add WHISPER_API_KEY to .env.production with secure generated key",
        "Add NEXT_PUBLIC_TRANSCRIPTION_PROVIDER to enable feature flag (whisper or webspeech)",
        "Document all environment variables in README.md",
        "Generate secure API key with: openssl rand -hex 32"
      ],
      "priority": 11,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-012",
      "title": "Implement feature flag for gradual rollout",
      "description": "As a developer, I need a feature flag so I can safely switch between Whisper and Web Speech API without code changes.",
      "acceptanceCriteria": [
        "Add NEXT_PUBLIC_TRANSCRIPTION_PROVIDER environment variable (webspeech or whisper)",
        "Create lib/config.ts with getTranscriptionProvider() function reading env var",
        "Update useNaturalVoice hook to check provider flag",
        "If provider=whisper, use /api/transcribe endpoint",
        "If provider=webspeech, use existing Web Speech API code",
        "Default to webspeech if env var not set (safe fallback)",
        "Add UI indicator showing which provider is active (dev mode only)",
        "Document feature flag usage in README.md",
        "Test switching between providers without code changes",
        "Typecheck passes"
      ],
      "priority": 12,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-013",
      "title": "Add comprehensive error handling and logging",
      "description": "As a developer, I need robust error handling so I can debug issues quickly and users get helpful error messages.",
      "acceptanceCriteria": [
        "Add structured JSON logging to Whisper service (app/logging_config.py)",
        "Log all transcription requests with audio size, model, processing time",
        "Log cache hits/misses with truncated hash",
        "Log errors with full stack traces to logs/whisper.log",
        "Add error handler in FastAPI returning consistent error JSON format",
        "Add request ID to all logs for tracing",
        "Add log rotation config in /etc/logrotate.d/whisper-service",
        "Configure log retention (7 days, compressed)",
        "Add console logging for development, file logging for production",
        "Test error scenarios: invalid audio, timeout, model load failure"
      ],
      "priority": 13,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-014",
      "title": "Create deployment script and documentation",
      "description": "As a developer, I need deployment scripts so I can deploy to Hetzner with one command.",
      "acceptanceCriteria": [
        "Create scripts/deploy-whisper.sh for production deployment",
        "Script SSHs to Hetzner server and copies whisper-service directory",
        "Script builds Docker images on server",
        "Script starts docker-compose with --build flag",
        "Script verifies services are healthy (curl health endpoints)",
        "Create whisper-service/README.md with setup instructions",
        "Document local development workflow (virtualenv, manual testing)",
        "Document production deployment process (Docker, environment variables)",
        "Document Redis setup and caching behavior",
        "Document rollback procedure (switch feature flag back to webspeech)",
        "Test deployment script on fresh server successfully"
      ],
      "priority": 14,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-015",
      "title": "Implement health check and monitoring endpoint",
      "description": "As a developer, I need monitoring endpoints so I can verify service health and track performance metrics.",
      "acceptanceCriteria": [
        "Add GET /metrics endpoint exposing Prometheus metrics",
        "Track counter: transcription_requests_total (labels: status, cached)",
        "Track histogram: transcription_duration_seconds (processing time)",
        "Track histogram: audio_duration_seconds (input audio length)",
        "Track histogram: real_time_factor (processing_time / audio_duration)",
        "Track counter: cache_hits_total and cache_misses_total",
        "Track gauge: active_requests (current in-flight requests)",
        "Add /stats endpoint returning JSON with cache hit rate",
        "Update /health endpoint to check Redis connection",
        "Return 503 if Whisper model failed to load",
        "Document metrics in README.md"
      ],
      "priority": 15,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-016",
      "title": "Create systemd service configuration",
      "description": "As a developer, I need a systemd service config so Whisper runs on boot and restarts on failure.",
      "acceptanceCriteria": [
        "Create /etc/systemd/system/whisper-service.service configuration",
        "Set User=www-data, Group=www-data for security",
        "Configure environment variables (model, device, cache settings)",
        "Set WorkingDirectory to /opt/mindshifting/whisper-service",
        "Set ExecStart to uvicorn command with 2 workers",
        "Configure Restart=always with RestartSec=10",
        "Set resource limits (LimitNOFILE=65536, MemoryLimit=2G, CPUQuota=200%)",
        "Enable service: systemctl enable whisper-service",
        "Test service starts: systemctl start whisper-service",
        "Test service survives crash: pkill -9 uvicorn, verify auto-restart",
        "Test service starts on boot: reboot server, verify service running"
      ],
      "priority": 16,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-017",
      "title": "Configure Nginx reverse proxy",
      "description": "As a developer, I need Nginx configuration so external requests can reach the Whisper service securely.",
      "acceptanceCriteria": [
        "Add upstream whisper_backend to Nginx config pointing to localhost:8000",
        "Add server block on port 8001 for debugging (optional, internal only)",
        "Configure proxy_pass to whisper_backend",
        "Set proxy headers (Host, X-Real-IP, X-Forwarded-For)",
        "Increase proxy timeouts (read, connect, send to 60s for slow transcriptions)",
        "Set client_max_body_size to 10M for audio uploads",
        "Add max_fails=3 fail_timeout=30s to upstream for health checking",
        "Test Nginx config: nginx -t",
        "Reload Nginx: systemctl reload nginx",
        "Test external access: curl http://server:8001/health"
      ],
      "priority": 17,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-018",
      "title": "Write integration tests for full transcription flow",
      "description": "As a developer, I need integration tests so I can verify the entire pipeline works end-to-end.",
      "acceptanceCriteria": [
        "Create tests/test_integration.py",
        "Test: Record 3-second WAV file, POST to /transcribe, verify transcript returned",
        "Test: Send same audio twice, verify second request is cached (cached=true)",
        "Test: Send invalid audio format, verify 400 error with helpful message",
        "Test: Send audio >10MB, verify 413 error",
        "Test: Send silent audio, verify warning logged but processing succeeds",
        "Test: Clear cache endpoint works (DELETE /cache returns success)",
        "Test: Health endpoint returns healthy status with model loaded",
        "Create test audio files in tests/fixtures/ directory",
        "Run tests with: pytest tests/test_integration.py",
        "All tests pass"
      ],
      "priority": 18,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-019",
      "title": "Create production monitoring and alerting",
      "description": "As a developer, I need monitoring so I know when the service is degraded or failing.",
      "acceptanceCriteria": [
        "Create scripts/health_check.sh that curls /health endpoint",
        "Script checks HTTP status code and response time",
        "Script sends Slack alert if service down (optional, if SLACK_WEBHOOK_URL set)",
        "Add health_check.sh to crontab (*/5 * * * * - every 5 minutes)",
        "Create scripts/check_metrics.sh that curls /stats and logs cache hit rate",
        "Alert if cache hit rate <10% (suggests cache not working)",
        "Alert if response time >5s (suggests service overloaded)",
        "Document alerting setup in README.md",
        "Test: Stop Whisper service, verify alert triggered within 5 minutes",
        "Test: Restart service, verify alert cleared"
      ],
      "priority": 19,
      "passes": false,
      "notes": ""
    },
    {
      "id": "US-020",
      "title": "Document migration path and rollback procedure",
      "description": "As a developer, I need clear migration documentation so I can safely roll out Whisper and roll back if needed.",
      "acceptanceCriteria": [
        "Create docs/whisper-migration.md with step-by-step migration guide",
        "Document pre-deployment checklist (test locally, verify Redis, check disk space)",
        "Document deployment steps (build, deploy, verify health)",
        "Document feature flag rollout strategy (0% → 10% → 50% → 100%)",
        "Document rollback procedure: set NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=webspeech, redeploy",
        "Document monitoring during rollout (watch error rates, latency, user feedback)",
        "Document success criteria (95% uptime, <2s latency, user satisfaction improvement)",
        "Create troubleshooting section for common issues (Redis down, model load timeout, OOM)",
        "Include performance benchmarks (expected latency for different audio lengths)",
        "Review documentation with team before production rollout"
      ],
      "priority": 20,
      "passes": false,
      "notes": ""
    }
  ]
}
```

---

CURRENT PROGRESS.TXT:
```
===========================================
RALPH SYSTEM - PROGRESS TRACKER
===========================================
Project: V4 Treatment Sessions - Voice Activity Detection
Branch: ralph/voice-activity-detection
Started: 2026-01-21

===========================================
CODEBASE PATTERNS
===========================================

1. State Management with localStorage
   - Use function form of useState for localStorage initialization
   - Example: useState(() => localStorage.getItem('key') ?? defaultValue)
   - Always persist changes back to localStorage in handlers

2. Hook Patterns
   - Use refs for callbacks to prevent unnecessary re-initialization
   - Store hook instances in refs when needed in callbacks defined before hook
   - Use useCallback for methods passed as props or used in dependencies

3. VAD Integration
   - Enable VAD only when both mic AND speaker are true
   - Pause VAD during speech recognition to avoid interference
   - Resume VAD after speech recognition completes

4. Audio Level Calculation
   - RMS formula: sqrt(sum(sample²) / length)
   - Scale to 0-100: Math.min(100, Math.round(rms * 500))

5. Conditional UI Rendering
   - Use logical AND (&&) for single condition
   - Wrap complex conditional sections in {}
   - Match existing component styling patterns

6. Error Handling in Hooks
   - Use try-catch in all async operations
   - Set error state with descriptive messages
   - Log errors with context for debugging

===========================================
LEARNINGS LOG
===========================================

[2026-01-21] US-001: Install VAD library dependency
- Successfully installed @ricky0123/vad-web v0.0.30
- Package includes WASM-based voice activity detection
- Project uses npm (not pnpm as initially specified in PRD)
- Typecheck passes without issues after installation
- Commit: feat: US-001 - Install VAD library dependency

[2026-01-21] US-002: Add VAD state management to TreatmentSession
- Added vadSensitivity state with localStorage persistence (default: 0.5)
- Added vadLevel state (0-100) for real-time meter visualization
- Added isVadActive state to track VAD running status
- Implemented handleVadSensitivityChange with localStorage save
- Implemented getVadSensitivityLabel helper (Low ≤0.35, Medium 0.35-0.65, High >0.65)
- Console logging confirms sensitivity changes
- Pattern: State initialization with localStorage fallback using function form
- Commit: feat: US-002 - Add VAD state management to TreatmentSession

[2026-01-21] US-003: Create useVAD hook foundation
- Created components/voice/useVAD.tsx following existing hook patterns
- Defined UseVADProps interface with all required callbacks
- Implemented hook structure with callback refs to prevent unnecessary re-initialization
- Added vadRef for MicVAD instance, isInitialized and error state
- Pattern: Use refs for callbacks to keep VAD instance stable across re-renders
- Commit: feat: US-003 - Create useVAD hook foundation

[2026-01-21] US-004: Implement VAD initialization logic
- Implemented full VAD lifecycle management in useEffect
- Dynamic import of @ricky0123/vad-web for code splitting
- Configured sensitivity thresholds with 0.15 hysteresis
- Set timing parameters in milliseconds (minSpeechMs: 150, preSpeechPadMs: 50, redemptionMs: 400)
- Single-threaded WASM configuration for browser compatibility
- Proper cleanup on unmount and when enabled changes
- Console logging confirms initialization and destruction
- Pattern: Use mounted flag to prevent state updates after unmount
- Commit: feat: US-004 - Implement VAD initialization logic

[2026-01-21] US-005: Implement VAD event handlers
- Implemented onSpeechStart, onSpeechEnd, onVADMisfire handlers
- Implemented onFrameProcessed for real-time level monitoring
- Calculate RMS (Root Mean Square) audio level from Float32Array data
- Scale RMS to 0-100 range using factor of 500
- Console logging for all speech detection events
- Pattern: RMS calculation - sqrt(sum(sample²) / length) for audio level
- Commit: feat: US-005 - Implement VAD event handlers

[2026-01-21] US-006: Add VAD start/pause/destroy methods
- Implemented startVAD, pauseVAD, destroyVAD control methods
- All methods wrapped in useCallback for stable references
- Comprehensive error handling with try-catch blocks
- Error messages set in state for UI display
- Console logging confirms all method calls
- Pattern: useCallback for methods that will be passed as props
- Commit: feat: US-006 - Add VAD start/pause/destroy methods

[2026-01-21] US-007: Integrate VAD with useNaturalVoice hook
- Imported useVAD hook into useNaturalVoice
- Added vadError state for separate VAD error tracking
- VAD only enabled when both isMicEnabled AND isSpeakerEnabled are true
- Implemented handleVadBargeIn callback to stop AI audio and start speech recognition
- Passed vadSensitivity and onVadLevel from TreatmentSession through hook chain
- Pattern: Conditional hook enablement based on multiple state flags
- Commit: feat: US-007 - Integrate VAD with useNaturalVoice hook

[2026-01-21] US-008: Implement barge-in handler logic
- Enhanced handleVadBargeIn with VAD pause during speech recognition
- Stop AI audio, clear all state flags and audio queue on barge-in
- Pause VAD temporarily to prevent interference with speech recognition
- Resume VAD monitoring after speech recognition ends (in onend callback)
- Console logging confirms barge-in flow and VAD state changes
- Pattern: Use refs to access hook instances in callbacks defined before hook initialization
- Commit: feat: US-008 - Implement barge-in handler logic

[2026-01-21] US-009: Add VAD sensitivity slider to settings modal
- Added VAD sensitivity section below Playback Speed
- Includes 🎙️ emoji, percentage display, and label (Low/Medium/High)
- Range slider (0.1-0.9, step 0.05) with preset buttons
- Only visible when both mic AND speaker enabled (conditional rendering)
- Mirrors Playback Speed styling for consistency
- Pattern: Conditional section rendering based on multiple state flags
- Commit: feat: US-009 - Add VAD sensitivity slider to settings modal
- Note: Browser verification pending (acceptance criteria includes dev-browser check)

[2026-01-21] US-010: Add real-time voice level meter
- Added 10-bar visual meter below sensitivity slider
- Displays voice level percentage (0-100%)
- Bars fill proportionally based on vadLevel state
- Color coding: indigo for filled, gray for unfilled
- Real-time updates driven by onVadLevel callback
- Pattern: Array mapping with conditional styling for responsive bar visualization
- Commit: feat: US-010 - Add real-time voice level meter
- Note: Browser verification pending

[2026-01-21] US-011: Add help text and visual feedback
- Added info icon (ℹ️) with instructional help text
- Text: "Speak while AI talks to test it"
- Positioned below voice level meter
- Styled consistently with existing info messages
- Only visible when VAD is active (inside conditional block)
- Commit: feat: US-011 - Add help text and visual feedback
- Note: Browser verification pending

[2026-01-21] US-017: Add comprehensive error handling
- Added browser compatibility checks (WebAssembly, MediaDevices)
- Descriptive error messages for different failure scenarios
- Handles microphone access loss, WASM download failure, permission denied
- Error state set without crashing app (graceful degradation)
- Full error context logged to console for debugging
- Pattern: Error message mapping based on error content analysis
- Commit: feat: US-017 - Add comprehensive error handling

[2026-01-21] US-018: Add error display in settings modal
- Added error banner below VAD controls in settings modal
- Red background with warning icon (⚠️) for visual prominence
- Displays descriptive error message from vadError state
- Conditional rendering - only shows when error present
- Matches existing error styling patterns in modal
- Commit: feat: US-018 - Add error display in settings modal
- Note: Browser verification pending

[2026-01-21] US-019: Implement lazy loading for VAD library
- Already completed in US-004 via dynamic import
- VAD library only loads when enabled (mic + speaker both true)
- Import failure handled gracefully in error handling
- Pattern: Dynamic import for code splitting

[2026-01-21] US-020: Optimize VAD level updates with debouncing
- Implemented 100ms debounce for vadLevel updates
- Used useMemo for stable debounced function reference
- Timer ref for cleanup on unmount
- Reduces re-renders while maintaining responsive UI
- Pattern: useMemo + setTimeout for debouncing with cleanup
- Commit: feat: US-020 - Optimize VAD level updates with debouncing

[2026-01-21] US-021: Add cleanup on component unmount
- Already completed in US-004 and US-020
- VAD instance destroyed in useEffect cleanup
- Debounce timer cleared on unmount
- Console logs confirm cleanup

[2026-01-21] US-022: Update documentation for VAD feature
- Added comprehensive VAD section to V4_READY_FOR_VOICE.md
- Updated audioFix.md with barge-in flow diagram
- Added JSDoc comments to useVAD hook with usage examples
- Documented sensitivity settings, error handling, troubleshooting
- Included API reference and implementation commit history
- Commit: feat: US-022 - Update documentation for VAD feature


---
```

---

PROJECT LOCATION: [specify where files are or upload them]

Please implement the next incomplete user story.
```

---

## After Each Iteration

1. Copy the updated `prd-whisper.json` from the LLM's response
2. Copy the updated `progress.txt` from the LLM's response
3. Apply the code changes to your project
4. Run the commit command
5. Repeat with next iteration using updated files

---

## Tips

- Always provide the FULL prd-whisper.json and progress.txt (not just the changes)
- If the LLM tries to do multiple stories, stop it and remind: "ONE story per iteration"
- If it skips quality checks, remind: "Run quality checks before committing"
- If it doesn't update progress.txt with learnings, prompt: "Add learnings to progress.txt"
