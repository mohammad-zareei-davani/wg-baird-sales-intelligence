# W&G Baird Sales Intelligence

Commercial analytics over W&G Baird job-level sales data. The platform turns a
print-job Excel extract into board-ready briefings: what the number is, what it
means, and what to do about it, with charts as supporting evidence rather than the
argument.

| Layer | Stack |
| --- | --- |
| Backend | FastAPI, pandas, scikit-learn, SQLite |
| Frontend | React, TypeScript, Tailwind CSS, Recharts |
| Data | Excel interchange → SQLite store of record |

---

## Features

| Page | Question answered |
| --- | --- |
| **Executive Briefing** | What the data is telling you, ranked by what is at stake |
| **Customer Value** | Where value added actually comes from |
| **Recurring Revenue** | Reprint / repeat work already won |
| **Reorder Forecasting** | Who is due to order next |
| **Account Retention** | Customers who have gone quiet relative to their own cadence |
| **Pricing Integrity** | Margin decided at the point of quoting |
| **Demand & Capacity** | Shape of the trading year |
| **Production Turnaround** | How long work takes to leave the building |
| **Quote Intelligence** | What comparable work actually sells for (ML) |
| **Retention Risk** | Who is unlikely to order again soon (ML) |

### Page anatomy

Every insight page follows the same structure so readers learn the format once:

1. Three headline metrics  
2. One key finding (hero figure + short commercial read)  
3. Breakdown table with plain-English row descriptions  
4. Numbered actions tagged by cost (free / low cost / value at stake)  
5. Supporting charts and detail tables underneath  

The UI uses a single light theme, designed for screen reading and boardroom
projection.

---

## Getting started

Run the API and the UI in **two terminals**. The frontend proxies `/api/*` to
port `8000`.

**Prerequisites:** Python 3.11+, Node.js 18+.

### Backend

```bash
cd backend
python -m venv .venv
```

Windows (PowerShell):

```bash
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

macOS / Linux:

```bash
./.venv/bin/pip install -r requirements.txt
./.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

