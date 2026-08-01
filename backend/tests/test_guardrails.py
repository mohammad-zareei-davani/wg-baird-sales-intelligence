"""Tests for the numeric guardrails on generated narrative.

These matter more than the usual unit test: they are what stops a fabricated
figure reaching a board pack. Each case is a way a language model realistically
goes wrong.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.llm.guardrails import (  # noqa: E402
    allowed_from_brief,
    check_brief,
    check_quality,
    find_violations,
)


COMPUTED = {
    "title": "Where Your Value Actually Comes From",
    "metrics": [
        {"label": "Top two accounts", "value": "22.5%", "sublabel": "CUST_011 and CUST_024 combined"},
        {"label": "Clearly ahead", "value": "4", "sublabel": "Holding 31.6% between them"},
        {"label": "Accounts for 80%", "value": "29", "sublabel": "Of 50 customers"},
    ],
    "hero": {
        "value": "22.5%",
        "caption": "of value added sits with two accounts",
        "body": "CUST_011 at 11.4% and CUST_024 at 11.1% are level, 2.6% apart.",
    },
    "breakdown": {
        "title": "Value added by type of work",
        "columns": ["Work type", "What it covers", "Value added", "Share"],
        "rows": [
            {"category": "Litho", "description": "Offset presses", "value": "£12.3M", "share": "97%"},
        ],
    },
    "actions": {
        "title": "How to protect this",
        "items": [
            {"title": "Name an owner", "badge": "Free: one meeting", "tone": "free",
             "body": "These accounts carry 22.5% of value added."},
        ],
    },
}

# Exactly how the writer builds it: every figure in the computed brief.
ALLOWED = allowed_from_brief(COMPUTED)


def _brief_with(**overrides):
    """Deep-copy the computed brief with dotted-path fields replaced."""
    import copy
    b = copy.deepcopy(COMPUTED)
    for path, value in overrides.items():
        parts = path.split(".")
        target = b
        for p in parts[:-1]:
            target = target[int(p)] if p.isdigit() else target[p]
        last = parts[-1]
        if last.isdigit():
            target[int(last)] = value
        else:
            target[last] = value
    return b


def test_faithful_text_passes():
    problems = check_brief(COMPUTED, ALLOWED)
    assert problems == [], problems


def test_invented_figure_is_caught():
    bad = _brief_with(**{"hero.body": "The top two accounts hold 48.9% of value added."})
    problems = check_brief(bad, ALLOWED)
    assert problems, "a fabricated percentage must be rejected"
    assert "48.9%" in problems[0]


def test_silently_rounded_figure_is_caught():
    # 22.5% quietly becoming 23% is the most likely real-world failure.
    bad = _brief_with(**{"hero.body": "Two accounts hold 23% of value added."})
    assert check_brief(bad, ALLOWED), "a rounded figure must be rejected"


def test_invented_currency_amount_is_caught():
    bad = _brief_with(**{"actions.items.0.body": "That is worth £4.2M a year."})
    assert check_brief(bad, ALLOWED), "a fabricated money amount must be rejected"


def test_hedged_figure_is_caught():
    bad = _brief_with(**{"hero.body": "Roughly £12.3M sits in litho work."})
    problems = check_brief(bad, ALLOWED)
    assert any("approximation" in p for p in problems), problems


def test_em_dash_is_caught():
    bad = _brief_with(**{"hero.caption": "value added — two accounts"})
    problems = check_brief(bad, ALLOWED)
    assert any("banned character" in p for p in problems), problems


def test_equivalent_formats_are_accepted():
    # Same figure written differently should not trip the check.
    assert not find_violations("22.50%", ALLOWED)
    assert not find_violations("£12.3M and 97%", ALLOWED)


def test_row_description_is_scanned():
    bad = _brief_with()
    bad["breakdown"]["rows"][0]["description"] = "Offset presses, 61% of jobs"
    assert check_brief(bad, ALLOWED), "figures in table descriptions must be checked too"


def test_caption_repeating_headline_figure_is_caught():
    bad = _brief_with(**{"hero.caption": "22.5%"})
    problems = check_quality(bad)
    assert any("hero.caption" in p for p in problems), problems


if __name__ == "__main__":
    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"  pass  {name}")
            except AssertionError as exc:
                failures += 1
                print(f"  FAIL  {name}: {exc}")
    print(f"\n{'all guardrail tests passed' if not failures else f'{failures} failed'}")
    sys.exit(1 if failures else 0)
