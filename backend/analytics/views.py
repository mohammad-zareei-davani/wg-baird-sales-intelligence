"""Django REST API for the sales intelligence platform."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from analytics.dormancy import compute_dormancy
from analytics.pricing_variance import compute_pricing_variance
from analytics.seasonality import compute_seasonality
from analytics.services import (
    cached_analytics,
    get_config,
    invalidate_cache,
    load_jobs_dataframe,
)
from analytics.value import customer_value_table
from core.ingest import ingest_workbook
from core.models import IngestRun, Job
from ml.predict import PredictValidationError, predict_expected_va

METRICS_PATH = Path(__file__).resolve().parents[1] / "ml" / "artifacts" / "metrics.json"


def _jobs():
    return load_jobs_dataframe()


@api_view(["GET"])
def health(_request):
    return Response({"status": "ok"})


@api_view(["GET"])
def summary(_request):
    def build():
        df = _jobs()
        config = get_config()
        valued = df.loc[(~df["is_credit"]) & df["is_closed"]]
        latest = IngestRun.objects.order_by("-id").first()
        sales_in = pd.to_datetime(df["sales_in"])
        return {
            "total_va_gbp": round(float(valued["va_amount_gbp"].sum()), 2),
            "total_revenue_gbp": round(float(valued["sell_price_gbp"].sum()), 2),
            "job_count": int(len(df)),
            "customer_count": int(df["customer_id"].nunique()),
            "date_range": {
                "min_sales_in": sales_in.min().date().isoformat() if sales_in.notna().any() else None,
                "max_sales_in": sales_in.max().date().isoformat() if sales_in.notna().any() else None,
            },
            "last_ingest": {
                "id": latest.id if latest else None,
                "created_at": latest.created_at.isoformat() if latest else None,
                "source_filename": latest.source_filename if latest else None,
                "rows_read": latest.rows_read if latest else None,
                "rows_inserted": latest.rows_inserted if latest else None,
                "rows_updated": latest.rows_updated if latest else None,
            },
            "data_quality": latest.quality_counts if latest else {},
            "exclusions": {
                "credits": int(df["is_credit"].sum()),
                "open_jobs": int((~df["is_closed"]).sum()),
            },
            "fx_eur_to_gbp": config["fx"]["eur_to_gbp"],
        }

    return Response(cached_analytics("summary", build))


@api_view(["GET"])
def customers(_request):
    def build():
        return customer_value_table(_jobs(), get_config())

    return Response(cached_analytics("customers", build))


@api_view(["GET"])
def customer_detail(_request, customer_id: str):
    df = _jobs()
    subset = df.loc[df["customer_id"] == customer_id]
    if subset.empty:
        return Response({"detail": f"Unknown CustomerID {customer_id}"}, status=404)

    value = customer_value_table(df, get_config())
    customer = next(
        (c for c in value["customers"] if c["customer_id"] == customer_id), None
    )
    dorm = compute_dormancy(df, get_config())
    gap = next((c for c in dorm["customers"] if c["customer_id"] == customer_id), None)

    valued = subset.loc[(~subset["is_credit"]) & subset["is_closed"]].copy()
    valued["sales_in"] = pd.to_datetime(valued["sales_in"])
    product_mix = (
        valued.groupby(["product_type_norm", "product_group"], dropna=False)
        .agg(
            job_count=("job_key", "count"),
            va_gbp=("va_amount_gbp", "sum"),
            revenue_gbp=("sell_price_gbp", "sum"),
        )
        .reset_index()
        .sort_values("va_gbp", ascending=False)
    )
    history = valued.sort_values("sales_in")[
        [
            "title",
            "sales_in",
            "product_type_norm",
            "product_group",
            "quantity",
            "sell_price_gbp",
            "va_amount_gbp",
            "va_pct",
            "work_type",
            "rep",
        ]
    ].copy()
    history["sales_in"] = history["sales_in"].dt.date.astype(str)

    return Response(
        {
            "customer_id": customer_id,
            "customer_name": customer["customer_name"] if customer else None,
            "summary": customer,
            "gap_statistics": gap,
            "product_mix": product_mix.to_dict(orient="records"),
            "order_history": history.to_dict(orient="records"),
        }
    )


@api_view(["GET"])
def at_risk(_request):
    def build():
        return compute_dormancy(_jobs(), get_config())

    return Response(cached_analytics("at_risk", build))


@api_view(["GET"])
def seasonality(_request):
    industry = _request.query_params.get("industry")
    product_type = _request.query_params.get("product_type")
    product_group = _request.query_params.get("product_group")
    cache_key = f"seasonality:{industry}:{product_type}:{product_group}"

    def build():
        return compute_seasonality(
            _jobs(),
            get_config(),
            industry=industry,
            product_type=product_type,
            product_group=product_group,
        )

    return Response(cached_analytics(cache_key, build))


@api_view(["GET"])
def pricing_variance(_request):
    def build():
        return compute_pricing_variance(_jobs(), get_config())

    return Response(cached_analytics("pricing_variance", build))


@api_view(["POST"])
def predict(request):
    body = request.data if hasattr(request, "data") else {}
    if not isinstance(body, dict):
        return Response({"detail": "JSON body required"}, status=400)
    mode = body.get("mode", "estimate")
    job_spec = {k: v for k, v in body.items() if k != "mode"}
    try:
        result = predict_expected_va(job_spec, mode=mode)
    except PredictValidationError as exc:
        return Response({"detail": str(exc)}, status=400)
    except FileNotFoundError:
        return Response({"detail": "Model artifacts not found. Train models first."}, status=503)
    return Response(result)


@api_view(["GET"])
def model_metrics(_request):
    if not METRICS_PATH.exists():
        return Response({"detail": "metrics.json not found"}, status=404)
    with open(METRICS_PATH, encoding="utf-8") as fh:
        return Response(json.load(fh))


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def ingest(request):
    upload = request.FILES.get("file")
    if upload is None:
        return Response({"detail": "Multipart field 'file' is required"}, status=400)

    import tempfile
    from pathlib import Path as P

    suffix = P(upload.name).suffix or ".xlsx"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        for chunk in upload.chunks():
            tmp.write(chunk)
        tmp_path = tmp.name

    # Preserve the client filename on the audit trail (temp path is opaque).
    display_name = P(upload.name).name
    try:
        run = ingest_workbook(tmp_path)
        run.source_filename = display_name
        run.save(update_fields=["source_filename"])
    finally:
        P(tmp_path).unlink(missing_ok=True)

    invalidate_cache()
    return Response(
        {
            "id": run.id,
            "created_at": run.created_at.isoformat(),
            "source_filename": run.source_filename,
            "rows_read": run.rows_read,
            "rows_inserted": run.rows_inserted,
            "rows_updated": run.rows_updated,
            "quality_counts": run.quality_counts,
            "job_count": Job.objects.count(),
        }
    )


@api_view(["GET"])
def options(_request):
    """Categorical domains for the job specification form.

    The predict form must offer the levels the models were trained on rather
    than free text, and product_type_norm carries its product_group so the
    two can never be submitted inconsistently.
    """

    def build():
        def distinct(field: str) -> list[str]:
            values = (
                Job.objects.exclude(**{f"{field}__isnull": True})
                .values_list(field, flat=True)
                .distinct()
                .order_by(field)
            )
            return [v for v in values if v not in (None, "")]

        product_types = (
            Job.objects.exclude(product_type_norm__isnull=True)
            .values("product_type_norm", "product_group")
            .distinct()
            .order_by("product_type_norm")
        )
        customers = (
            Job.objects.values("customer_id", "customer_name", "industry", "region")
            .distinct()
            .order_by("customer_id")
        )
        seen: set[str] = set()
        customer_rows = []
        for row in customers:
            if row["customer_id"] in seen:
                continue
            seen.add(row["customer_id"])
            customer_rows.append(row)

        return {
            "work_types": distinct("work_type"),
            "binding_types": distinct("binding_type_filled"),
            "currencies": distinct("currency"),
            "regions": distinct("region"),
            "industries": distinct("industry"),
            "product_groups": distinct("product_group"),
            "product_types": list(product_types),
            "customers": customer_rows,
            "default_job": _default_job_spec(),
        }

    return Response(cached_analytics("options", build))


def _default_job_spec() -> dict | None:
    """A real high-frequency Educational Books litho job for the Pricing form."""
    qs = (
        Job.objects.filter(
            is_credit=False,
            is_closed=True,
            work_type="Litho",
            product_type_norm__icontains="Educational",
            binding_type_filled__in=["Saddle", "Perfect"],
        )
        .exclude(plates__isnull=True)
        .exclude(quantity__isnull=True)
    )
    # Prefer top-five customers by revenue when available.
    from django.db.models import Sum

    top_ids = list(
        Job.objects.filter(is_credit=False, is_closed=True)
        .values("customer_id")
        .annotate(rev=Sum("sell_price_gbp"))
        .order_by("-rev")
        .values_list("customer_id", flat=True)[:5]
    )
    preferred = qs.filter(customer_id__in=top_ids).order_by("-quantity").first()
    row = preferred or qs.order_by("-quantity").first()
    if row is None:
        return None
    sales_in = row.sales_in
    iso = sales_in.isocalendar() if sales_in else None
    return {
        "customer_id": row.customer_id,
        "customer_name": row.customer_name,
        "industry": row.industry,
        "region": row.region,
        "work_type": row.work_type,
        "product_type_norm": row.product_type_norm,
        "product_group": row.product_group,
        "binding_type_filled": row.binding_type_filled,
        "currency": row.currency,
        "quantity": float(row.quantity) if row.quantity is not None else None,
        "plates": float(row.plates) if row.plates is not None else None,
        "impressions": float(row.impressions) if row.impressions is not None else None,
        "press_hrs": float(row.press_hrs) if row.press_hrs is not None else None,
        "booking_month": sales_in.month if sales_in else None,
        "booking_iso_week": int(iso[1]) if iso else None,
        "title": row.title,
    }


@api_view(["GET"])
def example_job(_request):
    """Return a random real closed non-credit job for the Pricing form."""
    import random

    qs = Job.objects.filter(is_credit=False, is_closed=True).exclude(
        quantity__isnull=True
    )
    count = qs.count()
    if count == 0:
        return Response({"detail": "No jobs available"}, status=404)
    offset = random.randint(0, count - 1)
    row = qs.order_by("id")[offset]
    sales_in = row.sales_in
    iso = sales_in.isocalendar() if sales_in else None
    return Response(
        {
            "customer_id": row.customer_id,
            "customer_name": row.customer_name,
            "industry": row.industry,
            "region": row.region,
            "work_type": row.work_type,
            "product_type_norm": row.product_type_norm,
            "product_group": row.product_group,
            "binding_type_filled": row.binding_type_filled or "OUTSOURCED",
            "currency": row.currency,
            "quantity": float(row.quantity) if row.quantity is not None else 0,
            "plates": float(row.plates) if row.plates is not None else 0,
            "impressions": float(row.impressions) if row.impressions is not None else 0,
            "press_hrs": float(row.press_hrs) if row.press_hrs is not None else 0,
            "booking_month": sales_in.month if sales_in else 1,
            "booking_iso_week": int(iso[1]) if iso else 1,
            "title": row.title,
        }
    )


@api_view(["GET"])
def customer_map(_request):
    pairs = (
        Job.objects.values("customer_id", "customer_name")
        .distinct()
        .order_by("customer_id")
    )
    return Response(
        {
            "pairs": list(pairs),
            "count": pairs.count(),
            "note": (
                "CustomerID is the entity key. Customer Name is a separate "
                "anonymised display label; the numeric suffixes do not correspond."
            ),
        }
    )