API: `http://localhost:8000`  
On first start, if `data/app.db` is empty, the sample workbook at
`data/raw/sample_data.xlsx` is loaded. Models train on first request; the
initial dashboard load may take up to a minute.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`). Keep the backend
running while using the dashboard.

---

## Architecture

End-to-end flow from Excel input to the dashboard. Each stage lists the
techniques, models, or outputs involved.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  INPUT                                                                      │
│  Excel job export  ·  sheet "Master Plain (Anon)"                           │
│  • First boot: data/raw/sample_data.xlsx                                    │
│  • Later: sidebar upload or POST /api/data/upload                           │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. INGEST & CLEAN                              data_loader.load_dataframe  │
│  • Read .xlsx (openpyxl)                                                    │
│  • Rename columns to a stable schema (COLUMN_MAP)                           │
│  • Coerce numeric and date fields                                           │
│  • Strip whitespace on IDs / names                                          │
│  • Drop rows missing sales_in or customer_id                                │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. PERSIST (SQLite)                                    data/app.db · db.py │
│  • Replace active dataset in jobs table (full replace, not append)          │
│  • Append-only log in dataset_uploads (source, row count, timestamp)        │
│  • Indexes on customer_id, sales_in, job_id                                 │
│  • Derived columns are NOT stored; recomputed on every read                 │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. DERIVE / PREPROCESS                         data_loader.derive_columns  │
│  • Currency conversion: Stg=1.0, Euro→GBP at BAIRD_EUR_GBP (default 0.86)   │
│    → sell_price_base, va_amount_base, cost columns *_base                   │
│  • Product canonicalisation: merge spelling variants on alphanumeric key    │
│    → product_type_clean                                                     │
│  • Lead time: ship_date − sales_in, clipped to [0, 180] days                │
│  • Margin flags: is_below_cost, is_low_margin (VA% < 25%)                   │
│  • Calendar: month_start for seasonality / ML panels                        │
│  • Recency anchor: analytics use max(sales_in), not wall-clock today        │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. DATASTORE                                           DataStore (in RAM)  │
│  • Thread-safe pandas DataFrame                                             │
│  • version counter bumps on replace → invalidates ML caches                 │
└─────────────────────────┬───────────────────────────┬───────────────────────┘
                          │                           │
                          ▼                           ▼
┌──────────────────────────────────────┐  ┌───────────────────────────────────┐
│  5a. ANALYTICS (rules / heuristics)  │  │  5b. MACHINE LEARNING             │
│                                      │  │                                   │
│  Customer value                      │  │  Quote Guard (price_model.py)     │
│  · Rank by va_amount_base            │  │  · HistGradientBoostingRegressor  │
│  · Pareto concentration (80% share)  │  │  · Target: log(sell_price_base)   │
│  · Split by work / product / sector  │  │  · Features: qty, impressions,    │
│                                      │  │    plates, press_hrs, paper/      │
│  Reorder forecasting                 │  │    labour/purchases_base,         │
│  · Mean gap between order dates      │  │    work_type, region, currency,   │
│  · Status: Overdue / Due soon /      │  │    product_type_clean             │
│    On track / Insufficient history   │  │  · Excluded: VA, markup, manadj   │
│  · 30-day expected value             │  │    (outputs of pricing, not       │
│                                      │  │     inputs)                       │
│  Account retention (rules)           │  │  · Train/test split; MAE, MAPE,   │
│  · Cadence-relative: At Risk 1.25×,  │  │    within 10% / 25%               │
│    Dormant 2.5× own gap              │  │  · Flag if actual < expected by   │
│  · Absolute fallbacks: 120 / 270 d   │  │    ≥ 20% (UNDERPRICED_THRESHOLD)  │
│                                      │  │                                   │
│  Pricing integrity                   │  │  Churn risk (churn_model.py)      │
│  · Override / discount / uplift      │  │  · HistGradientBoostingClassifier │
│  · Below-cost and low-margin jobs    │  │  · Unit: customer-month panel     │
│  · By customer, rep, work type       │  │  · Label: ordered within 60 days? │
│                                      │  │  · Features from history before   │
│  Seasonality                         │  │    observation date only          │
│  · Monthly sales & press hours       │  │    (no leakage)                   │
│  · Seasonal index vs baseline        │  │  · Time-based train/test split    │
│  · Seasonal-naive + growth forecast  │  │    (not random)                   │
│                                      │  │  · Benchmark: overdue-gap AUC     │
│  Delivery                            │  │  · Bands: High / Medium / Low     │
│  · Median & P90 lead time            │  │                                   │
│  · By work type / product; monthly   │  │                                   │
│                                      │  │                                   │
│  Repeat / reprint business           │  │                                   │
│  · Title cycles; due-for-reprint     │  │                                   │
│  · Min cycle 30 days (split orders)  │  │                                   │
└──────────────────┬───────────────────┘  └─────────────────┬─────────────────┘
                   │                                        │
                   └──────────────────┬─────────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  6. NARRATIVE BRIEFS                  analytics/narrative.py · llm/writer.py │
│  • Prose written per dataset by the model; templates as fallback            │
│  • Every figure computed, then written back over the model's output         │
│  • Guardrails reject invented, rounded or hedged numbers, then retry once   │
│  • Shape: title · 3 metrics · hero finding · breakdown table · actions      │
│  • Executive summary ranks all insights by annual value at stake and        │
│    drops any whose figure is zero                                           │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  7. API                                              FastAPI · main.py :8000│
│  • GET /api/summary, /insights/*, /ml/*, /executive-summary                 │
│  • Each insight returns raw figures + brief JSON                            │
│  • POST /api/data/upload replaces dataset and retrains models               │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  8. FRONTEND                                         React + Vite :5173     │
│  • Vite proxies /api → :8000                                                │
│  • DashboardDataContext: parallel fetch of all endpoints on load / upload   │
│  • AppLayout: sidebar, dataset meta bar                                     │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  9. UI OUTPUT                                                               │
│  Brief: metrics → key finding → breakdown → actions                         │
│  Then supporting charts (Recharts) and detail tables                        │
│  Overview: executive findings + currency split                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Loop | Behaviour |
| --- | --- |
| **Upload** | Replace `jobs` → bump DataStore version → invalidate ML cache → retrain → frontend reload |
| **Restart** | If `jobs` is non-empty, skip Excel → read SQLite → derive → continue from DataStore |

---

## Repository structure

```
wg-baird-sales-intelligence/
├── README.md
├── data/
│   ├── raw/                 # sample_data.xlsx (seed; not committed)
│   ├── uploads/             # upload scratch (not committed)
│   └── app.db               # SQLite store of record (not committed)
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── main.py          # FastAPI routes
│       ├── config.py        # FX rate and thresholds
│       ├── data_loader.py   # Excel → clean → derive → DataStore
│       ├── db.py            # SQLite schema and helpers
│       ├── analytics/       # Seven insight modules + narrative briefs
│       └── ml/              # Quote Guard + churn risk
└── frontend/
    ├── package.json
    ├── vite.config.ts       # proxies /api → :8000
    └── src/
        ├── App.tsx
        ├── api/             # Typed client and response types
        ├── data/            # DashboardDataContext
        ├── layout/          # App shell and navigation
        ├── components/      # Brief, charts, upload control
        ├── pages/           # One page per insight
        └── theme/           # Design tokens
