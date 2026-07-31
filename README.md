# W&G Baird Sales Intelligence

A dynamic analytics platform over W&G Baird's job-level sales data. FastAPI +
pandas + scikit-learn on the backend, React/TypeScript + Tailwind on the front,
SQLite as the store of record.

Every insight page leads with the commercial reading before showing any chart:
what the number is, what it means, and what to do about it.

## Architecture diagram

End-to-end flow from Excel input to the dashboard UI. Each box lists the
techniques, models or outputs used at that stage.

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
│  • Derived columns are NOT stored — recomputed on every read                │
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
│  6. NARRATIVE BRIEFS                               analytics/narrative.py   │
│  • Deterministic templates (not an LLM)                                     │
│  • Shape: title · 3 metrics · hero finding · breakdown table · actions      │
│  • Figures formatted server-side so prose and tables cannot disagree        │
│  • Executive summary picks five findings: pricing → value → repeat →        │
│    churn → seasonality                                                      │
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
│  • AppLayout: ink sidebar, meta bar (source · jobs · date range · currency) │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  9. UI OUTPUT                                                               │
│  Brief anatomy (every insight page):                                        │
│    metrics → key finding → breakdown table → numbered actions               │
│  Then Supporting Charts (Recharts): bars, donuts, seasonal lines, tables    │
│  Overview: executive findings + currency split                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Upload loop:** replace `jobs` → bump DataStore version → invalidate ML cache → retrain → frontend `reload()`.

**Restart loop:** if `jobs` is non-empty, skip Excel → read SQLite → derive → stages 4–9.

## How the app works

Data enters as an Excel export (or dashboard upload), is cleaned and stored in
SQLite, then enriched in memory. Seven analytics modules and two ML models run
over that dataset. Deterministic narrative templates turn verified figures into
a `brief` object. FastAPI serves those payloads; the React app loads them once
and renders brief-first pages with supporting charts underneath.

## Application structure

```
wg-baird-sales-intelligence/
├── README.md
├── data/
│   ├── raw/                        # sample_data.xlsx (seed; not in git)
│   ├── uploads/                    # upload scratch (not in git)
│   └── app.db                      # SQLite store of record (not in git)
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── main.py                 # FastAPI routes
│       ├── config.py               # FX rate and thresholds
│       ├── data_loader.py          # Excel → clean → derive → DataStore
│       ├── db.py                   # SQLite schema and helpers
│       ├── analytics/
│       │   ├── customer_value.py
│       │   ├── reorder.py
│       │   ├── churn.py
│       │   ├── pricing.py
│       │   ├── seasonality.py
│       │   ├── delivery.py
│       │   ├── repeat_business.py
│       │   └── narrative.py        # brief templates + executive summary
│       └── ml/
│           ├── price_model.py      # Quote Guard
│           └── churn_model.py      # Retention risk
└── frontend/
    ├── package.json
    ├── vite.config.ts              # proxies /api → :8000
    ├── tailwind.config.js
    └── src/
        ├── App.tsx                 # provider + routes
        ├── api/                    # typed client + response types
        ├── data/DashboardDataContext.tsx
        ├── layout/AppLayout.tsx    # sidebar, meta bar, outlet
        ├── components/
        │   ├── brief/Brief.tsx     # shared page anatomy
        │   ├── charts/             # Recharts wrappers
        │   ├── Panel.tsx
        │   └── UploadControl.tsx
        ├── pages/                  # one page per insight
        ├── theme/colors.ts
        └── format.ts
```

### Page → API mapping

| Route | Page | Backend |
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

## Pages

| Page | Question it answers |
| --- | --- |
| **Executive Briefing** | What the data is telling you, five findings deep |
| **Customer Value** | Where your value actually comes from |
| **Recurring Revenue** | Work you have already won |
| **Reorder Forecasting** | Who is due to order next |
| **Account Retention** | Customers who have gone quiet |
| **Pricing Integrity** | Margin decided at the point of quoting |
| **Demand & Capacity** | The shape of your trading year |
| **Production Turnaround** | How long work takes to leave the building |
| **Quote Intelligence** | What comparable work actually sells for |
| **Retention Risk** | Who is unlikely to come back |

## How each page is structured

Every insight page follows the same shape, so a reader learns the format once:

1. **Three headline figures**, each with a unit so it reads on its own.
2. **One hero number** with a three-sentence read, enough to take the point
   without going further.
