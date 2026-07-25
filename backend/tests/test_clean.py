"""Tests for the cleaning pipeline (pure pandas, no database)."""

import numpy as np
import pandas as pd
import pytest

from core.clean import EXPECTED_COLUMNS, clean_workbook, validate_columns
from core.config import load_config

CONFIG = load_config()


def make_frame(n: int = 1, **overrides) -> pd.DataFrame:
    """A minimal valid frame with all 36 expected columns."""
    base = {
        "Title": [f"JOB_{i}" for i in range(n)],
        "CustomerID": ["CUST_001"] * n,
        "Job Status": ["z-Closed"] * n,
        "SalesIn": [pd.Timestamp("2024-03-01")] * n,
        "Year": [2024] * n,
        "Month": ["March"] * n,
        "Week No": [9] * n,
        "SalesOut": [pd.Timestamp("2024-03-10")] * n,
        "Quantity": [1000.0] * n,
        "Sell Price": [500.0] * n,
        "Mup%": [0.1] * n,
        "VA Amount": [200.0] * n,
        "VA/24": [4800.0] * n,
        "VA%": [0.4] * n,
        "VA/K": [200.0] * n,
        "Rebate": [0.0] * n,
        "Puchases": [300.0] * n,
        "Press hrs": [1.0] * n,
        "Impressions": [2000.0] * n,
        "Handling": [0.0] * n,
        "Labour": [150.0] * n,
        "Paper": [100.0] * n,
        "labmup": [0.0] * n,
        "manadj": [0.0] * n,
        "mupnett": [0.0] * n,
        "Plates": [4.0] * n,
        "AmtInv": [500.0] * n,
        "Customer Name": ["Customer 1"] * n,
        "Rep": ["REP_01"] * n,
        "Region": ["NI"] * n,
        "Industry": ["Education"] * n,
        "Work Type": ["Litho"] * n,
        "Product Type": ["Magazines"] * n,
        "Binding Type": ["Stitched"] * n,
        "Currency": ["Stg"] * n,
        "Ship date": [pd.Timestamp("2024-03-08")] * n,
    }
    base.update(overrides)
    return pd.DataFrame(base)


def test_duplicate_product_labels_collapse():
    df = make_frame(
        n=6,
        **{
            "Product Type": [
                "Brochures / Price List",
                "Brochures / Price LIst",
                "Leaflets to A4/ Price Lists",
                "Leaflets to A4 /Price Lists",
                "Educational Books",
                "Books/Educational Books",
            ]
        },
    )
    cleaned, _ = clean_workbook(df, CONFIG)
    norm = cleaned["product_type_norm"].tolist()
    assert norm[0] == norm[1], "Brochures variants must collapse to one value"
    assert norm[2] == norm[3], "Leaflets variants must collapse to one value"
    assert norm[4] == norm[5], "Educational Books variants must collapse to one value"
    assert cleaned["product_type_norm"].nunique() == 3


def test_euro_row_converts_to_gbp():
    rate = CONFIG["fx"]["eur_to_gbp"]
    df = make_frame(n=2, **{"Currency": ["Euro", "Stg"], "Sell Price": [1000.0, 1000.0]})
    cleaned, _ = clean_workbook(df, CONFIG)
    assert cleaned.loc[0, "sell_price_gbp"] == pytest.approx(1000.0 * rate)
    assert cleaned.loc[1, "sell_price_gbp"] == pytest.approx(1000.0)
    # originals retained
    assert cleaned.loc[0, "Sell Price"] == pytest.approx(1000.0)


def test_negative_sell_price_flagged_as_credit():
    df = make_frame(n=2, **{"Sell Price": [-12920.0, 500.0]})
    cleaned, counts = clean_workbook(df, CONFIG)
    assert bool(cleaned.loc[0, "is_credit"]) is True
    assert bool(cleaned.loc[1, "is_credit"]) is False
    assert counts["credits_flagged"] == 1


def test_null_binding_becomes_outsourced():
    df = make_frame(n=2, **{"Binding Type": [np.nan, "Stitched"]})
    cleaned, counts = clean_workbook(df, CONFIG)
    assert cleaned.loc[0, "binding_type_filled"] == "OUTSOURCED"
    assert cleaned.loc[1, "binding_type_filled"] == "Stitched"
    assert counts["binding_null_encoded_outsourced"] == 1


def test_missing_column_raises_with_names():
    df = make_frame().drop(columns=["Labour", "Currency"])
    with pytest.raises(ValueError) as excinfo:
        validate_columns(df)
    assert "Labour" in str(excinfo.value)
    assert "Currency" in str(excinfo.value)


def test_expected_columns_is_complete():
    assert len(EXPECTED_COLUMNS) == 36