```

### Route map

| Route | Page | Endpoint(s) |
| --- | --- | --- |
| `/` | Executive Briefing | `GET /api/summary`, `GET /api/executive-summary` |
| `/customer-value` | Customer Value | `GET /api/insights/customer-value` |
| `/repeat-business` | Recurring Revenue | `GET /api/insights/repeat-business` |
| `/reorder` | Reorder Forecasting | `GET /api/insights/reorder` |
| `/churn` | Account Retention | `GET /api/insights/churn` |
| `/pricing` | Pricing Integrity | `GET /api/insights/pricing` |
| `/seasonality` | Demand & Capacity | `GET /api/insights/seasonality` |
| `/delivery` | Production Turnaround | `GET /api/insights/delivery` |
| `/quote-guard` | Quote Intelligence | `GET /api/ml/quote-guard` |
| `/churn-risk` | Retention Risk | `GET /api/ml/churn-risk` |

---

## Data and persistence

| Asset | Role |
| --- | --- |
| `data/raw/sample_data.xlsx` | Seeds the database on first run |
| `data/app.db` → `jobs` | Active dataset (indexed on customer, booking date, title) |
| `data/app.db` → `dataset_uploads` | Append-only log of every file loaded |

Restarting the API reads from SQLite; the original Excel file need not remain
on disk. Uploading a new workbook in the same format (dashboard or
`POST /api/data/upload`) replaces the dataset, re-derives every insight, and
retrains both models. Raw data and the database are excluded from git.

### Data-quality notes

- **Two currencies.** Sell prices are stored in the customer’s home currency in
  a single column. Summing them raw overstates the book by roughly £2.0M. All
  money figures are converted to GBP at a planning rate (`BAIRD_EUR_GBP`,
  default `0.86`) before aggregation. The currency split appears on the
  overview page.
- **Product naming drift.** The source has 64 product-type labels, some of
  which are spelling variants of the same category. Variants are merged on an
  alphanumeric key; genuinely distinct labels are left alone.

---

## Modelling

Both models report held-out performance in the UI beside their predictions.

| Model | Approach | Notes |
| --- | --- | --- |
| **Quote Guard** | `HistGradientBoostingRegressor` on `log(sell_price_base)` | Uses specification and input costs only. Value added, markup, and manual adjustment are excluded (they are outcomes of pricing, not inputs). Median absolute percentage error ≈ 6.7% on unseen jobs. |
| **Churn risk** | `HistGradientBoostingClassifier` on a customer-month panel | Features use history before each observation date only; train/test split is by time. Scored against a naive overdue-gap AUC. With ~50 customers it is a ranking aid, not a verdict. |

### Narrative generation

The prose on each page is written for the dataset actually loaded, so importing
a different extract produces commentary about that extract rather than wording
bent to fit it. The division of labour is strict.

**The analytics own every number.** Figures are computed, formatted, then
written back over the model's output field by field (`llm/writer.py`). Nothing
numeric on screen depends on the model having been careful.

**The model only chooses words.** It receives the figures and a factual note on
what the insight measures. It never sees a finished draft to copy, and is never
asked to calculate anything.

**Output is validated before display** (`llm/guardrails.py`). Every numeric
token in the generated text must appear in the computed figures, so a
fabricated, silently rounded or hedged number rejects the draft, as does
commentary thinner than the template it would replace. A rejected draft gets
one corrective attempt with the specific failures fed back; anything still
failing falls back to the built-in template.

**It degrades safely.** With no API key, an unreachable API, a timeout or a
failed validation, the dashboard renders the deterministic templates and keeps
working. The key is optional.

Each page states which path produced its commentary, and `GET /api/meta`
reports whether generation is active. Configuration lives in `backend/.env`
(git-ignored, see `.env.example`):

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
LLM_NARRATIVE_ENABLED=true
```

