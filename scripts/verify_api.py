"""Retrain models, reset the database to history-only, and exercise the API."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
BACKEND = REPO / "backend"
PY = REPO / ".venv" / "Scripts" / "python.exe"
BASE = "http://127.0.0.1:8000"


def run(args, cwd=REPO):
    print("$", " ".join(str(a) for a in args), flush=True)
    subprocess.check_call([str(PY), *args], cwd=str(cwd))


def http_json(method: str, path: str, body=None, files=None):
    url = BASE + path
    if files:
        # multipart via curl for reliability with file upload
        cmd = [
            "curl",
            "-s",
            "-w",
            "\n__STATUS__%{http_code}",
            "-X",
            method,
            url,
            "-F",
            f"file=@{files}",
        ]
        out = subprocess.check_output(cmd, text=True, encoding="utf-8")
        body_text, _, status = out.rpartition("\n__STATUS__")
        return int(status), json.loads(body_text) if body_text.strip() else {}

    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            payload = resp.read().decode("utf-8")
            return resp.status, json.loads(payload) if payload else {}
    except urllib.error.HTTPError as exc:
        payload = exc.read().decode("utf-8")
        try:
            parsed = json.loads(payload) if payload else {}
        except json.JSONDecodeError:
            parsed = {"raw": payload}
        return exc.code, parsed


def reset_to_history():
    code = r"""
import os, sys
from pathlib import Path
REPO = Path(r"%s")
sys.path.insert(0, str(REPO / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "baird.settings")
import django; django.setup()
from django.core.management import call_command
from core.models import Job, IngestRun
from core.config import reload_config
from core.ingest import ingest_workbook
from analytics.services import invalidate_cache
Job.objects.all().delete()
IngestRun.objects.all().delete()
reload_config()
run = ingest_workbook(REPO / "data" / "raw" / "history_2023_2025.xlsx")
invalidate_cache()
print("history_only", Job.objects.count(), run)
""" % REPO.as_posix()
    subprocess.check_call([str(PY), "-c", code])


def main():
    os.chdir(REPO)
    run(["-m", "pytest", "tests", "-q"], cwd=BACKEND)
    run([str(BACKEND / "ml" / "train.py")], cwd=BACKEND)

    metrics = json.loads((BACKEND / "ml" / "artifacts" / "metrics.json").read_text(encoding="utf-8"))
    print("\n=== Retrained metrics (three models) ===")
    print(json.dumps(metrics, indent=2))

    reset_to_history()

    # Start server
    server = subprocess.Popen(
        [str(PY), "manage.py", "runserver", "127.0.0.1:8000", "--noreload"],
        cwd=str(BACKEND),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    try:
        for _ in range(40):
            try:
                status, _ = http_json("GET", "/api/health/")
                if status == 200:
                    break
            except Exception:
                time.sleep(0.5)
        else:
            raise RuntimeError("Server failed to start")

        endpoints = [
            ("GET", "/api/health/"),
            ("GET", "/api/summary/"),
            ("GET", "/api/customers/"),
            ("GET", "/api/customers/CID_012/"),
            ("GET", "/api/at-risk/"),
            ("GET", "/api/seasonality/"),
            ("GET", "/api/pricing-variance/"),
            ("GET", "/api/model-metrics/"),
            ("GET", "/api/customer-map/"),
        ]
        print("\n=== Endpoint smoke ===")
        for method, path in endpoints:
            status, payload = http_json(method, path)
            keys = list(payload.keys()) if isinstance(payload, dict) else type(payload).__name__
            print(f"  {status} {method} {path} -> {keys}")

        status, before = http_json("GET", "/api/summary/")
        print(f"\nSummary before ingest: jobs={before.get('job_count')}")

        enquiry = {
            "mode": "enquiry",
            "quantity": 5000,
            "plates": 8,
            "product_type_norm": "Magazines",
            "product_group": "Magazines",
            "customer_id": "CID_012",
            "region": "NI",
            "industry": "Education",
            "work_type": "Litho",
            "binding_type_filled": "Stitched",
            "currency": "Stg",
            "booking_month": 3,
            "booking_iso_week": 10,
        }
        status, pred = http_json("POST", "/api/predict/", enquiry)
        print(f"\nPredict enquiry: {status}")
        print(json.dumps(pred, indent=2)[:800])

        estimate = {
            **enquiry,
            "mode": "estimate",
            "impressions": 12000,
            "press_hrs": 2.5,
        }
        status, pred2 = http_json("POST", "/api/predict/", estimate)
        print(f"\nPredict estimate: {status}")
        print(json.dumps(pred2, indent=2)[:800])

        bad = {**enquiry, "impressions": 12000}
        status, err = http_json("POST", "/api/predict/", bad)
        print(f"\nPredict enquiry WITH impressions (expect 400): {status}")
        print(err)

        update = REPO / "data" / "raw" / "update_2026.xlsx"
        status, ingest_resp = http_json("POST", "/api/ingest/", files=str(update))
        print(f"\nIngest update: {status}")
        print(json.dumps(ingest_resp, indent=2)[:1000])

        status, after = http_json("GET", "/api/summary/")
        print(f"\nSummary after ingest (no restart): jobs={after.get('job_count')}")
        print("data_quality keys:", list((after.get("data_quality") or {}).keys()))
        assert after.get("job_count") == 6354, after.get("job_count")
        print("API_VERIFICATION_OK")
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()


if __name__ == "__main__":
    main()
