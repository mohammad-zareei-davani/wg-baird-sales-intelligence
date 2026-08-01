"""Checks that generated prose only ever quotes figures we computed.

A language model writing about numbers will occasionally round, restate or
simply invent one. In a board report that is the difference between a useful
document and a dangerous one, so nothing the model writes is trusted on the
numbers.

The rule is deliberately blunt: every numeric token in the generated text
must appear in the set of figures the analytics produced for that insight. A
single unrecognised number rejects the whole brief and the deterministic
template is used instead. Rejecting is cheap; publishing a wrong figure is
not.
"""
from __future__ import annotations

import re

# Matches the number-like tokens that can appear in this copy: currency
# amounts, percentages, compact forms such as 1.3M or 759k, plain integers
# and decimals, with or without thousands separators.
_NUMERIC_TOKEN = re.compile(
    r"""
    (?<![A-Za-z0-9_])     # not digits inside an identifier such as CUST_011
    (?:£|€|\$)?           # optional currency symbol
    \d[\d,]*              # leading digits, possibly grouped
    (?:\.\d+)?            # optional decimal part
    (?:\s?[MmKk]\b)?      # optional compact suffix
    %?                    # optional percent sign
    (?![A-Za-z0-9_])      # nor the leading part of one such as JOB_00413
    """,
    re.VERBOSE,
)

# Words that read as quantities and would let the model imply a figure that
# was never computed.
_VAGUE_QUANTIFIERS = re.compile(
    r"\b(?:roughly|approximately|about|nearly|almost|around|circa|some)\s+"
    r"(?:£|€|\$)?\d",
    re.IGNORECASE,
)

_BANNED_CHARS = {"—"}  # em dash, per house style


def _canonical(token: str) -> str:
    """Reduce a numeric token to a comparable form.

    "£1,452,429", "1452429" and "£1,452,429.00" should all be treated as the
    same figure, so comparison is done on digits alone plus any percent or
    compact marker that changes the meaning.
    """
    t = token.strip().lower().replace(",", "").replace(" ", "")
    t = t.lstrip("£€$")
    is_pct = t.endswith("%")
    t = t.rstrip("%")
    suffix = ""
    if t and t[-1] in {"m", "k"}:
        suffix = t[-1]
        t = t[:-1]
    if t.endswith(".0"):
        t = t[:-2]
    # Drop a trailing zero decimal so 22.50 and 22.5 match.
    if "." in t:
        t = t.rstrip("0").rstrip(".")
    return f"{t}{suffix}{'%' if is_pct else ''}"


def allowed_tokens(values: list[str]) -> set[str]:
    """Build the set of figures the model is permitted to quote."""
    allowed: set[str] = set()
    for value in values:
        if value is None:
            continue
        for match in _NUMERIC_TOKEN.findall(str(value)):
            if any(ch.isdigit() for ch in match):
                allowed.add(_canonical(match))
    return allowed


def _walk_strings(node) -> list[str]:
    """Every string anywhere in a nested structure."""
    if isinstance(node, str):
        return [node]
    if isinstance(node, dict):
        return [s for v in node.values() for s in _walk_strings(v)]
    if isinstance(node, (list, tuple)):
        return [s for v in node for s in _walk_strings(v)]
    if isinstance(node, (int, float)):
        return [str(node)]
    return []


def allowed_from_brief(brief: dict) -> set[str]:
    """Figures permitted in generated prose, taken from the computed brief.

    Every number in the computed brief came out of the analytics, so the
    whole brief is the correct source of truth rather than a hand-picked
    subset. Anything outside it was invented.
    """
    return allowed_tokens(_walk_strings(brief))


def find_violations(text: str, allowed: set[str]) -> list[str]:
    """Return the numeric tokens in `text` that were not supplied to the model."""
    violations = []
    for match in _NUMERIC_TOKEN.findall(text or ""):
        if not any(ch.isdigit() for ch in match):
            continue
        canon = _canonical(match)
        if not canon:
            continue
        # Small standalone integers are ordinary prose ("two accounts",
        # "the next 60 days" when 60 was supplied) and are only allowed if
        # they were provided.
        if canon not in allowed:
            violations.append(match.strip())
    return violations


