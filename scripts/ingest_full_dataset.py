"""Clear the database and ingest history plus the 2026 update (full book)."""

from __future__ import annotations

import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "baird.settings")

import django

django.setup()

from analytics.dormancy import compute_dormancy
from analytics.services import get_config, invalidate_cache
from core.config import reload_config
from core.ingest import ingest_workbook
from core.models import IngestRun, Job


def main() -> None:
    Job.objects.all().delete()
    IngestRun.objects.all().delete()
    reload_config()
    ingest_workbook(REPO / "data" / "raw" / "history_2023_2025.xlsx")
    ingest_workbook(REPO / "data" / "raw" / "update_2026.xlsx")
    invalidate_cache()
    result = compute_dormancy(
        __import__("analytics.services", fromlist=["load_jobs_dataframe"]).load_jobs_dataframe(),
        get_config(),
    )
    print(
        f"jobs={Job.objects.count()} as_of={result['as_of']} "
        f"dormant={result['dormant_count']} watch={result['watch_count']} "
        f"exposure={result['annualised_exposure_gbp']}"
    )
    for c in result["dormant"]:
        print(
            f"  DORMANT {c['customer_id']} cycles={c['cycles_missed']} "
            f"days={c['days_since_last_order']} annualised={c['annualised_va_gbp']}"
        )
    for c in result["watch"][:8]:
        print(
            f"  WATCH {c['customer_id']} cycles={c['cycles_missed']} "
            f"days={c['days_since_last_order']}"
        )


if __name__ == "__main__":
    main()
