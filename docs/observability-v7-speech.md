# V7 Speech Observability (US-005)

Structured JSON log lines emitted by the Next.js API routes for V7 speech I/O. Every
`/api/transcribe` and `/api/tts` response produces one log line per call so we can derive
quality-of-service dashboards from plain-text logs (Vercel, Datadog, Loki, CloudWatch, etc.).

## Log event shapes

### `stt_call`

Emitted by `app/api/transcribe/route.ts::callOpenAIProvider` on every OpenAI STT response.

```json
{
  "event": "stt_call",
  "treatment_version": "v7",
  "detected_language": "en",
  "avg_no_speech_prob": 0.12,
  "avg_logprob": -0.34,
  "duration_sec": 2.83,
  "word_count": 7,
  "domain_bias_applied": true,
  "hallucination_filtered": false,
  "hallucination_reason": null,
  "model": "gpt-4o-mini-transcribe",
  "processing_time_ms": 540,
  "retry_count": 0
}
```

### `stt_hallucination_filtered`

Emitted in addition to `stt_call` whenever a hallucination gate fires.

```json
{
  "event": "stt_hallucination_filtered",
  "reason": "high_no_speech_prob: 0.742",
  "detected_language": "en",
  "avg_no_speech_prob": 0.742,
  "avg_logprob": -0.21,
  "duration": 2.1,
  "word_count": 5,
  "transcript_preview": "thanks for watching",
  "model": "gpt-4o-mini-transcribe"
}
```

### `stt_retry`

Emitted when the OpenAI STT call is retried once due to a transient failure (US-010).

```json
{ "event": "stt_retry", "model": "gpt-4o-mini-transcribe", "reason": "AbortError" }
```

### `stt_verbose_json_unsupported`

Emitted when the selected STT model doesn't support `response_format: 'verbose_json'` and the
route falls back to plain `json` (gates 2/3/4 are skipped for that call).

```json
{ "event": "stt_verbose_json_unsupported", "model": "gpt-4o-mini-transcribe" }
```

### `tts_call`

Emitted by `app/api/tts/route.ts::synthesizeWithOpenAI` on every OpenAI TTS response.

```json
{
  "event": "tts_call",
  "treatment_version": "v7",
  "text_length": 142,
  "voice": "shimmer",
  "model": "gpt-4o-mini-tts",
  "retry_count": 0,
  "fallback_used": false,
  "processing_time_ms": 620
}
```

## Rollup queries

These assume a tool that parses JSON log lines (e.g. `jq`, Loki LogQL, Datadog facets).

### `hallucination_rate`

```
hallucination_rate
  = sum(event='stt_call' AND hallucination_filtered=true)
  / count(event='stt_call')
```

Target: < 1% on a representative user sample. Alert > 5% over a 10-minute window.

### `p95_stt_latency_ms`

```
p95_stt_latency_ms = percentile(event='stt_call'.processing_time_ms, 0.95)
```

Target: < 1500 ms. Alert > 3000 ms sustained.

### `p95_tts_latency_ms`

```
p95_tts_latency_ms = percentile(event='tts_call'.processing_time_ms, 0.95)
```

Target: < 2000 ms. Alert > 5000 ms sustained.

### `tts_fallback_rate`

```
tts_fallback_rate
  = sum(event='tts_call' AND fallback_used=true)
  / count(event='tts_call')
```

Target: < 0.5%. Alert > 5% sustained (suggests primary model outage).

### `stt_retry_rate`

```
stt_retry_rate
  = sum(event='stt_call' AND retry_count > 0)
  / count(event='stt_call')
```

Target: < 1%. Alert > 5% sustained.

### `stt_verbose_json_fallback_rate`

```
stt_verbose_json_fallback_rate
  = count(event='stt_verbose_json_unsupported')
  / count(event='stt_call')
```

Should be 0. Any non-zero value means the selected STT model has dropped `verbose_json`
support and the metadata gates are effectively disabled — investigate immediately.

## Dashboard skeleton

A minimal ops dashboard should show these as time-series:

1. `stt_call` rate (per minute)
2. `hallucination_rate` (per minute, 10-min rolling)
3. `p95_stt_latency_ms`
4. `tts_call` rate (per minute)
5. `p95_tts_latency_ms`
6. `tts_fallback_rate`
7. `stt_retry_rate`

And these as single-value tiles with thresholds:

- 24h `hallucination_rate`
- 24h `tts_fallback_rate`
- 24h `stt_retry_rate`

## Privacy notes

`transcript_preview` is bounded to 80 characters and is only emitted on hallucination-filtered
calls (i.e. by design never contains a meaningful user utterance — filtered transcripts are
discarded before reaching the client). For further privacy hardening, route these logs to a
server-only sink and exclude them from user-facing product analytics.
