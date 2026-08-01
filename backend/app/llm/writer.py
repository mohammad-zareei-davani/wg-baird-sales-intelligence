"""Generates the written part of each report for the dataset actually loaded.

The split of responsibility is the important bit. The analytics compute every
figure and decide which numbers matter; the model only chooses how to say it.
Concretely:

  * The prompt receives the computed brief and the figures already formatted
    as strings. The model is told to reuse those strings verbatim.
  * The response is validated by `guardrails`. Any figure that did not come
    from the analytics rejects the whole brief.
  * On rejection, timeout, missing key or any API error, the deterministic
    template is returned instead.

The result is prose that adapts to a new dataset without the numbers ever
depending on the model being careful.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from app import config
from app.llm.guardrails import allowed_from_brief, check_brief, check_quality

log = logging.getLogger("wgb.llm")

# Structure the model must return. Mirrors the brief the dashboard renders,
# minus every numeric field, which is carried over from the computed brief.
BRIEF_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["title", "metrics", "hero", "breakdown", "actions"],
    "properties": {
        "title": {"type": "string"},
        "metrics": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["label", "value", "sublabel"],
                "properties": {
                    "label": {"type": "string"},
                    "value": {"type": "string"},
                    "sublabel": {"type": "string"},
                },
            },
        },
        "hero": {
            "type": "object",
            "additionalProperties": False,
            "required": ["value", "caption", "body"],
            "properties": {
                "value": {"type": "string"},
                "caption": {"type": "string"},
                "body": {"type": "string"},
            },
        },
        "breakdown": {
            "type": "object",
            "additionalProperties": False,
            "required": ["title", "columns", "rows"],
            "properties": {
                "title": {"type": "string"},
                "columns": {"type": "array", "items": {"type": "string"}},
                "rows": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["category", "description", "value", "share"],
                        "properties": {
                            "category": {"type": "string"},
                            "description": {"type": "string"},
                            "value": {"type": "string"},
                            "share": {"type": "string"},
                        },
                    },
                },
            },
        },
        "actions": {
            "type": "object",
            "additionalProperties": False,
            "required": ["title", "items"],
            "properties": {
                "title": {"type": "string"},
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["title", "badge", "tone", "body"],
                        "properties": {
                            "title": {"type": "string"},
                            "badge": {"type": "string"},
                            "tone": {"type": "string", "enum": ["free", "low", "value", "watch"]},
                            "body": {"type": "string"},
                        },
                    },
                },
            },
        },
    },
}

SYSTEM_PROMPT = """\
You write the commentary for a sales-intelligence dashboard used by the board \
of W&G Baird, a commercial printing company in Northern Ireland producing \
educational books, magazines, brochures, catalogues and large-format work.

Your reader is a non-technical director. Write for them: short, precise, \
concrete, and about the business rather than about the chart. Never say "the \
chart shows" or "the data indicates". State what is true, what it means \
commercially, and what to do.

Hard rules:
1. Every figure you write MUST be copied exactly from the FIGURES list you \
are given. Do not compute, round, convert, combine or estimate any number. If \
a number is not in that list, do not write it.
2. Do not hedge figures with "roughly", "about", "approximately" or similar.
3. Never use an em dash. Use commas, semicolons, colons or separate sentences.
4. Keep the same number of metrics, breakdown rows and actions as the input, \
and keep every "value" and "share" string exactly as given.
5. Describe what the ranked figures actually look like. If two leaders are \
close, say both. Do not imply a gap that the figures do not support.
6. British English. No exclamation marks. No marketing language.

Length: hero body 3 to 4 sentences. Action bodies 2 to 3 sentences. Row \
descriptions at most 10 words. Badges at most 5 words, formatted like \
"Free: one meeting" or "Project: high payback".

What each field is for:
- title: states the finding itself, not the topic. "Margin Decided at the Point \
of Quoting", not "Pricing Analysis".
- hero.caption: finishes the sentence the headline figure starts.
- hero.body: EXPLAINS. What is true, why it matters commercially, what it \
implies. It is not a list of instructions; the actions cover those.
- breakdown row descriptions: say what that row MEANS in plain words. Never \
restate the figure that sits beside it. "Estimator priced below the calculated \
figure", not "Given away over the period".
- actions: each is a specific thing a person could start on Monday, with the \
reasoning behind it.

Worked example of the depth and voice expected. The subject is unrelated, so \
take the style and not the content:

{
  "title": "Stock Sitting Longer Than It Sells",
  "hero": {
    "caption": "of stock value has not moved in a year",
    "body": "Just over a third of stock by value has not moved in twelve \
months, and most of it sits in two product groups. Holding it costs warehouse \
space and ties up cash that the business is currently borrowing to replace. \
Nothing here is unsellable, but it is being held as though it were still \
current, and no one owns the decision to clear it."
  },
  "breakdown_row_example": {
    "row": "Slow-moving",
    "description": "Sold at least once, but not in the last year"
  },
  "action_example": {
    "title": "Set a clearance trigger at twelve months.",
    "badge": "Free: policy decision",
    "body": "Agree a rule that stock untouched for a year is offered at a \
discount automatically rather than by exception. That converts a standing \
judgement call into a routine, and it stops the oldest stock quietly becoming \
the largest holding."
  }
}

