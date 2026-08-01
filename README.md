# W&G Baird Sales Intelligence

A commercial analytics platform that turns a print-job Excel extract into
board-ready briefings. Each insight states what the number is, what it means
commercially, and what to do about it, with charts as supporting evidence
rather than the argument.

Built for the W&G Baird data analytics assessment.

| Layer | Stack |
| --- | --- |
| Backend | FastAPI, pandas, scikit-learn, SQLAlchemy, SQLite |
| Frontend | React 18, TypeScript, Tailwind CSS, Recharts, Vite |
| Narrative | OpenAI, with validated fallback to built-in templates |
| Deployment | Docker Compose, or two local dev servers |

---

## Contents

- [Quick start](#quick-start)
- [What the platform does](#what-the-platform-does)
- [Findings from the sample dataset](#findings-from-the-sample-dataset)
- [How each page is structured](#how-each-page-is-structured)
- [Architecture](#architecture)
- [Analytical method](#analytical-method)
- [Machine learning](#machine-learning)
- [Written commentary](#written-commentary)
- [Reports and persistence](#reports-and-persistence)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Repository structure](#repository-structure)
- [Testing](#testing)
- [Limitations and next steps](#limitations-and-next-steps)

---

## Quick start

**A worked example ships with the repository.** `data/app.db` already contains
the sample dataset and its finished report, so the dashboard opens on a
populated Executive Briefing. No upload, no model training, and no API key are
required to review the work.

### Docker

```bash
docker compose up --build
```

Then open `http://localhost:8080`.

### Local development

Two terminals. The frontend proxies `/api/*` to port 8000.

**Prerequisites:** Python 3.11+, Node.js 18+.

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt          # Windows
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

```bash
cd frontend
npm install
npm run dev
```

On macOS or Linux use `./.venv/bin/` in place of `.\.venv\Scripts\`.
Open the URL Vite prints, by default `http://localhost:5173`.

### Seeing the full pipeline

To watch a report build from scratch, upload
`data/sample/WG-Baird-Sample-Dataset.xlsx` from the sidebar. The dashboard
shows live progress while the analysis runs, the model trains and the
commentary is written. Any report can be deleted from the sidebar, which
removes its dataset with it.

---

## What the platform does

Nine pages, each answering one commercial question.

| Page | Question answered |
| --- | --- |
| **Executive Briefing** | What the data is telling you, ranked by what is at stake |
| **Customer Value** | Where value added actually comes from |
| **Recurring Revenue** | Reprint work already won, and what is overdue |
| **Reorder Forecasting** | Who is due to order next |
| **Account Retention** | Customers who have gone quiet against their own cadence |
| **Pricing Integrity** | Margin decided at the point of quoting |
| **Demand & Capacity** | The shape of the trading year, and press load |
| **Production Turnaround** | How long work takes to leave the building |
| **Quote Intelligence** | What comparable work actually sells for (ML) |

The Executive Briefing is not a fixed list. Every insight is scored on the
money it has at stake per year, the largest are surfaced, and any insight whose
figure is zero drops out on its own. Change the dataset and the briefing
reorders itself.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│ INPUT   Excel job export, sheet "Master Plain (Anon)"                    │
│         Sidebar upload, or POST /api/reports                             │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 1. INGEST & VALIDATE                          data_loader.load_dataframe │
│    Rename to a stable schema · coerce types · drop unusable rows         │
│    Rejects a bad workbook before a report row is created                 │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 2. PERSIST                                              data/app.db · db │
│    report_jobs: the dataset behind each report                           │
│    reports: status, live progress, and the finished report as JSON       │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 3. DERIVE                                     data_loader.derive_columns │
│    Currency conversion to GBP  →  *_base columns                         │
│    Product canonicalisation    →  product_type_clean                     │
│    Lead time, margin flags, calendar month                               │
│    Recency anchored to max(sales_in), never wall-clock today             │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 4. BUILD REPORT (background thread)                    report_builder.py │
│    ┌────────────────────────────┐  ┌──────────────────────────────────┐  │
│    │ Analytics (7 modules)      │  │ Machine learning                 │  │
│    │ value · repeat · reorder   │  │ Quote Guard price benchmark      │  │
│    │ churn · pricing            │  │ HistGradientBoostingRegressor    │  │
│    │ seasonality · delivery     │  │ spec and cost inputs only        │  │
│    └────────────┬───────────────┘  └────────────────┬─────────────────┘  │
│                 └──────────────┬────────────────────┘                    │
│                                ▼                                         │
│    Narrative: computed brief → model rewrites prose → validated          │
│    Executive summary: score every insight, rank, drop the empty ones     │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 5. STORE & SERVE                                                         │
│    Whole payload saved once. Reopening is a ~1s read, never a rebuild    │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 6. DASHBOARD                        React · TypeScript · Tailwind        │
│    Report library · live progress · nine insight pages                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Analytical method

Choices that materially affect the numbers, and why they were made.

**Value added, not revenue.** Customers are ranked by what the business keeps
after paper, press and bought-in costs. Ranking by turnover changes which
accounts look most important, and points sales effort at the wrong ones.

**Concentration is measured, not assumed.** A fixed "top five" is arbitrary and
frequently wrong. The platform finds the largest proportional gap in the ranked
list, detects accounts close enough to read as level, and finds where the field
flattens. In the sample dataset that is two accounts effectively tied at the
top, four standing clearly ahead, and a flat field from the fifth. The chart
colours those four and marks the average account, so the written claim is
something a reader can verify by looking.

**Churn is relative to each customer's own habit.** Six weeks of silence from a
fortnightly customer is a genuine warning; the same six weeks from a
twice-a-year customer means nothing. Accounts with too little history fall back
to absolute thresholds.

**Recency anchors to the data, not to today.** An extract is a point in time.
Measuring against wall-clock today would make every customer look dormant
purely because the file is a few months old.

**Reprint cycles exclude split orders.** Two runs of a title a few days apart
are one order split across lines, not a reprint. Titles with a cycle under 30
days stay in the revenue figures but are excluded from the call list, where
they would otherwise always look overdue.

**Turnaround is judged per product.** A 30,000-copy educational book is not a
business-card run, so each job is compared against its own product's norm
rather than one company-wide target.

**Executive findings are ranked on annual money at stake.** Historical totals
are annualised so a long extract does not outrank a genuinely current figure.
Turnaround is deliberately left unscored: the value of slow jobs is revenue
that was delivered and paid for, not money at risk, and scoring it would put a
misleading figure at the top of the briefing.

---

## Machine learning

**Quote Guard** predicts what comparable work has sold for, giving estimators a
reference point at the moment of quoting and flagging jobs sold well below the
going rate.

| | |
| --- | --- |
| Model | `HistGradientBoostingRegressor` on `log(sell_price_base)` |
| Features | Quantity, impressions, plates, press hours, paper, labour, bought-in cost, work type, region, currency, product type |
| Excluded | Value added, markup, manual adjustment |
| Typical error | 6.7% on unseen jobs |
| Within 25% | 91.5% |
| Held out | 1,533 jobs, from 6,130 priced |

The exclusions matter more than the score. Value added, markup and the manual
adjustment are consequences of the pricing decision, not inputs to it.
Including them would let the model reconstruct the answer and report an
accuracy it has not earned.

Price is modelled in log space because job values span four orders of
magnitude; a flat error target would let a handful of very large jobs dominate
the fit.

---

## Written commentary

The prose on each page is written for the dataset actually loaded, so importing
a different extract produces commentary about that extract rather than wording
bent to fit it. The division of labour is strict.

**The analytics own every number.** Figures are computed, formatted, then
written back over the model's output field by field. Nothing numeric on screen
depends on the model having been careful.

**The model only chooses words.** It receives the figures and a factual note on
what the insight measures. It never sees a finished draft to copy, and is never
asked to calculate anything.

**Output is validated before display.** Every numeric token in the generated
text must appear in the computed figures, so a fabricated, silently rounded or
hedged number rejects the draft. So does commentary thinner than the template
it would replace: instructions in the explanation slot, table descriptions that
restate the figure beside them, or actions with no reasoning. A rejected draft
gets one corrective attempt with the specific failures fed back.

**It degrades safely.** With no API key, an unreachable API, a timeout or a
failed validation, the platform renders deterministic templates and keeps
working. The key is optional, and the shipped report needs none.

Each page states which path produced its commentary. `GET /api/meta` reports
whether generation is active.

---

## Reports and persistence

The platform holds a **library of reports** rather than one active dataset.

**Uploading** validates the workbook, stores its job rows against a new report,
and starts generation in the background. The request returns immediately; the
dashboard polls and shows live progress. While a report builds it shows only
that progress, never the previously open report.

**Generation runs once.** Analytics, the model and every piece of commentary
are produced in one pass and stored as a single payload. Reopening a report is
a database read of about a second, so returning later costs nothing and
consumes no API credit.

**Deleting** a report removes its stored dataset with it. A report left
mid-build by a restart is marked as interrupted on the next startup rather than
sitting at "generating" forever.

| Table | Holds |
| --- | --- |
| `reports` | Name, timestamps, status, live progress, dataset facts, finished report as JSON |
| `report_jobs` | The job rows behind each report, so the analysis can be rebuilt |

`data/app.db` is committed with the sample report already built, but it is also
the live working file. Uploading or deleting reports locally will show it as
modified in git. Restore it with `git checkout -- data/app.db` if you want the
shipped example to stay exactly as it is.

---

## Configuration

Every assumption a reviewer might reasonably challenge lives in
`backend/app/config.py` rather than being buried in the analytics.

| Setting | Default | Meaning |
| --- | --- | --- |
| `EUR_TO_GBP` | 0.86 | Planning rate for converting Euro-billed work |
| `AT_RISK_INTERVAL_MULTIPLE` | 1.25 | Silence beyond this multiple of a customer's own gap is At Risk |
| `DORMANT_INTERVAL_MULTIPLE` | 2.5 | Beyond this, Dormant |
| `FALLBACK_AT_RISK_DAYS` | 120 | Absolute threshold when there is no cadence |
| `FALLBACK_DORMANT_DAYS` | 270 | As above |
| `MIN_ORDERS_FOR_CADENCE` | 3 | Orders needed before a cadence is trusted |
| `DUE_SOON_DAYS` | 14 | Reorder window counted as due soon |
| `LOW_MARGIN_VA_PCT` | 0.25 | Below this VA share, too thin to carry overhead |
| `UNDERPRICED_THRESHOLD_PCT` | 0.20 | Shortfall against the benchmark that flags a job |
| `MAX_PLAUSIBLE_LEAD_DAYS` | 180 | Longer gaps treated as data artefacts |
| `MIN_REPRINT_CYCLE_DAYS` | 30 | Shorter cycles treated as split orders |

Secrets and environment overrides live in `.env` at the project root, which is
git-ignored and read by both the local backend and Docker Compose. Copy
`.env.example` to start:

```bash
OPENAI_API_KEY=sk-...          # optional; templates are used when absent
OPENAI_MODEL=gpt-4o-mini
LLM_NARRATIVE_ENABLED=true
LLM_TIMEOUT_SECONDS=25
BAIRD_EUR_GBP=0.86
```

---

## API reference

| Endpoint | Returns |
| --- | --- |
| `GET /api/reports` | Every report, newest first. Drives the sidebar |
| `GET /api/reports/{id}` | A report's status and, once ready, its full payload |
| `POST /api/reports` | Upload a workbook and start generating (multipart `file`) |
| `DELETE /api/reports/{id}` | Delete a report and the dataset behind it |
| `GET /api/meta` | Reporting assumptions and narrative-generation status |
| `GET /api/health` | Liveness and report count |

Each insight inside the payload carries a `brief` object (`title`, `metrics`,
`hero`, `breakdown`, `actions`) alongside its raw figures. Brief numbers are
formatted server-side so prose and tables cannot disagree.

---

## Repository structure

```
wg-baird-sales-intelligence/
├── README.md
├── docker-compose.yml
├── .env.example                   # Copy to .env; git-ignored
├── data/
│   ├── sample/                    # Sample workbook, committed
│   └── app.db                     # Datasets and reports; ships with the example
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py                # FastAPI routes
│   │   ├── config.py              # Every tunable assumption
│   │   ├── db.py                  # Schema and report lifecycle
│   │   ├── data_loader.py         # Ingest, validate, derive
│   │   ├── report_builder.py      # One-pass build with progress
│   │   ├── analytics/             # Seven insight modules + narrative
│   │   ├── ml/price_model.py      # Quote Guard
│   │   └── llm/
│   │       ├── writer.py          # Prompting and merge-back
│   │       └── guardrails.py      # Numeric and quality validation
│   └── tests/test_guardrails.py
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    └── src/
        ├── api/                   # Typed client
        ├── components/            # Brief anatomy, charts, tables
        ├── data/                  # Report context and polling
        ├── layout/                # Shell, sidebar, report library
        └── pages/                 # Nine insight pages
```

---

## Testing

The guardrails protecting generated commentary have their own tests, covering
invented figures, silently rounded figures, hedged figures, fabricated currency
amounts, and identifiers such as `CUST_011` that merely look numeric.

```bash
cd backend && .\.venv\Scripts\python tests\test_guardrails.py
```
