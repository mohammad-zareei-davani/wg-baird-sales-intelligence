"""Predict expected VA Amount (GBP) in enquiry or estimate mode.

Impressions and Press hrs are produced by the estimating system, not known
when a customer first enquires. Enquiry mode therefore rejects those fields
rather than silently ignoring them. Estimate mode is the post-estimate
benchmark and requires them.
"""

from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from ml.features import (
    CATEGORICAL_FEATURES,
    ENQUIRY_FORBIDDEN,
    feature_columns_for_mode,
    numeric_features_for_mode,
)
from ml.train import MODE_WHEN

ARTIFACTS = Path(__file__).resolve().parent / "artifacts"

_FEATURE_LABELS = {
    "quantity": "Quantity",
    "impressions": "Impressions",
    "plates": "Plates",
    "press_hrs": "Press hours",
    "booking_month": "Booking month",
    "booking_iso_week": "Booking ISO week",
    "customer_id": "Customer",
    "industry": "Industry",
    "region": "Region",
    "work_type": "Work type",
    "product_type_norm": "Product type",
    "product_group": "Product group",
    "binding_type_filled": "Binding type",
    "currency": "Currency",
}

_cache: dict = {}


class PredictValidationError(ValueError):
    """Raised when the job_spec does not match the requested mode."""


def _load():
    if not _cache:
        _cache["estimate"] = joblib.load(ARTIFACTS / "model_a_estimate.joblib")
        _cache["enquiry"] = joblib.load(ARTIFACTS / "model_a_enquiry.joblib")
        _cache["shap_estimate"] = joblib.load(ARTIFACTS / "shap_explainer_a_estimate.joblib")
        _cache["shap_enquiry"] = joblib.load(ARTIFACTS / "shap_explainer_a_enquiry.joblib")
        _cache["category_maps"] = joblib.load(ARTIFACTS / "category_maps.joblib")
    return _cache


def validate_job_spec_for_mode(job_spec: dict, mode: str) -> None:
    if mode not in ("enquiry", "estimate"):
        raise PredictValidationError(
            f"Unknown mode {mode!r}. Use 'enquiry' or 'estimate'."
        )

    present = {k for k, v in job_spec.items() if v is not None and k != "mode"}

    work_type = job_spec.get("work_type")
    plates = job_spec.get("plates")
    if (
        isinstance(work_type, str)
        and work_type.strip().lower() == "digital"
        and plates is not None
    ):
        try:
            plates_value = float(plates)
        except (TypeError, ValueError):
            plates_value = None
        if plates_value is not None and plates_value != 0:
            raise PredictValidationError(
                "Digital jobs carry zero plates throughout this dataset. "
                "Set plates to 0 for Digital work, or choose Litho / Wide Format."
            )

    if mode == "enquiry":
        forbidden = sorted(present & ENQUIRY_FORBIDDEN)
        if forbidden:
            raise PredictValidationError(
                "Enquiry mode cannot include estimating-only fields "
                f"{forbidden}. Use mode='estimate' after estimating has run, "
                "or omit impressions and press_hrs."
            )
        required = {"quantity", "plates"}
        missing = sorted(required - present)
        if missing:
            raise PredictValidationError(
                f"Enquiry mode requires fields: {missing}."
            )
    else:
        required = {"quantity", "plates", "impressions", "press_hrs"}
        missing = sorted(required - present)
        if missing:
            raise PredictValidationError(
                f"Estimate mode requires fields: {missing}."
            )


def _encode_job_spec(job_spec: dict, mode: str, category_maps: dict) -> tuple[np.ndarray, list[str]]:
    columns = feature_columns_for_mode(mode)
    row = {}
    for col in numeric_features_for_mode(mode):
        value = job_spec.get(col)
        row[col] = float(value) if value is not None else np.nan
    for col in CATEGORICAL_FEATURES:
        cats = category_maps[col]
        value = job_spec.get(col)
        if value is None or (isinstance(value, float) and np.isnan(value)):
            row[col] = np.nan
        elif value in cats:
            row[col] = float(cats.index(value))
        else:
            row[col] = np.nan
    return pd.DataFrame([row], columns=columns).to_numpy(), columns


def predict_expected_va(job_spec: dict, mode: str = "estimate") -> dict:
    """Return predicted VA (GBP) and the top five signed SHAP contributions."""
    validate_job_spec_for_mode(job_spec, mode)
    artifacts = _load()
    model = artifacts[mode]
    explainer = artifacts[f"shap_{mode}"]
    X, columns = _encode_job_spec(job_spec, mode, artifacts["category_maps"])
    prediction = float(model.predict(X)[0])

    shap_values = explainer.shap_values(X)
    if isinstance(shap_values, list):
        shap_values = shap_values[0]
    values = np.asarray(shap_values).reshape(-1)

    contributions = sorted(
        [
            {
                "feature": col,
                "label": _FEATURE_LABELS.get(col, col),
                "shap_value": round(float(values[i]), 2),
            }
            for i, col in enumerate(columns)
        ],
        key=lambda r: abs(r["shap_value"]),
        reverse=True,
    )[:5]

    return {
        "mode": mode,
        "when": MODE_WHEN[mode],
        "predicted_va_gbp": round(prediction, 2),
        "shap_contributions": contributions,
    }
