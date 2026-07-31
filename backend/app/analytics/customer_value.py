"""Insight 1: Most valuable customers and types of work.

Ranks customers by Value Added rather than raw sell price, because VA is
what the business keeps after paper, press and bought-in costs, so it is the
better proxy for how much a relationship is actually worth. All money is
converted to the base reporting currency first (see app.config).
"""
from __future__ import annotations

import pandas as pd

# Two accounts whose values are within this of each other read as level on a
# chart, so the narrative should name both rather than crowning one.
NEAR_TIE_PCT = 0.12
# A drop smaller than this means the next account is not meaningfully behind,
# which is where the ranked list stops being a ranking and becomes a field.
FLAT_DROP_PCT = 0.08
# How far down to look for structure. Past this the tail is the story.
MAX_RANKS_CONSIDERED = 10


def _concentration_shape(values: list[float]) -> dict:
    """Describe how value is actually distributed across the ranked accounts.

    A fixed "top five" is arbitrary and frequently wrong: sometimes two
    accounts tower over everything, sometimes the decline is gradual. Three
    things are measured instead, all of them visible on the ranked chart:

      leading_count  accounts above the largest proportional gap, i.e. the
                     group that genuinely stands apart from the rest
      tied_count     accounts at the top that are close enough to each other
                     to read as level, so the copy names all of them
      ahead_count    accounts before the point where the field flattens and
                     consecutive accounts stop being meaningfully different

    Returning all three lets the wording match the chart rather than assert a
    ranking the eye cannot see.
    """
    vals = [v for v in values if v > 0]
    n = len(vals)
    if n == 0:
        return {"leading_count": 0, "tied_count": 0, "ahead_count": 0,
                "break_drop_pct": 0.0, "flattens_at_rank": None}

    horizon = min(MAX_RANKS_CONSIDERED, n - 1)
    # drops[i] is the proportional fall from rank i+1 to rank i+2.
    drops = [1 - (vals[i + 1] / vals[i]) if vals[i] else 0.0 for i in range(horizon)]

    if drops:
        cut = max(range(len(drops)), key=lambda i: drops[i])
        leading_count = cut + 1
        break_drop = drops[cut]
    else:
        leading_count, break_drop = n, 0.0

    # How many of the leaders are level with the top one.
    tied_count = 1
    for i in range(1, n):
        if vals[0] and (1 - vals[i] / vals[0]) <= NEAR_TIE_PCT:
            tied_count = i + 1
        else:
            break

    # Where the ranked list stops separating and becomes a flat field. An
    # account only counts as standing ahead if it is meaningfully above the
    # one below it; once that gap collapses, that account is already part of
    # the field rather than the last of the leaders. Looked for from rank 3
    # down, since the top two are almost always apart.
    flattens_at = None
    for i in range(2, len(drops)):
        if drops[i] < FLAT_DROP_PCT:
            flattens_at = i + 1  # rank of the first account in the flat tail
            break
    ahead_count = (flattens_at - 1) if flattens_at else leading_count

    return {
        "leading_count": leading_count,
        "tied_count": tied_count,
        "ahead_count": max(ahead_count, leading_count),
        "break_drop_pct": round(break_drop * 100, 1),
        "flattens_at_rank": flattens_at,
    }


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

    shape = _concentration_shape(by_customer["total_va_amount"].tolist())
    lead_n = max(shape["leading_count"], 1)
    tied_n = max(shape["tied_count"], 1)
    ahead_n = max(shape["ahead_count"], 1)
    mean_va = float(by_customer["total_va_amount"].mean()) if len(by_customer) else 0.0

    def _names(k: int) -> list[str]:
        return [str(x) for x in by_customer.head(k)["customer_name"].tolist()]

    def _share(k: int) -> float:
        return round(float(by_customer.head(k)["value_share_pct"].sum()), 1)

    # The account immediately below the leading group, used to show how far
    # ahead that group actually is.
    next_after_lead = by_customer.iloc[lead_n] if len(by_customer) > lead_n else None

    concentration = {
        "customer_count": len(by_customer),
        "customers_for_80pct_value": pareto_customers,
        "pct_of_customers_for_80pct_value": round(pareto_customers / n * 100, 1),
        "top_customer_name": str(top_customer["customer_name"]) if top_customer is not None else None,
        "top_customer_share_pct": round(float(top_customer["value_share_pct"]), 1) if top_customer is not None else 0.0,
        "top_5_share_pct": _share(5),

        # Derived from the distribution rather than a fixed cut-off.
        "leading_count": lead_n,
        "leading_names": _names(lead_n),
        "leading_share_pct": _share(lead_n),
        "tied_count": tied_n,
        "tied_names": _names(tied_n),
        "tied_spread_pct": (
            round(float(
                (by_customer.iloc[0]["total_va_amount"] - by_customer.iloc[tied_n - 1]["total_va_amount"])
                / by_customer.iloc[0]["total_va_amount"] * 100
            ), 1) if tied_n > 1 and by_customer.iloc[0]["total_va_amount"] else 0.0
        ),
        "ahead_count": ahead_n,
        "ahead_share_pct": _share(ahead_n),
        "break_drop_pct": shape["break_drop_pct"],
        "flattens_at_rank": shape["flattens_at_rank"],
        "next_after_leading_share_pct": (
            round(float(next_after_lead["value_share_pct"]), 1) if next_after_lead is not None else 0.0
        ),
        "next_after_leading_name": (
            str(next_after_lead["customer_name"]) if next_after_lead is not None else None
        ),
        "mean_va": round(mean_va, 2),
        "first_tail_vs_mean": (
            round(float(by_customer.iloc[ahead_n]["total_va_amount"] / mean_va), 2)
            if len(by_customer) > ahead_n and mean_va else None
        ),
    }

    return {
        "top_customers": top_customers.round(2).to_dict(orient="records"),
        "work_type_breakdown": work_type_breakdown.round(2).to_dict(orient="records"),
        "product_breakdown": product_breakdown.round(2).to_dict(orient="records"),
        "industry_breakdown": industry_breakdown.round(2).to_dict(orient="records"),
        "concentration": concentration,
    }
