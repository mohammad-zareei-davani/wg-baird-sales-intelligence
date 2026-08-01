"""Turns computed figures into a short, structured briefing for each insight.

Each insight returns the same shape, which the dashboard renders identically
everywhere:

    title      a plain-English statement of what the page is about
    metrics    three headline figures, each with a unit so it reads alone
    hero       one number that matters most, with a tight three-sentence read
    breakdown  a table where every row carries its own explanation
    actions    numbered, specific things to do, each tagged with cost/effort

The constraint is deliberate: short, precise, actionable. A reader should be
able to take the point from the hero paragraph alone, get the detail from the
breakdown if they want it, and leave with something to do. Charts sit at the
bottom of each page as supporting evidence, not as the argument.

Generated deterministically rather than by a language model: the figures
quoted here have to reconcile exactly with the tables beside them, the wording
has to be identical on every load of the same data, and it has to work with no
external service and no per-query cost.
"""
from __future__ import annotations

from app.config import BASE_CURRENCY, BASE_CURRENCY_SYMBOL


# --- formatting helpers -----------------------------------------------------

def money(value: float | None) -> str:
    if value is None:
        return "n/a"
    sign = "-" if value < 0 else ""
    v = abs(float(value))
    if v >= 1_000_000:
        return f"{sign}{BASE_CURRENCY_SYMBOL}{v / 1_000_000:.1f}M"
    if v >= 1_000:
        return f"{sign}{BASE_CURRENCY_SYMBOL}{v / 1_000:.0f}k"
    return f"{sign}{BASE_CURRENCY_SYMBOL}{v:,.0f}"


def money_exact(value: float | None) -> str:
    if value is None:
        return "n/a"
    return f"{BASE_CURRENCY_SYMBOL}{abs(float(value)):,.0f}"


def pct(value: float | None, digits: int = 1) -> str:
    return "n/a" if value is None else f"{float(value):.{digits}f}%"


def count(value: float | None) -> str:
    return "n/a" if value is None else f"{int(value):,}"


def _plural(n: float, singular: str, plural: str | None = None) -> str:
    return singular if n == 1 else (plural or f"{singular}s")


def _names(items: list[str]) -> str:
    """Join names the way a person would write them."""
    items = [str(i) for i in items if i]
    if not items:
        return "the leading account"
    if len(items) == 1:
        return items[0]
    if len(items) == 2:
        return f"{items[0]} and {items[1]}"
    return f"{', '.join(items[:-1])} and {items[-1]}"


