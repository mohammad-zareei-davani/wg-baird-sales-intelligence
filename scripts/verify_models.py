"""Confirm pricing variance ranking and train the prediction models."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pandas as pd

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "baird.settings")

import django

django.setup()

from django.db import connection  # noqa: E402

from analytics.pricing_variance import compute_pricing_variance  # noqa: E402
from core.config import reload_config  # noqa: E402
from ml.train import train_models  # noqa: E402


def main() -> None:
    config = reload_config()
    df = pd.read_sql_query("SELECT * FROM core_job", connection)

    print("=== Pricing variance by rep (sorted by net % of own revenue) ===")
    variance = compute_pricing_variance(df, config)
    print(variance["limitation"])
    print()
    for r in variance["by_rep"]:
        print(
            f"  {r['key']}: net_pct={r['net_pct_of_revenue']:+.1%}  "
            f"net £{r['net_override_gbp']:,.0f}  "
            f"neg £{r['negative_override_gbp']:,.0f} (n={r['discounted_job_count']})  "
            f"pos £{r['positive_override_gbp']:,.0f} (n={r['marked_up_job_count']})  "
            f"avg_discount £{r['avg_discount_per_discounted_job_gbp']}"
        )
    print("\nNet-negative reps:")
    for r in variance["net_negative_reps"]:
        print(f"  {r['key']}: {r['net_pct_of_revenue']:+.1%}")

    print("\n=== Training models ===")
    metrics = train_models(df, config)
    print(json.dumps(metrics, indent=2))
    print("\n=== metrics.json on disk ===")
    print((REPO / "backend" / "ml" / "artifacts" / "metrics.json").read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
