"""Feature allowlist and banned-column enforcement."""

import pandas as pd
import pytest

from core.config import load_config
from ml.features import (
    CATEGORICAL_FEATURES,
    FEATURE_COLUMNS,
    FEATURE_COLUMNS_ENQUIRY,
    FEATURE_COLUMNS_ESTIMATE,
    NUMERIC_FEATURES,
    build_feature_matrix,
    validate_feature_frame,
)

CONFIG = load_config()


def _minimal_modelling_frame(n: int = 3) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "quantity": [1000.0] * n,
            "impressions": [2000.0] * n,
            "plates": [4.0] * n,
            "press_hrs": [1.5] * n,
            "booking_month": [3.0] * n,
            "booking_iso_week": [10.0] * n,
            "customer_id": ["CID_001"] * n,
            "industry": ["Education"] * n,
            "region": ["NI"] * n,
            "work_type": ["Litho"] * n,
            "product_type_norm": ["Magazines"] * n,
            "product_group": ["Magazines"] * n,
            "binding_type_filled": ["Stitched"] * n,
            "currency": ["Stg"] * n,
            "is_closed": [True] * n,
            "is_credit": [False] * n,
            "sales_in": pd.to_datetime(["2024-03-01"] * n),
            "va_amount_gbp": [200.0] * n,
            "va_pct": [0.4] * n,
        }
    )


def test_allowlist_produces_expected_columns():
    X = build_feature_matrix(_minimal_modelling_frame(), CONFIG, mode="estimate")
    assert list(X.columns) == FEATURE_COLUMNS_ESTIMATE
    assert list(X.columns) == FEATURE_COLUMNS
    assert set(NUMERIC_FEATURES).issubset(X.columns)
    assert set(CATEGORICAL_FEATURES).issubset(X.columns)
    assert "product_group" in X.columns
    for col in CATEGORICAL_FEATURES:
        assert str(X[col].dtype) == "category"


def test_enquiry_matrix_excludes_impressions_and_press_hrs():
    X = build_feature_matrix(_minimal_modelling_frame(), CONFIG, mode="enquiry")
    assert list(X.columns) == FEATURE_COLUMNS_ENQUIRY
    assert "impressions" not in X.columns
    assert "press_hrs" not in X.columns


def test_labour_in_feature_frame_raises():
    frame = _minimal_modelling_frame()[FEATURE_COLUMNS_ESTIMATE].copy()
    frame["Labour"] = 100.0
    with pytest.raises(ValueError, match="Banned features"):
        validate_feature_frame(frame, CONFIG)


def test_manadj_in_feature_frame_raises():
    frame = _minimal_modelling_frame()[FEATURE_COLUMNS_ESTIMATE].copy()
    frame["manadj"] = -50.0
    with pytest.raises(ValueError, match="Banned features"):
        validate_feature_frame(frame, CONFIG)


def test_banned_list_comes_from_config_not_hardcoded():
    banned = CONFIG["banned_features"]
    assert "Labour" in banned
    assert "manadj" in banned
    assert "VA Amount" in banned
