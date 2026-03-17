import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import { upsertUserOpenRouterKey } from '@/lib/server/labs-openrouter-key';

function isLikelyOpenRouterKey(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith('sk-or-') || trimmed.startsWith('sk_');
}

export async function GET() {
  try {
    const supabase = createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('user_labs_openrouter_keys')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('labs-openrouter-key GET query error:', error);
      return NextResponse.json({ error: 'Failed to check key status' }, { status: 500 });
    }

    return NextResponse.json({ hasKey: !!data });
  } catch (error) {
    console.error('labs-openrouter-key GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const rawApiKey = typeof body?.apiKey === 'string' ? body.apiKey : '';
    const apiKey = rawApiKey.trim();

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    if (!isLikelyOpenRouterKey(apiKey)) {
      return NextResponse.json({ error: 'Invalid API key format' }, { status: 400 });
    }

    await upsertUserOpenRouterKey(supabase, user.id, apiKey);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('labs-openrouter-key POST error:', error);
    return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 });
  }
}

