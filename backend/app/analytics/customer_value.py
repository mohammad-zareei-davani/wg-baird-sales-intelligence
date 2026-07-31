"""Insight 1: Most valuable customers and types of work.

Ranks customers by Value Added rather than raw sell price, because VA is
what the business keeps after paper, press and bought-in costs — it is the
better proxy for how much a relationship is actually worth. All money is
converted to the base reporting currency first (see app.config).
"""
from __future__ import annotations

import pandas as pd


def customer_value_summary(df: pd.DataFrame, top_n: int = 15) -> dict:
    by_customer = (
        df.groupby(["customer_id", "customer_name"], as_index=False)
        .agg(
            total_sell_price=("sell_price_base", "sum"),
            total_va_amount=("va_amount_base", "sum"),
            total_quantity=("quantity", "sum"),
            job_count=("job_id", "count"),
            avg_va_pct=("va_pct", "mean"),
            last_order=("sales_in", "max"),
            first_order=("sales_in", "min"),
            industry=("industry", "first"),
            region=("region", "first"),
            rep=("rep", "first"),
        )
        .sort_values("total_va_amount", ascending=False)
    )

    top_work_type = (
        df.groupby(["customer_id", "work_type"], as_index=False)["va_amount_base"]
        .sum()
        .sort_values("va_amount_base", ascending=False)
        .drop_duplicates("customer_id")
        .set_index("customer_id")["work_type"]
    )
    by_customer["top_work_type"] = by_customer["customer_id"].map(top_work_type)

    total_va = by_customer["total_va_amount"].sum()
    by_customer["value_share_pct"] = (
        (by_customer["total_va_amount"] / total_va * 100) if total_va else 0.0
    )

    top_customers = by_customer.head(top_n).copy()
    top_customers["last_order"] = top_customers["last_order"].dt.strftime("%Y-%m-%d")
    top_customers["first_order"] = top_customers["first_order"].dt.strftime("%Y-%m-%d")

    work_type_breakdown = (
        df.groupby("work_type", as_index=False)
        .agg(
            total_va_amount=("va_amount_base", "sum"),
            total_sell_price=("sell_price_base", "sum"),
            job_count=("job_id", "count"),
            avg_va_pct=("va_pct", "mean"),
        )
        .sort_values("total_va_amount", ascending=False)
    )

    product_breakdown = (
        df.groupby("product_type_clean", as_index=False)
        .agg(
            total_va_amount=("va_amount_base", "sum"),
            total_sell_price=("sell_price_base", "sum"),
            job_count=("job_id", "count"),
            avg_va_pct=("va_pct", "mean"),
        )
        .rename(columns={"product_type_clean": "product_type"})
        .sort_values("total_va_amount", ascending=False)
        .head(10)
    )

    industry_breakdown = (
        df.groupby("industry", as_index=False)
        .agg(
            total_va_amount=("va_amount_base", "sum"),
            job_count=("job_id", "count"),
            customer_count=("customer_id", "nunique"),
        )
        .sort_values("total_va_amount", ascending=False)
    )

    n = max(len(by_customer), 1)
    cum_share = by_customer["value_share_pct"].cumsum()
    pareto_customers = int((cum_share <= 80).sum()) or 1
    top_customer = by_customer.iloc[0] if len(by_customer) else None

    concentration = {
        "customer_count": len(by_customer),
        "customers_for_80pct_value": pareto_customers,
        "pct_of_customers_for_80pct_value": round(pareto_customers / n * 100, 1),
        "top_customer_name": str(top_customer["customer_name"]) if top_customer is not None else None,
        "top_customer_share_pct": round(float(top_customer["value_share_pct"]), 1) if top_customer is not None else 0.0,
        "top_5_share_pct": round(float(by_customer.head(5)["value_share_pct"].sum()), 1),
    }

    return {
        "top_customers": top_customers.round(2).to_dict(orient="records"),
        "work_type_breakdown": work_type_breakdown.round(2).to_dict(orient="records"),
        "product_breakdown": product_breakdown.round(2).to_dict(orient="records"),
        "industry_breakdown": industry_breakdown.round(2).to_dict(orient="records"),
        "concentration": concentration,
    }
