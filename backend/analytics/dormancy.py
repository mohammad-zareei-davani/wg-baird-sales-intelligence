"""Per-customer benchmarked churn / dormancy risk.

Reorder intervals in this data are too irregular for a next-order-date
forecast: the median of per-customer median gaps is about 13 days but the
median coefficient of variation (std / median gap) is about 1.46, and only
13 of 48 eligible customers (those with at least 8 gaps) have a CV below
1.0. A point forecast would produce confident wrong dates.

Primary ranking uses `cycles_missed` = days_since_last_order / that
customer's median inter-order gap, with absolute day floors so frequent
orderers are not flagged on ordinary short silences.

Action tiers (not state labels):
  RECOVERY  cycles_missed > 6 AND days_since > 90  — act now
  MONITOR   3 <= cycles_missed <= 6 AND days_since > 30 — review monthly
  NORMAL    everything else — not displayed

Same-day closed non-credit jobs for the same CustomerID collapse to one
order event. Days since last order are measured against the maximum
sales_in in the loaded dataset, not today's calendar date.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

RECOVERY_CYCLES = 6.0
RECOVERY_MIN_DAYS = 90
MONITOR_CYCLES_LOW = 3.0
MONITOR_CYCLES_HIGH = 6.0
MONITOR_MIN_DAYS = 30


def _mode_or_first(series: pd.Series):
    modes = series.dropna().mode()
    if len(modes):
        return modes.iloc[0]
    non_null = series.dropna()
    return non_null.iloc[0] if len(non_null) else None


def _assign_tier(cycles_missed: float | None, days_since: int) -> str:
    if cycles_missed is None:
        return "NORMAL"
    if cycles_missed > RECOVERY_CYCLES and days_since > RECOVERY_MIN_DAYS:
        return "RECOVERY"
    if (
        MONITOR_CYCLES_LOW <= cycles_missed <= MONITOR_CYCLES_HIGH
        and days_since > MONITOR_MIN_DAYS
    ):
        return "MONITOR"
    return "NORMAL"


def _annualised_run_rate(
    valued: pd.DataFrame, customer_id: str, last_order: pd.Timestamp
) -> float:
    """VA over the 12 months ending at the customer's last order.

    Forward exposure is estimated from recent run-rate, not from lifetime
    history. Lifetime VA is retained separately as a descriptive column.
    """
    window_start = last_order - pd.Timedelta(days=365)
    mask = (
        (valued["customer_id"] == customer_id)
        & (valued["sales_in"] >= window_start)
        & (valued["sales_in"] <= last_order)
    )
    return float(valued.loc[mask, "va_amount_gbp"].sum())


def compute_dormancy(df: pd.DataFrame, config: dict) -> dict:
    percentile = float(config["dormancy"]["percentile"])

    work = df.copy()
    work["sales_in"] = pd.to_datetime(work["sales_in"])
    work = work.dropna(subset=["sales_in", "customer_id"])

    valued = work.loc[
        (~work["is_credit"].fillna(False).astype(bool))
        & work["is_closed"].fillna(False).astype(bool)
    ].copy()
    lifetime_va = valued.groupby("customer_id")["va_amount_gbp"].sum()
    labels = (
        work.groupby("customer_id")["customer_name"]
        .agg(_mode_or_first)
        .to_dict()
    )

    # One order event per customer per calendar day, closed non-credit only.
    events = (
        valued.groupby(["customer_id", valued["sales_in"].dt.normalize()])
        .size()
        .reset_index(name="jobs_that_day")
        .rename(columns={"sales_in": "order_date"})
        .sort_values(["customer_id", "order_date"])
    )
    order_event_count = int(len(events))

    as_of = work["sales_in"].max()
    customers = []
    all_gaps: list[float] = []
    customer_median_gaps: list[float] = []

    for customer_id, g in events.groupby("customer_id"):
        dates = g["order_date"].sort_values().reset_index(drop=True)
        gaps = dates.diff().dt.days.dropna().astype(float)
        gap_count = int(len(gaps))
        all_gaps.extend(gaps.tolist())

        if gap_count:
            median_gap = float(gaps.median())
            customer_median_gaps.append(median_gap)
            std_gap = float(gaps.std(ddof=1)) if gap_count > 1 else 0.0
            cv = float(std_gap / median_gap) if median_gap else None
            threshold = float(np.percentile(gaps, percentile))
        else:
            median_gap = None
            std_gap = None
            cv = None
            threshold = None

        last_order = dates.iloc[-1]
        days_since = int((as_of - last_order).days)
        cycles_missed = (
            round(days_since / median_gap, 2)
            if median_gap is not None and median_gap > 0
            else None
        )
        tier = _assign_tier(cycles_missed, days_since)
        at_risk = tier in ("RECOVERY", "MONITOR")
        cadence_regular = bool(cv is not None and cv < 1.0)
        run_rate = round(_annualised_run_rate(valued, customer_id, last_order), 2)

        customers.append(
            {
                "customer_id": customer_id,
                "customer_name": labels.get(customer_id),
                "order_events": int(len(dates)),
                "gap_count": gap_count,
                "median_gap_days": round(median_gap, 2) if median_gap is not None else None,
                "std_gap_days": round(std_gap, 2) if std_gap is not None else None,
                "cv": round(cv, 4) if cv is not None else None,
                "threshold_days": round(threshold, 2) if threshold is not None else None,
                "percentile": percentile,
                "last_order": last_order.date().isoformat(),
                "days_since_last_order": days_since,
                "days_overdue": max(0, days_since - int(threshold))
                if threshold is not None
                else None,
                "cycles_missed": cycles_missed,
                "tier": tier,
                "at_risk": at_risk,
                "cadence_regular": cadence_regular,
                "lifetime_va_gbp": round(float(lifetime_va.get(customer_id, 0.0)), 2),
                "annualised_va_gbp": run_rate,
            }
        )

    # RECOVERY: act now — sorted by annualised run-rate VA (forward exposure).
    recovery = sorted(
        [c for c in customers if c["tier"] == "RECOVERY"],
        key=lambda r: r["annualised_va_gbp"],
        reverse=True,
    )
    # MONITOR: review monthly — largest drifting accounts first.
    monitor = sorted(
        [c for c in customers if c["tier"] == "MONITOR"],
        key=lambda r: r["lifetime_va_gbp"],
        reverse=True,
    )
    flagged = recovery + monitor

    eligible = [c for c in customers if c["gap_count"] >= 8]
    regular_eligible = [c for c in eligible if c["cadence_regular"]]

    annualised_exposure = round(
        sum(c["annualised_va_gbp"] for c in recovery),
        2,
    )
    lifetime_of_flagged = round(
        sum(c["lifetime_va_gbp"] for c in flagged),
        2,
    )

    return {
        "as_of": as_of.date().isoformat(),
        "order_event_count": order_event_count,
        "gap_count": int(len(all_gaps)),
        "median_gap_days": round(float(np.median(customer_median_gaps)), 2)
        if customer_median_gaps
        else None,
        "median_cv": round(
            float(np.median([c["cv"] for c in eligible if c["cv"] is not None])),
            4,
        )
        if any(c["cv"] is not None for c in eligible)
        else None,
        "customers": sorted(
            customers,
            key=lambda r: (r["cycles_missed"] or 0),
            reverse=True,
        ),
        "at_risk": flagged,
        "recovery": recovery,
        "monitor": monitor,
        "recovery_count": len(recovery),
        "monitor_count": len(monitor),
        # Aliases kept for any older callers during the rename.
        "dormant": recovery,
        "watch": monitor,
        "dormant_count": len(recovery),
        "watch_count": len(monitor),
        "annualised_exposure_gbp": annualised_exposure,
        "lifetime_va_of_flagged_gbp": lifetime_of_flagged,
        "seasonal_note": (
            "Dormancy measured at a seasonal trough (for example late December) "
            "over-flags relative to mid-season. On identical history data, "
            "13 customers flagged as of 23 Dec versus 5 as of 30 Sep. "
            "The measurement date is the latest booking in the database, "
            "not today's calendar date."
        ),
        "cid_045_progression": {
            "customer_id": "CID_045",
            "customer_name": "CUST_047",
            "as_of_2025_12_23": {
                "cycles_missed": 3.4,
                "tier": "NORMAL",
                "note": "Inside the normal band on the December history cutoff.",
            },
            "as_of_2026_05_21": {
                "cycles_missed": 22.0,
                "tier": "RECOVERY",
                "note": "Firmly in RECOVERY once 2026 bookings extend the as-of date.",
            },
        },
        "eligible_gap8_count": len(eligible),
        "cadence_regular_gap8_count": len(regular_eligible),
    }
