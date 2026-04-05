"""Unit tests for Mind Shifting Whisper domain bias helpers (stdlib unittest)."""
import unittest

from app.domain_bias import (
    build_domain_prompt,
    resolve_bias,
    cache_bias_key,
    sanitize_hotwords,
)


class DomainBiasTests(unittest.TestCase):
    def test_resolve_bias_empty_returns_none(self):
        p, h = resolve_bias(None, None, None)
        self.assertIsNone(p)
        self.assertIsNone(h)

    def test_resolve_bias_yesno(self):
        p, h = resolve_bias("yesno", None, None)
        self.assertIsNotNone(p)
        self.assertTrue("yes" in p.lower() or "no" in p.lower())
        self.assertIsNone(h)

    def test_resolve_bias_with_hotwords(self):
        p, h = resolve_bias("open", None, "anxiety presentation")
        self.assertIsNotNone(p)
        self.assertEqual(h, "anxiety presentation")

    def test_sanitize_hotwords_strips_control(self):
        self.assertEqual(sanitize_hotwords("hello\x00world"), "helloworld")
        self.assertEqual(sanitize_hotwords("too   many   spaces"), "too many spaces")

    def test_cache_bias_key_stable(self):
        a = cache_bias_key("yesno", "check_if_still_problem", "foo")
        b = cache_bias_key("yesno", "check_if_still_problem", "foo")
        self.assertEqual(a, b)
        self.assertNotEqual(cache_bias_key("feeling", None, None), a)

    def test_step_suffix_check_if_still(self):
        p = build_domain_prompt("yesno", "check_if_still_problem")
        self.assertIn("problem", p.lower())


if __name__ == "__main__":
    unittest.main()
