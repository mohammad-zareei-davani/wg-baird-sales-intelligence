"""SQLite persistence for uploaded datasets and the reports built from them.

The app holds a library of reports rather than one active dataset. Each upload
becomes a report: the job rows are stored so the analysis can be rebuilt, and
the finished report is stored alongside them as JSON so returning to it later
costs a single read rather than re-running the models and re-writing the
commentary.

Nothing is seeded. A fresh install has an empty library and asks for a file.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, text

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "app.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})

# Status values a report can hold.
STATUS_GENERATING = "generating"
STATUS_READY = "ready"
STATUS_FAILED = "failed"

JOBS_COLUMNS = [
    "job_id", "customer_id", "customer_name", "job_status",
    "sales_in", "year", "month", "week_no", "sales_out",
    "quantity", "sell_price", "markup_pct", "va_amount", "va_per_24",
    "va_pct", "va_per_k", "rebate", "purchases", "press_hrs",
    "impressions", "handling", "labour", "paper", "labour_markup",
    "manual_adjustment", "markup_net", "plates", "amount_invoiced",
    "rep", "region", "industry", "work_type", "product_type",
    "binding_type", "currency", "ship_date",
]

SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        status TEXT NOT NULL,
        progress TEXT,
        progress_pct INTEGER DEFAULT 0,
        row_count INTEGER DEFAULT 0,
        customer_count INTEGER DEFAULT 0,
        period_from TEXT,
        period_to TEXT,
        error TEXT,
        payload TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS report_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_id INTEGER NOT NULL,
        job_id TEXT,
        customer_id TEXT NOT NULL,
        customer_name TEXT,
        job_status TEXT,
        sales_in TEXT NOT NULL,
        year INTEGER,
        month INTEGER,
        week_no INTEGER,
        sales_out TEXT,
        quantity REAL,
        sell_price REAL,
        markup_pct REAL,
        va_amount REAL,
        va_per_24 REAL,
        va_pct REAL,
        va_per_k REAL,
        rebate REAL,
        purchases REAL,
        press_hrs REAL,
        impressions REAL,
        handling REAL,
        labour REAL,
        paper REAL,
        labour_markup REAL,
        manual_adjustment REAL,
        markup_net REAL,
        plates REAL,
        amount_invoiced REAL,
        rep TEXT,
        region TEXT,
        industry TEXT,
        work_type TEXT,
        product_type TEXT,
        binding_type TEXT,
        currency TEXT,
        ship_date TEXT
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_report_jobs_report ON report_jobs(report_id)",
    "CREATE INDEX IF NOT EXISTS idx_report_jobs_customer ON report_jobs(report_id, customer_id)",
    "CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC)",
]


def init_db() -> None:
    with engine.begin() as conn:
        for stmt in SCHEMA_STATEMENTS:
            conn.execute(text(stmt))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# --- report lifecycle -------------------------------------------------------

def create_report(name: str) -> int:
    """Register a report before its data is analysed, so the UI can show it
    as in progress from the moment the upload lands."""
    with engine.begin() as conn:
        result = conn.execute(
            text(
                "INSERT INTO reports (name, created_at, status, progress, progress_pct) "
                "VALUES (:name, :created_at, :status, :progress, 0)"
            ),
            {"name": name, "created_at": _now(), "status": STATUS_GENERATING,
             "progress": "Reading the workbook"},
        )
        return int(result.lastrowid)


def set_progress(report_id: int, message: str, pct: int) -> None:
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE reports SET progress = :p, progress_pct = :pct WHERE id = :id"),
            {"p": message, "pct": max(0, min(100, int(pct))), "id": report_id},
        )


def set_dataset_facts(report_id: int, rows: int, customers: int,
                      period_from: str | None, period_to: str | None) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                "UPDATE reports SET row_count = :rows, customer_count = :customers, "
                "period_from = :pf, period_to = :pt WHERE id = :id"
            ),
            {"rows": rows, "customers": customers, "pf": period_from, "pt": period_to,
             "id": report_id},
        )


def complete_report(report_id: int, payload: dict[str, Any]) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                "UPDATE reports SET status = :status, payload = :payload, progress = :progress, "
                "progress_pct = 100, completed_at = :completed WHERE id = :id"
            ),
            {"status": STATUS_READY, "payload": json.dumps(payload), "progress": "Complete",
             "completed": _now(), "id": report_id},
        )


def fail_report(report_id: int, message: str) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                "UPDATE reports SET status = :status, error = :error, progress = :progress "
                "WHERE id = :id"
            ),
            {"status": STATUS_FAILED, "error": message[:1000], "progress": "Failed", "id": report_id},
        )


# --- reads ------------------------------------------------------------------

_LIST_FIELDS = (
    "id, name, created_at, completed_at, status, progress, progress_pct, "
    "row_count, customer_count, period_from, period_to, error"
)


def list_reports() -> list[dict]:
    """Everything the sidebar needs, without the heavy payload."""
    with engine.connect() as conn:
        rows = conn.execute(
            text(f"SELECT {_LIST_FIELDS} FROM reports ORDER BY datetime(created_at) DESC")
        ).mappings().all()
    return [dict(r) for r in rows]


def get_report_meta(report_id: int) -> dict | None:
    with engine.connect() as conn:
        row = conn.execute(
            text(f"SELECT {_LIST_FIELDS} FROM reports WHERE id = :id"), {"id": report_id}
        ).mappings().first()
    return dict(row) if row else None


def get_report_payload(report_id: int) -> dict | None:
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT payload FROM reports WHERE id = :id"), {"id": report_id}
        ).mappings().first()
    if not row or not row["payload"]:
        return None
    return json.loads(row["payload"])


def latest_ready_report_id() -> int | None:
    with engine.connect() as conn:
        row = conn.execute(
            text(
                "SELECT id FROM reports WHERE status = :status "
                "ORDER BY datetime(created_at) DESC LIMIT 1"
            ),
            {"status": STATUS_READY},
        ).first()
    return int(row[0]) if row else None


def delete_report(report_id: int) -> bool:
    """Remove a report and the dataset it was built from."""
    with engine.begin() as conn:
        existing = conn.execute(
            text("SELECT id FROM reports WHERE id = :id"), {"id": report_id}
        ).first()
        if not existing:
            return False
        conn.execute(text("DELETE FROM report_jobs WHERE report_id = :id"), {"id": report_id})
        conn.execute(text("DELETE FROM reports WHERE id = :id"), {"id": report_id})
    return True


def count_reports() -> int:
    with engine.connect() as conn:
        return int(conn.execute(text("SELECT COUNT(*) FROM reports")).scalar_one())
