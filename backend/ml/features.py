"""Feature matrix construction for VA models.

Allowlist only. Banned columns are read from config.yaml and must never
appear in the feature matrix. ``product_group`` is an allowed categorical:
it is derived from Product Type (a quote-time field), not from outcomes.

Two numeric allowlists exist:

- **estimate** (Model A-Estimate): includes Impressions and Press hrs, which
  come from the estimating system after a production estimate exists.
- **enquiry** (Model A-Enquiry): Quantity, Plates, booking month and ISO week
  only. Impressions and Press hrs are unknown at first customer contact.
"""

from __future__ import annotations

import re

import pandas as pd

NUMERIC_FEATURES_ESTIMATE = [
    "quantity",
    "impressions",
    "plates",
    "press_hrs",
    "booking_month",
    "booking_iso_week",
]

NUMERIC_FEATURES_ENQUIRY = [
    "quantity",
    "plates",
    "booking_month",
    "booking_iso_week",
]

# Backwards-compatible alias for the full post-estimate numeric set.
NUMERIC_FEATURES = NUMERIC_FEATURES_ESTIMATE

CATEGORICAL_FEATURES = [
    "customer_id",
    "industry",
    "region",
    "work_type",
    "product_type_norm",
    "product_group",
    "binding_type_filled",
    "currency",
]

FEATURE_COLUMNS_ESTIMATE = NUMERIC_FEATURES_ESTIMATE + CATEGORICAL_FEATURES
FEATURE_COLUMNS_ENQUIRY = NUMERIC_FEATURES_ENQUIRY + CATEGORICAL_FEATURES
FEATURE_COLUMNS = FEATURE_COLUMNS_ESTIMATE

ENQUIRY_FORBIDDEN = {"impressions", "press_hrs"}

_SOURCE_ALIASES = {
    "Quantity": "quantity",
    "Impressions": "impressions",
    "Plates": "plates",
    "Press hrs": "press_hrs",
    "CustomerID": "customer_id",
    "Industry": "industry",
    "Region": "region",
    "Work Type": "work_type",
    "Currency": "currency",
}


def feature_columns_for_mode(mode: str) -> list[str]:
    if mode == "estimate":
        return list(FEATURE_COLUMNS_ESTIMATE)
    if mode == "enquiry":
        return list(FEATURE_COLUMNS_ENQUIRY)
    raise ValueError(f"Unknown prediction mode: {mode!r}. Use 'enquiry' or 'estimate'.")


def numeric_features_for_mode(mode: str) -> list[str]:
    if mode == "estimate":
        return list(NUMERIC_FEATURES_ESTIMATE)
    if mode == "enquiry":
        return list(NUMERIC_FEATURES_ENQUIRY)
    raise ValueError(f"Unknown prediction mode: {mode!r}. Use 'enquiry' or 'estimate'.")


def _snake(name: str) -> str:
    name = _SOURCE_ALIASES.get(name, name)
    name = name.replace("%", "_pct").replace("/", "_")
    name = re.sub(r"[\s\-]+", "_", name)
    return name.lower()


def banned_feature_names(config: dict) -> set[str]:
    """All banned identifiers in source and snake_case form, from config."""
    banned: set[str] = set()
    for raw in config["banned_features"]:
        banned.add(raw)
        banned.add(_snake(raw))
    return banned


def validate_feature_frame(frame: pd.DataFrame, config: dict) -> None:
    """Raise if a banned column is present in a feature frame."""
    banned = banned_feature_names(config)
    hits = [c for c in frame.columns if c in banned]
    lowered = {str(c).lower(): c for c in frame.columns}
    for b in config["banned_features"]:
        if b.lower() in lowered:
            hits.append(lowered[b.lower()])
        snake = _snake(b)
        if snake in frame.columns:
            hits.append(snake)
    hits = sorted(set(hits))
    if hits:
        raise ValueError(f"Banned features present in feature matrix: {hits}")


def prepare_modelling_frame(df: pd.DataFrame) -> pd.DataFrame:
    """Closed, non-credit jobs with engineered booking calendar features."""
    work = df.copy()
    for source, dest in _SOURCE_ALIASES.items():
        if source in work.columns and dest not in work.columns:
            work[dest] = work[source]

    closed = work["is_closed"].fillna(False).astype(bool)
    credit = work["is_credit"].fillna(False).astype(bool)
    work = work.loc[closed & ~credit].copy()

    sales_in = pd.to_datetime(work["sales_in"])
    work["booking_month"] = sales_in.dt.month.astype(float)
    work["booking_iso_week"] = sales_in.dt.isocalendar().week.astype(float)
    work["sales_in"] = sales_in
    return work


def build_feature_matrix(
    df: pd.DataFrame, config: dict, mode: str = "estimate"
) -> pd.DataFrame:
    """Return the allowlisted feature matrix for the given mode."""
    work = df if "booking_month" in df.columns else prepare_modelling_frame(df)
    columns = feature_columns_for_mode(mode)
    missing = [c for c in columns if c not in work.columns]
    if missing:
        raise KeyError(f"Feature columns missing from frame: {missing}")

    X = work[columns].copy()
    for col in CATEGORICAL_FEATURES:
        X[col] = X[col].astype("object").where(pd.notna(X[col]), other=None)
        X[col] = X[col].astype("category")
    for col in numeric_features_for_mode(mode):
        X[col] = pd.to_numeric(X[col], errors="coerce")

    validate_feature_frame(X, config)
    return X