_IMPERATIVE_OPENERS = (
    "feed ", "review ", "set ", "agree ", "implement ", "adjust ", "investigate ",
    "put ", "start ", "use ", "turn ", "move ", "check ", "give ", "run ", "make ",
)


def check_quality(brief: dict) -> list[str]:
    """Reject generated copy that is thinner than the template it replaces.

    Generation is only worth having if it is at least as good as the
    deterministic version. These checks catch the specific ways a small model
    degrades this format: instructions in the explanation, table descriptions
    that parrot the number beside them, and one-line actions with no reasoning.
    """
    problems: list[str] = []

    hero = brief.get("hero") or {}
    body = (hero.get("body") or "").strip()
    caption = (hero.get("caption") or "").strip()
    value = (hero.get("value") or "").strip()
    if len(body) < 180:
        problems.append("hero.body: too thin to be a finding")
    if body.lower().startswith(_IMPERATIVE_OPENERS):
        problems.append("hero.body: gives instructions instead of explaining")
    # Caption finishes the sentence the headline figure starts. Restating the
    # figure itself leaves two identical lines on the executive briefing.
    if not caption or caption == value or not re.search(r"[A-Za-z]", caption):
        problems.append("hero.caption: must finish the headline figure in words, not repeat it")

    for i, r in enumerate((brief.get("breakdown") or {}).get("rows") or []):
        desc = (r.get("description") or "").strip()
        value = (r.get("value") or "").strip()
        share = (r.get("share") or "").strip()
        if len(desc.split()) < 3:
            problems.append(f"breakdown.rows[{i}]: description says nothing")
        # A description containing the figure beside it is restating, not
        # explaining. Only applied to actual figures: these columns often hold
        # text labels such as "Good" or "Monitor", and a description is
        # perfectly entitled to use those words.
        def _is_figure(text: str) -> bool:
            return any(ch.isdigit() for ch in text)

        if value and _is_figure(value) and value in desc:
            problems.append(f"breakdown.rows[{i}]: description repeats its own figure")
        elif share and _is_figure(share) and share in desc:
            problems.append(f"breakdown.rows[{i}]: description repeats its own share")

    for i, a in enumerate((brief.get("actions") or {}).get("items") or []):
        if len((a.get("body") or "").strip()) < 90:
            problems.append(f"actions.items[{i}]: no reasoning behind the action")
        if not (a.get("title") or "").strip():
            problems.append(f"actions.items[{i}]: missing title")

    return problems


def check_brief(brief: dict, allowed: set[str]) -> list[str]:
    """Validate an entire generated brief. Empty list means it is safe to use."""
    problems: list[str] = []

    def scan(label: str, text: str | None) -> None:
        if not text:
            return
        for ch in _BANNED_CHARS:
            if ch in text:
                problems.append(f"{label}: contains a banned character")
        if _VAGUE_QUANTIFIERS.search(text):
            problems.append(f"{label}: hedged a figure with an approximation")
        bad = find_violations(text, allowed)
        if bad:
            problems.append(f"{label}: quotes figures not in the data ({', '.join(bad[:4])})")

    scan("title", brief.get("title"))

    hero = brief.get("hero") or {}
    scan("hero.caption", hero.get("caption"))
    scan("hero.body", hero.get("body"))

    for i, m in enumerate(brief.get("metrics") or []):
        scan(f"metrics[{i}].label", m.get("label"))
        scan(f"metrics[{i}].sublabel", m.get("sublabel"))

    breakdown = brief.get("breakdown") or {}
    scan("breakdown.title", breakdown.get("title"))
    for i, r in enumerate(breakdown.get("rows") or []):
        scan(f"breakdown.rows[{i}].description", r.get("description"))

    actions = brief.get("actions") or {}
    scan("actions.title", actions.get("title"))
    for i, a in enumerate(actions.get("items") or []):
        scan(f"actions.items[{i}].title", a.get("title"))
        scan(f"actions.items[{i}].badge", a.get("badge"))
        scan(f"actions.items[{i}].body", a.get("body"))

    return problems
