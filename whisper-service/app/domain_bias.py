"""
Domain bias strings for Mind Shifting treatment sessions (faster-whisper).

initial_prompt nudges the decoder toward brief, first-person therapeutic vocabulary
and away from generic internet-video phrasing. hotwords boosts session-specific
terms without forcing output shape.

See: https://github.com/SYSTRAN/faster-whisper — initial_prompt, hotwords
"""

import re
from typing import Optional, Tuple

# Short base: same register as v5 scripted prompts (brief, embodied, first person).
_BASE_PROMPT = (
    "A guided therapy session in English. The speaker answers briefly in first person. "
    "They may describe emotions, body sensations, thoughts, or mental images. "
)

# Mirrors lib/v5 expectedResponseType values used in the web client.
_TYPE_PROMPTS: dict[str, str] = {
    "yesno": (
        "Typical short answers include: yes, no, still, correct, that's right, "
        "not really, maybe, I think so, not yet."
    ),
    "feeling": (
        "They often name feelings and sensations: calm, anxious, fear, relief, sadness, "
        "anger, tension, tightness, lightness, heaviness, warmth, cold."
    ),
    "experience": (
        "They describe what happens in themselves when they feel something: breathing, "
        "tension, relaxation, thoughts, shifts in the body."
    ),
    "open": (
        "Brief, open answers about what they notice, need, or what could change."
    ),
    "problem": (
        "Short phrases in their own words naming the problem or situation."
    ),
    "description": (
        "A few words describing the problem, goal, or experience they want to work on."
    ),
    "goal": (
        "Short phrases about goals or desired outcomes."
    ),
    "selection": (
        "They may say numbers or words like one, two, three, first, second, or choose an option."
    ),
    "auto": (
        "Very short replies or minimal acknowledgment before the next question."
    ),
    "method": (
        "They may refer to problem shifting, belief shifting, identity, blockage, reality, or trauma work."
    ),
}

# Optional extra nudge for high-traffic step IDs (v5).
_STEP_PROMPT_SUFFIX: dict[str, str] = {
    "check_if_still_problem": " Often yes or no about whether something still feels like a problem.",
    "confirm_statement": " Often yes or no confirming a restated problem or goal.",
    "analyze_response": " Often yes or no confirming what was heard.",
    "goal_deadline_check": " Often yes or no about a deadline.",
    "goal_confirmation": " Often confirmation of a goal statement.",
}


def sanitize_hotwords(raw: Optional[str], max_len: int = 500) -> Optional[str]:
    """Strip control chars and cap length so form fields cannot blow up the decoder."""
    if not raw or not str(raw).strip():
        return None
    s = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", str(raw))
    s = " ".join(s.split())
    if len(s) > max_len:
        s = s[:max_len].rsplit(" ", 1)[0] if " " in s[:max_len] else s[:max_len]
    return s or None


def build_domain_prompt(
    expected_response_type: Optional[str],
    current_step: Optional[str],
) -> str:
    """
    Build initial_prompt for faster-whisper from session UI context.

    Falls back to 'open' when type is missing or unknown.
    """
    key = (expected_response_type or "open").strip().lower()
    if key not in _TYPE_PROMPTS:
        key = "open"
    text = _BASE_PROMPT + _TYPE_PROMPTS[key]
    step = (current_step or "").strip()
    if step and step in _STEP_PROMPT_SUFFIX:
        text = text + _STEP_PROMPT_SUFFIX[step]
    return text


def resolve_bias(
    expected_response_type: Optional[str],
    current_step: Optional[str],
    hotwords: Optional[str],
) -> Tuple[Optional[str], Optional[str]]:
    """
    Returns (initial_prompt, hotwords_or_none) for model.transcribe().

    When all inputs are empty, returns (None, None) so decoding matches
    pre–domain-bias behavior for legacy clients that only upload audio.
    """
    hw = sanitize_hotwords(hotwords)
    ert = (expected_response_type or "").strip()
    step = (current_step or "").strip()
    if not ert and not step and not hw:
        return None, None
    prompt = build_domain_prompt(ert or None, step or None)
    return prompt, hw


def cache_bias_key(
    expected_response_type: Optional[str],
    current_step: Optional[str],
    hotwords: Optional[str],
) -> str:
    """Stable string for Redis cache key suffix (same audio + different bias => different cache entry)."""
    hw = sanitize_hotwords(hotwords) or ""
    return f"{expected_response_type or ''}|{current_step or ''}|{hw}"
