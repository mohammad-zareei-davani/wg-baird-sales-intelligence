"""Insight 5: Demand seasonality and press capacity planning.

A printer's constraint is press time, not order count. This module tracks
booked work and press hours by month, isolates the repeating seasonal
shape from the underlying trend, and projects the next few months so
scheduling and staffing can be planned against expected load rather than
against last month's actuals.

The forecast is deliberately simple and explainable: a seasonal-naive
model (same month last year) blended with the recent 3-month level, so
anyone can reconstruct the number by hand. Its backtested error is
reported alongside it rather than hidden.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _monthly_frame(df: pd.DataFrame) -> pd.DataFrame:
    monthly = (
        df.groupby("month_start", as_index=False)
        .agg(
            sell_price=("sell_price_base", "sum"),
            va_amount=("va_amount_base", "sum"),
            press_hours=("press_hrs", "sum"),
            impressions=("impressions", "sum"),
            job_count=("job_id", "count"),
        )
        .sort_values("month_start")
    )
    # Reindex onto a complete monthly grid so a month with no bookings shows
    # as a genuine zero rather than silently disappearing from the series.
    full_index = pd.date_range(monthly["month_start"].min(), monthly["month_start"].max(), freq="MS")
    monthly = monthly.set_index("month_start").reindex(full_index).fillna(0.0)
    monthly.index.name = "month_start"
    return monthly.reset_index()


def _seasonal_index(monthly: pd.DataFrame, column: str) -> pd.DataFrame:
    """Average level of each calendar month relative to the overall mean."""
    tmp = monthly.copy()
    tmp["month_num"] = tmp["month_start"].dt.month
    overall = tmp[column].mean()
    idx = (
        tmp.groupby("month_num", as_index=False)[column]
        .mean()
        .rename(columns={column: "avg_value"})
    )
    idx["seasonal_index"] = (idx["avg_value"] / overall * 100) if overall else 100.0
    idx["month_name"] = idx["month_num"].map(lambda m: MONTH_NAMES[m - 1])
    return idx


def _forecast(monthly: pd.DataFrame, column: str, horizon: int) -> tuple[list[dict], float | None]:
    """Seasonal-naive blended with recent level, plus a backtested error.

    Returns (forecast rows, mean absolute percentage error from backtest).
    """
    series = monthly.set_index("month_start")[column]
    if len(series) < 14:
        return [], None

    def predict_for(target: pd.Timestamp, history: pd.Series) -> float:
        last_year = target - pd.DateOffset(years=1)
        seasonal = history.get(last_year, np.nan)
        recent = history.tail(3).mean()
        if np.isnan(seasonal):
            return float(recent)
        # Scale last year's same month by how the recent level compares with
        # the equivalent window a year ago, so the forecast tracks growth or
        # decline instead of assuming the business is flat year on year.
        prior_window = history.loc[:last_year].tail(3).mean()
        growth = (recent / prior_window) if prior_window else 1.0
        growth = float(np.clip(growth, 0.5, 2.0))
        return float(seasonal * growth)

    # Backtest over the last 6 available months using only prior data.
    errors: list[float] = []
    for i in range(max(len(series) - 6, 12), len(series)):
        target = series.index[i]
        actual = series.iloc[i]
        if actual <= 0:
            continue
        pred = predict_for(target, series.iloc[:i])
        errors.append(abs(pred - actual) / actual)
    mape = float(np.mean(errors) * 100) if errors else None

    rows = []
    history = series.copy()
    last = series.index[-1]
    for step in range(1, horizon + 1):
        target = last + pd.DateOffset(months=step)
        value = predict_for(target, history)
        rows.append({"month_start": target.strftime("%Y-%m-%d"), "forecast": round(max(value, 0.0), 2)})
        history.loc[target] = value

    return rows, mape


def seasonality_analysis(df: pd.DataFrame, horizon: int = 6) -> dict:
    monthly = _monthly_frame(df)

    sales_index = _seasonal_index(monthly, "sell_price")
    press_index = _seasonal_index(monthly, "press_hours")

    sales_forecast, sales_mape = _forecast(monthly, "sell_price", horizon)
    press_forecast, press_mape = _forecast(monthly, "press_hours", horizon)

    peak = sales_index.loc[sales_index["seasonal_index"].idxmax()]
    trough = sales_index.loc[sales_index["seasonal_index"].idxmin()]

    # Which industries drive the peak month. The schoolbook programme
    # should show up here if the seasonality is what the business believes.
    peak_month_num = int(peak["month_num"])
    peak_mix = (
        df[df["sales_in"].dt.month == peak_month_num]
        .groupby("industry", as_index=False)
        .agg(sell_price=("sell_price_base", "sum"))
        .sort_values("sell_price", ascending=False)
        .head(6)
    )

    monthly_out = monthly.copy()
    monthly_out["month_start"] = monthly_out["month_start"].dt.strftime("%Y-%m-%d")

    press_capacity_peak = float(monthly["press_hours"].max())
    press_recent = float(monthly["press_hours"].tail(12).mean())

    return {
        "monthly": monthly_out.round(2).to_dict(orient="records"),
        "sales_seasonal_index": sales_index.round(1).to_dict(orient="records"),
        "press_seasonal_index": press_index.round(1).to_dict(orient="records"),
        "sales_forecast": sales_forecast,
        "press_forecast": press_forecast,
        "peak_month_mix": peak_mix.round(2).to_dict(orient="records"),
        "summary": {
            "peak_month": str(peak["month_name"]),
            "peak_index": round(float(peak["seasonal_index"]), 1),
            "trough_month": str(trough["month_name"]),
            "trough_index": round(float(trough["seasonal_index"]), 1),
            "peak_to_trough_ratio": round(
                float(peak["seasonal_index"]) / float(trough["seasonal_index"]), 2
            ) if float(trough["seasonal_index"]) else None,
            "sales_forecast_mape": round(sales_mape, 1) if sales_mape is not None else None,
            "press_forecast_mape": round(press_mape, 1) if press_mape is not None else None,
            "forecast_horizon_months": horizon,
            "press_hours_peak_month": round(press_capacity_peak, 1),
            "press_hours_recent_avg": round(press_recent, 1),
            "forecast_next_month_sales": sales_forecast[0]["forecast"] if sales_forecast else None,
            "forecast_next_month_press": press_forecast[0]["forecast"] if press_forecast else None,
        },
    }
