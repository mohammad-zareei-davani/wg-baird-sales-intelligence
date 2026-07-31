# W&G Baird Sales Intelligence

A dynamic analytics platform over W&G Baird's job-level sales data. FastAPI +
pandas + scikit-learn on the backend, React/TypeScript + Tailwind on the front,
SQLite as the store of record.

Every insight page leads with the commercial reading — what the number is, what
it means, and what to do about it — before showing any chart.

## Insights

**Commercial**

1. **Customer value** — accounts ranked by Value Added rather than sell price,
   with work-type, product and sector breakdowns and a concentration measure.
2. **Repeat & reprint work** — recurring titles, their reprint cycles, and which
   are now overdue against their own cycle.
3. **Reorder timelines** — each account's normal ordering rhythm, with projected
   next order date and value.
4. **Churn & follow-up** — dormancy scored against each customer's own cadence,
   prioritised by lifetime value at stake.

**Operations**

5. **Pricing & margin integrity** — how often the automated estimate is
   overridden, where discounting concentrates, and which work ran below cost.
6. **Seasonality & capacity** — monthly demand and press-hour load, the seasonal
   shape of the year, and a six-month projection with backtested error.
7. **Delivery performance** — turnaround from booking to despatch, judged per
   product against that product's own norm.

**Predictive**

8. **Quote Guard** — a model that learns what comparable work sells for and
   flags jobs priced materially below it.
9. **Churn risk** — likelihood each account orders again within 60 days,
   validated against a naive benchmark on a time-based split.

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

Narrative text is generated deterministically from the computed figures rather
than by a language model, so the wording in a board pack always reconciles with
the table beside it and costs nothing to produce.

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

Every insight endpoint includes a `story` object (`headline`,
`what_it_means`, `recommended_action`) alongside the figures.

## Assumptions worth challenging

All in `backend/app/config.py`: the EUR→GBP rate, the churn multiples that
define "at risk" and "dormant", the 25% low-margin threshold, the 20% underpriced
threshold, the 180-day cap on plausible lead times, and the 30-day minimum for a
gap to count as a genuine reprint cycle.

Recency analytics anchor to the latest booking date in the data rather than
wall-clock today, so a months-old extract does not make every customer look
dormant.
