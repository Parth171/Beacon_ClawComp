# DealSense Backend

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

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
# capability check (shows mlx vs stub):
curl localhost:8000/api/v1/health
```

## Local models (optional, for real inference)

Install in a Python 3.11+ environment for best `mlx-vlm` compatibility:

```bash
pip install -e ".[mlx,vision,rag]"
```

With MLX installed and the models pulled, `/api/v1/health` reports the `mlx-text`
and `mlx-vision` clients instead of the stubs. Set `DEALSENSE_INFERENCE_BACKEND=mlx`
to require them (fails loudly if missing).

## Tests

```bash
pip install -e ".[dev]"
pytest
```
