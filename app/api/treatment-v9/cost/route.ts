import { NextRequest, NextResponse } from 'next/server';
import { getTtsCostSummary } from '@/lib/v9/tts-cost-metrics';
import { createServerClient } from '@/lib/database-server';

/**
 * V9 per-session TTS cost summary endpoint.
 *
 * Returns the running totals (calls, characters, estimated USD, avg
 * latency) for every provider that has been used in this session. This
 * is what the Phase 4 A/B experiment uses to decide which provider
 * actually wins on price at real-world session lengths.
 *
 * Query:
 *   GET /api/treatment-v9/cost?sessionId=...&userId=...
 */

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const userId = searchParams.get('userId');

  if (!sessionId || !userId) {
    return NextResponse.json(
      { error: 'sessionId and userId are required' },
      { status: 400 },
    );
  }

  try {
    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && user.id !== userId) {
      return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 });
    }
  } catch {
    // lenient auth — consistent with main v9 route
  }

  const summary = getTtsCostSummary(sessionId);
  if (!summary) {
    return NextResponse.json({
      sessionId,
      samples: [],
      perProvider: {},
      lastUpdated: null,
      note: 'No TTS calls recorded for this session yet.',
    });
  }

  return NextResponse.json(summary);
}
