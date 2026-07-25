"""Cleaning pipeline for the W&G Baird job workbook.

Transformations run in this exact order, each a separate testable function:

1. validate_columns          — all 36 expected columns present, else raise
2. normalise_product_type    — lowercase, collapse whitespace, standardise
                               slash spacing, config lookup, title-case
3. assign_product_group      — coarse rollup from config (additive)
4. fill_binding_type         — null Binding Type means outsourced finishing,
                               a meaningful null: encode as 'OUTSOURCED'
5. convert_currency          — Euro rows converted to GBP at the config rate,
                               originals retained
6. flag_credit               — Sell Price <= 0
7. flag_closed               — Job Status == 'z-Closed'
8. flag_date_anomaly         — Ship date < SalesIn, Ship date beyond the max
                               SalesIn in the file, or SalesOut missing

No Django imports here: pure pandas, driven by the config dict.
"""

from __future__ import annotations

import re

import pandas as pd

EXPECTED_COLUMNS = [
    "Title", "CustomerID", "Job Status", "SalesIn", "Year", "Month", "Week No",
    "SalesOut", "Quantity", "Sell Price", "Mup%", "VA Amount", "VA/24", "VA%",
    "VA/K", "Rebate", "Puchases", "Press hrs", "Impressions", "Handling",
    "Labour", "Paper", "labmup", "manadj", "mupnett", "Plates", "AmtInv",
    "Customer Name", "Rep", "Region", "Industry", "Work Type", "Product Type",
    "Binding Type", "Currency", "Ship date",
]

# source monetary column -> derived GBP column
MONETARY_GBP_MAP = {
    "Sell Price": "sell_price_gbp",
    "VA Amount": "va_amount_gbp",
    "Puchases": "purchases_gbp",
    "Labour": "labour_gbp",
    "Paper": "paper_gbp",
}


def validate_columns(df: pd.DataFrame) -> None:
    missing = [c for c in EXPECTED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Workbook is missing expected columns: {missing}")


def _normalise_label(value: str) -> str:
    s = str(value).strip().lower()
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\s*/\s*", " / ", s)
    return s


def normalise_product_type(df: pd.DataFrame, config: dict) -> pd.DataFrame:
    lookup = config["product_type_normalisation"]
    keys = df["Product Type"].map(_normalise_label, na_action="ignore")
    df["product_type_norm"] = keys.map(
        lambda k: lookup.get(k, k.title()), na_action="ignore"
    )
    return df


def assign_product_group(df: pd.DataFrame, config: dict) -> pd.DataFrame:
    """Additive coarse rollup. Does not alter product_type_norm."""
    group_map = config.get("product_group_map", {})
    df["product_group"] = df["product_type_norm"].map(
        lambda v: group_map.get(v, "Other") if pd.notna(v) else "Other"
    )
    return df


def fill_binding_type(df: pd.DataFrame) -> pd.DataFrame:
    df["binding_type_filled"] = df["Binding Type"].fillna("OUTSOURCED")
    return df


def convert_currency(df: pd.DataFrame, config: dict) -> pd.DataFrame:
    rate = float(config["fx"]["eur_to_gbp"])
    is_euro = df["Currency"] == "Euro"
    for source_col, gbp_col in MONETARY_GBP_MAP.items():
        df[gbp_col] = df[source_col].where(~is_euro, df[source_col] * rate)
    return df


def flag_credit(df: pd.DataFrame) -> pd.DataFrame:
    df["is_credit"] = df["Sell Price"].le(0).fillna(False).astype(bool)
    return df


def flag_closed(df: pd.DataFrame) -> pd.DataFrame:
    df["is_closed"] = (df["Job Status"] == "z-Closed").astype(bool)
    return df


def flag_date_anomaly(df: pd.DataFrame) -> pd.DataFrame:
    sales_in = pd.to_datetime(df["SalesIn"])
    sales_out = pd.to_datetime(df["SalesOut"])
    ship = pd.to_datetime(df["Ship date"])
    max_sales_in = sales_in.max()

    ship_before_booking = ship < sales_in
    ship_beyond_horizon = ship > max_sales_in
    missing_sales_out = sales_out.isna()

    df["has_date_anomaly"] = (
        ship_before_booking | ship_beyond_horizon | missing_sales_out
    ).astype(bool)
    return df


def clean_workbook(df: pd.DataFrame, config: dict) -> tuple[pd.DataFrame, dict]:
    """Apply the full pipeline; return (cleaned frame, data quality counts)."""
    validate_columns(df)
    df = df.copy()

    raw_product_labels_excluding_null = df["Product Type"].nunique(dropna=True)
    raw_product_labels_including_null = df["Product Type"].nunique(dropna=False)
    df = normalise_product_type(df, config)
    df = assign_product_group(df, config)
    df = fill_binding_type(df)
    df = convert_currency(df, config)
    df = flag_credit(df)
    df = flag_closed(df)
    df = flag_date_anomaly(df)

    quality_counts = {
        "rows": int(len(df)),
        "product_labels_raw_excluding_null": int(raw_product_labels_excluding_null),
        "product_labels_raw_including_null": int(raw_product_labels_including_null),
        "product_labels_normalised": int(df["product_type_norm"].nunique(dropna=True)),
        "product_groups": int(df["product_group"].nunique()),
        "binding_null_encoded_outsourced": int(df["Binding Type"].isna().sum()),
        "euro_rows_converted": int((df["Currency"] == "Euro").sum()),
        "stg_rows": int((df["Currency"] == "Stg").sum()),
        "credits_flagged": int(df["is_credit"].sum()),
        "closed_jobs": int(df["is_closed"].sum()),
        "open_jobs": int((~df["is_closed"]).sum()),
        "date_anomalies": int(df["has_date_anomaly"].sum()),
        "missing_sales_out": int(df["SalesOut"].isna().sum()),
    }
    return df, quality_counts
