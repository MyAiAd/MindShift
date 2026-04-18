---
name: prefer-ai-over-regex-for-nlp
description: User prefers LLM calls over regex for natural language processing tasks — regex can't cover English permutations
type: feedback
---

When facing natural language parsing tasks (e.g., detecting deadlines in goal statements), prefer LLM calls over regex solutions. User's reasoning: "there is no way we can expect a regex to know the entire permutation set of the English language. An LLM would shine here."

**Why:** Regex-based approaches fail on edge cases and produce bugs (duplicate words, missed patterns, lost data). The cost of a gpt-4o-mini call (~$0.0002) is negligible compared to the UX damage from broken sentences.

**How to apply:** When a task involves understanding, extracting, or recombining natural language input, default to proposing an LLM solution. Keep regex only as a fallback for when the LLM is unavailable (timeout, no API key).
