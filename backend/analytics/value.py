"""Customer value segmentation on value added (VA), not revenue.

All customer aggregations key on CustomerID. Customer Name is carried as a
display label only — the two anonymisation schemes are 1:1 but do not share
numeric identity.

VA% aggregation uses the median after excluding values outside a sane band
(±100%). Extreme negative ratios are credit or rework adjustments and would
otherwise drag the mean below zero on otherwise healthy accounts. The
cost-to-serve index requires at least eight jobs; thin books are reported
as null rather than ranked.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

# Exclude VA% outside ±100% before any aggregation. Values such as -290% are
# credit/rework adjustments, not achievable margin on a commercial job.
VA_PCT_BAND = (-1.0, 1.0)
COST_TO_SERVE_MIN_JOBS = 8


def _value_frame(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, int]]:
    credits = int(df["is_credit"].fillna(False).astype(bool).sum())
    open_jobs = int((~df["is_closed"].fillna(False).astype(bool)).sum())
    keep = (~df["is_credit"].fillna(False).astype(bool)) & df["is_closed"].fillna(
        False
    ).astype(bool)
    excluded = {
        "excluded_credits": credits,
        "excluded_open_jobs": open_jobs,
        "rows_included": int(keep.sum()),
        "rows_total": int(len(df)),
    }
    return df.loc[keep].copy(), excluded


def _mode_or_first(series: pd.Series) -> Any:
    modes = series.dropna().mode()
    if len(modes):
        return modes.iloc[0]
    non_null = series.dropna()
    return non_null.iloc[0] if len(non_null) else None


def _median_va_pct(series: pd.Series) -> float | None:
    """Median VA% after excluding values outside the sane band."""
    clean = series.dropna()
    clean = clean.loc[(clean >= VA_PCT_BAND[0]) & (clean <= VA_PCT_BAND[1])]
    if clean.empty:
        return None
    return round(float(clean.median()), 4)


def customer_value_table(df: pd.DataFrame, config: dict | None = None) -> dict:
    """Per-customer VA metrics, concentration curves, and volume-vs-value."""
    del config  # reserved for future knobs; value logic has none yet
    valued, exclusions = _value_frame(df)

    if valued.empty:
        return {
            "customers": [],
            "concentration": {"va": [], "revenue": []},
            "volume_vs_value": [],
            "exclusions": exclusions,
            "cost_to_serve_min_jobs": COST_TO_SERVE_MIN_JOBS,
        }

    sales_in = pd.to_datetime(valued["sales_in"])
    valued = valued.assign(_sales_in=sales_in)

    grouped = valued.groupby("customer_id", dropna=False)
    rows = []
    for customer_id, g in grouped:
        va_total = float(g["va_amount_gbp"].sum())
        rev_total = float(g["sell_price_gbp"].sum())
        job_count = int(len(g))
        rows.append(
            {
                "customer_id": customer_id,
                "customer_name": _mode_or_first(g["customer_name"]),
                "total_va_gbp": round(va_total, 2),
                "total_revenue_gbp": round(rev_total, 2),
                "job_count": job_count,
                "va_per_job": round(va_total / job_count, 2) if job_count else 0.0,
                "mean_va_per_24": round(float(g["va_per_24"].mean()), 2)
                if g["va_per_24"].notna().any()
                else None,
                "median_va_pct": _median_va_pct(g["va_pct"]),
                "first_order": g["_sales_in"].min().date().isoformat(),
                "last_order": g["_sales_in"].max().date().isoformat(),
                "industry": _mode_or_first(g["industry"]),
                "region": _mode_or_first(g["region"]),
                "primary_rep": _mode_or_first(g["rep"]),
            }
        )

    customers = sorted(rows, key=lambda r: r["total_va_gbp"], reverse=True)

    # Portfolio median for the cost-to-serve index uses only books with enough
    # jobs; otherwise a two-job account can invent an absurd index.
    eligible_for_index = [
        c for c in customers if c["job_count"] >= COST_TO_SERVE_MIN_JOBS
    ]
    portfolio_median_va_per_job = (
        float(np.median([c["va_per_job"] for c in eligible_for_index]))
        if eligible_for_index
        else 0.0
    )

    for c in customers:
        if c["job_count"] < COST_TO_SERVE_MIN_JOBS or not portfolio_median_va_per_job:
            c["cost_to_serve_index"] = None
        else:
            c["cost_to_serve_index"] = round(
                float(c["va_per_job"] / portfolio_median_va_per_job),
                3,
            )

    concentration = {
        "va": _concentration_curve(customers, "total_va_gbp"),
        "revenue": _concentration_curve(customers, "total_revenue_gbp"),
    }

    volume_vs_value = [
        {
            "customer_id": c["customer_id"],
            "customer_name": c["customer_name"],
            "job_count": c["job_count"],
            "total_va_gbp": c["total_va_gbp"],
            "total_revenue_gbp": c["total_revenue_gbp"],
            "va_per_job": c["va_per_job"],
            "cost_to_serve_index": c["cost_to_serve_index"],
        }
        for c in customers
    ]

    return {
        "customers": customers,
        "concentration": concentration,
        "volume_vs_value": volume_vs_value,
        "exclusions": exclusions,
        "portfolio_median_va_per_job": round(portfolio_median_va_per_job, 2),
        "cost_to_serve_min_jobs": COST_TO_SERVE_MIN_JOBS,
    }


def _concentration_curve(customers: list[dict], value_key: str) -> list[dict]:
    total = sum(c[value_key] for c in customers)
    cumulative = 0.0
    curve = []
    ranked = sorted(customers, key=lambda r: r[value_key], reverse=True)
    for rank, c in enumerate(ranked, start=1):
        cumulative += c[value_key]
        curve.append(
            {
                "rank": rank,
                "customer_id": c["customer_id"],
                "customer_name": c["customer_name"],
                "value": round(c[value_key], 2),
                "cumulative_share": round(cumulative / total, 4) if total else 0.0,
            }
        )
    return curve
