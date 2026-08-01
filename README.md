# W&G Baird Sales Intelligence

Commercial analytics over W&G Baird job-level sales data. The platform turns a
print-job Excel extract into board-ready briefings: what the number is, what it
means, and what to do about it, with charts as supporting evidence rather than the
argument.

| Layer | Stack |
| --- | --- |
| Backend | FastAPI, pandas, scikit-learn, SQLite |
| Frontend | React, TypeScript, Tailwind CSS, Recharts |
| Deploy | Docker Compose (nginx + uvicorn) |
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

### Page anatomy

Every insight page follows the same structure so readers learn the format once:

1. Three headline metrics  
2. One key finding (hero figure + short commercial read)  
3. Breakdown table with plain-English row descriptions  
4. Supporting charts and detail tables  
5. Numbered actions tagged by cost (free / low cost / value at stake)  

The UI uses a single light theme, designed for screen reading and boardroom
projection.

---

## Getting started

### Docker (recommended)

**Prerequisites:** Docker Desktop (or Docker Engine + Compose).

```bash
cp .env.example .env   # optional: add OPENAI_API_KEY for generated commentary
docker compose up --build
```

Open **http://localhost:8080**. nginx serves the UI and proxies `/api` to the
backend. `./data` is mounted into the container so the sample report and any
uploads persist on the host.

```bash
docker compose down          # stop
docker compose down -v       # stop (volumes are host-mounted; data stays in ./data)
```

| Service | Image role | Host port |
| --- | --- | --- |
| `frontend` | Vite build → nginx | `8080` → container `80` |
| `backend` | uvicorn (FastAPI) | internal only (`backend:8000`) |

### Local development

Run the API and the UI in **two terminals**. The frontend proxies `/api/*` to
port `8000`.

**Prerequisites:** Python 3.11+, Node.js 18+.

Copy `.env.example` to `.env` at the **repository root** if you want optional
LLM commentary (the app works without a key).

#### Backend

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

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`). Keep the backend
running while using the dashboard.

### Sample data

**A worked example ships with the repository.** `data/app.db` already contains
the W&G Baird sample dataset and its finished report, so the dashboard opens on
a populated Executive Briefing with no upload, no model training and no API key
required. Nothing is generated on startup.

To see the full pipeline instead, upload `data/sample/WG-Baird-Sample-Dataset.xlsx`
(or any workbook in the same format) from the sidebar and watch the report
build. Delete any report from the sidebar to remove it and its dataset.

---

## Architecture

End-to-end flow from Excel input to the dashboard.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  INPUT                                                                      │
│  Excel job export  ·  sheet "Master Plain (Anon)"                           │
│  • Sidebar upload, or POST /api/reports                                     │
│  • Sample report ships in data/app.db for a ready dashboard on first open   │
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
│  • Each upload becomes a report (library, not a single active dataset)      │
│  • Job rows stored per report; finished payload stored as JSON              │
│  • Indexes on customer_id, sales_in, job_id                                 │
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
┌──────────────────────────────────────┐  ┌───────────────────────────────────┐
│  4a. ANALYTICS (rules / heuristics)  │  │  4b. MACHINE LEARNING             │
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
│  Pricing integrity                   │  │                                   │
│  · Override / discount / uplift      │  │                                   │
│  · Below-cost and low-margin jobs    │  │                                   │
│  · By customer, rep, work type       │  │                                   │
│                                      │  │                                   │
│  Seasonality                         │  │                                   │
│  · Monthly sales & press hours       │  │                                   │
│  · Seasonal index vs baseline        │  │                                   │
│  · Seasonal-naive + growth forecast  │  │                                   │
│                                      │  │                                   │
│  Delivery                            │  │                                   │
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
│  5. NARRATIVE BRIEFS                  analytics/narrative.py · llm/writer.py │
│  • Prose written per dataset by the model; templates as fallback            │
│  • Every figure computed, then written back over the model's output         │
│  • Guardrails reject invented, rounded or hedged numbers, then retry once   │
│  • Shape: title · 3 metrics · hero finding · breakdown table · actions      │
│  • Executive summary ranks insights by annual value at stake and            │
│    drops any whose figure is zero                                           │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  6. REPORT PAYLOAD                                     report_builder.py    │
│  • One build pass: analytics + Quote Guard + every brief                    │
│  • Stored on the report row; reopening is a database read, not a rebuild    │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  7. API / UI                                                                │
│  • FastAPI report library: list / get / upload / delete                     │
│  • React dashboard: one payload per selected report                         │
│  • Local: Vite :5173 proxies /api → :8000                                   │
│  • Docker: nginx :8080 serves UI and proxies /api → backend                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Loop | Behaviour |
| --- | --- |
| **Upload** | Create report → store jobs → background build → poll until ready |
| **Reopen** | `GET /api/reports/{id}` returns the stored payload (~1s) |
| **Delete** | Removes the report and its job rows together |
| **Restart mid-build** | Interrupted reports are marked failed on next startup |

---

## Repository structure

```
wg-baird-sales-intelligence/
├── README.md
├── docker-compose.yml
├── .env.example             # Copy to .env at repo root (git-ignored)
├── data/
│   ├── sample/              # Sample workbook, committed
│   └── app.db               # Datasets and reports (ships with the example)
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py          # FastAPI routes
│       ├── config.py        # Loads root .env; FX rate and thresholds
│       ├── data_loader.py   # Excel → clean → derive
│       ├── db.py            # SQLite schema and helpers
│       ├── report_builder.py
│       ├── analytics/       # Insight modules + narrative briefs
│       ├── llm/             # Commentary writer + guardrails
│       └── ml/              # Quote Guard price model
└── frontend/
    ├── Dockerfile
    ├── nginx.conf           # Serves UI; proxies /api → backend
    ├── package.json
    ├── vite.config.ts       # Dev: proxies /api → :8000
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

