# HomePilot

HomePilot is an autonomous AI buyer's agent that ranks candidate homes using
specialized agents coordinated by a CEO orchestrator.

## Architecture

- FastAPI exposes the recommendation API with streaming progress events.
- Pydantic models define the request, property, agent output, and recommendation contracts.
- The CEO agent coordinates specialist agents and assembles ranked recommendations.
- Specialist agents evaluate each listing:
  - Property Intelligence Agent
  - Hidden Cost Agent
  - Family Fit Agent
  - Property Value Agent
  - Future Outlook Agent
- Next.js frontend provides buyer intake, live agent progress, and ranked results.

## Run Locally

### Backend

From the `backend/` directory, use a virtualenv (do not use Homebrew's global
`uvicorn` — it won't have FastAPI installed):

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

The main endpoint is:

```text
POST /api/v1/recommendations
```

### Frontend (Next.js)

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The intake form at `/` proxies requests to the
FastAPI backend via `frontend/src/app/api/recommendations/route.ts`.

Set the backend URL in `frontend/.env.local`:

```text
HOMEPILOT_API_URL=http://127.0.0.1:8000
```

Flow:

1. `/` — enter buyer profile and listing URLs (or click **Load demo**)
2. **Analyze** — stores ranked results in `sessionStorage` and navigates to `/results`
3. `/results` — ranked cards with expandable agent breakdowns

## Demo

Run the deterministic demo request from the CLI:

```bash
cd backend
source .venv/bin/activate
python3 scripts/run_demo.py
```

Or use **Load demo** in the web UI. The seeded demo data lives in
`backend/app/data/demo_recommendation_request.json` (copied to `frontend/public/demo_request.json`).
