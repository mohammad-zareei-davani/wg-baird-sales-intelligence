"""Insight 2: Reorder values and predicted timelines.

For each customer we treat every distinct booking date as one "order
event" (a customer can have multiple jobs on the same day). From the
sequence of order events we derive:
  - average time between orders (the reorder cadence)
  - how regular that cadence is (coefficient of variation of the gaps)
  - a naive forecast of the next order date and its expected value

This is a simple heuristic (moving average), not a trained model — it is
transparent and defensible for a first cut, and swappable for a real
survival/time-series model later without changing the API shape.
"""
from __future__ import annotations

import pandas as pd

MIN_ORDERS_FOR_PREDICTION = 3


def _regularity_label(cv: float) -> str:
    if cv < 0.4:
        return "Regular"
    if cv < 0.9:
        return "Variable"
    return "Irregular"


def reorder_predictions(df: pd.DataFrame, as_of: pd.Timestamp, recent_n: int = 3) -> dict:
    orders = (
        df.groupby(["customer_id", "customer_name", "sales_in"], as_index=False)
        .agg(order_value=("sell_price", "sum"), order_va=("va_amount", "sum"))
        .sort_values(["customer_id", "sales_in"])
    )

    records = []
    for (cust_id, cust_name), g in orders.groupby(["customer_id", "customer_name"]):
        g = g.sort_values("sales_in")
        dates = g["sales_in"]
        order_count = len(g)
        last_order = dates.iloc[-1]
        avg_order_value = g["order_value"].mean()

        if order_count < MIN_ORDERS_FOR_PREDICTION:
            records.append({
                "customer_id": cust_id,
                "customer_name": cust_name,
                "order_count": order_count,
                "avg_interval_days": None,
                "regularity": "Insufficient history",
                "last_order_date": last_order.strftime("%Y-%m-%d"),
                "predicted_next_order_date": None,
                "days_until_predicted": None,
                "avg_order_value": round(avg_order_value, 2),
                "predicted_next_order_value": None,
                "status": "Insufficient history",
            })
            continue

        gaps = dates.diff().dropna().dt.days
        mean_gap = gaps.mean()
        std_gap = gaps.std(ddof=0) or 0.0
        cv = (std_gap / mean_gap) if mean_gap else 0.0

        predicted_next = last_order + pd.Timedelta(days=round(mean_gap))
        days_until = (predicted_next - as_of).days
        recent_value = g["order_value"].tail(recent_n).mean()

        status = "Overdue" if days_until < 0 else ("Due soon" if days_until <= 14 else "On track")

        records.append({
            "customer_id": cust_id,
            "customer_name": cust_name,
            "order_count": order_count,
            "avg_interval_days": round(mean_gap, 1),
            "regularity": _regularity_label(cv),
            "last_order_date": last_order.strftime("%Y-%m-%d"),
            "predicted_next_order_date": predicted_next.strftime("%Y-%m-%d"),
            "days_until_predicted": days_until,
            "avg_order_value": round(avg_order_value, 2),
            "predicted_next_order_value": round(recent_value, 2),
            "status": status,
        })

    result = pd.DataFrame(records)
    predictable = result[result["status"] != "Insufficient history"].sort_values("days_until_predicted")
    others = result[result["status"] == "Insufficient history"]
    ordered = pd.concat([predictable, others], ignore_index=True)

    summary = {
        "predictable_customers": int(len(predictable)),
        "overdue_count": int((predictable["status"] == "Overdue").sum()) if len(predictable) else 0,
        "due_soon_count": int((predictable["status"] == "Due soon").sum()) if len(predictable) else 0,
        "expected_value_next_30_days": round(
            predictable.loc[
                predictable["days_until_predicted"].between(-10_000, 30), "predicted_next_order_value"
            ].sum(),
            2,
        ) if len(predictable) else 0.0,
    }

    return {
        "customers": ordered.where(pd.notnull(ordered), None).to_dict(orient="records"),
        "summary": summary,
    }