Every page reads from the one payload fetched for the selected report, so
switching between insights involves no further requests.

| Route | Page |
| --- | --- |
| `/` | Executive Briefing |
| `/customer-value` | Customer Value |
| `/repeat-business` | Recurring Revenue |
| `/reorder` | Reorder Forecasting |
| `/churn` | Account Retention |
| `/pricing` | Pricing Integrity |
| `/seasonality` | Demand & Capacity |
| `/delivery` | Production Turnaround |
| `/quote-guard` | Quote Intelligence |

### API

| Endpoint | Returns |
| --- | --- |
| `GET /api/reports` | Every stored report, newest first (drives the sidebar) |
| `GET /api/reports/{id}` | A report's status and, once ready, its full payload |
| `POST /api/reports` | Upload a workbook and start generating (multipart `file`) |
| `DELETE /api/reports/{id}` | Delete a report and the dataset behind it |
| `GET /api/meta` | Reporting assumptions and narrative-generation status |
| `GET /api/health` | Liveness and report count |

Each insight inside the payload carries a `brief` object (`title`, `metrics`,
`hero`, `breakdown`, `actions`) alongside its raw figures. Brief numbers are
formatted server-side so prose and tables cannot disagree.

---

## Reports and persistence

The app holds a **library of reports** rather than one active dataset.

**Uploading** validates the workbook, stores its job rows against a new report,
and starts generation in the background. The request returns immediately; the
dashboard polls and shows live progress ("Writing commentary: Pricing
integrity", 67%). While a report builds it shows only that progress, never the
previously open report.

**Generation runs once.** Analytics, the Quote Guard model and every piece of
commentary are produced in one pass and stored as a single payload. Reopening a
report is a database read of about a second, not a rebuild, so returning later
costs nothing and consumes no API credit.

**Deleting** a report removes its stored dataset with it, so nothing is
orphaned. A report left mid-build by a restart is marked as interrupted on the
next startup rather than sitting at "generating" forever.

Two tables in `data/app.db`:

| Table | Holds |
| --- | --- |
| `reports` | Name, timestamps, status, live progress, dataset facts, and the finished report as JSON |
| `report_jobs` | The job rows behind each report, so the analysis can be rebuilt |

`data/app.db` is committed with the sample report already built, but it is also
the live working file. Uploading or deleting reports locally will show it as
modified in git; restore it with `git checkout -- data/app.db` if you want the
shipped example to stay exactly as it is.

---

## Configuration

Settings are read from the **repository-root** `.env` (see `.env.example`).
Defaults and thresholds also live in `backend/app/config.py` so assumptions can
be challenged without changing analytics code.

| Setting | Default | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | _(empty)_ | Optional; enables per-dataset commentary |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model used when a key is present |
| `LLM_NARRATIVE_ENABLED` | `true` | Set `false` to force templates even with a key |
| `LLM_TIMEOUT_SECONDS` | `25` | Fallback to templates if the model is slow |
| `BAIRD_EUR_GBP` | `0.86` | Planning EUR→GBP rate |
| At-risk / dormant multiples | `1.25×` / `2.5×` own order gap | Rules-based retention |
| Fallback absolute days | `120` / `270` | Customers with too little history |
| Low-margin VA threshold | `25%` | Pricing integrity |
| Underpriced threshold | `20%` | Quote Guard flags |
| Max plausible lead time | `180` days | Delivery averages |
| Min reprint cycle | `30` days | Exclude split orders from “due” list |

Recency analytics anchor to the latest booking date in the data, not wall-clock
today, so a months-old extract does not make every customer look dormant.
