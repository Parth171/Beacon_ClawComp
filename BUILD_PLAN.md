# Beacon — Refined Build Plan

Companion to `plan.md`. This file records the resolved architecture decisions, the
reuse map from the deprecated `homepilot/` code, and the sequenced to-do list.
`plan.md` remains the product/vision spec; this is the engineering plan.

---

## Resolved decisions

| # | Decision | Choice | Consequence |
|---|----------|--------|-------------|
| 1 | Local inference runtime | **MLX + outlines/llguidance** (mlx-vlm for vision, MLX-LM for text) | Rebuild the inference layer. The deprecated Ollama `vision.py` transport is discarded; its prompt + JSON schema transfer. `image_prep.py` is runtime-agnostic and kept. |
| 2 | Analysis DAG shape | **Linear chain: Inspection → Valuation → Trajectory** | Overrides the plan's "2/3/4 run in parallel." Each agent consumes the previous one's evidence. Removes the circular dependency the plan implied. Orchestrator is a resilient sequential pipeline, not a parallel fan-out. |
| 3 | Agent 2 valuation method | **Live comps now; XGBoost when MLS data exists** | Ships unblocked on the working comps-median engine. XGBoost/LightGBM added later as the primary estimator with comps as fallback. (Revisit if MLS training data is already available.) |

### Revised execution order (supersedes the diagram in plan.md)

```
Data Collection (A1)
      ↓ canonical schema + image set
Inspection (A3)            ← runs FIRST on photos alone (pure visual evidence)
      ↓ repairRisk, renovationScore, flags
Valuation (A2)            ← consumes inspection condition; reads priceHistory/distress
      ↓ mispricing, sellerUrgency, distressSale
Trajectory (A4)          ← consumes inspection + valuation; weighs cost vs upside
      ↓ trajectoryScore, signals, tensions
Cross-Agent Evidence Synthesis
      ↓ unified evidence object
Investment Thesis (A5)   → BUY / PASS + corroborations / conflicts
      ↓
PandaDoc (A6)            → LOI + report (BUY) | report only (PASS)
```

Agent numbers (A2–A6) are kept from `plan.md` for traceability; **execution order is
the chain above**, not numeric order.

---

## Reuse map (from deprecated `homepilot/`)

### Keep ~as-is (infrastructure)
- `backend/app/services/image_prep.py` — OpenCV download/blur-filter/dedup/resize/base64. Feeds the MLX VLM.
- `backend/app/services/progress.py` — ContextVar streaming of agent/sub-task events → drives the live frontend pipeline.
- `backend/app/services/openclaw.py` + `services/comps.py` + Node skills at `~/.openclaw/workspace/skills/` (`fetch-listings.js`, `fetch-comps.js`, realtor.ca/.com adapters) — the scraping layer = Agent 1.
- `backend/app/agents/base.py` — typed async `Agent[InputT, OutputT]` protocol.
- `backend/app/core/config.py` — Pydantic settings pattern (swap Ollama keys for MLX).
- `backend/app/models/property.py`, `models/agent_outputs.py` (`BreakdownItem` / `CalcInput` evidence structs), `main.py` app factory.
- Frontend (Next.js): `AgentPipeline`, `PropertyReport`, intake form, SSE wiring.

### Reuse the logic, re-home it
- `agents/property_intelligence.py` → **Agent 3 Inspection** (vision + heuristic fallback already structured the way we need).
- `agents/property_value.py` → **Agent 2 Valuation** (already adjusts value by condition result — matches the new chain order).
- `agents/hidden_cost.py` → feeds Agent 3's `estimatedRepairCost` / ownership-cost context.
- `agents/future_outlook.py` → starting point for **Agent 4**, but it's a static `area_signals.json`, **not** a RAG pipeline (see gaps).
- `agents/ceo.py` → reuse only the streaming-orchestration pattern; discard ranking logic.

### Discard
- `agents/family_fit.py`, `models/user.py` (BuyerProfile), `services/task_graph.py` (empty stub), `services/scoring.py` (unused protocol).

---

## Net-new builds (no equivalent in deprecated code)

1. **MLX inference layer** — mlx-vlm (Qwen2.5-VL) + MLX-LM (Llama-3-8B) + outlines/llguidance constrained JSON. On the critical path: every LLM/VLM agent depends on it.
2. **SQLite ledger** — per-property run record + per-agent output persistence + run state for failure recovery.
3. **Agent 4 RAG pipeline** — municipal doc ingestion, 512/64 chunking, BGE-Small embeddings, Qdrant index (FSA + doc type + recency), structured per-field queries, evidence-weighted scoring via MLX synthesis. Largest single build.
4. **Agent 5 Investment Thesis** — constrained reasoning over the unified evidence object → corroborations / conflicts / recommendation / nextStep.
5. **Agent 6 PandaDoc** — LOI + report templates, variable mapping, BUY-only signing flow.
6. **XGBoost/LightGBM valuation** — deferred until MLS sales data is sourced.

## Known data gap (critical path for Agent 2)
The scraper does **not** currently extract `priceHistory` or `daysOnMarket`, and
realtor.ca returns `yearBuilt: null`. `priceHistory` is the headline distress signal.
Extend the realtor.ca/.com adapters + the `map_openclaw_listing_to_property` mapping
and the canonical schema before Valuation can be meaningful.

---

## Sequenced to-do (what to do first)

**Phase 0 — Foundation (do first; everything depends on it)**
1. Scaffold the Beacon backend by forking the homepilot structure (FastAPI app, config, base agent, progress streaming, models) and rebranding.
2. Build the MLX inference layer (mlx-vlm + MLX-LM + outlines/llguidance constrained JSON). Replaces Ollama.
3. Build the SQLite ledger (run + per-agent output + state schema, read/write helpers).

**Phase 1 — Agent 1 Data Collection**
4. Wire the Node scraping skills via `openclaw.py`; extend adapters + mapping + canonical schema to capture `priceHistory`, `daysOnMarket`, `yearBuilt`.

**Phase 2 — Analysis chain (in order)**
5. Agent 3 Inspection: `image_prep` → MLX VLM per-image schema → aggregate `repairRisk` / `renovationScore` / `estimatedRepairCost` + evidence artifacts.
6. Agent 2 Valuation: comps engine + MLX listing-context signal, consuming inspection condition + `priceHistory` distress → `mispricing` / `sellerUrgency` / `distressSale` + evidence.
7. Agent 4 Trajectory: RAG pipeline (ingest → chunk → BGE → Qdrant → structured queries → evidence-weighted MLX synthesis), consuming inspection + valuation → `trajectoryScore` / `signals` / `tensions`.

**Phase 3 — Synthesis + Thesis**
8. Cross-agent evidence aggregator: assemble the unified evidence object, persist to ledger.
9. Agent 5 Investment Thesis: MLX constrained reasoning → BUY/PASS + corroborations/conflicts + `nextStep`.

**Phase 4 — Output**
10. Agent 6 PandaDoc: LOI + report templates, variable mapping, BUY-only signing flow.
11. Frontend: adapt to single-listing intake + live pipeline + thesis report.

**Phase 5 — Hardening / later**
12. Orchestrator resilience: ledger-backed sequential pipeline with partial-signal fallback (not silent skip).
13. XGBoost/LightGBM valuation model once MLS training data is sourced; comps becomes fallback.
