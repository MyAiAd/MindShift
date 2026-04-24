import type { TtsCostMetrics, TtsProviderId } from '@/lib/voice/tts-providers';

/**
 * Per-session TTS cost instrumentation.
 *
 * Aggregates cost data across TTS calls so the Phase 4 provider A/B test
 * can answer: "what would this session have cost on each provider?"
 *
 * This is deliberately in-memory. Persisting sessions across processes
 * is the job of the existing treatment_sessions / treatment_interactions
 * tables; the metrics aggregator is just a running tally per live
 * session. The voice adapter and /turn route both call into it.
 *
 * Instrumentation is also emitted as structured log lines in
 * lib/v9/voice-adapter.ts so that aggregation in a log sink (Loki /
 * CloudWatch / etc) does not depend on process lifetime.
 */

export interface TtsCostSample {
  provider: TtsProviderId;
  voice: string;
  characters: number;
  estimatedUsd: number;
  latencyMs: number;
  totalMs: number;
  stepId?: string;
  timestamp: number;
}

export interface TtsCostTotals {
  calls: number;
  characters: number;
  estimatedUsd: number;
  avgLatencyMs: number;
  avgTotalMs: number;
}

interface SessionRecord {
  samples: TtsCostSample[];
  perProvider: Partial<Record<TtsProviderId, TtsCostTotals>>;
  lastUpdated: number;
}

const sessions = new Map<string, SessionRecord>();

function emptyTotals(): TtsCostTotals {
  return {
    calls: 0,
    characters: 0,
    estimatedUsd: 0,
    avgLatencyMs: 0,
    avgTotalMs: 0,
  };
}

function accumulate(totals: TtsCostTotals, sample: TtsCostSample): TtsCostTotals {
  const nextCalls = totals.calls + 1;
  return {
    calls: nextCalls,
    characters: totals.characters + sample.characters,
    estimatedUsd: totals.estimatedUsd + sample.estimatedUsd,
    avgLatencyMs:
      (totals.avgLatencyMs * totals.calls + sample.latencyMs) / nextCalls,
    avgTotalMs:
      (totals.avgTotalMs * totals.calls + sample.totalMs) / nextCalls,
  };
}

export function recordTtsCost(
  sessionId: string | undefined,
  provider: TtsProviderId,
  voice: string,
  stepId: string | undefined,
  cost: TtsCostMetrics,
): TtsCostSample {
  const sample: TtsCostSample = {
    provider,
    voice,
    characters: cost.characters,
    estimatedUsd: cost.estimatedUsd,
    latencyMs: cost.latencyMs,
    totalMs: cost.totalMs,
    stepId,
    timestamp: Date.now(),
  };

  if (!sessionId) return sample;

  const existing = sessions.get(sessionId) ?? {
    samples: [],
    perProvider: {},
    lastUpdated: Date.now(),
  };

  existing.samples.push(sample);
  existing.perProvider[provider] = accumulate(
    existing.perProvider[provider] ?? emptyTotals(),
    sample,
  );
  existing.lastUpdated = Date.now();
  sessions.set(sessionId, existing);

  return sample;
}

export function getTtsCostSummary(sessionId: string):
  | {
      sessionId: string;
      samples: TtsCostSample[];
      perProvider: Partial<Record<TtsProviderId, TtsCostTotals>>;
      lastUpdated: number;
    }
  | null {
  const record = sessions.get(sessionId);
  if (!record) return null;
  return { sessionId, ...record };
}

export function listTtsCostSessions(): string[] {
  return Array.from(sessions.keys());
}

/**
 * Evict sessions that have not been updated in the last `maxAgeMs`
 * milliseconds. Call from a scheduled task if the process is long-lived.
 */
export function evictStaleTtsCostSessions(maxAgeMs: number): number {
  const cutoff = Date.now() - maxAgeMs;
  let evicted = 0;
  for (const [id, record] of sessions.entries()) {
    if (record.lastUpdated < cutoff) {
      sessions.delete(id);
      evicted += 1;
    }
  }
  return evicted;
}

/** For tests only. */
export function __resetTtsCostMetrics(): void {
  sessions.clear();
}
