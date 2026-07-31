from __future__ import annotations

import shutil
import tempfile
from datetime import datetime
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.analytics.churn import churn_analysis
from app.analytics.customer_value import customer_value_summary
from app.analytics.reorder import reorder_predictions
from app.data_loader import store

app = FastAPI(title="W&G Baird Sales Intelligence API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _as_of() -> pd.Timestamp:
    """Reference "today" for recency-based analytics.

    The dataset is a point-in-time extract, so we anchor to its most
    recent booking date rather than wall-clock time — otherwise every
    customer looks dormant purely because the extract is a few months
    old, not because they actually stopped ordering.
    """
    df = store.get()
    if df.empty:
        return pd.Timestamp(datetime.now().date())
    return pd.Timestamp(df["sales_in"].max().date())


@app.get("/api/health")
def health() -> dict:
    df = store.get()
    return {
        "status": "ok",
        "source": store.source_name,
        "row_count": int(len(df)),
    }


@app.get("/api/summary")
def summary() -> dict:
    df = store.get()
    if df.empty:
        raise HTTPException(status_code=404, detail="No data loaded")

    return {
        "row_count": int(len(df)),
        "customer_count": int(df["customer_id"].nunique()),
        "total_sell_price": round(float(df["sell_price"].sum()), 2),
        "total_va_amount": round(float(df["va_amount"].sum()), 2),
        "avg_va_pct": round(float(df["va_pct"].mean()) * 100, 1),
        "date_range": {
            "from": df["sales_in"].min().strftime("%Y-%m-%d"),
            "to": df["sales_in"].max().strftime("%Y-%m-%d"),
        },
        "source": store.source_name,
    }


@app.get("/api/insights/customer-value")
def insight_customer_value(top_n: int = 15) -> dict:
    df = store.get()
    if df.empty:
        raise HTTPException(status_code=404, detail="No data loaded")
    return customer_value_summary(df, top_n=top_n)


@app.get("/api/insights/reorder")
def insight_reorder() -> dict:
    df = store.get()
    if df.empty:
        raise HTTPException(status_code=404, detail="No data loaded")
    return reorder_predictions(df, as_of=_as_of())


@app.get("/api/insights/churn")
def insight_churn() -> dict:
    df = store.get()
    if df.empty:
        raise HTTPException(status_code=404, detail="No data loaded")
    return churn_analysis(df, as_of=_as_of())


@app.post("/api/data/upload")
async def upload_data(file: UploadFile) -> dict:
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Please upload an .xlsx file in the same format as the sample dataset")

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
