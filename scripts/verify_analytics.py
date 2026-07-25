"""Verify analytics outputs on the full loaded dataset."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pandas as pd

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "baird.settings")

import django

django.setup()

from django.db import connection  # noqa: E402

from analytics.dormancy import compute_dormancy  # noqa: E402
from analytics.pricing_variance import compute_pricing_variance  # noqa: E402
from analytics.seasonality import compute_seasonality  # noqa: E402
from analytics.value import customer_value_table  # noqa: E402
from core.config import reload_config  # noqa: E402
from core.models import Job  # noqa: E402


def load_jobs() -> pd.DataFrame:
    return pd.read_sql_query("SELECT * FROM core_job", connection)


def main() -> None:
    config = reload_config()
    df = load_jobs()
    print(f"Loaded jobs: {len(df)} (expect 6354)")
    print(f"Distinct product_group: {df['product_group'].nunique()}")
    print(df["product_group"].value_counts().to_string())
    print()

    value = customer_value_table(df, config)
    customers = value["customers"]
    print("=== 1. Top 5 by total VA (GBP) ===")
    for c in customers[:5]:
        print(
            f"  {c['customer_id']} / {c['customer_name']}: "
            f"VA £{c['total_va_gbp']:,.0f}  rev £{c['total_revenue_gbp']:,.0f}  "
            f"jobs={c['job_count']}"
        )

    rev_curve = value["concentration"]["revenue"]
    top3 = next(r for r in rev_curve if r["rank"] == 3)["cumulative_share"]
    top12 = next(r for r in rev_curve if r["rank"] == 12)["cumulative_share"]
    print(f"\n=== 2. Cumulative revenue share ===")
    print(f"  top 3:  {top3:.1%}  (expect ~27%)")
    print(f"  top 12: {top12:.1%}  (expect ~50%)")

    print("\n=== 3. Volume vs value outliers ===")
    # Comparable revenue, divergent job count: surface the classic pair and
    # also the auto-detected extremes so both identifiers are unambiguous.
    named = {c["customer_name"]: c for c in value["volume_vs_value"]}
    for label in ["CUST_007", "CUST_018"]:
        c = named.get(label)
        if c:
            print(
                f"  expected-label {label}: {c['customer_id']} / {c['customer_name']}  "
                f"jobs={c['job_count']}  rev £{c['total_revenue_gbp']:,.0f}  "
                f"VA £{c['total_va_gbp']:,.0f}"
            )
    # Algorithmic pair: among customers with revenue within 10% of each other,
    # maximise job-count ratio.
    vv = value["volume_vs_value"]
    best = None
    for a in vv:
        for b in vv:
            if a["customer_id"] >= b["customer_id"]:
                continue
            if min(a["job_count"], b["job_count"]) == 0:
                continue
            rev_ratio = max(a["total_revenue_gbp"], b["total_revenue_gbp"]) / max(
                1.0, min(a["total_revenue_gbp"], b["total_revenue_gbp"])
            )
            if rev_ratio > 1.1:
                continue
            job_ratio = max(a["job_count"], b["job_count"]) / min(a["job_count"], b["job_count"])
            if best is None or job_ratio > best[0]:
                high, low = (a, b) if a["job_count"] > b["job_count"] else (b, a)
                best = (job_ratio, high, low)
    if best:
        _, high, low = best
        for label, c in [("high-volume", high), ("low-volume peer", low)]:
            print(
                f"  {label}: {c['customer_id']} / {c['customer_name']}  "
                f"jobs={c['job_count']}  rev £{c['total_revenue_gbp']:,.0f}  "
                f"VA £{c['total_va_gbp']:,.0f}"
            )

    dorm = compute_dormancy(df, config)
    print(f"\n=== 4. At-risk (sorted by lifetime VA) ===")
    print(f"  as_of={dorm['as_of']}  at_risk_count={len(dorm['at_risk'])}")
    for c in dorm["at_risk"][:15]:
        print(
            f"  {c['customer_id']} / {c['customer_name']}: last={c['last_order']}  "
            f"days_since={c['days_since_last_order']}  thr={c['threshold_days']}  "
            f"VA £{c['lifetime_va_gbp']:,.0f}  regular={c['cadence_regular']}"
        )

    print(
        f"\n=== 5. cadence_regular among gap_count>=8: "
        f"{dorm['cadence_regular_gap8_count']} of {dorm['eligible_gap8_count']} "
        f"(expect 13 of 48)"
    )
    print(
        f"=== 6. order events={dorm['order_event_count']}  gaps={dorm['gap_count']} "
        f"(expect ~3824 / ~3774)"
    )
    print(
        f"     median_gap={dorm['median_gap_days']}  median_cv={dorm['median_cv']}"
    )

    season = compute_seasonality(df, config)
    print("\n=== 7. Monthly VA series (totals by calendar month across years) ===")
    monthly = pd.DataFrame(season["monthly"])
    by_month = monthly.groupby("month")["va_gbp"].sum()
    for m, v in by_month.items():
        print(f"  month {int(m):02d}: £{v:,.0f}")

    leak = compute_pricing_variance(df, config)
    print("\n=== 8. Pricing variance by rep (net % of own revenue) ===")
    for r in leak["by_rep"][:5]:
        print(
            f"  {r['key']}: net_pct={r['net_pct_of_revenue']:+.1%}  "
            f"net £{r['net_override_gbp']:,.0f}  "
            f"neg £{r['negative_override_gbp']:,.0f}  pos £{r['positive_override_gbp']:,.0f}"
        )
    print("  limitation:", leak["limitation"][:120], "...")

    print("\n=== Exclusions (value analysis) ===")
    print(value["exclusions"])
    print(f"\nJob count in DB: {Job.objects.count()}")


if __name__ == "__main__":
    main()
