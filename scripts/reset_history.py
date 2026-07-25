"""Reset the database to history only, so the 2026 upload is a live demo."""

from __future__ import annotations

import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "baird.settings")

import django  # noqa: E402

django.setup()

from analytics.services import invalidate_cache  # noqa: E402
from core.config import reload_config  # noqa: E402
from core.ingest import ingest_workbook  # noqa: E402
from core.models import IngestRun, Job  # noqa: E402


def main() -> None:
    Job.objects.all().delete()
    IngestRun.objects.all().delete()
    reload_config()
    run = ingest_workbook(REPO / "data" / "raw" / "history_2023_2025.xlsx")
    invalidate_cache()
    print(
        f"history only: jobs={Job.objects.count()} "
        f"read={run.rows_read} inserted={run.rows_inserted} updated={run.rows_updated}"
    )


if __name__ == "__main__":
    main()
