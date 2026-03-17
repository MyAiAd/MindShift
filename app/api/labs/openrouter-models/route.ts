import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import { getUserOpenRouterKey } from '@/lib/server/labs-openrouter-key';

interface OpenRouterModel {
  id: string;
  name: string;
  architecture?: {
    output_modalities?: string[];
  };
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

    const apiKey = await getUserOpenRouterKey(supabase, user.id);
    if (!apiKey) {
      return NextResponse.json({ error: 'No API key configured', models: [] }, { status: 200 });
    }

    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('openrouter-models fetch failed:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch models from OpenRouter', models: [] },
        { status: 502 }
      );
    }

    const payload = await response.json();
    const models: OpenRouterModel[] = Array.isArray(payload?.data) ? payload.data : [];

    const normalized = models
      .filter((model) => {
        const modalities = model.architecture?.output_modalities ?? [];
        return modalities.length === 0 || modalities.includes('text');
      })
      .map((model) => ({
        id: model.id,
        name: model.name || model.id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ models: normalized });
  } catch (error) {
    console.error('openrouter-models GET error:', error);
    return NextResponse.json({ error: 'Internal server error', models: [] }, { status: 500 });
  }
}