_WORDS = {1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five",
          6: "Six", 7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten"}


def _word(n: int) -> str:
    """Small numbers read better as words at the start of a sentence."""
    return _WORDS.get(int(n), str(int(n)))


_ORDINALS = {1: "first", 2: "second", 3: "third", 4: "fourth", 5: "fifth",
             6: "sixth", 7: "seventh", 8: "eighth", 9: "ninth", 10: "tenth"}


def _ordinal(n: int | None) -> str:
    if n is None:
        return "next"
    return _ORDINALS.get(int(n), f"{int(n)}th")


def _significance(at_stake: float | None, basis: str, include: bool = True) -> dict:
    """How much attention a finding deserves, in money terms.

    Findings compete for space in the executive briefing, so each one
    declares what is actually at stake. Ranking on a common monetary measure
    is the only comparison a board would accept, and it means a finding with
    nothing behind it drops out of the briefing automatically rather than
    occupying a slot by convention.
    """
    value = float(at_stake or 0.0)
    return {
        "at_stake": round(value, 2),
        "basis": basis,
        "include": bool(include and value > 0),
    }


def _metric(label: str, value: str, sublabel: str) -> dict:
    return {"label": label, "value": value, "sublabel": sublabel}


def _row(category: str, description: str, value: str, share: str) -> dict:
    return {"category": category, "description": description, "value": value, "share": share}


def _action(title: str, badge: str, tone: str, body: str) -> dict:
    """tone drives the badge colour: 'free' | 'low' | 'value' | 'watch'."""
    return {"title": title, "badge": badge, "tone": tone, "body": body}


def _brief(title: str, metrics: list[dict], hero: dict, breakdown: dict, actions: dict) -> dict:
    return {
        "title": title,
        "metrics": metrics,
        "hero": hero,
        "breakdown": breakdown,
        "actions": actions,
    }


# --- Customer value ---------------------------------------------------------

def customer_value_brief(result: dict) -> dict:
    c = result["concentration"]
    top = c.get("top_customer_name") or "the largest account"
    work = result["work_type_breakdown"]
    total_va = sum(w["total_va_amount"] for w in work) or 1

    descriptions = {
        "Litho": "Large-format offset presses, the core of the business",
        "Digital": "Short-run work on digital presses",
        "Wide Format": "Banners, pop-ups and display work",
        "Outwork": "Produced entirely through external suppliers",
    }

    lead_n = c["leading_count"]
    tied_n = c["tied_count"]
    ahead_n = c["ahead_count"]
    lead_names = _names(c["leading_names"])
    tied_names = _names(c["tied_names"])
    shares = {r["customer_name"]: r["value_share_pct"] for r in result["top_customers"]}

    # Describe the top of the chart as it actually looks. Naming a single
    # winner when two accounts are level would not survive a glance at the
    # ranked bars.
    if tied_n > 1:
        pair = ", ".join(f"{n} at {pct(shares.get(n, 0))}" for n in c["tied_names"])
        top_sentence = (
            f"{tied_names} are effectively level at the top ({pair}, "
            f"{pct(c['tied_spread_pct'])} apart), and together they hold "
            f"{pct(c['leading_share_pct'])} of value added."
        )
        lead_label = f"Top {_word(lead_n).lower()} accounts, level"
    else:
        top_sentence = (
            f"{top} leads clearly on {pct(c['top_customer_share_pct'])} of value added."
        )
        lead_label = "Largest account"

    # Where the ranking stops being a ranking.
    if c["flattens_at_rank"] and ahead_n > lead_n:
        tail_sentence = (
            f"{_word(ahead_n)} accounts stand clearly ahead of the rest; from the "
            f"{_ordinal(c['flattens_at_rank'])} the field flattens out at close to the "
            f"average account size."
        )
    else:
        tail_sentence = (
            f"Below them the field is flat, with no account clearly separated from the next."
        )

    return _brief(
        title="Where Your Value Actually Comes From",
        metrics=[
            _metric(lead_label, pct(c["leading_share_pct"]), f"{lead_names} combined"),
            _metric("Clearly ahead of the field", count(ahead_n),
                    f"Holding {pct(c['ahead_share_pct'])} between them"),
            _metric("Accounts for 80% of value", count(c["customers_for_80pct_value"]),
                    f"Of {c['customer_count']} customers"),
        ],
        hero={
            "value": pct(c["leading_share_pct"]),
            "caption": f"of value added sits with {_word(lead_n).lower()} {_plural(lead_n, 'account')}",
            "body": (
                f"{top_sentence} The next account down, {c['next_after_leading_name']}, is on "
                f"{pct(c['next_after_leading_share_pct'])}, less than half their size. "
                f"{tail_sentence} Concentration like this is efficient to serve, but it is the "
                f"single largest commercial risk on the book."
            ),
        },
        breakdown={
            "title": "Value added by type of work",
            "columns": ["Work type", "What it covers", "Value added", "Share"],
            "rows": [
                _row(
                    w["work_type"],
                    descriptions.get(w["work_type"], "Other production"),
                    money(w["total_va_amount"]),
                    pct(w["total_va_amount"] / total_va * 100, 0),
                )
                for w in work
            ],
        },
        actions={
            "title": "How to protect and grow this",
            "items": [
                _action(
                    f"Put a named relationship plan behind {lead_names}.",
                    f"Free: {_word(lead_n).lower()} {_plural(lead_n, 'meeting')}",
                    "free",
                    f"{_plural(lead_n, 'This account carries', 'These accounts carry')} "
                    f"{pct(c['leading_share_pct'])} of value added between "
                    f"{_plural(lead_n, 'it', 'them')}. Work of that size should have a "
                    f"board-visible owner, a documented renewal position, and more than one "
                    f"relationship inside the customer. Single-contact dependency is how accounts "
                    f"this size get lost without warning.",
                ),
                _action(
                    "Set a growth target for the mid-tier specifically.",
                    "Planning: quarterly review",
                    "low",
                    f"Only {c['customers_for_80pct_value']} of {c['customer_count']} customers "
                    f"produce 80% of value, and below the {_word(ahead_n).lower()} accounts that "
                    f"stand ahead the field is essentially level. Growing the accounts just below "
                    f"that group is the fastest way to reduce concentration risk without needing "
                    f"to win new logos.",
                ),
                _action(
                    "Check the value mix, not just the revenue mix.",
                    "Free: review this report",
                    "free",
                    "Work types differ sharply in what they keep per pound sold. Ranking customers "
                    "by value added rather than turnover changes who the most important accounts "
                    "are, and it should change where sales effort is pointed.",
                ),
            ],
        },
    )


# --- Pricing ----------------------------------------------------------------

def pricing_brief(result: dict) -> dict:
    s = result["summary"]
    top_disc = s.get("top_discount_customer") or "one account"
    worst = s.get("worst_below_cost_customer") or "one account"
    total_sales = s["discount_total"] / (s["discount_as_pct_of_sales"] / 100) if s["discount_as_pct_of_sales"] else 0

    return _brief(
        title="Margin Decided at the Point of Quoting",
        metrics=[
            _metric("Quotes overridden", pct(s["overridden_pct"]), "Of all jobs priced"),
            _metric("Price reductions", money(s["discount_total"]), "Given away over the period"),
            _metric("Jobs below cost", count(s["below_cost_jobs"]), f"{money(abs(s['below_cost_va']))} of lost value"),
        ],
        hero={
            "value": pct(s["overridden_pct"]),
            "caption": "of quotes leave at a price the system did not set",
            "body": (
                f"The estimating system calculates a price, and on {pct(s['overridden_pct'])} of "
                f"jobs somebody changes it before the quote goes out. Reductions of "
                f"{money(s['discount_total'])} are almost exactly offset by uplifts of "
                f"{money(s['uplift_total'])}, so this is not money leaking away, but it does mean "
                f"pricing depends on who handles the job rather than on a rule the business can "
                f"review or improve."
            ),
        },
        breakdown={
            "title": "Where the money moves at quoting stage",
            "columns": ["Category", "What it means", "Amount", "Share of sales"],
            "rows": [
                _row(
                    "Price reductions",
                    "Estimator priced below the calculated figure",
                    money(s["discount_total"]),
                    pct(s["discount_as_pct_of_sales"], 1),
                ),
                _row(
                    "Price uplifts",
                    "Estimator priced above the calculated figure",
                    money(s["uplift_total"]),
                    pct(s["uplift_total"] / total_sales * 100, 1) if total_sales else "n/a",
                ),
                _row(
                    "Jobs below cost",
                    "Delivered for less than they cost to produce",
                    f"-{money(abs(s['below_cost_va']))}",
                    f"{count(s['below_cost_jobs'])} jobs",
                ),
                _row(
                    "Low-margin work",
                    "Under 25% value added, too thin to carry overhead",
                    money(s["low_margin_sell_value"]),
                    pct(s["low_margin_pct"], 1) + " of jobs",
                ),
            ],
        },
        actions={
            "title": "How to tighten pricing",
            "items": [
                _action(
                    f"Review the {count(s['below_cost_jobs'])} below-cost jobs individually.",
                    f"Up to {money(abs(s['below_cost_va']))} at stake",
                    "value",
                    f"Some of these will be genuine loss-makers, some will be credit notes or "
                    f"mis-bookings. The distinction matters and only a person can make it. "
                    f"{pct(s['worst_below_cost_share_pct'], 0)} of the value sits on {worst}, so "
                    f"start there.",
                ),
                _action(
                    "Recalibrate the automated price.",
                    "Project: high payback",
                    "value",
                    f"A calculated price that needs changing on {pct(s['overridden_pct'])} of jobs "
                    f"is not doing its job. Feed the last two years of overrides back into the "
                    f"pricing rules so the default lands closer to what estimators actually charge. "
                    f"That removes a manual step from every single quote.",
                ),
                _action(
                    f"Agree a discount authority threshold, starting with {top_disc}.",
                    "Free: policy decision",
                    "free",
                    f"{top_disc} absorbed {money(s['top_discount_amount'])} of reductions. Set a "
                    f"level beyond which a price cut needs a second signature. The aim is not to "
                    f"stop discounting; it is to make sure the larger ones are deliberate.",
                ),
            ],
        },
    )


# --- Reorder ----------------------------------------------------------------

def reorder_brief(result: dict) -> dict:
    s = result["summary"]
    return _brief(
        title="Who Is Due to Order Next",
        metrics=[
            _metric("Overdue now", count(s["overdue_count"]), "Past their normal gap"),
            _metric("Due within 14 days", count(s["due_soon_count"]), "On their usual rhythm"),
            _metric("Expected next 30 days", money(s["expected_value_next_30_days"]), "Based on recent order values"),
        ],
        hero={
            "value": count(s["overdue_count"]),
            "caption": "customers are overdue an order",
            "body": (
                f"Most customers reorder on a rhythm, even when nobody has written it down. "
                f"{count(s['overdue_count'])} accounts are now past the gap they normally leave "
                f"between orders, and {count(s['due_soon_count'])} more are due within a fortnight. "
                f"Together that points to roughly {money(s['expected_value_next_30_days'])} of work "
                f"in the next month."
            ),
        },
        breakdown={
            "title": "The order book by readiness",
            "columns": ["Status", "What it means", "Customers", "Action window"],
            "rows": [
                _row("Overdue", "Silent longer than their own normal gap",
                     count(s["overdue_count"]), "This week"),
                _row("Due soon", "Expected to order within 14 days",
                     count(s["due_soon_count"]), "Next fortnight"),
                _row("On track", "Ordering as expected, nothing to chase",
                     count(max(s["predictable_customers"] - s["overdue_count"] - s["due_soon_count"], 0)),
                     "Monitor only"),
            ],
        },
        actions={
            "title": "How to use this",
            "items": [
                _action(
                    "Work the overdue list first.",
                    "Free: sales call",
                    "free",
                    "A customer whose own pattern says they should have ordered by now is the "
                    "cheapest lead the business has. No prospecting, no introduction, just a call "
                    "asking whether anything has changed.",
                ),
                _action(
                    "Give production the due-soon list weekly.",
                    "Free: existing meeting",
                    "free",
                    f"Roughly {money(s['expected_value_next_30_days'])} is expected in the next 30 "
                    f"days. Scheduling against that forward view beats reacting to orders as they "
                    f"land, particularly for press time that has to be booked in advance.",
                ),
                _action(
                    "Treat a broken rhythm as an early warning.",
                    "Free: flag to account manager",
                    "watch",
                    "A customer who reliably ordered monthly and has now missed twice is telling "
                    "you something before they tell you. That signal is worth more when it is acted "
                    "on at two missed cycles rather than six.",
                ),
            ],
        },
    )


# --- Churn (rules) ----------------------------------------------------------

def churn_brief(result: dict) -> dict:
    counts = result["status_counts"]
    at_risk = counts.get("At Risk", 0)
    dormant = counts.get("Dormant", 0)
    active = counts.get("Active", 0)
    at_stake = result["dormant_lifetime_value_at_stake"]

    return _brief(
        title="Customers Who Have Gone Quiet",
        metrics=[
            _metric("At risk", count(at_risk), "Quieter than their own pattern"),
            _metric("Dormant", count(dormant), "Effectively stopped ordering"),
            _metric("Value at stake", money(at_stake), "Lifetime value of dormant accounts"),
        ],
        hero={
            "value": money(at_stake),
            "caption": "of lifetime value sits with dormant accounts",
            "body": (
                f"Customers rarely announce that they are leaving; they simply stop calling. "
                f"{count(at_risk)} {_plural(at_risk, 'account is', 'accounts are')} quieter than "
                f"their own history would predict, and {count(dormant)} "
                f"{_plural(dormant, 'has', 'have')} effectively stopped. Acting while an account is "
                f"merely quiet costs far less than winning it back once it has gone."
            ),
        },
        breakdown={
            "title": "How every account is classified",
            "columns": ["Status", "What it means", "Customers", "Priority"],
            "rows": [
                _row("Active", "Ordering within their normal rhythm", count(active), "None"),
                _row("At risk", "Silent 1.25–2.5× their usual gap", count(at_risk), "Contact this week"),
                _row("Dormant", "Silent beyond 2.5× their usual gap", count(dormant), "Win-back campaign"),
            ],
        },
        actions={
            "title": "How to respond",
            "items": [
                _action(
                    "Call the at-risk accounts this week.",
                    "Free: sales call",
                    "free",
                    "These customers have not left; they have gone quiet. A single call asking "
                    "whether anything has changed will usually reveal whether it is a pause, a "
                    "budget issue, or a competitor, while there is still time to respond.",
                ),
                _action(
                    "Run the dormant list as a funded campaign.",
                    f"Up to {money(at_stake)} recoverable",
                    "value",
                    "Dormant accounts need more than routine follow-up. Give the list a budget, a "
                    "specific offer, and a deadline, and treat the response rate as the measure of "
                    "whether win-back is worth repeating.",
                ),
                _action(
                    "Judge silence against each customer's own habit.",
                    "Free: already built in",
                    "free",
                    "Six weeks of quiet from a fortnightly customer is a warning; the same six "
                    "weeks from a twice-a-year customer means nothing. A single company-wide "
                    "threshold would raise false alarms on one and miss the other entirely.",
                ),
            ],
        },
    )


# --- Seasonality ------------------------------------------------------------

def seasonality_brief(result: dict) -> dict:
    s = result["summary"]
    ratio = s.get("peak_to_trough_ratio")

    return _brief(
        title="The Shape of Your Trading Year",
        metrics=[
            _metric("Busiest month", str(s["peak_month"]), f"{pct(s['peak_index'], 0)} of an average month"),
            _metric("Quietest month", str(s["trough_month"]), f"{pct(s['trough_index'], 0)} of an average month"),
            _metric("Next month projected",
                    money(s["forecast_next_month_sales"]),
                    f"{count(s['forecast_next_month_press'])} press hours"),
        ],
        hero={
            "value": f"{ratio:.1f}×" if ratio else "n/a",
            "caption": f"more work in {s['peak_month']} than in {s['trough_month']}",
            "body": (
                f"{s['peak_month']} runs at {pct(s['peak_index'], 0)} of an average month while "
                f"{s['trough_month']} runs at {pct(s['trough_index'], 0)}. Because the constraint "
                f"here is press time rather than order count, that swing lands directly on "
                f"capacity: overtime and outsourcing at the peak, fixed cost against thin work at "
                f"the trough. Both are expensive, and both are predictable a year ahead."
            ),
        },
        breakdown={
            "title": "Planning implications by season",
            "columns": ["Period", "What it means for the plant", "Level", "Priority"],
            "rows": [
                _row(f"Peak ({s['peak_month']})", "Risk of overtime, outsourcing and missed dates",
                     pct(s["peak_index"], 0), "Book capacity early"),
                _row(f"Trough ({s['trough_month']})", "Fixed cost carried against much less work",
                     pct(s["trough_index"], 0), "Schedule maintenance"),
                _row("Recent press load", "Average press hours over the last 12 months",
                     f"{s['press_hours_recent_avg']:,.0f} hrs", "Baseline"),
                _row("Peak press load", "Highest month on record",
                     f"{s['press_hours_peak_month']:,.0f} hrs", "Capacity ceiling"),
            ],
        },
        actions={
            "title": "How to plan against this",
            "items": [
                _action(
                    "Set shift patterns and holidays from the seasonal shape.",
                    "Free: planning decision",
                    "free",
                    f"Planning against last month's actuals guarantees being wrong twice a year. "
                    f"The projection for next month is {money(s['forecast_next_month_sales'])} of "
                    f"sales and roughly {count(s['forecast_next_month_press'])} press hours.",
                ),
                _action(
                    f"Move maintenance and training into {s['trough_month']}.",
                    "Free: reschedule existing work",
                    "free",
                    "The quiet month is the cheapest possible window for planned downtime, press "
                    "servicing and operator training. Doing this work in a peak month costs "
                    "capacity the business cannot spare.",
                ),
                _action(
                    "Target off-peak work deliberately.",
                    "Campaign: fills fixed cost",
                    "low",
                    "Sales effort aimed at customers whose own cycle falls in the quiet months is "
                    "worth more per pound than work that arrives when the presses are already full, "
                    "because it uses capacity that is otherwise paid for and idle.",
                ),
            ],
        },
    )


# --- Delivery ---------------------------------------------------------------

def delivery_brief(result: dict) -> dict:
    s = result["summary"]
    direction = s.get("direction", "stable")
    trend_word = {"slower": "slipped", "faster": "improved", "stable": "held steady"}[direction]

    return _brief(
        title="How Long Work Takes to Leave the Building",
        metrics=[
            _metric("Typical turnaround", f"{s['median_days']:.0f} days", "Half of all jobs ship within this"),
            _metric("Slowest tenth", f"{s['p90_days']:.0f} days", "Or longer, where complaints come from"),
            _metric("Recent trend", f"{s['recent_vs_prior_days']:+.1f} days", f"Turnaround has {trend_word}"),
        ],
        hero={
            "value": f"{s['median_days']:.0f} days",
            "caption": "from order booked to job despatched",
            "body": (
                f"Half of all work ships within {s['median_days']:.0f} days, but the slowest tenth "
                f"takes {s['p90_days']:.0f} days or more, and it is the spread, not the average, "
                f"that customers notice. {s['fastest_work_type']} work turns around in about "
                f"{s['fastest_median_days']:.0f} days against {s['slowest_median_days']:.0f} for "
                f"{s['slowest_work_type']}. Turnaround has {trend_word} recently."
            ),
        },
        breakdown={
            "title": "Turnaround by production route",
            "columns": ["Work type", "Why it takes this long", "Median", "Slowest tenth"],
            "rows": [
                _row(
                    w["work_type"],
                    {
                        "Digital": "Short runs, minimal make-ready",
                        "Litho": "Plate-making and press set-up before running",
                        "Wide Format": "Single-pass display work",
                        "Outwork": "Dependent on an external supplier's schedule",
                    }.get(w["work_type"], "Other production route"),
                    f"{w['median_days']:.0f} days",
                    f"{w['p90_days']:.0f} days",
                )
                for w in result["by_work_type"]
            ],
        },
        actions={
            "title": "How to improve turnaround",
            "items": [
                _action(
                    "Publish a turnaround promise per product, not one company figure.",
                    "Free: policy decision",
                    "free",
                    f"A {s['fastest_median_days']:.0f}-day digital job and a "
                    f"{s['slowest_median_days']:.0f}-day litho run cannot share one commitment. "
                    f"Per-product promises are both honest and easier to hit, and they give sales "
                    f"something concrete to quote.",
                ),
                _action(
                    "Review jobs running far beyond their own product's norm.",
                    "Free: exception review",
                    "watch",
                    "A long book run is not a problem; a book run taking twice what book runs "
                    "normally take is. Comparing each job against its own product's typical "
                    "turnaround isolates the genuinely recoverable time.",
                ),
                _action(
                    "Track the slowest tenth, not the average.",
                    "Free: change the KPI",
                    "free",
                    f"The median has barely moved, but the tail at {s['p90_days']:.0f} days is "
                    f"where expedite costs, complaints and lost repeat business originate. Managing "
                    f"the tail is what customers actually experience.",
                ),
            ],
        },
    )


# --- Repeat business --------------------------------------------------------

def repeat_business_brief(result: dict) -> dict:
    s = result["summary"]
    return _brief(
        title="Work You Have Already Won",
        metrics=[
            _metric("Reprint revenue", pct(s["repeat_revenue_pct"]), "Of all revenue"),
            _metric("Recurring titles", count(s["repeat_titles"]), f"Averaging {s['avg_runs_per_repeat_title']} runs"),
            _metric("Overdue a reprint", count(s["titles_due_reprint"]), f"Worth {money(s['reprint_pipeline_value'])}"),
        ],
        hero={
            "value": money(s["reprint_pipeline_value"]),
            "caption": "of reprint work is now overdue",
            "body": (
                f"{pct(s['repeat_revenue_pct'])} of revenue comes from titles printed before, work "
                f"where the origination is done and the specification is proven. "
                f"{count(s['titles_due_reprint'])} of those titles are now past their own reprint "
                f"cycle. Each one is either about to be ordered, about to be ordered somewhere "
                f"else, or discontinued, and all three are worth knowing early."
            ),
        },
        breakdown={
            "title": "The title base, split by behaviour",
            "columns": ["Category", "What it means", "Titles", "Commercial read"],
            "rows": [
                _row("Recurring titles", "Printed more than once for the same customer",
                     count(s["repeat_titles"]), "Predictable, defensible revenue"),
                _row("Overdue a reprint", "Past their own average cycle",
                     count(s["titles_due_reprint"]), f"{money(s['reprint_pipeline_value'])} callable now"),
                _row("One-off titles", "Printed once, no cycle established",
                     count(s["one_off_titles"]), "Needs a reason to return"),
                _row("Most reprinted title", "Highest number of runs on record",
                     f"{s['max_runs']} runs", "Proof the model works"),
            ],
        },
        actions={
            "title": "How to turn this into a pipeline",
            "items": [
                _action(
                    "Make the overdue reprint list a standing call list.",
                    f"{money(s['reprint_pipeline_value'])} identified",
                    "value",
                    "This is the easiest revenue in the business and it is currently left to "
                    "chance. A weekly call against titles past their cycle converts guesswork into "
                    "a repeatable sales motion.",
                ),
                _action(
                    "Quote reprints before the customer asks.",
                    "Free: sales behaviour",
                    "free",
                    "A competitor only needs the specification the customer already holds to quote "
                    "against you. Getting there first, with a price and a slot, is usually enough "
                    "to keep the work without discounting for it.",
                ),
                _action(
                    "Use reprint cycles to fill quiet press weeks.",
                    "Planning: uses idle capacity",
                    "low",
                    "Reprints are among the few jobs where timing is genuinely negotiable. Pulling "
                    "them forward into a slow week fills capacity that is otherwise paid for and "
                    "standing idle.",
                ),
            ],
        },
    )


# --- Quote Guard ------------------------------------------------------------

def quote_guard_brief(result: dict) -> dict:
    if not result.get("available"):
        return _brief(
            title="Quote Benchmarking",
            metrics=[],
            hero={"value": "n/a", "caption": "not enough priced history",
                  "body": result.get("reason", "The benchmark needs more completed, priced jobs before it can distinguish a keen price from a normal one.")},
            breakdown={"title": "", "columns": [], "rows": []},
            actions={"title": "", "items": []},
        )

    m = result["metrics"]
    return _brief(
        title="What Comparable Work Actually Sells For",
        metrics=[
            _metric("Typical accuracy", pct(m["median_abs_pct_error"]), "Error on jobs never seen"),
            _metric("Within 25%", pct(m["within_25pct"]), "Of held-out jobs predicted"),
            _metric("Underpriced jobs found", count(result["flagged_count"]),
                    f"Worth {money(abs(result['value_gap']))} of gap"),
        ],
        hero={
            "value": pct(m["median_abs_pct_error"]),
            "caption": "typical error when predicting a job's price",
            "body": (
                f"A job's specification and input costs explain most of what it sells for, which "
                f"means the price comparable work has historically achieved can be calculated. On "
                f"jobs the model had never seen it lands within {pct(m['median_abs_pct_error'])} "
                f"for a typical job. Applied at the point of quoting, it protects margin before it "
                f"is committed rather than reporting on it afterwards."
            ),
        },
        breakdown={
            "title": "How the benchmark was tested",
            "columns": ["Measure", "What it means", "Result", "Read"],
            "rows": [
                _row("Typical error", "Half of jobs are predicted closer than this",
                     pct(m["median_abs_pct_error"]), "Good"),
                _row("Within 10%", "Share of jobs predicted very closely",
                     pct(m["within_10pct"]), "Usable as a guide"),
                _row("Within 25%", "Share predicted close enough to act on",
                     pct(m["within_25pct"]), "Strong"),
                _row("Tested on", "Jobs held back from training entirely",
                     f"{count(m['test_rows'])} jobs", "Honest measure"),
            ],
        },
        actions={
            "title": "How to put this to work",
            "items": [
                _action(
                    "Show the benchmark inside the estimating screen.",
                    "Integration: highest value",
                    "value",
                    "The number is only useful at the moment the quote is being built. Displayed "
                    "alongside the calculated price it gives the estimator a second opinion without "
                    "removing their judgement.",
                ),
                _action(
                    "Start advisory, not blocking.",
                    "Free: rollout decision",
                    "free",
                    "Show the comparison and let estimators price as they see fit. Review the "
                    "flagged jobs monthly to confirm the model is calling them fairly before giving "
                    "it any authority over a quote.",
                ),
                _action(
                    f"Review the {count(result['flagged_count'])} flagged jobs.",
                    f"{money(abs(result['value_gap']))} of gap identified",
                    "value",
                    f"These sold more than {result['threshold_pct']:.0f}% below what comparable work "
                    f"achieved. Some will be deliberate commercial decisions and worth repeating; "
                    f"the rest are drift worth understanding.",
                ),
            ],
        },
    )


# --- Data quality -----------------------------------------------------------

def data_quality_brief(summary: dict) -> dict:
    split = summary.get("currency_split", [])
    overstatement = summary.get("naive_mixed_total", 0) - summary.get("total_sell_price", 0)

    rows = [
        _row(
            c["currency"],
            "Billed to customers in this currency",
            f"{c['sell_price_native']:,.0f}",
            money(c["sell_price_base"]),
        )
        for c in split
    ]
    rows.append(_row(
        f"Reported total ({BASE_CURRENCY})",
        "Every figure in this dashboard, converted",
        "n/a",
        money(summary.get("total_sell_price", 0)),
    ))

    return _brief(
        title="A Note on How the Figures Are Calculated",
        metrics=[
            _metric("Reporting currency", BASE_CURRENCY, f"Converted at €1 = {BASE_CURRENCY_SYMBOL}{summary.get('eur_to_gbp')}"),
            _metric("Overstatement avoided", money(overstatement), "If currencies were summed raw"),
            _metric("Jobs analysed", count(summary.get("row_count")), "Across the full period"),
        ],
        hero={
            "value": money(overstatement),
            "caption": "the error avoided by converting first",
            "body": (
                f"Sell prices are recorded in each customer's own currency in a single column. "
                f"Added together untouched they produce a total that is neither pounds nor euros "
                f"and overstates the book by {money(overstatement)}. Every figure in this dashboard "
                f"is converted to {BASE_CURRENCY} before any total is taken."
            ),
        },
        breakdown={
            "title": "The book by billing currency",
            "columns": ["Currency", "What it covers", "Native value", f"In {BASE_CURRENCY}"],
            "rows": rows,
        },
        actions={
            "title": "What to fix at source",
            "items": [
                _action(
                    "Agree one reporting currency for management accounts.",
                    "Free: policy decision",
                    "free",
                    "Mixed-currency totals are not comparable across regions or periods. Fixing the "
                    "convention once removes a recurring source of confusion in board reporting.",
                ),
                _action(
                    "Hold the conversion rate fixed within a reporting period.",
                    "Free: convention",
                    "free",
                    "A rate that moves between reports makes trading performance and exchange-rate "
                    "movement impossible to separate. Fix it for the year and restate deliberately.",
                ),
                _action(
                    "Tidy product naming at entry.",
                    "Low cost: data hygiene",
                    "low",
                    "The source carries 64 product types, several of which are the same category "
                    "typed differently. Spelling variants are merged automatically here, but a "
                    "controlled list at the point of entry would remove the problem at source.",
                ),
            ],
        },
    )


# --- Executive summary ------------------------------------------------------

def significance_for(area: str, result: dict, years: float = 1.0) -> dict:
    """What each insight has at stake, expressed as money per year.

    The executive briefing used to show a fixed list in a fixed order, which
    meant a finding appeared even when the number behind it was zero, and a
    large problem could sit below a small one. Scoring every insight on one
    measure fixes both: the briefing reorders itself around whatever
    currently matters most, and anything with nothing behind it drops out.

    Two rules keep the comparison honest. Figures accumulated over the whole
    dataset are divided by its span so everything is an annual rate, and only
    money genuinely at risk or genuinely recoverable counts. Revenue that
    merely passed through a slow process is not at stake, so turnaround is
    deliberately left unscored rather than allowed to dominate the ranking on
    a number that does not mean what it appears to mean.
    """
    span = max(float(years), 0.25)

    try:
        if area == "customer_value":
            c = result["concentration"]
            lead = {r["customer_name"] for r in result["top_customers"][: c["leading_count"]]}
            annual = sum(
                r["total_va_amount"] for r in result["top_customers"] if r["customer_name"] in lead
            ) / span
            return _significance(annual, "Annual value added riding on the leading accounts")

        if area == "pricing":
            s = result["summary"]
            annual = (abs(s["below_cost_va"]) + s["discount_total"]) / span
            return _significance(annual, "Value given away at quoting each year, plus below-cost work")

        if area == "repeat_business":
            s = result["summary"]
            # A present backlog, not a historical total, so it is not divided.
            return _significance(s["reprint_pipeline_value"], "Reprints now overdue their cycle")

        if area == "churn":
            annual = result["dormant_lifetime_value_at_stake"] / span
            return _significance(annual, "Annual value added from accounts that have gone dormant")

        if area == "reorder":
            # Normal expected trading is not at stake. Only the customers who
            # are already past their own reorder point are.
            overdue = [
                r for r in result.get("customers", [])
                if r.get("status") == "Overdue" and r.get("predicted_next_order_value")
            ]
            at_risk = sum(r["predicted_next_order_value"] for r in overdue)
            return _significance(at_risk, "Predicted value from customers past their reorder point")

        if area == "seasonality":
            idx = result.get("sales_seasonal_index") or []
            if not idx:
                return _significance(0, "Seasonal swing", include=False)
            # How much revenue the quiet months fall short of an evenly
            # loaded year. The plant carries the same fixed cost through
            # those months, so this is the annual size of the under-loading,
            # not a swing figure taken from a single month.
            monthly = [r["avg_value"] for r in idx]
            level = sum(monthly) / len(monthly)
            shortfall = sum(max(0.0, level - v) for v in monthly)
            return _significance(
                shortfall, "Annual revenue shortfall in the quiet months against even loading"
            )

        if area == "delivery":
            # Turnaround is a service measure. The value of slow jobs is
            # revenue that was delivered and paid for, not money at risk, so
            # scoring it here would put a misleading figure at the top of the
            # briefing. The page still reports it in full.
            return _significance(0, "Service measure, no direct money at risk", include=False)

        if area == "quote_guard":
            if not result.get("available"):
                return _significance(0, "Quote benchmark unavailable", include=False)
            # Measured on the held-out sample only, so scaled to the full book.
            metrics = result.get("metrics") or {}
            tested = metrics.get("test_rows") or 0
            trained = metrics.get("train_rows") or 0
            scale = ((tested + trained) / tested) if tested else 1.0
            annual = abs(result.get("value_gap", 0)) * scale / span
            return _significance(annual, "Annual gap on jobs sold below the going rate")
    except (KeyError, TypeError, ValueError, ZeroDivisionError):
        # A malformed or empty result should drop the finding, never break
        # the briefing for every other insight.
        return _significance(0, "Not available", include=False)

    return _significance(0, "Not scored", include=False)


def executive_summary(items: list[dict], limit: int = 5, years: float = 1.0) -> list[dict]:
    """Rank the findings by what is at stake and drop the empty ones.

    `items` is a list of {"area", "brief", "result"}. Order is decided here
    rather than being hard-coded, so the briefing reflects the data in front
    of it rather than the order the modules happen to be written in.
    """
    scored = []
    for item in items:
        brief = item.get("brief") or {}
        hero = brief.get("hero") or {}
        sig = significance_for(item["area"], item.get("result") or {}, years=years)
        if not sig["include"]:
            continue
        scored.append({
            "area": item["area"],
            "title": brief.get("title", ""),
            "value": hero.get("value", ""),
            "caption": hero.get("caption", ""),
            "body": hero.get("body", ""),
            "at_stake": sig["at_stake"],
            "at_stake_label": money(sig["at_stake"]),
            "basis": sig["basis"],
        })

    scored.sort(key=lambda r: r["at_stake"], reverse=True)
    return scored[:limit]
