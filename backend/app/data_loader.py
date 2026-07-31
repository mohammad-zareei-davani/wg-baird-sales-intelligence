"""Loads the W&G Baird job/sales dataset from Excel into a clean DataFrame.

The dataset is a flat list of print jobs. Each row is one job, not one
"order" in the retail sense — a customer can have several jobs booked on
the same date. The analytics modules treat a distinct (customer, date)
booking as an order event.
"""
from __future__ import annotations

import threading
from pathlib import Path

import pandas as pd

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
    "plates", "amount_invoiced",
]
DATE_COLUMNS = ["sales_in", "sales_out", "ship_date"]


def load_dataframe(path: Path | str) -> pd.DataFrame:
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


class DataStore:
    """Thread-safe holder for the currently active dataset.

    Supports hot-swapping in a new file (the "dynamic system" requirement)
    without restarting the API process.
    """

    def __init__(self, initial_path: Path | str):
        self._lock = threading.Lock()
        self._path = Path(initial_path)
        self._df = load_dataframe(self._path)
        self._source_name = self._path.name

    def get(self) -> pd.DataFrame:
        with self._lock:
            return self._df

    def replace(self, path: Path | str, source_name: str) -> int:
        new_df = load_dataframe(path)
        with self._lock:
            self._df = new_df
            self._path = Path(path)
            self._source_name = source_name
        return len(new_df)

    @property
    def source_name(self) -> str:
        with self._lock:
            return self._source_name


store = DataStore(DEFAULT_DATA_PATH)