Generation runs once per insight per dataset and is cached. It is warmed in the
background at startup and after an upload, so pages are ready before anyone
opens them: a cold dataset takes a couple of minutes to write, after which all
eleven endpoints serve in about two seconds.

Guardrails have their own tests in `backend/tests/test_guardrails.py`, covering
invented figures, silently rounded figures, hedged figures, fabricated currency
amounts and identifiers such as `CUST_011` that merely look numeric:

```bash
cd backend && ./.venv/Scripts/python tests/test_guardrails.py
```

---

## API reference

| Endpoint | Returns |
| --- | --- |
| `GET /api/summary` | Headline figures and currency split |
| `GET /api/meta` | Reporting assumptions and thresholds |
| `GET /api/executive-summary` | Findings most warranting senior attention |
| `GET /api/insights/customer-value` | Value by customer, work type, product, sector |
| `GET /api/insights/repeat-business` | Recurring titles and reprint pipeline |
| `GET /api/insights/reorder` | Reorder cadence and projections |
| `GET /api/insights/churn` | Rules-based dormancy and follow-up list |
| `GET /api/insights/pricing` | Overrides, discounting, below-cost work |
| `GET /api/insights/seasonality` | Monthly trend, seasonal index, forecast |
| `GET /api/insights/delivery` | Turnaround performance |
| `GET /api/ml/quote-guard` | Price benchmark, metrics, flagged jobs |
| `GET /api/ml/churn-risk` | Risk scores, metrics, benchmark comparison |
| `POST /api/data/upload` | Replace active dataset (`multipart/form-data`) |
| `GET /api/data/history` | Log of datasets loaded |

Every insight and ML endpoint includes a `brief` object (`title`, `metrics`,
`hero`, `breakdown`, `actions`) alongside raw figures. Brief numbers are
formatted server-side so prose and tables cannot disagree.

---

## Configuration

Assumptions live in `backend/app/config.py` and can be challenged or overridden
without changing analytics code:

| Setting | Default | Purpose |
| --- | --- | --- |
| `BAIRD_EUR_GBP` | `0.86` | Planning EUR→GBP rate |
| At-risk / dormant multiples | `1.25×` / `2.5×` own order gap | Rules-based retention |
| Fallback absolute days | `120` / `270` | Customers with too little history |
| Low-margin VA threshold | `25%` | Pricing integrity |
| Underpriced threshold | `20%` | Quote Guard flags |
| Max plausible lead time | `180` days | Delivery averages |
| Min reprint cycle | `30` days | Exclude split orders from “due” list |

Recency analytics anchor to the latest booking date in the data, not wall-clock
today, so a months-old extract does not make every customer look dormant.
