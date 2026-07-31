"""Loads the W&G Baird job/sales dataset and keeps it persisted in SQLite.

The dataset is a flat list of print jobs. Each row is one job, not one
"order" in the retail sense. A customer can have several jobs booked on
the same date. The analytics modules treat a distinct (customer, date)
booking as an order event.

Excel is the interchange format; SQLite (see app.db) is the store of
record, so the active dataset survives an API restart instead of only
living in process memory.
"""
from __future__ import annotations

import threading
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from sqlalchemy import text

from app.config import FX_RATES, LOW_MARGIN_VA_PCT, MAX_PLAUSIBLE_LEAD_DAYS
from app.db import JOBS_COLUMNS, engine, init_db, jobs_row_count, record_upload, upload_history

DEFAULT_DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "raw" / "sample_data.xlsx"
SHEET_NAME = "Master Plain (Anon)"

COLUMN_MAP = {
    "Title": "job_id",
    "CustomerID": "customer_id",
    "Job Status": "job_status",
    "SalesIn": "sales_in",
    "Year": "year",
    "Month": "month",
    "Week No": "week_no",
    "SalesOut": "sales_out",
    "Quantity": "quantity",
    "Sell Price": "sell_price",
    "Mup%": "markup_pct",
    "VA Amount": "va_amount",
    "VA/24": "va_per_24",
    "VA%": "va_pct",
    "VA/K": "va_per_k",
    "Rebate": "rebate",
    "Puchases": "purchases",
    "Press hrs": "press_hrs",
    "Impressions": "impressions",
    "Handling": "handling",
    "Labour": "labour",
    "Paper": "paper",
    "labmup": "labour_markup",
    "manadj": "manual_adjustment",
    "mupnett": "markup_net",
    "Plates": "plates",
    "AmtInv": "amount_invoiced",
    "Customer Name": "customer_name",
    "Rep": "rep",
    "Region": "region",
    "Industry": "industry",
    "Work Type": "work_type",
    "Product Type": "product_type",
    "Binding Type": "binding_type",
    "Currency": "currency",
    "Ship date": "ship_date",
}

NUMERIC_COLUMNS = [
    "quantity", "sell_price", "markup_pct", "va_amount", "va_per_24", "va_pct",
    "va_per_k", "rebate", "purchases", "press_hrs", "impressions", "handling",
    "labour", "paper", "labour_markup", "manual_adjustment", "markup_net",
    "plates", "amount_invoiced", "year", "month", "week_no",
]
DATE_COLUMNS = ["sales_in", "sales_out", "ship_date"]


def load_dataframe(path: Path | str) -> pd.DataFrame:
    """Read and clean a raw Excel export. Does not touch the database."""
    df = pd.read_excel(path, sheet_name=SHEET_NAME, engine="openpyxl")
    df = df.rename(columns=COLUMN_MAP)

    missing = set(COLUMN_MAP.values()) - set(df.columns)
    if missing:
        raise ValueError(f"Uploaded file is missing expected columns: {sorted(missing)}")

    for col in NUMERIC_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    for col in DATE_COLUMNS:
        df[col] = pd.to_datetime(df[col], errors="coerce")

    df["customer_id"] = df["customer_id"].astype(str).str.strip()
    df["customer_name"] = df["customer_name"].astype(str).str.strip()

    df = df.dropna(subset=["sales_in", "customer_id"])
    return df.reset_index(drop=True)


# Money columns recorded in the customer's home currency. Summing these raw
# across a mixed-currency book adds euros to pounds, so analytics use the
# converted "<name>_base" versions instead.
MONEY_COLUMNS = [
    "sell_price", "va_amount", "purchases", "manual_adjustment", "paper",
    "labour", "handling", "markup_net", "amount_invoiced", "rebate",
    "va_per_24", "va_per_k",
]


