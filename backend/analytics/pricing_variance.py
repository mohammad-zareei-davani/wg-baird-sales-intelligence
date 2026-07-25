"""Pricing variance from manual overrides (manadj).

manadj is how the automated price was manually overridden. This module
measures pricing *variance* requiring review — positive and negative — not
'leakage'. Absolute negative totals alone mislead: a rep can discount
heavily in pounds while remaining net positive after mark-ups.

Limitation: the dataset has no quote or win/loss records, so a discount
cannot be judged as unjustified. A lower price may have won a job that
would otherwise have been lost. Rankings flag variance for commercial
review; they do not prove value destruction.
"""

from __future__ import annotations

import pandas as pd

LIMITATION = (
    "Pricing variance identifies override patterns for review. It cannot "
    "establish that any discount was unjustified: the dataset contains no "
    "quote or win/loss records, so there is no way to know whether a "
    "discount won a job that would otherwise have been lost."
)


def _manadj_gbp(df: pd.DataFrame, config: dict) -> pd.Series:
    rate = float(config["fx"]["eur_to_gbp"])
    is_euro = df["currency"] == "Euro"
    return df["manadj"].where(~is_euro, df["manadj"] * rate)


def compute_pricing_variance(df: pd.DataFrame, config: dict) -> dict:
    work = df.copy()
    work["manadj_gbp"] = _manadj_gbp(work, config)

    mask = (~work["is_credit"].fillna(False).astype(bool)) & work["is_closed"].fillna(
        False
    ).astype(bool)
    work = work.loc[mask].copy()

    by_rep = _aggregate(work, "rep")
    by_work_type = _aggregate(work, "work_type")
    by_product_group = _aggregate(work, "product_group")
    by_product_type = _aggregate(work, "product_type_norm")
    by_customer = _aggregate_customer(work)

    net_negative_reps = [r for r in by_rep if r["net_override_gbp"] < 0]

    # Override magnitude vs achieved VA% (negative overrides only, for charting).
    negative = work.loc[work["manadj_gbp"].fillna(0) < 0].copy()
    bins = [-float("inf"), -5000, -1000, -500, -100, -10, 0]
    labels = ["<=-5000", "-5000..-1000", "-1000..-500", "-500..-100", "-100..-10", "-10..0"]
    override_vs_va = []
    if len(negative):
        negative["override_bin"] = pd.cut(negative["manadj_gbp"], bins=bins, labels=labels)
        binned = (
            negative.groupby("override_bin", observed=False)
            .agg(
                count=("manadj_gbp", "size"),
                mean_va_pct=("va_pct", "mean"),
                median_va_pct=("va_pct", "median"),
                negative_override_gbp=("manadj_gbp", "sum"),
            )
            .reset_index()
        )
        override_vs_va = [
            {
                "override_bin": str(r.override_bin),
                "count": int(r.count),
                "mean_va_pct": round(float(r.mean_va_pct), 4)
                if pd.notna(r.mean_va_pct)
                else None,
                "median_va_pct": round(float(r.median_va_pct), 4)
                if pd.notna(r.median_va_pct)
                else None,
                "negative_override_gbp": round(float(r.negative_override_gbp), 2),
            }
            for r in binned.itertuples(index=False)
        ]

    return {
        "limitation": LIMITATION,
        "primary_rank": "net_pct_of_revenue",
        "by_rep": by_rep,
        "by_work_type": by_work_type,
        "by_product_group": by_product_group,
        "by_product_type": by_product_type,
        "by_customer": by_customer,
        "net_negative_reps": net_negative_reps,
        "override_vs_va_pct": override_vs_va,
    }


# Backwards-compatible alias during the rename; API will use pricing_variance.
compute_leakage = compute_pricing_variance


def _aggregate(work: pd.DataFrame, column: str) -> list[dict]:
    if work.empty or column not in work.columns:
        return []

    rows = []
    for key, g in work.groupby(column, dropna=False):
        rows.append(_variance_row(g, key=None if pd.isna(key) else key))
    rows.sort(key=lambda r: (r["net_pct_of_revenue"] is None, r["net_pct_of_revenue"] or 0.0))
    return rows


def _aggregate_customer(work: pd.DataFrame) -> list[dict]:
    if work.empty:
        return []
    rows = []
    for (cid, cname), g in work.groupby(["customer_id", "customer_name"], dropna=False):
        row = _variance_row(g, key=cid)
        row["customer_id"] = cid
        row["customer_name"] = cname
        rows.append(row)
    rows.sort(key=lambda r: (r["net_pct_of_revenue"] is None, r["net_pct_of_revenue"] or 0.0))
    return rows


def _variance_row(g: pd.DataFrame, key) -> dict:
    manadj = g["manadj_gbp"].fillna(0.0)
    revenue = float(g["sell_price_gbp"].sum())
    neg = manadj.loc[manadj < 0]
    pos = manadj.loc[manadj > 0]
    negative_value = float(neg.sum())  # already negative
    positive_value = float(pos.sum())
    net = float(manadj.sum())
    discounted_count = int((manadj < 0).sum())
    marked_up_count = int((manadj > 0).sum())
    avg_discount = float(neg.mean()) if discounted_count else None
    net_pct = (net / revenue) if revenue else None
    return {
        "key": key,
        "negative_override_gbp": round(negative_value, 2),
        "discounted_job_count": discounted_count,
        "positive_override_gbp": round(positive_value, 2),
        "marked_up_job_count": marked_up_count,
        "net_override_gbp": round(net, 2),
        "revenue_gbp": round(revenue, 2),
        "net_pct_of_revenue": round(net_pct, 4) if net_pct is not None else None,
        "avg_discount_per_discounted_job_gbp": round(avg_discount, 2)
        if avg_discount is not None
        else None,
    }
