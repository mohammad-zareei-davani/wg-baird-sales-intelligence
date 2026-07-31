"""Insight 7: Repeat and reprint work.

The same job title reappears for the same customer across the dataset —
these are reprints of work already set up and run before. For a printer
this is the most valuable revenue there is: the origination is already
done, the specification is known, and the reorder is predictable.

Knowing which titles reprint, on what cycle, and which are now overdue
turns a reactive order book into a callable pipeline.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from app.config import MIN_REPRINT_CYCLE_DAYS


def repeat_business_analysis(df: pd.DataFrame, as_of: pd.Timestamp, top_n: int = 20) -> dict:
    titles = (
        df.groupby(["customer_id", "customer_name", "job_id"], as_index=False)
        .agg(
            print_runs=("sales_in", "count"),
            first_run=("sales_in", "min"),
            last_run=("sales_in", "max"),
            total_sell=("sell_price_base", "sum"),
            total_va=("va_amount_base", "sum"),
            total_quantity=("quantity", "sum"),
            product_type=("product_type_clean", "first"),
        )
    )

    total_sell_all = float(titles["total_sell"].sum())
    repeat = titles[titles["print_runs"] > 1].copy()
    one_off = titles[titles["print_runs"] == 1]

    repeat_sell = float(repeat["total_sell"].sum())

    # Average cycle between reprints, and whether the next one is overdue.
    span_days = (repeat["last_run"] - repeat["first_run"]).dt.days
    repeat["avg_cycle_days"] = (span_days / (repeat["print_runs"] - 1)).round(1)
    repeat["days_since_last_run"] = (as_of - repeat["last_run"]).dt.days
    # Titles whose runs all landed on one day have no measurable cycle, so
    # they are left as NaN rather than counted as infinitely overdue.
    repeat["cycles_overdue"] = (
        repeat["days_since_last_run"] / repeat["avg_cycle_days"].replace(0, np.nan)
    )
    repeat["avg_value_per_run"] = repeat["total_sell"] / repeat["print_runs"]

    all_due = repeat[
        (repeat["cycles_overdue"] >= 1.0)
        & (repeat["avg_cycle_days"] >= MIN_REPRINT_CYCLE_DAYS)
    ]
    due_now = all_due.sort_values("avg_value_per_run", ascending=False).head(top_n).copy()

    top_titles = repeat.sort_values("total_sell", ascending=False).head(top_n).copy()

    for frame in (due_now, top_titles):
        frame["first_run"] = frame["first_run"].dt.strftime("%Y-%m-%d")
        frame["last_run"] = frame["last_run"].dt.strftime("%Y-%m-%d")

    by_product = (
        repeat.groupby("product_type", as_index=False)
        .agg(titles=("job_id", "count"), total_sell=("total_sell", "sum"), runs=("print_runs", "sum"))
        .sort_values("total_sell", ascending=False)
        .head(8)
    )

    # Pipeline value counts every overdue title, not just the ones shown.
    pipeline_value = float(all_due["avg_value_per_run"].sum())

    return {
        "summary": {
            "distinct_titles": len(titles),
            "repeat_titles": len(repeat),
            "one_off_titles": len(one_off),
            "repeat_title_pct": round(len(repeat) / len(titles) * 100, 1) if len(titles) else 0.0,
            "repeat_revenue": round(repeat_sell, 2),
            "repeat_revenue_pct": round(repeat_sell / total_sell_all * 100, 1) if total_sell_all else 0.0,
            "avg_runs_per_repeat_title": round(float(repeat["print_runs"].mean()), 1) if len(repeat) else 0.0,
            "max_runs": int(repeat["print_runs"].max()) if len(repeat) else 0,
            "titles_due_reprint": len(all_due),
            "reprint_pipeline_value": round(pipeline_value, 2),
        },
        "due_for_reprint": due_now.round(2).to_dict(orient="records"),
        "top_repeat_titles": top_titles.round(2).to_dict(orient="records"),
        "by_product": by_product.round(2).to_dict(orient="records"),
    }
