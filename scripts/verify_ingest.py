"""Report ingest quality: run history, job counts, product-type normalisation, credits.

Use ``--stage history`` after ingesting history twice, then ``--stage full``
after ingesting the 2026 update.
"""

import argparse
import os
import sys
from pathlib import Path

import pandas as pd

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "baird.settings")

import django

django.setup()

from core.models import IngestRun, Job  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", choices=("history", "full"), required=True)
    args = parser.parse_args()

    print("=== IngestRun records (newest first) ===")
    for run in IngestRun.objects.all():
        print(f"  {run}")
        print(f"    quality_counts: {run.quality_counts}")

    total = Job.objects.count()
    print(f"\nTotal Job rows: {total}")
    print(f"Stored is_credit count: {Job.objects.filter(is_credit=True).count()}")

    history_path = REPO / "data" / "raw" / "history_2023_2025.xlsx"
    history = pd.read_excel(history_path, sheet_name="Master Plain (Anon)")
    history_credit_rows = int(history["Sell Price"].le(0).sum())

    if args.stage == "history":
        raw_excluding_null = int(history["Product Type"].nunique(dropna=True))
        raw_including_null = int(history["Product Type"].nunique(dropna=False))
        norm_excluding_null = (
            Job.objects.exclude(product_type_norm__isnull=True)
            .values("product_type_norm")
            .distinct()
            .count()
        )
        norm_including_null = Job.objects.values("product_type_norm").distinct().count()
        job = Job.objects.order_by("id").first()

        print(f"Source is_credit rows (history): {history_credit_rows}")
        print(
            "Raw Product Type distinct: "
            f"{raw_including_null} including null; "
            f"{raw_excluding_null} excluding null"
        )
        print(
            "Normalised Product Type distinct: "
            f"{norm_including_null} including null; "
            f"{norm_excluding_null} excluding null"
        )
        print(f"type(job.sales_in): {type(job.sales_in)!r}")
    else:
        update_path = REPO / "data" / "raw" / "update_2026.xlsx"
        update = pd.read_excel(update_path, sheet_name="Master Plain (Anon)")
        full_credit_rows = history_credit_rows + int(update["Sell Price"].le(0).sum())
        print(f"Source is_credit rows (full dataset): {full_credit_rows}")


if __name__ == "__main__":
    main()
