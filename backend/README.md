# Beacon Backend

Autonomous real-estate underwriting. A URL goes in; an agent graph (Data Collection
→ Inspection → Valuation → Trajectory → Synthesis → Thesis → PandaDoc) produces a
full investment report. All inference is local (MLX on Apple Silicon); PandaDoc is
the only external call. See `../plan.md` (spec) and `../BUILD_PLAN.md` (engineering
plan + decisions).

## Status: Phase 0 (foundation)

Built so far:
- App scaffold (FastAPI factory, config, base agent, progress streaming, models).
- Inference layer: MLX text (Llama-3-8B) + vision (Qwen2.5-VL) clients with
  constrained/validated JSON, plus a deterministic **stub** backend so the system
  runs and tests without the multi-GB models present.
- SQLite **ledger**: per-run + per-agent persistence for partial-signal fallback.

## Run locally

The app is two processes: this FastAPI backend (port 8000) and the Next.js
frontend (port 3000), which proxies `/api/analyze/stream` to the backend.

### 1. Backend

The canonical runtime is `.venv-mlx` (Python 3.14, real MLX models). Use it to
get real inference; `/api/v1/health` then reports `mlx-text` / `mlx-vision`
instead of the stubs.

```bash
cd backend
source .venv-mlx/bin/activate
uvicorn app.main:app --port 8000
# capability check (shows mlx vs stub):
curl localhost:8000/api/v1/health
```

First-time setup of the venv (if it doesn't exist yet):

```bash
cd backend
python3 -m venv .venv-mlx
source .venv-mlx/bin/activate
pip install -e ".[dev,mlx,vision,rag]"
```

### 2. Frontend

```bash
cd frontend
npm install          # first time only
npm run dev          # serves http://localhost:3000
```

The frontend reads `DEALSENSE_API_URL` (defaults to `http://127.0.0.1:8000`).
Copy `frontend/.env.example` to `frontend/.env.local` to override it or to set
`ANTHROPIC_API_KEY` (needed for the Agent 6 Letter of Intent route; without it
`/api/loi` falls back to a deterministic mock).

Then open **http://localhost:3000**.

## Local models (optional, for real inference)

Install in a Python 3.11+ environment for best `mlx-vlm` compatibility:

```bash
pip install -e ".[mlx,vision,rag]"
```

With MLX installed and the models pulled, `/api/v1/health` reports the `mlx-text`
and `mlx-vision` clients instead of the stubs. Set `BEACON_INFERENCE_BACKEND=mlx`
to require them (fails loudly if missing).

## Tests

```bash
pip install -e ".[dev]"
pytest
```
