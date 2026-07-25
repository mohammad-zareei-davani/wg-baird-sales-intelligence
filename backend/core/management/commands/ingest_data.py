"""Ingest a workbook: python manage.py ingest_data --file data/raw/history_2023_2025.xlsx"""

from django.core.management.base import BaseCommand, CommandError

from analytics.services import invalidate_cache
from core.ingest import ingest_workbook


class Command(BaseCommand):
    help = "Ingest a job workbook (upsert keyed on job_key) and record an IngestRun."

    def add_arguments(self, parser):
        parser.add_argument("--file", required=True, help="Path to the .xlsx workbook")

    def handle(self, *args, **options):
        try:
            run = ingest_workbook(options["file"])
        except FileNotFoundError as exc:
            raise CommandError(str(exc)) from exc
        invalidate_cache()
        self.stdout.write(self.style.SUCCESS(str(run)))
        self.stdout.write(f"quality_counts: {run.quality_counts}")
