"""Insight 3: Customer churn / dormancy and follow-up opportunities.

A customer's own order history sets the baseline for what "normal" looks
like for them — a customer who orders every 2 weeks going quiet for 45
days is a much stronger churn signal than the same gap for a customer who
orders twice a year. So dormancy is scored relative to each customer's own
historical cadence, not a single global cutoff. Customers with only one
order fall back to fixed absolute thresholds since they have no cadence.
"""
from __future__ import annotations

import pandas as pd

FALLBACK_AT_RISK_DAYS = 120
FALLBACK_DORMANT_DAYS = 270


def _status_from_ratio(ratio: float) -> str:
    if ratio <= 1.25:
        return "Active"
    if ratio <= 2.5:
        return "At Risk"
    return "Dormant"


def _status_from_absolute(days_since: int) -> str:
    if days_since <= FALLBACK_AT_RISK_DAYS:
        return "Active"
    if days_since <= FALLBACK_DORMANT_DAYS:
        return "At Risk"
    return "Dormant"


def churn_analysis(df: pd.DataFrame, as_of: pd.Timestamp) -> dict:
    orders = (
        df.groupby(["customer_id", "customer_name"], as_index=False)
        .agg(
            order_dates=("sales_in", lambda s: sorted(s.unique())),
            lifetime_va=("va_amount", "sum"),
            lifetime_sell=("sell_price", "sum"),
            job_count=("job_id", "count"),
            industry=("industry", "first"),
            region=("region", "first"),
            rep=("rep", "first"),
        )
    )

    records = []
    for _, row in orders.iterrows():
        dates = pd.to_datetime(pd.Series(row["order_dates"]))
        last_order = dates.iloc[-1]
        days_since = (as_of - last_order).days
        order_count = len(dates)

        if order_count >= 3:
            gaps = dates.diff().dropna().dt.days
            avg_interval = gaps.mean()
            ratio = days_since / avg_interval if avg_interval else days_since
            status = _status_from_ratio(ratio)
            basis = "relative"
        else:
            avg_interval = None
            status = _status_from_absolute(days_since)
            basis = "absolute"

        records.append({
            "customer_id": row["customer_id"],
            "customer_name": row["customer_name"],
            "industry": row["industry"],
            "region": row["region"],
            "rep": row["rep"],
            "order_count": int(order_count),
            "last_order_date": last_order.strftime("%Y-%m-%d"),
            "days_since_last_order": int(days_since),
            "avg_interval_days": round(avg_interval, 1) if avg_interval is not None else None,
            "basis": basis,
            "status": status,
            "lifetime_va_amount": round(row["lifetime_va"], 2),
            "lifetime_sell_price": round(row["lifetime_sell"], 2),
        })

    result = pd.DataFrame(records)

    status_counts = result["status"].value_counts().to_dict()

    follow_up = (
        result[result["status"].isin(["At Risk", "Dormant"])]
        .sort_values(["status", "lifetime_va_amount"], ascending=[True, False])
    )

    return {
        "customers": result.sort_values("lifetime_va_amount", ascending=False).to_dict(orient="records"),
        "follow_up_opportunities": follow_up.to_dict(orient="records"),
        "status_counts": {
            "Active": int(status_counts.get("Active", 0)),
            "At Risk": int(status_counts.get("At Risk", 0)),
            "Dormant": int(status_counts.get("Dormant", 0)),
        },
        "dormant_lifetime_value_at_stake": round(
            result.loc[result["status"] == "Dormant", "lifetime_va_amount"].sum(), 2
        ),
    }
