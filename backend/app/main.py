from __future__ import annotations

import shutil
import tempfile
from datetime import datetime
from functools import lru_cache
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.analytics import narrative
from app.analytics.churn import churn_analysis
from app.analytics.customer_value import customer_value_summary
from app.analytics.delivery import delivery_analysis
from app.analytics.pricing import pricing_analysis
from app.analytics.reorder import reorder_predictions
from app.analytics.repeat_business import repeat_business_analysis
from app.analytics.seasonality import seasonality_analysis
from app.data_loader import store
from app.ml.churn_model import train_churn_model
from app.ml.price_model import train_price_model

app = FastAPI(title="W&G Baird Sales Intelligence API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _df() -> pd.DataFrame:
    df = store.get()
    if df.empty:
        raise HTTPException(status_code=404, detail="No data loaded")
    return df


def _as_of() -> pd.Timestamp:
    """Reference "today" for recency-based analytics.

    The dataset is a point-in-time extract, so we anchor to its most recent
    booking date rather than wall-clock time, because otherwise every customer
    looks dormant purely because the extract is a few months old, not
    because they actually stopped ordering.
    """
    df = store.get()
    if df.empty:
        return pd.Timestamp(datetime.now().date())
    return pd.Timestamp(df["sales_in"].max().date())


# The ML models take a few seconds to fit, so they are cached against the
# dataset version and only retrained when new data is uploaded.
@lru_cache(maxsize=2)
def _price_model(_version: int) -> dict:
    return train_price_model(store.get())


@lru_cache(maxsize=2)
def _churn_model(_version: int) -> dict:
    return train_churn_model(store.get())


@app.get("/api/health")
def health() -> dict:
    df = store.get()
    return {"status": "ok", "source": store.source_name, "row_count": int(len(df))}


@app.get("/api/meta")
def meta() -> dict:
    """Reporting assumptions, surfaced so they can be challenged."""
    return {
        "base_currency": config.BASE_CURRENCY,
        "base_currency_symbol": config.BASE_CURRENCY_SYMBOL,
        "eur_to_gbp": config.EUR_TO_GBP,
        "thresholds": {
            "at_risk_interval_multiple": config.AT_RISK_INTERVAL_MULTIPLE,
            "dormant_interval_multiple": config.DORMANT_INTERVAL_MULTIPLE,
            "due_soon_days": config.DUE_SOON_DAYS,
            "low_margin_va_pct": config.LOW_MARGIN_VA_PCT,
            "underpriced_threshold_pct": config.UNDERPRICED_THRESHOLD_PCT,
            "max_plausible_lead_days": config.MAX_PLAUSIBLE_LEAD_DAYS,
        },
    }


@app.get("/api/summary")
def summary() -> dict:
    df = _df()
    currency_split = (
        df.groupby("currency", as_index=False)
        .agg(job_count=("job_id", "count"), sell_price_native=("sell_price", "sum"),
             sell_price_base=("sell_price_base", "sum"))
        .round(2)
        .to_dict(orient="records")
    )
    payload = {
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
        "source": store.source_name,
    }
    payload["brief"] = narrative.data_quality_brief(payload)
    return payload


@app.get("/api/insights/customer-value")
def insight_customer_value(top_n: int = 15) -> dict:
    result = customer_value_summary(_df(), top_n=top_n)
    result["brief"] = narrative.customer_value_brief(result)
    return result


@app.get("/api/insights/reorder")
def insight_reorder() -> dict:
    result = reorder_predictions(_df(), as_of=_as_of())
    result["brief"] = narrative.reorder_brief(result)
    return result


@app.get("/api/insights/churn")
def insight_churn() -> dict:
    result = churn_analysis(_df(), as_of=_as_of())
    result["brief"] = narrative.churn_brief(result)
    return result


@app.get("/api/insights/pricing")
def insight_pricing() -> dict:
    result = pricing_analysis(_df())
    result["brief"] = narrative.pricing_brief(result)
    return result


@app.get("/api/insights/seasonality")
def insight_seasonality(horizon: int = 6) -> dict:
    result = seasonality_analysis(_df(), horizon=horizon)
    result["brief"] = narrative.seasonality_brief(result)
    return result


@app.get("/api/insights/delivery")
def insight_delivery() -> dict:
    result = delivery_analysis(_df())
    result["brief"] = narrative.delivery_brief(result)
    return result


@app.get("/api/insights/repeat-business")
def insight_repeat_business() -> dict:
    result = repeat_business_analysis(_df(), as_of=_as_of())
    result["brief"] = narrative.repeat_business_brief(result)
    return result


@app.get("/api/ml/quote-guard")
def ml_quote_guard() -> dict:
    _df()
    result = dict(_price_model(store.version))
    result["brief"] = narrative.quote_guard_brief(result)
    return result


@app.get("/api/ml/churn-risk")
def ml_churn_risk() -> dict:
    _df()
    result = dict(_churn_model(store.version))
    result["brief"] = narrative.churn_model_brief(result)
    return result


@app.get("/api/executive-summary")
def exec_summary(limit: int = 5) -> dict:
    """The findings that currently matter most, ranked by what is at stake.

    Every insight is scored, not just a chosen few, so the briefing reorders
    itself as the data changes and drops anything with nothing behind it.
    """
    df = _df()
    as_of = _as_of()

    results = {
        "pricing": pricing_analysis(df),
        "customer_value": customer_value_summary(df),
        "repeat_business": repeat_business_analysis(df, as_of),
        "churn": churn_analysis(df, as_of),
        "reorder": reorder_predictions(df, as_of=as_of),
        "seasonality": seasonality_analysis(df),
        "delivery": delivery_analysis(df),
        "quote_guard": _price_model(store.version),
    }
    builders = {
        "pricing": narrative.pricing_brief,
        "customer_value": narrative.customer_value_brief,
        "repeat_business": narrative.repeat_business_brief,
        "churn": narrative.churn_brief,
        "reorder": narrative.reorder_brief,
        "seasonality": narrative.seasonality_brief,
        "delivery": narrative.delivery_brief,
        "quote_guard": narrative.quote_guard_brief,
    }

    # Figures accumulated over the whole extract are annualised before being
    # compared, so a long dataset does not make every historical total look
    # larger than a genuinely current one.
    span_days = (df["sales_in"].max() - df["sales_in"].min()).days
    years = max(span_days / 365.25, 0.25)

    briefs = {area: builders[area](result) for area, result in results.items()}
    items = [
        {"area": area, "brief": briefs[area], "result": results[area]}
        for area in results
    ]
    findings = narrative.executive_summary(items, limit=limit, years=years)

    return {
        "findings": findings,
        "considered": len(items),
        "years_of_data": round(years, 2),
        "briefs": {f["area"]: briefs[f["area"]] for f in findings},
    }


@app.post("/api/data/upload")
async def upload_data(file: UploadFile) -> dict:
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=400,
            detail="Please upload an .xlsx file in the same format as the sample dataset",
        )

    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = Path(tmp.name)

    try:
        row_count = store.replace(tmp_path, source_name=file.filename)
    except Exception as exc:  # noqa: BLE001 - surfaced to the caller as a 400
        raise HTTPException(status_code=400, detail=f"Could not load file: {exc}") from exc
    finally:
        tmp_path.unlink(missing_ok=True)

    return {"status": "ok", "source": file.filename, "row_count": row_count}


@app.get("/api/data/history")
def data_history() -> dict:
    return {"uploads": store.upload_history()}
