"""Churn risk: likelihood a customer places another order in the next 60 days.

The rules-based churn view elsewhere in the system asks "has this customer
gone quiet relative to their own habit?". This model asks the forward
question instead: given everything we know about an account today, how
likely are they to come back within the next two months?

Method. There are only 50 customers, far too few to train on directly, so
the unit of observation is a customer-month: for every customer, at the
start of every month, we describe their behaviour using only what was
known at that moment and record whether they went on to order within the
next 60 days. That turns 50 accounts into a few thousand labelled
observations.

Two safeguards matter for the result to mean anything:

  * Every feature is computed from history strictly before the observation
    date, so the model never sees the future it is being asked to predict.
  * Train and test are split by time, not at random. Testing on later
    months than it trained on is the honest version of the question the
    business actually has, and it avoids the model learning a specific
    customer's later behaviour from their earlier rows.

The model is scored against a naive benchmark (how overdue the customer is
relative to their own average gap). If it cannot beat that, the extra
complexity is not earning its place, and the reported numbers say so.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score

LOOKAHEAD_DAYS = 60
MIN_PRIOR_ORDERS = 3

FEATURE_COLUMNS = [
    "days_since_last_order",
    "avg_interval_days",
    "interval_cv",
    "recency_ratio",
    "orders_last_90d",
    "orders_last_365d",
    "tenure_days",
    "va_last_90d",
    "va_trend_ratio",
]

FEATURE_LABELS = {
    "days_since_last_order": "Days since last order",
    "avg_interval_days": "Typical gap between orders",
    "interval_cv": "How regular their ordering is",
    "recency_ratio": "Silence relative to their normal gap",
    "orders_last_90d": "Orders in last 90 days",
    "orders_last_365d": "Orders in last 12 months",
    "tenure_days": "Length of relationship",
    "va_last_90d": "Value added, last 90 days",
    "va_trend_ratio": "Recent value vs prior period",
}


def _build_panel(df: pd.DataFrame) -> pd.DataFrame:
    orders = (
        df.groupby(["customer_id", "customer_name", "sales_in"], as_index=False)
        .agg(order_va=("va_amount_base", "sum"))
        .sort_values(["customer_id", "sales_in"])
    )

    start = df["sales_in"].min().to_period("M").to_timestamp()
    end = df["sales_in"].max().to_period("M").to_timestamp()
    observation_dates = pd.date_range(start, end, freq="MS")

    rows: list[dict] = []
    for (cust_id, cust_name), g in orders.groupby(["customer_id", "customer_name"]):
        dates = g["sales_in"].reset_index(drop=True)
        vas = g["order_va"].reset_index(drop=True)

        for obs in observation_dates:
            past_mask = dates < obs
            n_past = int(past_mask.sum())
            if n_past < MIN_PRIOR_ORDERS:
                continue

            past_dates = dates[past_mask]
            past_vas = vas[past_mask]
            last_order = past_dates.iloc[-1]
            gaps = past_dates.diff().dropna().dt.days

            avg_interval = float(gaps.mean()) if len(gaps) else np.nan
            interval_cv = float(gaps.std(ddof=0) / avg_interval) if len(gaps) and avg_interval else 0.0
            days_since = float((obs - last_order).days)

            va_90 = float(past_vas[past_dates >= obs - pd.Timedelta(days=90)].sum())
            va_prior_90 = float(
                past_vas[(past_dates >= obs - pd.Timedelta(days=180)) & (past_dates < obs - pd.Timedelta(days=90))].sum()
            )

            future_mask = (dates >= obs) & (dates < obs + pd.Timedelta(days=LOOKAHEAD_DAYS))

            rows.append({
                "customer_id": cust_id,
                "customer_name": cust_name,
                "observation_date": obs,
                "days_since_last_order": days_since,
                "avg_interval_days": avg_interval,
                "interval_cv": interval_cv,
                "recency_ratio": days_since / avg_interval if avg_interval else np.nan,
                "orders_last_90d": float((past_dates >= obs - pd.Timedelta(days=90)).sum()),
                "orders_last_365d": float((past_dates >= obs - pd.Timedelta(days=365)).sum()),
                "tenure_days": float((obs - past_dates.iloc[0]).days),
                "va_last_90d": va_90,
                "va_trend_ratio": (va_90 / va_prior_90) if va_prior_90 > 0 else 1.0,
                "will_order": int(future_mask.any()),
            })

    panel = pd.DataFrame(rows)
    if panel.empty:
        return panel
    panel["va_trend_ratio"] = panel["va_trend_ratio"].clip(0, 5)
    return panel


def train_churn_model(df: pd.DataFrame) -> dict:
    panel = _build_panel(df)
    if panel.empty:
        return {"available": False, "reason": "Not enough order history to build a training panel."}

    max_date = df["sales_in"].max()
    # An observation can only be labelled once the full look-ahead window has
    # elapsed; anything more recent has an unknowable outcome.
    labelled = panel[panel["observation_date"] <= max_date - pd.Timedelta(days=LOOKAHEAD_DAYS)].copy()

    if len(labelled) < 200 or labelled["will_order"].nunique() < 2:
        return {"available": False, "reason": "Not enough labelled history to train a reliable model."}

    labelled = labelled.sort_values("observation_date")
    split_at = labelled["observation_date"].quantile(0.7)
    train = labelled[labelled["observation_date"] <= split_at]
    test = labelled[labelled["observation_date"] > split_at]

    if len(test) < 50 or test["will_order"].nunique() < 2 or train["will_order"].nunique() < 2:
        return {"available": False, "reason": "Not enough variation after the time-based split to evaluate honestly."}

    model = HistGradientBoostingClassifier(max_iter=250, learning_rate=0.06, random_state=42)
    model.fit(train[FEATURE_COLUMNS], train["will_order"])

    proba = model.predict_proba(test[FEATURE_COLUMNS])[:, 1]
    auc = float(roc_auc_score(test["will_order"], proba))

    # Naive benchmark: the more overdue a customer is relative to their own
    # average gap, the less likely they are to order. If the model cannot
    # beat this, it is not worth the complexity.
    baseline_score = -test["recency_ratio"].fillna(test["recency_ratio"].median())
    baseline_auc = float(roc_auc_score(test["will_order"], baseline_score))

    predicted_label = (proba >= 0.5).astype(int)
    accuracy = float((predicted_label == test["will_order"]).mean())
    base_rate = float(test["will_order"].mean())

    # Score every customer as at the latest date in the data. These rows are
    # deliberately unlabelled — they are the genuine forward prediction.
    current = panel[panel["observation_date"] == panel["observation_date"].max()].copy()
    if current.empty:
        current_risk: list[dict] = []
    else:
        current["order_probability"] = model.predict_proba(current[FEATURE_COLUMNS])[:, 1]
        current["risk_score"] = 1 - current["order_probability"]
        current["risk_band"] = pd.cut(
            current["risk_score"],
            bins=[-0.01, 0.35, 0.65, 1.01],
            labels=["Low", "Medium", "High"],
        ).astype(str)
        current = current.sort_values("risk_score", ascending=False)
        current_risk = (
            current[[
                "customer_id", "customer_name", "risk_score", "order_probability", "risk_band",
                "days_since_last_order", "avg_interval_days", "orders_last_365d", "va_last_90d",
            ]]
            .round(3)
            .to_dict(orient="records")
        )

    band_counts = {"High": 0, "Medium": 0, "Low": 0}
    for row in current_risk:
        band_counts[row["risk_band"]] = band_counts.get(row["risk_band"], 0) + 1

    return {
        "available": True,
        "metrics": {
            "auc": round(auc, 3),
            "baseline_auc": round(baseline_auc, 3),
            "beats_baseline": bool(auc > baseline_auc),
            "accuracy": round(accuracy, 3),
            "base_rate": round(base_rate, 3),
            "train_rows": int(len(train)),
            "test_rows": int(len(test)),
            "customers": int(panel["customer_id"].nunique()),
            "lookahead_days": LOOKAHEAD_DAYS,
            "train_period_end": split_at.strftime("%Y-%m-%d"),
        },
        "current_risk": current_risk,
        "band_counts": band_counts,
        "features_used": [FEATURE_LABELS[f] for f in FEATURE_COLUMNS],
    }
