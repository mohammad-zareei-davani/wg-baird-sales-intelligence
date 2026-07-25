"""Monthly VA and revenue seasonality, with like-for-like year-on-year.

2026 is a partial year ending mid-May. YoY comparisons truncate every year
to the day-of-year range present in the partial year so early-year peaks are
not compared against full-year totals.
"""

from __future__ import annotations

import pandas as pd


def _value_mask(df: pd.DataFrame) -> pd.Series:
    return (~df["is_credit"].fillna(False).astype(bool)) & df["is_closed"].fillna(
        False
    ).astype(bool)


def compute_seasonality(
    df: pd.DataFrame,
    config: dict | None = None,
    industry: str | None = None,
    product_type: str | None = None,
    product_group: str | None = None,
) -> dict:
    del config
    work = df.loc[_value_mask(df)].copy()
    work["sales_in"] = pd.to_datetime(work["sales_in"])
    work = work.dropna(subset=["sales_in"])

    if industry:
        work = work.loc[work["industry"] == industry]
    if product_type:
        work = work.loc[work["product_type_norm"] == product_type]
    if product_group:
        work = work.loc[work["product_group"] == product_group]

    work["year"] = work["sales_in"].dt.year
    work["month"] = work["sales_in"].dt.month
    work["year_month"] = work["sales_in"].dt.to_period("M").astype(str)

    monthly = (
        work.groupby(["year", "month", "year_month"], as_index=False)
        .agg(
            va_gbp=("va_amount_gbp", "sum"),
            revenue_gbp=("sell_price_gbp", "sum"),
            job_count=("sales_in", "size"),
        )
        .sort_values(["year", "month"])
    )
    monthly_records = [
        {
            "year": int(r.year),
            "month": int(r.month),
            "year_month": r.year_month,
            "va_gbp": round(float(r.va_gbp), 2),
            "revenue_gbp": round(float(r.revenue_gbp), 2),
            "job_count": int(r.job_count),
        }
        for r in monthly.itertuples(index=False)
    ]

    by_industry = _breakdown(work, "industry")
    by_product_type = _breakdown(work, "product_type_norm")
    by_product_group = _breakdown(work, "product_group")

    yoy = _like_for_like_yoy(work)

    return {
        "monthly": monthly_records,
        "by_industry": by_industry,
        "by_product_type": by_product_type,
        "by_product_group": by_product_group,
        "like_for_like_yoy": yoy,
        "exclusions": {
            "excluded_credits": int(df["is_credit"].fillna(False).astype(bool).sum()),
            "excluded_open_jobs": int((~df["is_closed"].fillna(False).astype(bool)).sum()),
        },
    }


def _breakdown(work: pd.DataFrame, column: str) -> list[dict]:
    if column not in work.columns or work.empty:
        return []
    grouped = (
        work.groupby([column, work["sales_in"].dt.to_period("M").astype(str)])
        .agg(va_gbp=("va_amount_gbp", "sum"), revenue_gbp=("sell_price_gbp", "sum"))
        .reset_index()
    )
    grouped.columns = [column, "year_month", "va_gbp", "revenue_gbp"]
    return [
        {
            "dimension": column,
            "value": None if pd.isna(r[column]) else r[column],
            "year_month": r["year_month"],
            "va_gbp": round(float(r["va_gbp"]), 2),
            "revenue_gbp": round(float(r["revenue_gbp"]), 2),
        }
        for _, r in grouped.iterrows()
    ]


def _like_for_like_yoy(work: pd.DataFrame) -> list[dict]:
    if work.empty:
        return []
    max_year = int(work["sales_in"].dt.year.max())
    partial = work.loc[work["sales_in"].dt.year == max_year, "sales_in"]
    if partial.empty:
        return []
    max_doy = int(partial.dt.dayofyear.max())

    truncated = work.loc[work["sales_in"].dt.dayofyear <= max_doy].copy()
    annual = (
        truncated.groupby(truncated["sales_in"].dt.year)
        .agg(va_gbp=("va_amount_gbp", "sum"), revenue_gbp=("sell_price_gbp", "sum"))
        .reset_index()
        .rename(columns={"sales_in": "year"})
        .sort_values("year")
    )
    records = []
    prev_va = None
    for r in annual.itertuples(index=False):
        va = float(r.va_gbp)
        change = None if prev_va in (None, 0) else (va - prev_va) / prev_va
        records.append(
            {
                "year": int(r.year),
                "va_gbp": round(va, 2),
                "revenue_gbp": round(float(r.revenue_gbp), 2),
                "day_of_year_cap": max_doy,
                "va_yoy_change": round(change, 4) if change is not None else None,
            }
        )
        prev_va = va
    return records
