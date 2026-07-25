# W&G Baird Sales Intelligence Platform

A sales analytics and prediction platform for a commercial printer, built as a technical assessment for the KTP Associate role at Queen's University Belfast in partnership with W&G Baird.

The platform ingests anonymised job history from Excel (≈6,350 jobs, 50 customers, January 2023 – May 2026) and turns it into board-level answers: where value concentrates, which accounts are drifting away, when demand peaks, what manual price overrides really cost, and what a new job should be worth before and after estimating.

---

## 1. What the platform does

| Question | Answer provided |
|---|---|
| Where does value sit? | Customer value ranking, concentration curves, and a volume-vs-value view that separates high-touch accounts from high-ticket ones. |
| Who is drifting? | Dormancy detection calibrated to each customer's own ordering rhythm, ranked into two action tiers (Recovery and Monitor). |
| When does demand peak? | Monthly value-added seasonality with like-for-like year-on-year comparison that handles the partial 2026 year correctly. |
| What do overrides cost? | Pricing variance per rep, work type, product group, and customer — netting discounts against mark-ups instead of counting discounts alone. |
| What is a new job worth? | Two-stage machine-learning prediction: an enquiry-time estimate from basic job details, refined once estimating data (impressions, press hours, plates) exists. |

Every cleaning rule and analytical assumption is externalised to `config/config.yaml` and documented below — nothing is hardcoded or hidden.

---

## 2. How it works

### Data flow

```
┌─────────────────┐     POST /api/ingest/      ┌──────────────────────────┐
│  Excel workbook │ ─────────────────────────► │ Django + DRF (port 8000) │
│  (.xlsx)        │                            │  clean → upsert Job      │
└─────────────────┘                            │  analytics modules       │
                                               │  gradient-boosted models │
                                               └────────────┬─────────────┘
                                                            │ /api/*
                                               ┌────────────▼─────────────┐
                                               │ React + Vite (port 5173) │
                                               │  Overview · At Risk      │
                                               │  Customers · Pricing     │
                                               └──────────────────────────┘
```

1. **Ingest.** A workbook is uploaded through the UI (or the `ingest_data` management command). Each row is cleaned, then inserted or updated against a stable identity key: `job_key`, the SHA-256 of all 36 raw cell values. Re-ingesting the same file changes nothing; only byte-identical duplicates collapse. Every run is audited in an `IngestRun` record (rows read / inserted / updated, quality counts).
2. **Clean.** Product-type typos are merged (five deliberate groups only), Euro amounts convert to GBP, credits and open jobs are flagged rather than deleted, null binding type is encoded as `OUTSOURCED` (its true meaning), and date anomalies are flagged and retained.
3. **Analyse.** Four analytics modules (value, dormancy, seasonality, pricing variance) compute from the job table on demand, behind an in-memory cache that invalidates whenever a new ingest lands.
4. **Predict.** Three gradient-boosted models are trained on a strict time split. The API serves predictions with uncertainty bands; SHAP values explain each prediction's drivers.
5. **Present.** A React frontend renders four pages — Overview, At Risk, Customers, Pricing — with the upload flow in the header.

### Components

| Path | Role |
|---|---|
| `config/config.yaml` | FX rate, product merges, product groups, banned model features, dormancy thresholds, train cutoff |
| `backend/core/` | Django models, cleaning pipeline, ingest upsert, management commands |
| `backend/analytics/` | Value, dormancy, seasonality, pricing variance; REST views; response cache |
| `backend/ml/` | Feature matrix, training, prediction, SHAP explanations |
| `frontend/` | Vite + React 18 + TypeScript (strict) + Recharts |
| `scripts/` | Data split and verification scripts (see §8) |

---

## 3. Setup and run

**Prerequisites:** Python 3.11+, Node.js 20+, npm.

### Backend

```bash
cd wg-baird-sales-intelligence
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
# source .venv/bin/activate

pip install -r backend/requirements.txt
cd backend
python manage.py migrate
python manage.py ingest_data ../data/raw/history_2023_2025.xlsx
python manage.py ingest_data ../data/raw/update_2026.xlsx
python -m ml.train
python manage.py runserver 127.0.0.1:8000
```

### Frontend (second terminal)

```bash
cd wg-baird-sales-intelligence/frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173/ — Vite proxies `/api` to Django.

### Tests and typecheck

```bash
# Backend tests (from repo root, venv active)
cd backend && pytest -q

