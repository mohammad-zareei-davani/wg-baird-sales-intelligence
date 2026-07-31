# W&G Baird Sales Intelligence

FastAPI backend + React/TypeScript frontend surfacing three insights from the
W&G Baird job-level sales export:

1. **Most valuable customers & types of work** — customers ranked by Value
   Added, with each customer's dominant work type and an 80/20 concentration
   stat.
2. **Reorder values & predicted timelines** — per-customer order cadence,
   with a forecast next-order date and expected value.
3. **Customer churn & follow-up opportunities** — dormancy scored against
   each customer's own historical ordering cadence, with a prioritised
   follow-up list ranked by lifetime value at stake.

The system re-analyses on demand: uploading a new `.xlsx` file in the same
format (via the dashboard's upload button, or `POST /api/data/upload`)
swaps the active dataset without restarting the API. The active dataset is
persisted to a SQLite database (`data/app.db`), not just held in memory, so
it survives an API restart and every upload is logged with a timestamp.

## Run it

Backend (FastAPI):

```bash
cd backend
python -m venv .venv
./.venv/Scripts/pip install -r requirements.txt   # .venv/bin/pip on macOS/Linux
./.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

Frontend (Vite + React + TS):

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (defaults to `http://localhost:5173`) — it proxies
`/api/*` to the backend on port 8000.

## Data

`data/raw/sample_data.xlsx` is the sample dataset used to seed the database
the first time the API runs (excluded from git — see `.gitignore`). Column
definitions are on the workbook's "Field Definitions" tab.

`data/app.db` is a SQLite database (also excluded from git) holding two
tables:

- `jobs` — every row of the active dataset, in the cleaned/typed form the
  analytics modules consume (indexed on `customer_id`, `sales_in`, `job_id`).
- `dataset_uploads` — an append-only log of every file that has been loaded,
  with row count and timestamp.

On startup, if `jobs` is empty the API ingests `data/raw/sample_data.xlsx`
into it; otherwise it reads the existing database as-is, so restarting the
API does not require the original Excel file to still be on disk. Uploading
a new file (`POST /api/data/upload`) deletes and repopulates `jobs` and adds
a row to `dataset_uploads`.

## API

- `GET /api/summary` — headline KPIs
- `GET /api/insights/customer-value?top_n=15`
- `GET /api/insights/reorder`
- `GET /api/insights/churn`
- `POST /api/data/upload` — multipart `file` field, replaces the active dataset
- `GET /api/data/history` — log of every dataset uploaded so far
