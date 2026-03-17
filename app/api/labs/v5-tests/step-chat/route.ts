import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';
import OpenAI from 'openai';
import { getUserOpenRouterKey } from '@/lib/server/labs-openrouter-key';

export async function POST(request: NextRequest) {
  const supabase = createServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    stepContext: {
      stepLabel: string;
      userInput: string;
      actualMessage: string;
      expectedStep: string;
      actualStep: string;
    };
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    model?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { stepContext, messages, model } = body;
  const openRouterKey = await getUserOpenRouterKey(supabase, user.id);
  if (!openRouterKey) {
    return NextResponse.json(
      { error: 'OpenRouter API key required. Add it in Settings > API Keys.' },
      { status: 400 }
    );
  }

  const systemPrompt = `You are a protocol review assistant for a therapeutic treatment app called MindShifting.
A doctor is reviewing a V5 treatment session script step-by-step.

STEP CONTEXT:
- Step label: ${stepContext.stepLabel}
- User input was: "${stepContext.userInput}"
- Expected step name: ${stepContext.expectedStep}
- Actual step name returned: ${stepContext.actualStep}
- The system responded with: "${stepContext.actualMessage}"

Your job: help the doctor articulate exactly what the correct response text should be.
Use their exact therapeutic wording. Ask clarifying questions if needed.
Once you fully understand and are confident, output EXACTLY this on its own line
(and ONLY when confident — do not output it prematurely):
CORRECTION_CONFIRMED:{"correctedText":"<the exact correct response here>"}`;

  const openai = new OpenAI({
    apiKey: openRouterKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'https://mind-shift.click',
      'X-Title': 'MindShifting Labs V5',
    },
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        const completion = await openai.chat.completions.create({
          model: model || 'openai/gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
          ],
          stream: true,
        });

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content ?? '';
          if (delta) {
            controller.enqueue(encoder.encode(delta));
          }
        }
      } catch (err) {
        console.error('step-chat streaming error', err);
        controller.enqueue(encoder.encode('\n[Error: AI response failed]'));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