Write the commentary yourself. Do not restate the figures as descriptions, and \
do not put instructions in the hero body. The one thing you must not change is \
the numbers.
"""


def _figures_from(brief: dict) -> list[str]:
    """Collect every pre-formatted figure the model is allowed to quote."""
    out: list[str] = []
    hero = brief.get("hero") or {}
    out.append(str(hero.get("value", "")))
    for m in brief.get("metrics") or []:
        out.append(str(m.get("value", "")))
        out.append(str(m.get("sublabel", "")))
    for r in (brief.get("breakdown") or {}).get("rows") or []:
        out.append(str(r.get("value", "")))
        out.append(str(r.get("share", "")))
    for a in (brief.get("actions") or {}).get("items") or []:
        out.append(str(a.get("badge", "")))
    # The template prose itself is a legitimate source of figures, since it
    # was produced from the same computed values.
    out.append(str(hero.get("caption", "")))
    out.append(str(hero.get("body", "")))
    for a in (brief.get("actions") or {}).get("items") or []:
        out.append(str(a.get("body", "")))
    return [o for o in out if o]


# What each insight actually measures. The model needs this to write about
# the business rather than about a table of numbers, and it is deliberately
# factual: there is no prose here for it to copy.
AREA_NOTES = {
    "customer_value": (
        "Customers ranked by value added, meaning what the business keeps after paper, "
        "press and bought-in costs. The point is how concentrated that value is, which "
        "accounts stand apart from the field, and the commercial risk that creates."
    ),
    "pricing": (
        "The estimating system calculates a price which an estimator can override before "
        "the quote is sent. This measures how often that happens, how much is given away "
        "in reductions against uplifts, and which work was delivered below cost."
    ),
    "reorder": (
        "Most customers reorder on a rhythm. This derives each customer's normal gap "
        "between orders and flags who is overdue, who is due shortly, and the value that "
        "implies for the coming weeks."
    ),
    "churn": (
        "Customers rarely announce they are leaving; they stop calling. Silence is judged "
        "against each customer's own ordering habit, not one company-wide threshold, so "
        "quiet from a frequent buyer is treated differently from quiet from a rare one."
    ),
    "seasonality": (
        "Demand by month, and the press hours that demand consumes. The constraint in a "
        "printing business is press time, so the swing between busy and quiet months "
        "drives overtime at one end and idle fixed cost at the other."
    ),
    "delivery": (
        "Turnaround from the order being booked in to the job leaving the building. "
        "Products differ legitimately, so performance is judged per product against that "
        "product's own norm rather than one target for everything."
    ),
    "repeat_business": (
        "Titles printed more than once for the same customer. Reprint work is the most "
        "profitable revenue in a print business because origination is already done, and "
        "the most predictable because titles reprint on a cycle."
    ),
    "quote_guard": (
        "A model trained on completed jobs that predicts what comparable work has sold "
        "for, from specification and input costs only. It gives estimators a reference "
        "point and flags jobs sold well below the going rate."
    ),
    "churn_risk": (
        "A model predicting whether each account will order again within the look-ahead "
        "window, trained on earlier months and tested only on later ones. It ranks the "
        "call list rather than settling any single account."
    ),
    "data_quality": (
        "How the figures are prepared before any analysis: the order book is billed in "
        "more than one currency, so everything is converted to one reporting currency "
        "before totals are taken."
    ),
}


def _facts(computed: dict) -> dict:
    """The numbers and their meaning, with the template's prose stripped out.

    Handing the model finished sentences invites it to return them unchanged,
    which defeats the point of generating for this dataset. It gets the
    figures and what they represent, and writes the commentary itself.
    """
    metrics = computed.get("metrics") or []
    breakdown = computed.get("breakdown") or {}
    actions = computed.get("actions") or {}
    return {
        "headline_figures": [
            {"figure": m.get("value"), "what_it_is": m.get("label"), "detail": m.get("sublabel")}
            for m in metrics
        ],
        "single_most_important_figure": (computed.get("hero") or {}).get("value"),
        "table": {
            "columns": breakdown.get("columns", []),
            "rows": [
                {"row": r.get("category"), "figure": r.get("value"), "share": r.get("share")}
                for r in breakdown.get("rows") or []
            ],
        },
        "how_many_actions_to_write": len(actions.get("items") or []),
        "table_title_hint": breakdown.get("title"),
    }


def _user_prompt(area: str, brief: dict, context: dict) -> str:
    figures = sorted(set(_figures_from(brief)))
    return (
        f"INSIGHT: {area}\n"
        f"WHAT THIS INSIGHT MEASURES:\n{AREA_NOTES.get(area, '')}\n\n"
        f"DATASET CONTEXT:\n{json.dumps(context, indent=2)}\n\n"
        f"THE FACTS TO WRITE ABOUT:\n{json.dumps(_facts(brief), indent=2)}\n\n"
        f"FIGURES you may quote, verbatim and only these:\n"
        + "\n".join(f"  - {f}" for f in figures)
        + "\n\nWrite the commentary. Give it a title that states the finding, a caption "
        "for the headline figure, a hero body explaining what it means commercially, a "
        "one-line description for every table row, and the actions. Say what these "
        "particular numbers show, including where two figures are close enough that "
        "naming only one would mislead."
    )


def _merge_numbers(generated: dict, computed: dict) -> dict:
    """Force every numeric field back to the computed value.

    Even with a compliant model this removes a whole class of failure: the
    figures on screen are the analytics' figures by construction, not because
    the model was asked nicely.
    """
    merged = json.loads(json.dumps(generated))  # cheap deep copy

    comp_hero = computed.get("hero") or {}
    hero = merged.setdefault("hero", {})
    hero["value"] = comp_hero.get("value", "")
    # Caption must be prose that finishes the headline figure. If the model
    # echoed the figure (or wrote only digits), keep the computed caption.
    gen_caption = (hero.get("caption") or "").strip()
    comp_value = (comp_hero.get("value") or "").strip()
    if (
        not gen_caption
        or gen_caption == comp_value
        or not any(ch.isalpha() for ch in gen_caption)
    ):
        hero["caption"] = comp_hero.get("caption", "")

    comp_metrics = computed.get("metrics") or []
    for i, m in enumerate(merged.get("metrics") or []):
        if i < len(comp_metrics):
            m["value"] = comp_metrics[i].get("value", "")

    comp_rows = (computed.get("breakdown") or {}).get("rows") or []
    rows = (merged.get("breakdown") or {}).get("rows") or []
    for i, r in enumerate(rows):
        if i < len(comp_rows):
            r["value"] = comp_rows[i].get("value", "")
            r["share"] = comp_rows[i].get("share", "")
            r["category"] = comp_rows[i].get("category", r.get("category", ""))
    if merged.get("breakdown") is not None:
        merged["breakdown"]["columns"] = (computed.get("breakdown") or {}).get("columns", [])

    # Structural fields the dashboard depends on.
    comp_actions = (computed.get("actions") or {})
    if comp_actions.get("footnote"):
        merged.setdefault("actions", {})["footnote"] = comp_actions["footnote"]

    return merged


def _client():
    from openai import OpenAI

    return OpenAI(api_key=config.OPENAI_API_KEY, timeout=config.LLM_TIMEOUT_SECONDS)


def generate_brief(area: str, computed: dict, context: dict | None = None) -> dict:
    """Return a generated brief, or the computed one if generation is unsafe.

    Always returns a usable brief. `generated_by` records which path produced
    it so the dashboard can be honest about provenance.
    """
    fallback = dict(computed)
    fallback["generated_by"] = "template"

    if not config.LLM_ACTIVE:
        return fallback

    allowed = allowed_from_brief(computed)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": _user_prompt(area, computed, context or {})},
    ]

    # One corrective attempt. Most rejections are a single fixable slip, such
    # as a description that restates its own figure, and telling the model
    # exactly what failed is far more likely to produce usable copy than
    # discarding the whole thing on the first try.
    for attempt in (1, 2):
        try:
            response = _client().chat.completions.create(
                model=config.OPENAI_MODEL,
                messages=messages,
                response_format={
                    "type": "json_schema",
                    "json_schema": {"name": "insight_brief", "strict": True, "schema": BRIEF_SCHEMA},
                },
                temperature=0.6,
            )
            raw = response.choices[0].message.content or ""
            generated = json.loads(raw)
        except Exception as exc:  # noqa: BLE001 - any failure falls back, never breaks the page
            log.warning("narrative generation failed for %s: %s", area, exc)
            return fallback

        merged = _merge_numbers(generated, computed)
        problems = check_brief(merged, allowed) + check_quality(merged)

        if not problems:
            merged["generated_by"] = f"model:{config.OPENAI_MODEL}"
            if attempt > 1:
                merged["generation_note"] = "Regenerated after a first draft failed validation"
            return merged

        log.info("narrative for %s failed validation on attempt %s: %s",
                 area, attempt, "; ".join(problems[:3]))

        if attempt == 1:
            messages.append({"role": "assistant", "content": json.dumps(generated)})
            messages.append({
                "role": "user",
                "content": (
                    "That draft was rejected for the following reasons:\n"
                    + "\n".join(f"  - {p}" for p in problems)
                    + "\n\nWrite it again, fixing every point. Remember: row descriptions "
                    "explain what the row means and never repeat the figure beside them; "
                    "the hero body explains rather than instructs; every action needs its "
                    "reasoning; quote only the figures supplied, with no approximations."
                ),
            })

    log.warning("narrative for %s rejected twice, using template", area)
    rejected = dict(fallback)
    rejected["generation_note"] = "Generated text failed validation twice, template used"
    return rejected
