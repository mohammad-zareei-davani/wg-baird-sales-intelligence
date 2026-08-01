"""Builds a complete report from an uploaded dataset, once.

Everything the dashboard renders is produced here and stored as a single
payload: the analytics, the pricing model, and the written commentary.
Returning to a report later is then a database read rather than a rebuild,
which matters because the model takes seconds to fit and each piece of
commentary is a separate call to the language model.

The work runs in a background thread. Progress is written to the database as
it goes so the dashboard can show what is happening rather than an
indeterminate spinner.
"""
from __future__ import annotations

import logging
from datetime import datetime

import pandas as pd

from app import config, db
from app.analytics import narrative
from app.analytics.churn import churn_analysis
from app.analytics.customer_value import customer_value_summary
from app.analytics.delivery import delivery_analysis
from app.analytics.pricing import pricing_analysis
from app.analytics.reorder import reorder_predictions
from app.analytics.repeat_business import repeat_business_analysis
from app.analytics.seasonality import seasonality_analysis
from app.data_loader import load_jobs
from app.llm.writer import generate_brief
from app.ml.price_model import train_price_model

log = logging.getLogger("wgb.report")

# Order matters only for the progress messages the user sees.
INSIGHT_LABELS = {
    "customer_value": "Customer value",
    "repeat_business": "Recurring revenue",
    "reorder": "Reorder forecasting",
    "churn": "Account retention",
    "pricing": "Pricing integrity",
    "seasonality": "Demand and capacity",
    "delivery": "Production turnaround",
    "quote_guard": "Quote intelligence",
}


def _as_of(df: pd.DataFrame) -> pd.Timestamp:
    """Reference "today" for recency-based analytics.

    An extract is a point in time, so recency is measured against its most
    recent booking rather than wall-clock today. Otherwise every customer
    looks dormant purely because the file is a few months old.
    """
    if df.empty:
        return pd.Timestamp(datetime.now().date())
    return pd.Timestamp(df["sales_in"].max().date())


def _summary(df: pd.DataFrame, source: str) -> dict:
    currency_split = (
        df.groupby("currency", as_index=False)
        .agg(job_count=("job_id", "count"), sell_price_native=("sell_price", "sum"),
             sell_price_base=("sell_price_base", "sum"))
        .round(2)
        .to_dict(orient="records")
    )
    return {
        "row_count": int(len(df)),
        "customer_count": int(df["customer_id"].nunique()),
        "total_sell_price": round(float(df["sell_price_base"].sum()), 2),
        "total_va_amount": round(float(df["va_amount_base"].sum()), 2),
        "avg_va_pct": round(float(df["va_pct"].mean()) * 100, 1),
        "naive_mixed_total": round(float(df["sell_price"].sum()), 2),
        "currency_split": currency_split,
        "date_range": {
            "from": df["sales_in"].min().strftime("%Y-%m-%d"),
            "to": df["sales_in"].max().strftime("%Y-%m-%d"),
        },
        "base_currency": config.BASE_CURRENCY,
        "base_currency_symbol": config.BASE_CURRENCY_SYMBOL,
        "eur_to_gbp": config.EUR_TO_GBP,
        "source": source,
        "narrative_generated": config.LLM_ACTIVE,
    }


def _dataset_context(df: pd.DataFrame, source: str) -> dict:
    """The few facts the narrative writer needs to describe this dataset."""
    return {
        "source_file": source,
        "jobs": int(len(df)),
        "customers": int(df["customer_id"].nunique()),
        "period": f"{df['sales_in'].min():%Y-%m-%d} to {df['sales_in'].max():%Y-%m-%d}",
        "reporting_currency": config.BASE_CURRENCY,
        "work_types": sorted(df["work_type"].dropna().unique().tolist()),
        "industries": sorted(df["industry"].dropna().unique().tolist())[:12],
    }


def build_payload(df: pd.DataFrame, source: str, report_id: int | None = None) -> dict:
    """Run every analysis and write every brief. Returns the stored payload."""

    def progress(message: str, pct: int) -> None:
        if report_id is not None:
            db.set_progress(report_id, message, pct)

    as_of = _as_of(df)

    progress("Analysing the order book", 15)
    results: dict[str, dict] = {
        "customer_value": customer_value_summary(df, top_n=20),
        "repeat_business": repeat_business_analysis(df, as_of),
        "reorder": reorder_predictions(df, as_of=as_of),
        "churn": churn_analysis(df, as_of=as_of),
        "pricing": pricing_analysis(df),
        "seasonality": seasonality_analysis(df),
        "delivery": delivery_analysis(df),
    }

    progress("Training the pricing model", 35)
    results["quote_guard"] = train_price_model(df)

    builders = {
        "customer_value": narrative.customer_value_brief,
        "repeat_business": narrative.repeat_business_brief,
        "reorder": narrative.reorder_brief,
        "churn": narrative.churn_brief,
        "pricing": narrative.pricing_brief,
        "seasonality": narrative.seasonality_brief,
        "delivery": narrative.delivery_brief,
        "quote_guard": narrative.quote_guard_brief,
    }

    summary = _summary(df, source)
    context = _dataset_context(df, source)

    # Commentary is the slow part, so progress is reported per insight.
    total = len(builders) + 1
    for i, (area, build) in enumerate(builders.items(), start=1):
        label = INSIGHT_LABELS.get(area, area)
        progress(f"Writing commentary: {label}", 45 + int(45 * i / total))
        computed = build(results[area])
        results[area]["brief"] = generate_brief(area, computed, context)

    progress("Writing commentary: Data quality", 92)
    summary["brief"] = generate_brief("data_quality", narrative.data_quality_brief(summary), context)

    progress("Ranking the findings", 96)
    span_days = (df["sales_in"].max() - df["sales_in"].min()).days
    years = max(span_days / 365.25, 0.25)
    items = [
        {"area": area, "brief": results[area]["brief"], "result": results[area]}
        for area in results
    ]
    findings = narrative.executive_summary(items, limit=5, years=years)

    return {
        "summary": summary,
        "customerValue": results["customer_value"],
        "repeatBusiness": results["repeat_business"],
        "reorder": results["reorder"],
        "churn": results["churn"],
        "pricing": results["pricing"],
        "seasonality": results["seasonality"],
        "delivery": results["delivery"],
        "quoteGuard": results["quote_guard"],
        "executive": {
            "findings": findings,
            "considered": len(items),
            "years_of_data": round(years, 2),
        },
    }


def generate_report(report_id: int, source: str) -> None:
    """Build and persist a report. Safe to run in a background thread."""
    try:
        db.set_progress(report_id, "Loading the dataset", 8)
        df = load_jobs(report_id)
        if df.empty:
            db.fail_report(report_id, "The stored dataset is empty.")
            return

        db.set_dataset_facts(
            report_id,
            rows=int(len(df)),
            customers=int(df["customer_id"].nunique()),
            period_from=df["sales_in"].min().strftime("%Y-%m-%d"),
            period_to=df["sales_in"].max().strftime("%Y-%m-%d"),
        )

        payload = build_payload(df, source, report_id=report_id)
        db.complete_report(report_id, payload)
        log.info("report %s ready (%s rows)", report_id, len(df))
    except Exception as exc:  # noqa: BLE001 - the failure belongs in the UI, not a stack trace
        log.exception("report %s failed", report_id)
        db.fail_report(report_id, str(exc))
