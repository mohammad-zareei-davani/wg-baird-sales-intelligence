# W&G Baird Sales Intelligence

A dynamic analytics platform over W&G Baird's job-level sales data. FastAPI +
pandas + scikit-learn on the backend, React/TypeScript + Tailwind on the front,
SQLite as the store of record.

Every insight page leads with the commercial reading — what the number is, what
it means, and what to do about it — before showing any chart.

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

Every page follows the same shape, so a reader learns the format once:

1. **Three headline figures**, each with a unit so it reads on its own.
2. **One hero number** with a three-sentence read — enough to take the point
   without going further.
3. **A breakdown table** where every row carries a plain-English description of
   what that row means.
4. **Numbered actions**, each tagged with what it costs (free / low cost /
   value at stake) and explained concretely.
5. **Supporting charts** underneath — evidence for the argument, not the
   argument itself.

The interface supports light and dark mode, following the system setting until
the user chooses explicitly.

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
  added, markup and the manual adjustment are excluded — they are consequences
  of the pricing decision, not inputs to it. Median error ~6.7% on unseen jobs.
- **Churn risk** is trained on a customer-month panel (features computed only
  from history before each observation date) and split by time rather than at
  random. It is scored against a naive "how overdue are they" benchmark; with
  only 50 customers it is presented as a ranking aid, not a verdict.

The written briefing on each page is generated deterministically from the
computed figures rather than by a language model. The numbers quoted have to
reconcile exactly with the table beside them, the wording has to be identical on
every load of the same data, and it has to work with no external service and no
per-query cost — a template interpolating verified figures meets all three.

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

- `jobs` — the active dataset, indexed on customer, booking date and title
- `dataset_uploads` — an append-only log of every file loaded, with row count
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

Every insight endpoint includes a `brief` object alongside the raw figures —
`title`, `metrics`, `hero`, `breakdown` and `actions` — which is what the
dashboard renders. The numbers in the brief are formatted server-side so the
prose and the tables can never disagree.

## Assumptions worth challenging

All in `backend/app/config.py`: the EUR→GBP rate, the churn multiples that
define "at risk" and "dormant", the 25% low-margin threshold, the 20% underpriced
threshold, the 180-day cap on plausible lead times, and the 30-day minimum for a
gap to count as a genuine reprint cycle.

Recency analytics anchor to the latest booking date in the data rather than
wall-clock today, so a months-old extract does not make every customer look
dormant.
