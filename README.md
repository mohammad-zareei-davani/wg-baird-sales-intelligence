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
swaps the active dataset without restarting the API.

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

`data/raw/sample_data.xlsx` is the sample dataset used as the default
dataset on startup (excluded from git — see `.gitignore`). Column
definitions are on the workbook's "Field Definitions" tab.

## API

- `GET /api/summary` — headline KPIs
- `GET /api/insights/customer-value?top_n=15`
- `GET /api/insights/reorder`
- `GET /api/insights/churn`
- `POST /api/data/upload` — multipart `file` field, replaces the active dataset
