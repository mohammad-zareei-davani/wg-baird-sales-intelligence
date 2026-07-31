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
        "Litho": "Large-format offset presses — the core of the business",
        "Digital": "Short-run work on digital presses",
        "Wide Format": "Banners, pop-ups and display work",
        "Outwork": "Produced entirely through external suppliers",
    }

    return _brief(
        title="Where Your Value Actually Comes From",
        metrics=[
            _metric("Top five accounts", pct(c["top_5_share_pct"]), "Share of all value added"),
            _metric("Largest single account", pct(c["top_customer_share_pct"]), f"{top} alone"),
            _metric("Accounts for 80% of value", count(c["customers_for_80pct_value"]),
                    f"Of {c['customer_count']} customers"),
        ],
        hero={
            "value": pct(c["top_5_share_pct"]),
            "caption": "of value added comes from five accounts",
            "body": (
                f"Five customers generate {pct(c['top_5_share_pct'])} of everything the business "
                f"keeps after paper, press and bought-in costs, and {top} alone accounts for "
                f"{pct(c['top_customer_share_pct'])}. Concentration this high is efficient to "
                f"serve, but it is also the single largest commercial risk on the book. Losing "
                f"one of these relationships would take years to replace."
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
                    f"Put a named relationship plan behind {top}.",
                    "Free — one meeting",
                    "free",
                    f"An account worth {pct(c['top_customer_share_pct'])} of value added should "
                    f"have a board-visible owner, a documented renewal position, and more than one "
                    f"relationship inside the customer. Single-contact dependency is how accounts "
                    f"this size get lost without warning.",
                ),
                _action(
                    "Set a growth target for the mid-tier specifically.",
                    "Planning — quarterly review",
                    "low",
                    f"Only {c['customers_for_80pct_value']} of {c['customer_count']} customers "
                    f"produce 80% of value. Growing the accounts immediately below the top five is "
                    f"the fastest way to reduce concentration risk without needing to win new "
                    f"logos.",
                ),
                _action(
                    "Check the value mix, not just the revenue mix.",
                    "Free — review this report",
                    "free",
                    "Work types differ sharply in what they keep per pound sold. Ranking customers "
                    "by value added rather than turnover changes who the most important accounts "
                    "are — and it should change where sales effort is pointed.",
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
                f"{money(s['uplift_total'])}, so this is not money leaking away — but it does mean "
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
                    "Under 25% value added — too thin to carry overhead",
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
                    "Project — high payback",
                    "value",
                    f"A calculated price that needs changing on {pct(s['overridden_pct'])} of jobs "
                    f"is not doing its job. Feed the last two years of overrides back into the "
                    f"pricing rules so the default lands closer to what estimators actually charge. "
                    f"That removes a manual step from every single quote.",
                ),
                _action(
                    f"Agree a discount authority threshold, starting with {top_disc}.",
                    "Free — policy decision",
                    "free",
                    f"{top_disc} absorbed {money(s['top_discount_amount'])} of reductions. Set a "
                    f"level beyond which a price cut needs a second signature. The aim is not to "
                    f"stop discounting — it is to make sure the larger ones are deliberate.",
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
                    "Free — sales call",
                    "free",
                    "A customer whose own pattern says they should have ordered by now is the "
                    "cheapest lead the business has. No prospecting, no introduction — just a call "
                    "asking whether anything has changed.",
                ),
                _action(
                    "Give production the due-soon list weekly.",
                    "Free — existing meeting",
                    "free",
                    f"Roughly {money(s['expected_value_next_30_days'])} is expected in the next 30 "
                    f"days. Scheduling against that forward view beats reacting to orders as they "
                    f"land, particularly for press time that has to be booked in advance.",
                ),
                _action(
                    "Treat a broken rhythm as an early warning.",
                    "Free — flag to account manager",
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
                f"Customers rarely announce that they are leaving — they simply stop calling. "
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
                    "Free — sales call",
                    "free",
                    "These customers have not left; they have gone quiet. A single call asking "
                    "whether anything has changed will usually reveal whether it is a pause, a "
                    "budget issue, or a competitor — while there is still time to respond.",
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
                    "Free — already built in",
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
    mape = s.get("sales_forecast_mape")

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
                _row(f"Peak — {s['peak_month']}", "Risk of overtime, outsourcing and missed dates",
                     pct(s["peak_index"], 0), "Book capacity early"),
                _row(f"Trough — {s['trough_month']}", "Fixed cost carried against much less work",
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
                    "Free — planning decision",
                    "free",
                    f"Planning against last month's actuals guarantees being wrong twice a year. "
                    f"The projection for next month is {money(s['forecast_next_month_sales'])} of "
                    f"sales and roughly {count(s['forecast_next_month_press'])} press hours.",
                ),
                _action(
                    f"Move maintenance and training into {s['trough_month']}.",
                    "Free — reschedule existing work",
                    "free",
                    "The quiet month is the cheapest possible window for planned downtime, press "
                    "servicing and operator training. Doing this work in a peak month costs "
                    "capacity the business cannot spare.",
                ),
                _action(
                    "Target off-peak work deliberately.",
                    "Campaign — fills fixed cost",
                    "low",
                    "Sales effort aimed at customers whose own cycle falls in the quiet months is "
                    "worth more per pound than work that arrives when the presses are already full "
                    "— it uses capacity that is otherwise paid for and idle.",
                ),
            ],
        }
        | ({"footnote": f"Backtested against recent months, the projection has been out by about {pct(mape, 0)} on average — close enough to plan capacity around, not close enough to commit to."} if mape is not None else {}),
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
            _metric("Slowest tenth", f"{s['p90_days']:.0f} days", "Or longer — where complaints come from"),
            _metric("Recent trend", f"{s['recent_vs_prior_days']:+.1f} days", f"Turnaround has {trend_word}"),
        ],
        hero={
            "value": f"{s['median_days']:.0f} days",
            "caption": "from order booked to job despatched",
            "body": (
                f"Half of all work ships within {s['median_days']:.0f} days, but the slowest tenth "
                f"takes {s['p90_days']:.0f} days or more — and it is the spread, not the average, "
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
                    "Free — policy decision",
                    "free",
                    f"A {s['fastest_median_days']:.0f}-day digital job and a "
                    f"{s['slowest_median_days']:.0f}-day litho run cannot share one commitment. "
                    f"Per-product promises are both honest and easier to hit, and they give sales "
                    f"something concrete to quote.",
                ),
                _action(
                    "Review jobs running far beyond their own product's norm.",
                    "Free — exception review",
                    "watch",
                    "A long book run is not a problem; a book run taking twice what book runs "
                    "normally take is. Comparing each job against its own product's typical "
                    "turnaround isolates the genuinely recoverable time.",
                ),
                _action(
                    "Track the slowest tenth, not the average.",
                    "Free — change the KPI",
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
                f"{pct(s['repeat_revenue_pct'])} of revenue comes from titles printed before — work "
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
                    "Free — sales behaviour",
                    "free",
                    "A competitor only needs the specification the customer already holds to quote "
                    "against you. Getting there first, with a price and a slot, is usually enough "
                    "to keep the work without discounting for it.",
                ),
                _action(
                    "Use reprint cycles to fill quiet press weeks.",
                    "Planning — uses idle capacity",
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
                    "Integration — highest value",
                    "value",
                    "The number is only useful at the moment the quote is being built. Displayed "
                    "alongside the calculated price it gives the estimator a second opinion without "
                    "removing their judgement.",
                ),
                _action(
                    "Start advisory, not blocking.",
                    "Free — rollout decision",
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


# --- Churn risk model -------------------------------------------------------

def churn_model_brief(result: dict) -> dict:
    if not result.get("available"):
        return _brief(
            title="Predicted Retention Risk",
            metrics=[],
            hero={"value": "n/a", "caption": "not enough order history",
                  "body": result.get("reason", "The model needs more ordering history before its predictions can be trusted.")},
            breakdown={"title": "", "columns": [], "rows": []},
            actions={"title": "", "items": []},
        )

    m = result["metrics"]
    bands = result["band_counts"]
    verdict = "Better than the simple rule" if m["beats_baseline"] else "No better than the simple rule"

    return _brief(
        title="Who Is Unlikely to Come Back",
        metrics=[
            _metric("High risk", count(bands.get("High", 0)), f"Unlikely to order in {m['lookahead_days']} days"),
            _metric("Model score", f"{m['auc']:.3f}", f"Against a benchmark of {m['baseline_auc']:.3f}"),
            _metric("Tested on", count(m["test_rows"]), "Later months than it learned from"),
        ],
        hero={
            "value": count(bands.get("High", 0)),
            "caption": f"accounts unlikely to order within {m['lookahead_days']} days",
            "body": (
                f"Rather than asking who has gone quiet, this asks how likely each account is to "
                f"come back — weighing how overdue they are against their own habit, whether spend "
                f"is falling, and how established the relationship is. Trained on earlier months "
                f"and tested only on later ones, it scores {m['auc']:.3f} against "
                f"{m['baseline_auc']:.3f} for simply asking who is overdue."
            ),
        },
        breakdown={
            "title": "How to read the risk bands",
            "columns": ["Band", "What it means", "Accounts", "Action"],
            "rows": [
                _row("High", "Unlikely to order in the next 60 days",
                     count(bands.get("High", 0)), "Contact this week"),
                _row("Medium", "Uncertain — watch for a further slip",
                     count(bands.get("Medium", 0)), "Monitor"),
                _row("Low", "Expected to order as normal",
                     count(bands.get("Low", 0)), "None"),
                _row("Model vs benchmark", "Whether the extra complexity earns its place",
                     f"{m['auc']:.3f} vs {m['baseline_auc']:.3f}", verdict),
            ],
        },
        actions={
            "title": "How to use the score",
            "items": [
                _action(
                    "Rank the monthly call list by risk score.",
                    "Free — reorder existing work",
                    "free",
                    "The score adds most value as a priority order, not as a verdict. Account "
                    "managers keep the same list; they just work it in a better sequence.",
                ),
                _action(
                    "Cross-check high risk against account value.",
                    "Free — combine two views",
                    "watch",
                    "A high-risk account worth a few thousand and one worth six figures deserve "
                    "very different responses. Read this page alongside customer value before "
                    "committing effort.",
                ),
                _action(
                    "Re-test the model as history accumulates.",
                    "Ongoing — quarterly",
                    "low",
                    f"With only {m['customers']} customers the model is working from limited "
                    f"evidence. Re-running it each quarter, and watching whether it still beats the "
                    f"simple overdue rule, is what keeps it trustworthy.",
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
        "—",
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
                    "Free — policy decision",
                    "free",
                    "Mixed-currency totals are not comparable across regions or periods. Fixing the "
                    "convention once removes a recurring source of confusion in board reporting.",
                ),
                _action(
                    "Hold the conversion rate fixed within a reporting period.",
                    "Free — convention",
                    "free",
                    "A rate that moves between reports makes trading performance and exchange-rate "
                    "movement impossible to separate. Fix it for the year and restate deliberately.",
                ),
                _action(
                    "Tidy product naming at entry.",
                    "Low cost — data hygiene",
                    "low",
                    "The source carries 64 product types, several of which are the same category "
                    "typed differently. Spelling variants are merged automatically here, but a "
                    "controlled list at the point of entry would remove the problem at source.",
                ),
            ],
        },
    )


# --- Executive summary ------------------------------------------------------

def executive_summary(briefs: dict[str, dict]) -> list[dict]:
    """The handful of findings worth a senior manager's attention first."""
    order = ["pricing", "customer_value", "repeat_business", "churn", "seasonality"]
    out = []
    for key in order:
        brief = briefs.get(key)
        if brief:
            out.append({
                "area": key,
                "title": brief["title"],
                "value": brief["hero"]["value"],
                "caption": brief["hero"]["caption"],
                "body": brief["hero"]["body"],
            })
    return out