def _canonical_product_types(series: pd.Series) -> pd.Series:
    """Merge spelling variants of the same product type.

    The source data carries 64 distinct product_type values, but several
    are the same category typed differently ("Brochures / Price List" vs
    "Brochures / Price LIst", "Leaflets to A4/ Price Lists" vs "Leaflets
    to A4 /Price Lists"). Grouping on an alphanumeric-only key merges those
    safely, and each group adopts its most common spelling as the label.
    Genuinely different labels are left alone.
    """
    values = series.fillna("Unspecified").astype(str).str.strip()
    key = values.str.lower().str.replace(r"[^a-z0-9]", "", regex=True)
    canonical = (
        pd.DataFrame({"key": key, "value": values})
        .groupby(["key", "value"]).size().rename("n").reset_index()
        .sort_values(["key", "n"], ascending=[True, False])
        .drop_duplicates("key").set_index("key")["value"]
    )
    return key.map(canonical).fillna(values)


def derive_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Add the reporting-ready columns the analytics modules consume."""
    df = df.copy()

    df["fx_rate"] = df["currency"].map(FX_RATES).fillna(1.0)
    for col in MONEY_COLUMNS:
        df[f"{col}_base"] = df[col] * df["fx_rate"]

    df["product_type_clean"] = _canonical_product_types(df["product_type"])

    lead = (df["ship_date"] - df["sales_in"]).dt.days
    # Negative or absurdly long gaps are cancelled/reopened jobs, not real
    # turnaround, so they are excluded rather than allowed to skew averages.
    df["lead_time_days"] = lead.where((lead >= 0) & (lead <= MAX_PLAUSIBLE_LEAD_DAYS))

    df["is_below_cost"] = df["va_amount"] < 0
    df["is_low_margin"] = df["va_pct"] < LOW_MARGIN_VA_PCT
    # Named month_start so it does not clobber the source "month" integer,
    # which is part of the persisted schema.
    df["month_start"] = df["sales_in"].dt.to_period("M").dt.to_timestamp()

    return df


def _write_to_db(df: pd.DataFrame, source_name: str) -> None:
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM jobs"))
        df[JOBS_COLUMNS].to_sql("jobs", conn, if_exists="append", index=False)
    record_upload(source_name, len(df), datetime.now(timezone.utc).isoformat())


def _read_from_db() -> pd.DataFrame:
    return pd.read_sql("SELECT * FROM jobs", engine, parse_dates=DATE_COLUMNS)


class DataStore:
    """Thread-safe holder for the currently active dataset.

    Backed by SQLite: the first run ingests the sample file into the
    database; subsequent runs (and uploads via the API) read from /
    write to the database, so the active dataset survives a restart
    without needing the original Excel file on disk.
    """

    def __init__(self, default_path: Path | str):
        self._lock = threading.Lock()
        self._default_path = Path(default_path)
        init_db()

        if jobs_row_count() == 0:
            df = load_dataframe(self._default_path)
            _write_to_db(df, source_name=self._default_path.name)
        else:
            df = _read_from_db()

        history = upload_history()
        self._df = derive_columns(df)
        self._source_name = history[0]["source_name"] if history else self._default_path.name
        # Bumped whenever the dataset changes, so cached model fits are
        # invalidated rather than served against stale data.
        self._version = 0

    def get(self) -> pd.DataFrame:
        with self._lock:
            return self._df

    def replace(self, path: Path | str, source_name: str) -> int:
        new_df = load_dataframe(path)
        _write_to_db(new_df, source_name)
        with self._lock:
            self._df = derive_columns(new_df)
            self._source_name = source_name
            self._version += 1
        return len(new_df)

    @property
    def version(self) -> int:
        with self._lock:
            return self._version

    @property
    def source_name(self) -> str:
        with self._lock:
            return self._source_name

    @staticmethod
    def upload_history() -> list[dict]:
        return upload_history()


store = DataStore(DEFAULT_DATA_PATH)
