"""Shared data access and in-memory analytics cache.

Cache keys on the latest IngestRun id so a successful upload invalidates
previous responses without a process restart.
"""

from __future__ import annotations

from functools import wraps
from typing import Any, Callable

import pandas as pd
from django.db import connection

from core.config import load_config
from core.models import IngestRun


_CACHE: dict[str, Any] = {"ingest_id": None, "payloads": {}}


def latest_ingest_id() -> int | None:
    run = IngestRun.objects.order_by("-id").first()
    return run.id if run else None


def load_jobs_dataframe() -> pd.DataFrame:
    return pd.read_sql_query("SELECT * FROM core_job", connection)


def invalidate_cache() -> None:
    _CACHE["ingest_id"] = None
    _CACHE["payloads"] = {}


def cached_analytics(name: str, builder: Callable[[], Any]) -> Any:
    ingest_id = latest_ingest_id()
    if _CACHE["ingest_id"] != ingest_id:
        _CACHE["ingest_id"] = ingest_id
        _CACHE["payloads"] = {}
    if name not in _CACHE["payloads"]:
        _CACHE["payloads"][name] = builder()
    return _CACHE["payloads"][name]


def get_config() -> dict:
    return load_config()
