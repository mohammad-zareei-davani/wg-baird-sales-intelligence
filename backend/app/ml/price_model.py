"""Quote Guard: a learned benchmark for what a job should sell for.

The model learns the relationship between a job's specification and input
costs (quantity, impressions, plates, press hours, paper, labour, bought-in
work) and the price it actually achieved. Given a new job it produces the
price comparable work has historically commanded, which gives estimators a
second opinion at the point of quoting and flags historic work that was
sold materially below the going rate.

Deliberately excluded from the inputs: value added, markup, handling
charges and the manual adjustment itself. Those are outputs of the pricing
decision, not inputs to it, and including them would let the model reconstruct
the answer and produce a meaninglessly good score.

Price is modelled in log space because job values span four orders of
magnitude; a flat error target would let a handful of very large jobs
dominate the fit.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

from app.config import UNDERPRICED_THRESHOLD_PCT

NUMERIC_FEATURES = [
    "quantity", "impressions", "plates", "press_hrs",
    "paper_base", "labour_base", "purchases_base",
]
CATEGORICAL_FEATURES = ["work_type", "region", "currency", "product_type_clean"]

FEATURE_LABELS = {
    "quantity": "Order quantity",
    "impressions": "Impressions (sheets)",
    "plates": "Printing plates",
    "press_hrs": "Press hours",
    "paper_base": "Paper cost",
    "labour_base": "Labour cost",
    "purchases_base": "Bought-in cost",
    "work_type": "Work type",
    "region": "Region",
    "currency": "Currency",
    "product_type_clean": "Product type",
}


def _build_matrix(df: pd.DataFrame, categories: dict[str, pd.Index] | None = None):
    X = df[NUMERIC_FEATURES].copy()
    cats: dict[str, pd.Index] = {}
    for col in CATEGORICAL_FEATURES:
        values = df[col].astype("string").fillna("Unknown")
        if categories is None:
            cat_type = pd.CategoricalDtype(sorted(values.unique()))
        else:
            cat_type = pd.CategoricalDtype(categories[col])
        coded = values.astype(cat_type).cat.codes
        X[col] = coded
        cats[col] = cat_type.categories
    return X, cats


def train_price_model(df: pd.DataFrame) -> dict:
    usable = df[(df["sell_price_base"] > 0) & df["sell_price_base"].notna()].copy()
    if len(usable) < 200:
        return {"available": False, "reason": "Not enough priced jobs to train a reliable model."}

    X, categories = _build_matrix(usable)
    y = np.log1p(usable["sell_price_base"])

    X_train, X_test, y_train, y_test, idx_train, idx_test = train_test_split(
        X, y, usable.index, test_size=0.25, random_state=42
    )

    model = HistGradientBoostingRegressor(max_iter=400, learning_rate=0.06, random_state=42)
    model.fit(X_train, y_train)

    pred_log = model.predict(X_test)
    actual = np.expm1(y_test)
    predicted = np.expm1(pred_log)
    pct_err = np.abs(predicted - actual) / actual

    metrics = {
        "r2_log": round(float(r2_score(y_test, pred_log)), 3),
        "mae": round(float(mean_absolute_error(actual, predicted)), 2),
        "median_abs_pct_error": round(float(np.median(pct_err) * 100), 1),
        "within_10pct": round(float((pct_err <= 0.10).mean() * 100), 1),
        "within_25pct": round(float((pct_err <= 0.25).mean() * 100), 1),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
    }

    # Score the held-out jobs only. Scoring jobs the model trained on would
    # understate the gap, because the model has already seen their price.
    scored = usable.loc[idx_test].copy()
    scored["expected_price"] = predicted
    scored["actual_price"] = actual.values
    scored["gap"] = scored["actual_price"] - scored["expected_price"]
    scored["gap_pct"] = scored["gap"] / scored["expected_price"] * 100

    underpriced = scored[scored["gap_pct"] <= -UNDERPRICED_THRESHOLD_PCT * 100]
    flagged = (
        underpriced.sort_values("gap")
        .head(20)[[
            "job_id", "customer_name", "product_type_clean", "work_type",
            "quantity", "actual_price", "expected_price", "gap", "gap_pct",
        ]]
        .rename(columns={"product_type_clean": "product_type"})
    )

    return {
        "available": True,
        "metrics": metrics,
        "threshold_pct": round(UNDERPRICED_THRESHOLD_PCT * 100, 0),
        "flagged_count": int(len(underpriced)),
        "flagged_share_pct": round(len(underpriced) / len(scored) * 100, 1) if len(scored) else 0.0,
        "value_gap": round(float(underpriced["gap"].sum()), 2),
        "flagged_jobs": flagged.round(2).to_dict(orient="records"),
        "features_used": [FEATURE_LABELS[f] for f in NUMERIC_FEATURES + CATEGORICAL_FEATURES],
    }
