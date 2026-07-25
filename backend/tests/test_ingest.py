"""Database tests for full-row identity and idempotent ingestion."""

import pytest

from core.ingest import ingest_workbook
from core.models import Job
from tests.test_clean import make_frame


def write_workbook(path, frame):
    frame.to_excel(path, index=False, sheet_name="Master Plain (Anon)")


@pytest.mark.django_db
def test_byte_identical_rows_produce_one_record(tmp_path):
    frame = make_frame(n=2)
    frame.loc[1] = frame.loc[0]
    path = tmp_path / "identical.xlsx"
    write_workbook(path, frame)

    run = ingest_workbook(path)

    assert run.rows_read == 2
    assert run.rows_inserted == 1
    assert run.quality_counts["duplicates_collapsed"] == 1
    assert Job.objects.count() == 1


@pytest.mark.django_db
def test_rows_differing_only_in_impressions_both_persist(tmp_path):
    frame = make_frame(n=2)
    frame.loc[1] = frame.loc[0]
    frame.loc[1, "Impressions"] = frame.loc[0, "Impressions"] + 1
    path = tmp_path / "different-impressions.xlsx"
    write_workbook(path, frame)

    run = ingest_workbook(path)

    assert run.rows_inserted == 2
    assert run.quality_counts["duplicates_collapsed"] == 0
    assert Job.objects.count() == 2
    assert Job.objects.values("job_key").distinct().count() == 2


@pytest.mark.django_db
def test_reingesting_loaded_file_inserts_zero(tmp_path):
    frame = make_frame(n=2)
    path = tmp_path / "repeat.xlsx"
    write_workbook(path, frame)

    first = ingest_workbook(path)
    second = ingest_workbook(path)

    assert first.rows_inserted == 2
    assert second.rows_inserted == 0
    assert second.rows_updated == 2
    assert Job.objects.count() == 2
