"""Loader for config/config.yaml at the repository root.

No analytical constant lives in code; everything comes from this file.
"""

from functools import lru_cache
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = REPO_ROOT / "config" / "config.yaml"


@lru_cache(maxsize=1)
def load_config() -> dict:
    with open(CONFIG_PATH, encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def reload_config() -> dict:
    """Bypass the cache after config.yaml changes (tests / management)."""
    load_config.cache_clear()
    return load_config()
