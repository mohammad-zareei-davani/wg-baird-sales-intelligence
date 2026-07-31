"""SQLite persistence for the ingested job/sales data.

Excel is the interchange format the business already uses (and the format
new extracts will keep arriving in), but it is not a database: every
process restart would otherwise mean re-reading the last-uploaded file
from disk, and there's nowhere to keep a history of what was loaded when.
SQLite gives the "dynamic system" requirement a real backing store without
the operational overhead of running a separate database server for what
is, at this scale, a single-writer analytics tool.
"""
from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine, text

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "app.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})

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
    CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL,
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
    "CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON jobs(customer_id)",
    "CREATE INDEX IF NOT EXISTS idx_jobs_sales_in ON jobs(sales_in)",
    "CREATE INDEX IF NOT EXISTS idx_jobs_job_id ON jobs(job_id)",
    """
    CREATE TABLE IF NOT EXISTS dataset_uploads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_name TEXT NOT NULL,
        row_count INTEGER NOT NULL,
        uploaded_at TEXT NOT NULL
    )
    """,
]


def init_db() -> None:
    with engine.begin() as conn:
        for stmt in SCHEMA_STATEMENTS:
            conn.execute(text(stmt))


def jobs_row_count() -> int:
    with engine.connect() as conn:
        return conn.execute(text("SELECT COUNT(*) FROM jobs")).scalar_one()


def record_upload(source_name: str, row_count: int, uploaded_at: str) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO dataset_uploads (source_name, row_count, uploaded_at) "
                "VALUES (:source_name, :row_count, :uploaded_at)"
            ),
            {"source_name": source_name, "row_count": row_count, "uploaded_at": uploaded_at},
        )


def upload_history() -> list[dict]:
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT source_name, row_count, uploaded_at FROM dataset_uploads ORDER BY id DESC")
        ).mappings().all()
    return [dict(r) for r in rows]
