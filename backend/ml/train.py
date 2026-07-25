"""Train VA models with a time-based split.

Three models share the same cutoff and categorical allowlist:

- **Model A-Estimate** — post-estimate VA Amount. Uses Impressions and Press
  hrs from the estimating system. Answers: given the production estimate,
  what should this job be worth.
- **Model A-Enquiry** — first-contact VA Amount. Numeric features limited to
  Quantity, Plates, booking month and ISO week. Impressions and Press hrs
  are produced by estimating and are not known when a customer first
  enquires, so a model that requires them can only run after estimating.
- **Model B** — VA%. Same features as A-Estimate. Weak score is expected.

Unseen categorical levels at test time: with scikit-learn 1.9's native
categorical support, training categories are frozen; unseen test levels
become NaN and do not raise.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score

from core.config import load_config
from ml.features import (
    CATEGORICAL_FEATURES,
    FEATURE_COLUMNS_ENQUIRY,
    FEATURE_COLUMNS_ESTIMATE,
    build_feature_matrix,
    prepare_modelling_frame,
)

ARTIFACTS = Path(__file__).resolve().parent / "artifacts"

MODE_WHEN = {
    "estimate": (
        "Use after estimating has produced Impressions and Press hours — "
        "the post-estimate benchmark for what the job should be worth."
    ),
    "enquiry": (
        "Use at first customer contact, before estimating — Impressions and "
        "Press hours are not yet known."
    ),
}


def _encode_categoricals(
    X_train: pd.DataFrame, X_test: pd.DataFrame, columns: list[str]
) -> tuple[pd.DataFrame, pd.DataFrame, dict]:
    category_maps: dict[str, list] = {}
    train = X_train.copy()
    test = X_test.copy()
    for col in CATEGORICAL_FEATURES:
        cats = pd.Index(pd.Series(train[col].astype("object")).dropna().unique()).tolist()
        category_maps[col] = cats
        train_codes = pd.Categorical(train[col].astype("object"), categories=cats).codes.astype(
            float
        )
        test_codes = pd.Categorical(test[col].astype("object"), categories=cats).codes.astype(
            float
        )
        train_codes[train_codes < 0] = np.nan
        test_codes[test_codes < 0] = np.nan
        train[col] = train_codes
        test[col] = test_codes
    # Keep column order stable for the mode's feature list.
    return train[columns], test[columns], category_maps


def _baseline_product_median(train_y: pd.Series, train_types: pd.Series, test_types: pd.Series):
    medians = train_y.groupby(train_types, dropna=False).median()
    global_median = float(train_y.median())
    preds = test_types.map(medians).astype(float)
    return preds.fillna(global_median)


def _fit_hgb(X_train: pd.DataFrame, y_train: pd.Series, columns: list[str]):
    cat_indices = [columns.index(c) for c in CATEGORICAL_FEATURES]
    model = HistGradientBoostingRegressor(
        max_iter=400,
        learning_rate=0.06,
        categorical_features=cat_indices,
        random_state=0,
    )
    model.fit(X_train.to_numpy(), y_train.to_numpy())
    return model


def train_models(df: pd.DataFrame, config: dict | None = None) -> dict:
    config = config or load_config()
    cutoff = pd.Timestamp(config["model"]["train_cutoff"])

    work = prepare_modelling_frame(df)
    y_a = work["va_amount_gbp"].astype(float)
    y_b = work["va_pct"].astype(float)
    product_type = work["product_type_norm"]
    sales_in = work["sales_in"]

    usable = y_a.notna() & y_b.notna()
    work = work.loc[usable]
    y_a, y_b, product_type, sales_in = (
        y_a.loc[usable],
        y_b.loc[usable],
        product_type.loc[usable],
        sales_in.loc[usable],
    )

    train_mask = sales_in <= cutoff
    test_mask = sales_in > cutoff
    y_a_train, y_a_test = y_a.loc[train_mask], y_a.loc[test_mask]
    y_b_train, y_b_test = y_b.loc[train_mask], y_b.loc[test_mask]
    type_train, type_test = product_type.loc[train_mask], product_type.loc[test_mask]
    base_a = _baseline_product_median(y_a_train, type_train, type_test)
    base_b = pd.Series(float(y_b_train.median()), index=y_b_test.index)

    # --- A-Estimate + B (full numeric set) ---
    X_est = build_feature_matrix(work, config, mode="estimate")
    X_est_train_raw, X_est_test_raw = X_est.loc[train_mask], X_est.loc[test_mask]
    X_est_train, X_est_test, category_maps = _encode_categoricals(
        X_est_train_raw, X_est_test_raw, FEATURE_COLUMNS_ESTIMATE
    )
    model_a_estimate = _fit_hgb(X_est_train, y_a_train, FEATURE_COLUMNS_ESTIMATE)
    model_b = _fit_hgb(X_est_train, y_b_train, FEATURE_COLUMNS_ESTIMATE)
    pred_a_est = model_a_estimate.predict(X_est_test.to_numpy())
    pred_b = model_b.predict(X_est_test.to_numpy())

    # --- A-Enquiry (no impressions / press hrs) ---
    X_enq = build_feature_matrix(work, config, mode="enquiry")
    X_enq_train_raw, X_enq_test_raw = X_enq.loc[train_mask], X_enq.loc[test_mask]
    X_enq_train, X_enq_test, _ = _encode_categoricals(
        X_enq_train_raw, X_enq_test_raw, FEATURE_COLUMNS_ENQUIRY
    )
    model_a_enquiry = _fit_hgb(X_enq_train, y_a_train, FEATURE_COLUMNS_ENQUIRY)
    pred_a_enq = model_a_enquiry.predict(X_enq_test.to_numpy())

    metrics = {
        "cutoff": cutoff.date().isoformat(),
        "train_rows": int(train_mask.sum()),
        "test_rows": int(test_mask.sum()),
        "categorical_features": CATEGORICAL_FEATURES,
        "unseen_categorical_policy": (
            "Training categories are frozen. Unseen test levels are encoded as "
            "missing (NaN). HistGradientBoostingRegressor (scikit-learn 1.9) "
            "routes missing categorical values through its missing-value bin "
            "and does not raise."
        ),
        "model_a_estimate": {
            "name": "Model A-Estimate",
            "mode": "estimate",
            "when": MODE_WHEN["estimate"],
            "target": "va_amount_gbp",
            "features": FEATURE_COLUMNS_ESTIMATE,
            "r2": round(float(r2_score(y_a_test, pred_a_est)), 4),
            "mae": round(float(mean_absolute_error(y_a_test, pred_a_est)), 2),
            "baseline_r2": round(float(r2_score(y_a_test, base_a)), 4),
            "baseline_mae": round(float(mean_absolute_error(y_a_test, base_a)), 2),
            "baseline": "per product_type_norm median VA from training data",
        },
        "model_a_enquiry": {
            "name": "Model A-Enquiry",
            "mode": "enquiry",
            "when": MODE_WHEN["enquiry"],
            "target": "va_amount_gbp",
            "features": FEATURE_COLUMNS_ENQUIRY,
            "r2": round(float(r2_score(y_a_test, pred_a_enq)), 4),
            "mae": round(float(mean_absolute_error(y_a_test, pred_a_enq)), 2),
            "baseline_r2": round(float(r2_score(y_a_test, base_a)), 4),
            "baseline_mae": round(float(mean_absolute_error(y_a_test, base_a)), 2),
            "baseline": "per product_type_norm median VA from training data",
        },
        "model_b": {
            "name": "Model B",
            "mode": None,
            "when": (
                "Diagnostic only: tests whether job spec, customer and season "
                "explain achieved margin ratio (VA%)."
            ),
            "target": "va_pct",
            "features": FEATURE_COLUMNS_ESTIMATE,
            "r2": round(float(r2_score(y_b_test, pred_b)), 4),
            "mae": round(float(mean_absolute_error(y_b_test, pred_b)), 4),
            "baseline_r2": round(float(r2_score(y_b_test, base_b)), 4),
            "baseline_mae": round(float(mean_absolute_error(y_b_test, base_b)), 4),
            "baseline": "training-set median VA%",
            "interpretation": (
                "Weak score is expected. Job specification, customer and season "
                "explain little of achieved margin ratio; margin is set by human "
                "pricing decisions this dataset does not record."
            ),
        },
    }

    for key in ("model_a_estimate", "model_a_enquiry"):
        if metrics[key]["r2"] > 0.95:
            raise RuntimeError(
                f"{metrics[key]['name']} R²={metrics[key]['r2']} exceeds 0.95 — "
                "likely feature leakage. Audit the allowlist."
            )

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    joblib.dump(model_a_estimate, ARTIFACTS / "model_a_estimate.joblib")
    joblib.dump(model_a_enquiry, ARTIFACTS / "model_a_enquiry.joblib")
    joblib.dump(model_b, ARTIFACTS / "model_b_va_pct.joblib")
    joblib.dump(category_maps, ARTIFACTS / "category_maps.joblib")

    import shap

    joblib.dump(
        shap.TreeExplainer(model_a_estimate),
        ARTIFACTS / "shap_explainer_a_estimate.joblib",
    )
    joblib.dump(
        shap.TreeExplainer(model_a_enquiry),
        ARTIFACTS / "shap_explainer_a_enquiry.joblib",
    )

    with open(ARTIFACTS / "metrics.json", "w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2)

    return metrics


def main() -> None:
    import os
    import sys

    from django.db import connection

    backend = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(backend))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "baird.settings")
    import django

    django.setup()

    df = pd.read_sql_query("SELECT * FROM core_job", connection)
    print(json.dumps(train_models(df), indent=2))


if __name__ == "__main__":
    main()
