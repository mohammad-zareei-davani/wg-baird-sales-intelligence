"""Synthetic dormancy cadence and tier tests."""

import pandas as pd

from analytics.dormancy import compute_dormancy


def _jobs(customer_id: str, customer_name: str, dates: list[str], **extra) -> pd.DataFrame:
    rows = []
    for i, d in enumerate(dates):
        rows.append(
            {
                "customer_id": customer_id,
                "customer_name": customer_name,
                "sales_in": pd.Timestamp(d),
                "is_credit": False,
                "is_closed": True,
                "va_amount_gbp": 100.0 + i,
                **extra,
            }
        )
    return pd.DataFrame(rows)


def test_regular_cadence_not_flagged():
    regular_dates = pd.date_range("2024-01-01", periods=12, freq="14D")
    regular = _jobs(
        "CID_REG",
        "CUST_REG",
        [d.strftime("%Y-%m-%d") for d in regular_dates],
    )
    anchor = _jobs("CID_ANCHOR", "CUST_ANCHOR", ["2024-06-03"])
    df = pd.concat([regular, anchor], ignore_index=True)
    result = compute_dormancy(df, {"dormancy": {"percentile": 90}})
    cust = next(c for c in result["customers"] if c["customer_id"] == "CID_REG")
    assert cust["cadence_regular"] is True
    assert cust["tier"] == "NORMAL"
    assert cust["at_risk"] is False
    assert cust["cycles_missed"] is not None and cust["cycles_missed"] < 3


def test_recovery_tier_long_silence_many_cycles():
    dates = [
        "2023-01-01",
        "2023-01-15",
        "2023-01-29",
        "2023-02-12",
        "2023-02-26",
        "2023-03-12",
        "2023-03-26",
        "2023-04-09",
        "2023-04-23",
    ]
    erratic = _jobs("CID_ERR", "CUST_ERR", dates)
    later = _jobs("CID_LATER", "CUST_LATER", ["2025-12-01"])
    df = pd.concat([erratic, later], ignore_index=True)
    result = compute_dormancy(df, {"dormancy": {"percentile": 90}})
    cust = next(c for c in result["customers"] if c["customer_id"] == "CID_ERR")
    assert cust["cycles_missed"] is not None and cust["cycles_missed"] > 6
    assert cust["days_since_last_order"] > 90
    assert cust["tier"] == "RECOVERY"
    assert cust["at_risk"] is True


def test_monitor_requires_absolute_day_floor():
    # Frequent orderer: many cycles missed but only ~15 days silence → NORMAL.
    dates = pd.date_range("2024-01-01", periods=20, freq="2D")
    cust = _jobs("CID_FAST", "CUST_FAST", [d.strftime("%Y-%m-%d") for d in dates])
    later = _jobs("CID_LATER", "CUST_LATER", ["2024-02-23"])
    df = pd.concat([cust, later], ignore_index=True)
    result = compute_dormancy(df, {"dormancy": {"percentile": 90}})
    row = next(c for c in result["customers"] if c["customer_id"] == "CID_FAST")
    assert row["median_gap_days"] == 2.0
    assert row["cycles_missed"] is not None and row["cycles_missed"] >= 3
    assert row["days_since_last_order"] <= 30
    assert row["tier"] == "NORMAL"


def test_monitor_tier_when_cycles_and_days_qualify():
    # Median gap 10 days; 40 days silence → 4.0 cycles, days > 30 → MONITOR.
    dates = pd.date_range("2024-01-01", periods=12, freq="10D")
    cust = _jobs("CID_MON", "CUST_MON", [d.strftime("%Y-%m-%d") for d in dates])
    # Last order ~2024-04-20; as_of 40 days later.
    later = _jobs("CID_LATER", "CUST_LATER", ["2024-05-30"])
    df = pd.concat([cust, later], ignore_index=True)
    result = compute_dormancy(df, {"dormancy": {"percentile": 90}})
    row = next(c for c in result["customers"] if c["customer_id"] == "CID_MON")
    assert 3 <= row["cycles_missed"] <= 6
    assert row["days_since_last_order"] > 30
    assert row["tier"] == "MONITOR"


def test_cv_uses_std_over_median():
    dates = [
        "2024-01-01",
        "2024-01-02",
        "2024-01-03",
        "2024-01-04",
        "2024-01-05",
        "2024-04-15",
    ]
    df = _jobs("CID_TAIL", "CUST_TAIL", dates)
    result = compute_dormancy(df, {"dormancy": {"percentile": 90}})
    cust = next(c for c in result["customers"] if c["customer_id"] == "CID_TAIL")
    assert cust["median_gap_days"] == 1.0
    assert cust["cv"] is not None and cust["cv"] > 1.0
    assert cust["cadence_regular"] is False


def test_credits_do_not_create_order_events():
    dates = ["2024-01-01", "2024-01-15", "2024-01-29", "2024-02-12"]
    real = _jobs("CID_CR", "CUST_CR", dates)
    credit = _jobs("CID_CR", "CUST_CR", ["2024-06-01"])
    credit["is_credit"] = True
    later = _jobs("CID_LATER", "CUST_LATER", ["2024-06-01"])
    df = pd.concat([real, credit, later], ignore_index=True)
    result = compute_dormancy(df, {"dormancy": {"percentile": 90}})
    cust = next(c for c in result["customers"] if c["customer_id"] == "CID_CR")
    assert cust["last_order"] == "2024-02-12"
    assert cust["order_events"] == 4


def test_recovery_sorted_by_annualised_va():
    dormant_dates = pd.date_range("2023-01-01", periods=10, freq="14D")
    high = _jobs(
        "CID_HIGH",
        "CUST_HIGH",
        [d.strftime("%Y-%m-%d") for d in dormant_dates],
    )
    high["va_amount_gbp"] = 1000.0
    low = _jobs(
        "CID_LOW",
        "CUST_LOW",
        [d.strftime("%Y-%m-%d") for d in dormant_dates],
    )
    low["va_amount_gbp"] = 10.0
    later = _jobs("CID_LATER", "CUST_LATER", ["2025-06-01"])
    df = pd.concat([high, low, later], ignore_index=True)
    result = compute_dormancy(df, {"dormancy": {"percentile": 90}})
    assert result["recovery_count"] >= 2
    assert result["recovery"][0]["annualised_va_gbp"] >= result["recovery"][1]["annualised_va_gbp"]
    expected = sum(c["annualised_va_gbp"] for c in result["recovery"])
    assert result["annualised_exposure_gbp"] == round(expected, 2)
