"""Reads an uploaded workbook into the clean frame the analytics expect.

Each row is one print job, not one order: a customer can have several jobs
booked on the same day, so the analytics treat a distinct (customer, date)
booking as an order event.

There is no active-dataset singleton and nothing is seeded. A workbook is read
when it is uploaded, stored against a report, and read back from the database
only if that report needs rebuilding.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd
from sqlalchemy import text

from app.config import FX_RATES, LOW_MARGIN_VA_PCT, MAX_PLAUSIBLE_LEAD_DAYS
from app.db import JOBS_COLUMNS, engine

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

# Money columns recorded in the customer's home currency. Summing these raw
# across a mixed-currency book adds euros to pounds, so analytics use the
# converted "<name>_base" versions instead.
MONEY_COLUMNS = [
    "sell_price", "va_amount", "purchases", "manual_adjustment", "paper",
    "labour", "handling", "markup_net", "amount_invoiced", "rebate",
    "va_per_24", "va_per_k",
]


class DatasetError(ValueError):
    """The uploaded workbook cannot be used, with a reason worth showing."""


def load_dataframe(path: Path | str) -> pd.DataFrame:
    """Read and clean a raw Excel export."""
    try:
        df = pd.read_excel(path, sheet_name=SHEET_NAME, engine="openpyxl")
    except ValueError as exc:
        raise DatasetError(
            f'The workbook has no sheet named "{SHEET_NAME}". '
            "Export the job list in the same format as the sample dataset."
        ) from exc

    df = df.rename(columns=COLUMN_MAP)

    missing = set(COLUMN_MAP.values()) - set(df.columns)
    if missing:
        raise DatasetError(
            "The workbook is missing expected columns: " + ", ".join(sorted(missing))
        )

    for col in NUMERIC_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    for col in DATE_COLUMNS:
        df[col] = pd.to_datetime(df[col], errors="coerce")

    df["customer_id"] = df["customer_id"].astype(str).str.strip()
    df["customer_name"] = df["customer_name"].astype(str).str.strip()

    df = df.dropna(subset=["sales_in", "customer_id"])
    if df.empty:
        raise DatasetError("No usable rows: every row is missing a booking date or customer.")

    return df.reset_index(drop=True)


def _canonical_product_types(series: pd.Series) -> pd.Series:
    """Merge spelling variants of the same product type.

    Source data commonly carries the same category typed several ways
    ("Brochures / Price List" against "Brochures / Price LIst"). Grouping on an
    alphanumeric-only key merges those safely, and each group adopts its most
    common spelling. Genuinely different labels are left alone.
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
    # Negative or absurdly long gaps are cancelled or reopened jobs, not real
    # turnaround, so they are excluded rather than allowed to skew averages.
    df["lead_time_days"] = lead.where((lead >= 0) & (lead <= MAX_PLAUSIBLE_LEAD_DAYS))

    df["is_below_cost"] = df["va_amount"] < 0
    df["is_low_margin"] = df["va_pct"] < LOW_MARGIN_VA_PCT
    # Named month_start so it does not clobber the source "month" integer,
    # which is part of the persisted schema.
    df["month_start"] = df["sales_in"].dt.to_period("M").dt.to_timestamp()

    return df


def store_jobs(report_id: int, df: pd.DataFrame) -> None:
    """Persist the dataset behind a report so it can be rebuilt later."""
    frame = df[JOBS_COLUMNS].copy()
    frame.insert(0, "report_id", report_id)
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM report_jobs WHERE report_id = :id"), {"id": report_id})
        frame.to_sql("report_jobs", conn, if_exists="append", index=False)


def load_jobs(report_id: int) -> pd.DataFrame:
    """Read a stored dataset back, ready for analysis."""
    df = pd.read_sql(
        "SELECT * FROM report_jobs WHERE report_id = ?",
        engine,
        params=(report_id,),
        parse_dates=DATE_COLUMNS,
    )
    return derive_columns(df.drop(columns=["id", "report_id"], errors="ignore"))
