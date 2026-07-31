"""Insight 6: Turnaround and delivery performance.

Lead time is measured from the date the order is booked in to the date it
ships. Speed is one of the things customers actually notice, so this
tracks how long work takes by type, whether it is improving or slipping,
and which work sits in the long tail.

Turnaround varies legitimately by product. A 30,000-copy educational book
is not a business-card run, so performance is judged per product against
that product's own typical turnaround rather than one company-wide target.
"""
from __future__ import annotations

import pandas as pd


def delivery_analysis(df: pd.DataFrame, min_jobs: int = 20) -> dict:
    d = df[df["lead_time_days"].notna()].copy()
    if d.empty:
        return {"summary": {}, "by_work_type": [], "by_product": [], "monthly_trend": [], "slowest_jobs": []}

    overall_median = float(d["lead_time_days"].median())

    by_work_type = (
        d.groupby("work_type", as_index=False)
        .agg(
            job_count=("job_id", "count"),
            median_days=("lead_time_days", "median"),
            mean_days=("lead_time_days", "mean"),
            p90_days=("lead_time_days", lambda s: s.quantile(0.9)),
        )
        .sort_values("median_days")
    )

    by_product = (
        d.groupby("product_type_clean", as_index=False)
        .agg(
            job_count=("job_id", "count"),
            median_days=("lead_time_days", "median"),
            p90_days=("lead_time_days", lambda s: s.quantile(0.9)),
            sell_price=("sell_price_base", "sum"),
        )
        .rename(columns={"product_type_clean": "product_type"})
    )
    by_product = by_product[by_product["job_count"] >= min_jobs].sort_values("median_days", ascending=False)

    monthly_trend = (
        d.groupby("month_start", as_index=False)
        .agg(median_days=("lead_time_days", "median"), job_count=("job_id", "count"))
        .sort_values("month_start")
    )
    monthly_trend["month_start"] = monthly_trend["month_start"].dt.strftime("%Y-%m-%d")

    # "Slow" is relative to what that product normally takes, so a long book
    # run is not flagged simply for being a book.
    product_median = d.groupby("product_type_clean")["lead_time_days"].transform("median")
    d["days_over_product_norm"] = d["lead_time_days"] - product_median
    slowest = (
        d.sort_values("days_over_product_norm", ascending=False)
        .head(15)[[
            "job_id", "customer_name", "product_type_clean", "work_type",
            "lead_time_days", "days_over_product_norm", "sell_price_base",
        ]]
        .rename(columns={"product_type_clean": "product_type", "sell_price_base": "sell_price"})
    )

    recent = monthly_trend.tail(6)["median_days"].mean()
    prior = monthly_trend.head(max(len(monthly_trend) - 6, 1))["median_days"].mean()
    trend_change = float(recent - prior) if len(monthly_trend) > 6 else 0.0

    fastest_row = by_work_type.iloc[0]
    slowest_row = by_work_type.iloc[-1]

    return {
        "summary": {
            "jobs_measured": len(d),
            "coverage_pct": round(len(d) / len(df) * 100, 1),
            "median_days": round(overall_median, 1),
            "mean_days": round(float(d["lead_time_days"].mean()), 1),
            "p90_days": round(float(d["lead_time_days"].quantile(0.9)), 1),
            "fastest_work_type": str(fastest_row["work_type"]),
            "fastest_median_days": round(float(fastest_row["median_days"]), 1),
            "slowest_work_type": str(slowest_row["work_type"]),
            "slowest_median_days": round(float(slowest_row["median_days"]), 1),
            "recent_vs_prior_days": round(trend_change, 1),
            "direction": "slower" if trend_change > 0.5 else ("faster" if trend_change < -0.5 else "stable"),
        },
        "by_work_type": by_work_type.round(1).to_dict(orient="records"),
        "by_product": by_product.round(1).to_dict(orient="records"),
        "monthly_trend": monthly_trend.round(1).to_dict(orient="records"),
        "slowest_jobs": slowest.round(1).to_dict(orient="records"),
    }
