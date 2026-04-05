/**
 * Context passed from the treatment UI to /api/transcribe so Whisper can apply
 * domain bias (initial_prompt + hotwords) aligned with v5 expectedResponseType.
 */
export type TranscriptionDomainContext = {
  /** From API `expectedResponseType` (e.g. yesno, feeling, open). */
  expectedResponseType: string | null;
  /** Current v5 step id for finer prompt nudges (e.g. check_if_still_problem). */
  currentStep: string | null;
  /**
   * Session vocabulary: recent user wording, problem phrases, names.
   * Server truncates and sanitizes; keep under ~500 chars client-side.
   */
  hotwords: string | null;
};

export function buildHotwordsFromRecentUserMessages(
  messages: Array<{ isUser: boolean; content: string }>,
  maxLen = 400
): string | null {
  const userTexts = messages
    .filter((m) => m.isUser && m.content?.trim())
    .slice(-3)
    .map((m) => m.content.trim());
  if (userTexts.length === 0) return null;
  const joined = userTexts.join(' ');
  if (joined.length <= maxLen) return joined;
  return joined.slice(0, maxLen).trim();
}
