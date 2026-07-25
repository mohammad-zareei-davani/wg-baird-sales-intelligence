"""Ingestion: read a workbook, hash each raw row, clean it, and upsert
into the Job table keyed on ``job_key``. Every run writes an IngestRun row."""

from __future__ import annotations

import datetime as dt
import hashlib
import math
from pathlib import Path

import numpy as np
import pandas as pd
from django.db import transaction

from core.clean import EXPECTED_COLUMNS, clean_workbook, validate_columns
from core.config import load_config
from core.models import IngestRun, Job

SHEET_NAME = "Master Plain (Anon)"

SOURCE_TO_FIELD = {
    "Title": "title",
    "CustomerID": "customer_id",
    "Job Status": "job_status",
    "SalesIn": "sales_in",
    "Year": "year",
    "Month": "month",
    "Week No": "week_no",
    "SalesOut": "sales_out",
    "Quantity": "quantity",
    "Sell Price": "sell_price",
    "Mup%": "mup_pct",
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
    "labmup": "labmup",
    "manadj": "manadj",
    "mupnett": "mupnett",
    "Plates": "plates",
    "AmtInv": "amt_inv",
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

DERIVED_FIELDS = [
    "sell_price_gbp",
    "va_amount_gbp",
    "purchases_gbp",
    "labour_gbp",
    "paper_gbp",
    "product_type_norm",
    "product_group",
    "binding_type_filled",
    "is_credit",
    "is_closed",
    "has_date_anomaly",
]

DATE_FIELDS = {"sales_in", "sales_out", "ship_date"}
INT_FIELDS = {"year", "week_no"}
STR_FIELDS = {"month"}

UPDATE_FIELDS = list(SOURCE_TO_FIELD.values()) + DERIVED_FIELDS


def _raw_value_string(value) -> str:
    """Render one raw cell for hashing using the ingestion contract."""
    if value is None:
        return ""
    try:
        if pd.isna(value):
            return ""
    except (TypeError, ValueError):
        pass
    return str(value)


def compute_job_key(row: pd.Series | dict) -> str:
    """SHA-256 of all raw columns in sheet order, truncated to 32 hex chars."""
    payload = "|".join(_raw_value_string(row[column]) for column in EXPECTED_COLUMNS)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:32]


def _to_python(value, field: str):
    """Convert a pandas/numpy cell to a value the ORM accepts."""
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(value, np.generic):
        value = value.item()
    if field in DATE_FIELDS and isinstance(value, (pd.Timestamp, dt.datetime)):
        value = value.date()
    if field in INT_FIELDS:
        return int(value)
    if field in STR_FIELDS:
        if isinstance(value, float) and value.is_integer():
            return str(int(value))
        return str(value)
    return value


def _row_to_kwargs(row: dict) -> dict:
    kwargs = {"job_key": row["job_key"]}
    for source_col, field in SOURCE_TO_FIELD.items():
        kwargs[field] = _to_python(row[source_col], field)
    for field in DERIVED_FIELDS:
        kwargs[field] = _to_python(row[field], field)
    return kwargs


def ingest_workbook(path: str | Path) -> IngestRun:
    path = Path(path)
    raw = pd.read_excel(path, sheet_name=SHEET_NAME)
    rows_read = len(raw)

    config = load_config()
    validate_columns(raw)
    # Identity must be computed before cleaning so config changes cannot alter
    # an existing record's key.
    raw = raw.copy()
    raw["job_key"] = raw.apply(compute_job_key, axis=1)
    duplicates_collapsed = int(raw["job_key"].duplicated().sum())
    cleaned, quality_counts = clean_workbook(raw, config)
    cleaned = cleaned.drop_duplicates(subset="job_key", keep="first")
    quality_counts["duplicates_collapsed"] = duplicates_collapsed

    existing_ids = dict(Job.objects.values_list("job_key", "id"))

    to_insert: list[Job] = []
    to_update: list[Job] = []
    for row in cleaned.to_dict(orient="records"):
        kwargs = _row_to_kwargs(row)
        pk = existing_ids.get(kwargs["job_key"])
        if pk is None:
            to_insert.append(Job(**kwargs))
        else:
            to_update.append(Job(id=pk, **kwargs))

    with transaction.atomic():
        Job.objects.bulk_create(to_insert, batch_size=500)
        if to_update:
            Job.objects.bulk_update(to_update, fields=UPDATE_FIELDS, batch_size=500)
        run = IngestRun.objects.create(
            source_filename=path.name,
            rows_read=rows_read,
            rows_inserted=len(to_insert),
            rows_updated=len(to_update),
            quality_counts=quality_counts,
        )
    return run
