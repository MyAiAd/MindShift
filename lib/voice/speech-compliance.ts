import { ROUTING_TOKENS } from '../v7/routing-tokens';

export type SpeechComplianceResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'routing_token' | 'message_mismatch';
      details: string;
      token?: string;
    };

export function normalizeSpeechText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function detectRoutingToken(text: string): string | null {
  const trimmed = text.trim();
  const upper = trimmed.toUpperCase();

  for (const token of ROUTING_TOKENS) {
    if (upper === token) {
      return token;
    }
    if (upper.includes(token)) {
      return token;
    }
  }

  return null;
}

export function validateSpeechOutput(options: {
  textToSpeak: string;
  apiMessage?: string | null;
}): SpeechComplianceResult {
  const { textToSpeak, apiMessage } = options;
  const detectedToken = detectRoutingToken(textToSpeak);

  if (detectedToken) {
    return {
      ok: false,
      reason: 'routing_token',
      token: detectedToken,
      details: `Detected internal routing token "${detectedToken}" in speech output.`,
    };
  }

  if (typeof apiMessage === 'string') {
    const normalizedSpeech = normalizeSpeechText(textToSpeak);
    const normalizedMessage = normalizeSpeechText(apiMessage);

    if (normalizedSpeech !== normalizedMessage) {
      return {
        ok: false,
        reason: 'message_mismatch',
        details:
          `Speech output does not match the server message. ` +
          `speech="${normalizedSpeech}" api="${normalizedMessage}"`,
      };
    }
  }

  return { ok: true };
}