3. **A breakdown table** where every row carries a plain-English description of
   what that row means.
4. **Numbered actions**, each tagged with what it costs (free / low cost /
   value at stake) and explained concretely.
5. **Supporting charts** underneath: evidence for the argument, not the argument
   itself.

The interface is a single light theme, tuned for on-screen reading and for
projection in a boardroom.

## Two findings worth knowing before reading the numbers

- **The book is billed in two currencies.** Sell prices are recorded in the
  customer's own currency in a single column. Summed untouched they overstate
  the book by roughly £2.0M. Everything is converted to GBP at a stated planning
  rate (`BAIRD_EUR_GBP`, default 0.86) before aggregation, and the split is shown
  on the overview page.
- **Product naming has drifted.** The source carries 64 distinct product types,
  some of which are the same category typed differently. Spelling variants are
  merged on an alphanumeric key; genuinely different labels are left alone.

## Modelling notes

Both models report honest held-out performance, shown in the UI beside the
predictions:

- **Quote Guard** predicts price from specification and input costs only. Value
  added, markup and the manual adjustment are excluded, because they are
  consequences of the pricing decision rather than inputs to it. Median error is
  about 6.7% on unseen jobs.
- **Churn risk** is trained on a customer-month panel (features computed only
  from history before each observation date) and split by time rather than at
  random. It is scored against a naive "how overdue are they" benchmark; with
  only 50 customers it is presented as a ranking aid, not a verdict.

The written briefing on each page is generated deterministically from the
computed figures rather than by a language model. The numbers quoted have to
reconcile exactly with the table beside them, the wording has to be identical on
every load of the same data, and it has to work with no external service and no
per-query cost. A template interpolating verified figures meets all three.

## Run it

Backend:

```bash
cd backend && python -m venv .venv && ./.venv/Scripts/pip install -r requirements.txt
```
```bash
cd backend && ./.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend && npm install && npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`); it proxies `/api/*`
to port 8000. On macOS/Linux use `.venv/bin/` in place of `.venv/Scripts/`.

## Data & persistence

`data/raw/sample_data.xlsx` seeds the database on first run. `data/app.db`
(SQLite) is the store of record and holds:

- `jobs`, the active dataset, indexed on customer, booking date and title
- `dataset_uploads`, an append-only log of every file loaded, with row count
  and timestamp

Restarting the API reads from the database, so the original Excel file does not
need to remain on disk. Uploading a new file in the same format (via the
dashboard or `POST /api/data/upload`) replaces the dataset, re-derives every
insight and retrains both models. Neither the raw data nor the database is
committed to git.

## API

| Endpoint | Returns |
| --- | --- |
| `GET /api/summary` | Headline figures and the currency split |
| `GET /api/meta` | Reporting assumptions and thresholds |
| `GET /api/executive-summary` | The findings most warranting senior attention |
| `GET /api/insights/customer-value` | Value by customer, work type, product, sector |
| `GET /api/insights/repeat-business` | Recurring titles and reprint pipeline |
| `GET /api/insights/reorder` | Reorder cadence and projections |
| `GET /api/insights/churn` | Rules-based dormancy and follow-up list |
| `GET /api/insights/pricing` | Override rates, discounting, below-cost work |
| `GET /api/insights/seasonality` | Monthly trend, seasonal index, forecast |
| `GET /api/insights/delivery` | Turnaround performance |
| `GET /api/ml/quote-guard` | Price benchmark, metrics, flagged jobs |
| `GET /api/ml/churn-risk` | Risk scores, metrics, benchmark comparison |
| `POST /api/data/upload` | Replace the active dataset (multipart `file`) |
| `GET /api/data/history` | Log of datasets loaded |

Every insight endpoint includes a `brief` object alongside the raw figures. It
carries `title`, `metrics`, `hero`, `breakdown` and `actions`, and is what the
dashboard renders. The numbers inside it are formatted server-side, so the prose
and the tables can never disagree.

## Assumptions worth challenging

All in `backend/app/config.py`: the EUR→GBP rate, the churn multiples that
define "at risk" and "dormant", the 25% low-margin threshold, the 20% underpriced
threshold, the 180-day cap on plausible lead times, and the 30-day minimum for a
gap to count as a genuine reprint cycle.

Recency analytics anchor to the latest booking date in the data rather than
wall-clock today, so a months-old extract does not make every customer look
dormant.
