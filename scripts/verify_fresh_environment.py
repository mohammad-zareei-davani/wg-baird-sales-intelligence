"""Reproduce README backend setup in a brand-new virtualenv and run tests."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import venv
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
FRESH_VENV = REPO / ".fresh_venv"


def run(cmd: list[str], cwd: Path | None = None) -> None:
    print("$", " ".join(cmd), flush=True)
    subprocess.check_call(cmd, cwd=str(cwd or REPO))


def main() -> None:
    if FRESH_VENV.exists():
        shutil.rmtree(FRESH_VENV)
    print("Creating fresh venv at", FRESH_VENV, flush=True)
    venv.create(FRESH_VENV, with_pip=True)

    if sys.platform == "win32":
        py = str(FRESH_VENV / "Scripts" / "python.exe")
        pip = str(FRESH_VENV / "Scripts" / "pip.exe")
    else:
        py = str(FRESH_VENV / "bin" / "python")
        pip = str(FRESH_VENV / "bin" / "pip")

    run([py, "-m", "pip", "install", "--upgrade", "pip"])
    run([py, "-m", "pip", "install", "-r", str(REPO / "backend" / "requirements.txt")])

    backend = REPO / "backend"
    env = os.environ.copy()
    env["DJANGO_SETTINGS_MODULE"] = "baird.settings"

    run([py, "manage.py", "migrate", "--run-syncdb"], cwd=backend)
    run([py, "-m", "pytest", "tests", "-q", "--tb=short"], cwd=backend)

    # Confirm RECOVERY / MONITOR counts on the live DB.
    code = r"""
import os, sys
from pathlib import Path
REPO = Path(r"%s")
sys.path.insert(0, str(REPO / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "baird.settings")
import django; django.setup()
from analytics.services import load_jobs_dataframe, get_config, invalidate_cache
from analytics.dormancy import compute_dormancy
invalidate_cache()
r = compute_dormancy(load_jobs_dataframe(), get_config())
print("TIERS", r["as_of"], r["recovery_count"], r["monitor_count"], r["annualised_exposure_gbp"])
print("RECOVERY", [c["customer_id"] for c in r["recovery"]])
print("MONITOR", [c["customer_id"] for c in r["monitor"]])
assert r["recovery_count"] == 5, r["recovery_count"]
assert 12 <= r["monitor_count"] <= 16, r["monitor_count"]
print("FRESH_ENVIRONMENT_OK")
""" % REPO.as_posix()
    run([py, "-c", code])
    print("Fresh venv verification complete.", flush=True)


if __name__ == "__main__":
    main()
