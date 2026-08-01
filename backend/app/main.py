"""HTTP surface for the report library.

The app holds many reports rather than one active dataset, so the API is
report-scoped: upload creates one, the list feeds the sidebar, fetching one
returns the payload built at upload time, and deleting removes both the report
and the dataset behind it.
"""
from __future__ import annotations

import logging
import shutil
import tempfile
import threading
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app import config, db
from app.data_loader import DatasetError, load_dataframe, store_jobs
from app.report_builder import generate_report

log = logging.getLogger("wgb")

app = FastAPI(title="W&G Baird Sales Intelligence API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    db.init_db()
    _recover_interrupted_reports()


def _recover_interrupted_reports() -> None:
    """Mark reports left mid-build by a restart as failed.

    Generation lives in a thread, so a process that stops halfway leaves a
    report that would otherwise sit at "generating" forever. Better to say it
    was interrupted and let the user retry.
    """
    for report in db.list_reports():
        if report["status"] == db.STATUS_GENERATING:
            db.fail_report(report["id"], "Generation was interrupted by a restart. Upload again.")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "reports": db.count_reports()}


@app.get("/api/meta")
def meta() -> dict:
    """Reporting assumptions, surfaced so they can be challenged."""
    return {
        "base_currency": config.BASE_CURRENCY,
        "base_currency_symbol": config.BASE_CURRENCY_SYMBOL,
        "eur_to_gbp": config.EUR_TO_GBP,
        "narrative": {
            # Whether commentary is written for the dataset or coming from the
            # built-in templates. Figures are computed either way.
            "generation_active": config.LLM_ACTIVE,
            "model": config.OPENAI_MODEL if config.LLM_ACTIVE else None,
            "api_key_present": bool(config.OPENAI_API_KEY),
            "enabled_in_config": config.LLM_NARRATIVE_ENABLED,
        },
        "thresholds": {
            "at_risk_interval_multiple": config.AT_RISK_INTERVAL_MULTIPLE,
            "dormant_interval_multiple": config.DORMANT_INTERVAL_MULTIPLE,
            "due_soon_days": config.DUE_SOON_DAYS,
            "low_margin_va_pct": config.LOW_MARGIN_VA_PCT,
            "underpriced_threshold_pct": config.UNDERPRICED_THRESHOLD_PCT,
            "max_plausible_lead_days": config.MAX_PLAUSIBLE_LEAD_DAYS,
            "min_reprint_cycle_days": config.MIN_REPRINT_CYCLE_DAYS,
        },
    }


# --- report library ---------------------------------------------------------

@app.get("/api/reports")
def list_reports() -> dict:
    """Every report, newest first. Drives the sidebar."""
    return {"reports": db.list_reports()}


@app.get("/api/reports/{report_id}")
def get_report(report_id: int) -> dict:
    """A report's metadata, plus its payload once it is ready.

    While a report is still building this returns progress and no payload, so
    the dashboard shows the generating state rather than stale content from a
    previous report.
    """
    meta_row = db.get_report_meta(report_id)
    if not meta_row:
        raise HTTPException(status_code=404, detail="Report not found")

    response = {"report": meta_row, "payload": None}
    if meta_row["status"] == db.STATUS_READY:
        payload = db.get_report_payload(report_id)
        if payload is None:
            raise HTTPException(status_code=500, detail="Report is marked ready but has no content")
        response["payload"] = payload
    return response


@app.post("/api/reports")
async def upload_report(file: UploadFile, background: BackgroundTasks) -> dict:
    """Accept a workbook, store it, and start building its report.

    The file is validated before the report is registered, so a bad upload
    reports its problem immediately instead of appearing in the library as a
    failure the user has to clear up.
    """
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=400,
            detail="Please upload an .xlsx workbook exported in the standard job-list format.",
        )

    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = Path(tmp.name)

    try:
        df = load_dataframe(tmp_path)
    except DatasetError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - surfaced to the caller as a 400
        raise HTTPException(status_code=400, detail=f"Could not read the workbook: {exc}") from exc
    finally:
        tmp_path.unlink(missing_ok=True)

    report_id = db.create_report(file.filename)
    try:
        store_jobs(report_id, df)
    except Exception as exc:  # noqa: BLE001
        db.fail_report(report_id, f"Could not store the dataset: {exc}")
        raise HTTPException(status_code=500, detail="Could not store the dataset") from exc

    db.set_dataset_facts(
        report_id,
        rows=int(len(df)),
        customers=int(df["customer_id"].nunique()),
        period_from=df["sales_in"].min().strftime("%Y-%m-%d"),
        period_to=df["sales_in"].max().strftime("%Y-%m-%d"),
    )
    db.set_progress(report_id, "Queued for analysis", 5)

    # Generation takes minutes when commentary is being written, so it runs
    # off the request. The client polls the report until it is ready.
    threading.Thread(
        target=generate_report,
        args=(report_id, file.filename),
        name=f"report-{report_id}",
        daemon=True,
    ).start()

    return {"report": db.get_report_meta(report_id)}


@app.delete("/api/reports/{report_id}")
def remove_report(report_id: int) -> dict:
    """Delete a report and the dataset it was built from."""
    meta_row = db.get_report_meta(report_id)
    if not meta_row:
        raise HTTPException(status_code=404, detail="Report not found")
    if meta_row["status"] == db.STATUS_GENERATING:
        raise HTTPException(
            status_code=409,
            detail="This report is still being generated. Wait for it to finish before deleting it.",
        )

    db.delete_report(report_id)
    return {"deleted": report_id, "reports": db.list_reports()}