# Frontend typecheck
cd frontend && npx tsc --noEmit
```

---

## 4. Data contract and cleaning

**Input:** first worksheet of the workbook, 36 raw columns (order flexible, names must match the source schema), including `Title`, `CustomerID`, `Customer Name`, `Product Type`, `Sell Price`, `VA Amount`, `VA%`, `SalesIn`, `SalesOut`, `Currency`, `Work Type`, `Binding Type`, `Quantity`, `Impressions`, `Plates`, `Press hrs`, `manadj`, `Rep`, `Industry`, and `Region`.

**Identity:** `job_key = SHA-256` of all 36 raw values, computed before any cleaning so the key is stable if configuration changes. **Entity key:** `CustomerID`; `Customer Name` is an independent anonymised display label, so both are shown in every customer-level output.

**Cleaning rules** (`backend/core/clean.py`, driven by config):

| Rule | Treatment |
|---|---|
| Product Type typos / spacing | Five merge groups only: brochures/price list, leaflets to A4/price lists, educational books, certificates, miscellaneous-ask advice. Genuine distinctions (Signage vs Signage (large), Menu variants, Banners variants) are preserved. |
| Product group | Coarse 10-group rollup used for charts and as a model feature; the detailed `product_type_norm` stays intact. |
| Binding Type null | Encoded `OUTSOURCED` — null means finishing was outsourced, not missing data. |
| Currency | Euro → GBP at `fx.eur_to_gbp` (0.85); original values retained. |
| Non-positive sell price | Flagged `is_credit`; excluded from value totals, never deleted. |
| Open jobs | Flagged `is_closed`; historical value uses closed jobs only. |
| Date anomalies | Flagged `has_date_anomaly`; retained. |
| Byte-identical rows | Collapsed by `job_key` (one duplicated credit note for CID_048, 2024-07-23). |
| VA% aggregation | Median after excluding values outside ±100%; extreme negatives are credit/rework adjustments, not real margins. |
| Partial year | Year-on-year comparisons truncate every year to a shared day-of-year cap. |

Development split of the source workbook: `data/raw/history_2023_2025.xlsx` (through December 2025) and `data/raw/update_2026.xlsx` (January–May 2026), so the 2026 upload can be demonstrated live.

---

## 5. Analytics methodology

### Customer value (`analytics/value.py`)

Closed, non-credit jobs aggregated on `CustomerID`. Concentration on the full book: the top 3 accounts hold ≈28% of value added, the top 12 ≈51%. A volume-vs-value scatter separates high-touch accounts (many small jobs) from high-ticket ones. A cost-to-serve index (VA per job ÷ portfolio median, minimum 8 jobs) flags accounts that consume disproportionate effort.

### Dormancy — action tiers (`analytics/dormancy.py`)

Fixed dormancy windows fail here: fortnightly magazine accounts and annual prospectus accounts cannot share one clock. Instead, each customer is measured in **cycles missed** — days since their last order divided by their own median order gap — with absolute day floors to suppress noise:

- **RECOVERY** (act now): more than 6 cycles missed *and* more than 90 days silent. Sorted by annualised run-rate value at stake.
- **MONITOR** (review monthly): 3–6 cycles missed *and* more than 30 days silent. Sorted by lifetime value.
- Everything else is normal and not displayed.

The as-of date is always the latest booking in the database. Measurement date matters: on identical history, December (a seasonal trough) flags more than twice as many accounts as September, which is why the thresholds carry day floors. Worked example: customer CID_045 measured 3.4 cycles missed in December 2025 (normal) and 22.0 by May 2026 (Recovery) — the metric surfaces drift before it is obvious.

No next-order-date forecast is offered: order-gap variability is too high for a defensible point estimate (median coefficient of variation ≈ 1.4).

### Seasonality (`analytics/seasonality.py`)

Monthly value-added series shows December troughs and peaks in February–March and August–October. Year-on-year comparison is like-for-like: every year is truncated to the same day-of-year as the incomplete final year. Charts aggregate on the 10 product groups, never the 59 detailed product types.

### Pricing variance (`analytics/pricing_variance.py`)

Manual overrides (`manadj`) analysed per rep, work type, product group, and customer: discount total, mark-up total, net effect, and net as a percentage of that segment's own revenue (the primary ranking). Netting matters — the rep with the largest absolute discounts is strongly net positive once mark-ups are included, and only a small number of reps are genuinely net negative.

**Stated limitation (also shown in the UI):** the dataset contains no quotes or win/loss records, so no discount can be labelled unjustified.

---

## 6. Machine learning

Strict time-based split at `model.train_cutoff` (2025-12-31): 5,337 training and 669 test rows (closed, non-credit). Cost and margin columns are banned as features via config and asserted absent at train time. All models are scikit-learn `HistGradientBoostingRegressor`; unseen categories at prediction time route through the missing-value bin rather than raising.

| Model | Target | When usable | R² | MAE | Baseline MAE |
|---|---|---|---|---|---|
| A-Enquiry | VA amount (GBP) | First contact — no estimating data | ≈0.86 | ≈£468 | ≈£1,285 |
| A-Estimate | VA amount (GBP) | After estimating | ≈0.925 | ≈£368 | ≈£1,285 |
| B | VA % | Diagnostic only | ≈0.15 | ≈0.135 | ≈0.164 |

Model B's weak score is itself a finding: job specification, customer, and season explain little of achieved margin, because margin is set by human pricing decisions this dataset does not record. That is the evidence base for capturing quote data (§9).

The two Model A modes agree closely on the test window (correlation 0.951, median absolute difference £146). The UI presents predictions as bands (prediction ± MAE): an indicative band at enquiry, a tighter band at estimate, and the Pricing page runs one job specification through both modes side by side with SHAP driver explanations.

---

## 7. API reference

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health/` | Liveness |
| GET | `/api/summary/` | KPIs and data quality |
| GET | `/api/customers/` | Value table, concentration, scatter |
| GET | `/api/customers/<CustomerID>/` | Account detail |
| GET | `/api/at-risk/` | Recovery / Monitor tiers |
| GET | `/api/seasonality/` | Monthly VA and year-on-year |
| GET | `/api/pricing-variance/` | Override analysis |
| POST | `/api/predict/` | `{ mode: enquiry\|estimate, ... }` |
| GET | `/api/model-metrics/` | Metrics for all three models |
| POST | `/api/ingest/` | Multipart workbook upload |
| GET | `/api/options/` | Form domains and default job |
| GET | `/api/example-job/` | Random real job to prefill the form |
| GET | `/api/customer-map/` | CustomerID → Customer Name pairs |

