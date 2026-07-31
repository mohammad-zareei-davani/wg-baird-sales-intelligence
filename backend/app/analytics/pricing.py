"""Insight 4: Pricing discipline and margin integrity.

The estimating system produces an automated price, which an estimator can
then override before the quote goes out ("manadj" in the source data).
That override is where commercial judgement enters the process — and where
margin quietly leaks if it is not measured.

This module answers three questions a board would actually ask:
  1. How often is the automated price overridden, and by how much?
  2. Which work are we selling below cost, and who does it concentrate on?
  3. Where does discounting cluster — by account, by rep, by type of work?

Note on the below-cost jobs: negative value added can mean genuinely
loss-making work, but it can also mean a credit note or a mis-booked
job. The output is framed as an exception list for review, not an
accusation.
"""
from __future__ import annotations

import pandas as pd


def _bucket_summary(df: pd.DataFrame, by: str) -> list[dict]:
    cuts = df[df["manual_adjustment_base"] < 0]
    grouped = (
        cuts.groupby(by, as_index=False)
        .agg(
            discount_total=("manual_adjustment_base", "sum"),
            discounted_jobs=("job_id", "count"),
        )
        .sort_values("discount_total")
    )
    totals = (
        df.groupby(by, as_index=False)
        .agg(all_jobs=("job_id", "count"), sell_total=("sell_price_base", "sum"))
    )
    merged = grouped.merge(totals, on=by, how="left")
    merged["discount_total"] = merged["discount_total"].abs()
    merged["discount_as_pct_of_sales"] = (
        merged["discount_total"] / merged["sell_total"].replace(0, pd.NA) * 100
    ).fillna(0.0)
    merged = merged.rename(columns={by: "name"})
    return merged.round(2).to_dict(orient="records")


def pricing_analysis(df: pd.DataFrame, top_n: int = 12) -> dict:
    total_jobs = len(df)
    adj = df["manual_adjustment_base"]

    overridden = df[adj != 0]
    cuts = df[adj < 0]
    uplifts = df[adj > 0]

    total_sell = float(df["sell_price_base"].sum())
    discount_total = float(cuts["manual_adjustment_base"].sum())
    uplift_total = float(uplifts["manual_adjustment_base"].sum())

    below_cost = df[df["is_below_cost"]]
    low_margin = df[df["is_low_margin"]]

    below_cost_by_customer = (
        below_cost.groupby("customer_name", as_index=False)
        .agg(
            job_count=("job_id", "count"),
            va_amount=("va_amount_base", "sum"),
            sell_price=("sell_price_base", "sum"),
        )
        .sort_values("va_amount")
        .head(top_n)
    )

    discount_by_customer = (
        cuts.groupby("customer_name", as_index=False)
        .agg(
            discount_total=("manual_adjustment_base", "sum"),
            discounted_jobs=("job_id", "count"),
        )
        .assign(discount_total=lambda d: d["discount_total"].abs())
        .sort_values("discount_total", ascending=False)
        .head(top_n)
    )
    customer_sales = df.groupby("customer_name", as_index=False).agg(
        sell_total=("sell_price_base", "sum"), all_jobs=("job_id", "count")
    )
    discount_by_customer = discount_by_customer.merge(customer_sales, on="customer_name", how="left")
    discount_by_customer["discount_as_pct_of_sales"] = (
        discount_by_customer["discount_total"] / discount_by_customer["sell_total"].replace(0, pd.NA) * 100
    ).fillna(0.0)

    below_cost_total = float(below_cost["va_amount_base"].sum())
    worst_customer = below_cost_by_customer.iloc[0] if len(below_cost_by_customer) else None
    top_discount_customer = discount_by_customer.iloc[0] if len(discount_by_customer) else None

    return {
        "summary": {
            "total_jobs": total_jobs,
            "overridden_jobs": len(overridden),
            "overridden_pct": round(len(overridden) / total_jobs * 100, 1) if total_jobs else 0.0,
            "discounted_jobs": len(cuts),
            "uplifted_jobs": len(uplifts),
            "discount_total": round(abs(discount_total), 2),
            "uplift_total": round(uplift_total, 2),
            "net_adjustment": round(uplift_total + discount_total, 2),
            "discount_as_pct_of_sales": round(abs(discount_total) / total_sell * 100, 2) if total_sell else 0.0,
            "below_cost_jobs": len(below_cost),
            "below_cost_va": round(below_cost_total, 2),
            "low_margin_jobs": len(low_margin),
            "low_margin_pct": round(len(low_margin) / total_jobs * 100, 1) if total_jobs else 0.0,
            "low_margin_sell_value": round(float(low_margin["sell_price_base"].sum()), 2),
            "worst_below_cost_customer": str(worst_customer["customer_name"]) if worst_customer is not None else None,
            "worst_below_cost_share_pct": (
                round(float(worst_customer["va_amount"]) / below_cost_total * 100, 1)
                if worst_customer is not None and below_cost_total else 0.0
            ),
            "top_discount_customer": str(top_discount_customer["customer_name"]) if top_discount_customer is not None else None,
            "top_discount_amount": round(float(top_discount_customer["discount_total"]), 2) if top_discount_customer is not None else 0.0,
        },
        "discount_by_customer": discount_by_customer.round(2).to_dict(orient="records"),
        "discount_by_rep": _bucket_summary(df, "rep"),
        "discount_by_work_type": _bucket_summary(df, "work_type"),
        "below_cost_by_customer": below_cost_by_customer.round(2).to_dict(orient="records"),
    }
