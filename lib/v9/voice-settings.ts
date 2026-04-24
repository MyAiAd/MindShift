import { createServerClient } from '@/lib/database-server';
import {
  V9_STT_PROVIDER,
  V9_TTS_PROVIDER,
  type V9SttProvider,
  type V9TtsProvider,
} from '@/lib/voice/speech-config';

/**
 * V9 voice-pair selection backed by the `system_voice_settings`
 * singleton row (migration 062).
 *
 * Precedence for runtime resolution:
 *
 *   1. DB singleton row (written via the admin UI;
 *      `app/api/admin/voice-settings/route.ts`). This is the
 *      authoritative source of truth in any deploy that has had a
 *      super_admin visit the settings page.
 *   2. Environment variables `V9_STT_PROVIDER` / `V9_TTS_PROVIDER`
 *      (useful for CI, for fresh installs before an admin has opened
 *      the UI, and for pinning a specific test deploy).
 *   3. Hard-coded default: `openai` for both sides.
 *
 * In-flight sessions must NEVER be affected by changes to this
 * setting. The V9 route-handlers read this module once at session
 * start, write the resolved pair onto `context.metadata.voicePair`,
 * and thereafter read exclusively from that pinned metadata. See
 * `lib/v9/core.ts#v9HandleStartSession` for the pinning call site.
 */

export interface VoicePair {
  stt: V9SttProvider;
  tts: V9TtsProvider;
}

export interface VoicePairWithAudit extends VoicePair {
  /** Whether this pair came from the DB singleton (`true`) or from
   *  the env/default fallback chain (`false`). */
  fromDatabase: boolean;
  /** Wall-clock of the last admin write, if the pair came from DB. */
  updatedAt?: string;
  /** Super_admin user id of the last writer, if the pair came from DB. */
  updatedBy?: string | null;
}

const DB_TABLE = 'system_voice_settings';
const DB_ROW_ID = 1;

function envFallback(): VoicePair {
  return {
    stt: V9_STT_PROVIDER,
    tts: V9_TTS_PROVIDER,
  };
}

function sanitizeStt(value: unknown): V9SttProvider {
  return value === 'whisper-local' || value === 'openai' ? value : 'openai';
}

function sanitizeTts(value: unknown): V9TtsProvider {
  return value === 'elevenlabs' || value === 'kokoro' || value === 'openai'
    ? value
    : 'openai';
}

/**
 * Read the current voice pair, falling back through
 * DB → env → default. This call must be cheap: the V9 route invokes
 * it on every new session start.
 */
export async function getVoicePair(): Promise<VoicePairWithAudit> {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from(DB_TABLE)
      .select('stt_provider, tts_provider, updated_at, updated_by')
      .eq('id', DB_ROW_ID)
      .maybeSingle();

    if (error) {
      console.warn(
        '[voice-settings] DB read failed, falling back to env:',
        error.message,
      );
      return { ...envFallback(), fromDatabase: false };
    }

    if (!data) {
      return { ...envFallback(), fromDatabase: false };
    }

    return {
      stt: sanitizeStt(data.stt_provider),
      tts: sanitizeTts(data.tts_provider),
      fromDatabase: true,
      updatedAt: data.updated_at ?? undefined,
      updatedBy: (data.updated_by as string | null) ?? null,
    };
  } catch (err) {
    console.warn(
      '[voice-settings] unexpected error reading DB, falling back to env:',
      err instanceof Error ? err.message : err,
    );
    return { ...envFallback(), fromDatabase: false };
  }
}

/**
 * Admin write-path. The underlying RLS policy (migration 062)
 * restricts this to `super_admin` — the API route layer does its own
 * role check as belt-and-suspenders. Both checks must pass for a
 * write to succeed.
 */
export async function setVoicePair(
  pair: VoicePair,
  updatedBy: string,
): Promise<VoicePairWithAudit> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from(DB_TABLE)
    .update({
      stt_provider: pair.stt,
      tts_provider: pair.tts,
      updated_by: updatedBy,
    })
    .eq('id', DB_ROW_ID)
    .select('stt_provider, tts_provider, updated_at, updated_by')
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to persist voice settings: ${error?.message ?? 'unknown error'}`,
    );
  }

  return {
    stt: sanitizeStt(data.stt_provider),
    tts: sanitizeTts(data.tts_provider),
    fromDatabase: true,
    updatedAt: data.updated_at ?? undefined,
    updatedBy: (data.updated_by as string | null) ?? null,
  };
}