---

## 8. Verification scripts

Standalone scripts in `scripts/` reproduce each stage of the build for review:

| Script | Verifies |
|---|---|
| `split_source_data.py` | Splits the source workbook into history and 2026 update files |
| `verify_ingest.py` | Ingest counts, idempotency, normalisation effect, credit handling |
| `verify_analytics.py` | All four analytics modules on the full dataset |
| `verify_models.py` | Pricing variance ranking and model training metrics |
| `verify_api.py` | End-to-end API: retrain, reset to history, live 2026 upload, endpoint checks |
| `verify_fresh_environment.py` | README setup reproduced in a brand-new virtualenv, plus the test suite |
| `ingest_full_dataset.py` | Resets and loads history + 2026 update |
| `reset_history.py` | Resets to history only, for a live upload demonstration |

---

## 9. Assumptions and limitations

**Assumptions** (all configurable in `config/config.yaml` where applicable):

- EUR→GBP fixed at 0.85; not a daily rate series.
- Credits and open jobs are excluded from value totals.
- Train cutoff 2025-12-31; as-of date is the latest booking in the database.
- Cost-to-serve requires at least 8 jobs; digital jobs carry zero plates.

**Limitations:**

- **No quote or lost-bid records** — pricing variance cannot measure win rate against discount level. Capturing quote data is the primary recommended next investment.
- **50-customer anonymised sample** — concentration and dormancy rates may not generalise to the full customer book.
- **Partial 2026 year** — raw annual totals would understate 2026; all year-on-year views are truncated like-for-like instead.
- **Anonymised identifiers** — `CustomerID` and `Customer Name` are independent schemes; numeric suffixes do not correspond.
- **Model B cannot be tuned into usefulness** with this feature set; improving it without quote data would be misleading.

---

## 10. Recommended next steps

1. Capture quote and win/loss data and link it to jobs — unlocks justified-discount analysis and a real margin model.
2. Move from SQLite to a production database and schedule incremental ingest.
3. Add rep-level workflow: assign Recovery accounts, log outreach, track reactivation.
4. Recalibrate dormancy floors quarterly against seasonal troughs.
5. Expand beyond the 50-customer sample for board reporting.
