# Beacon — OpenClaw Architecture Specification

---

## Vision

Beacon is an autonomous real estate underwriting platform. The user provides a listing URL. OpenClaw coordinates a graph of specialized agents that evaluate valuation, structural risk, neighborhood trajectory, and appreciation potential. I want it do the user can either give a link, or the system finds it for the user. 

Every listing gets a full run. The recommendation is an output, not a gate. A PASS still produces a complete investment report — no LOI is generated, but the analysis is never withheld.

The core design principle: **evidence flows between agents**. Each agent doesn't just produce a score — it produces artifacts (flagged images, cited document chunks, detected signals) that downstream agents consume to calibrate their own confidence. A trajectory claim backed by an approved rezoning permit is weighted differently than one inferred from a single council minute. A repair risk corroborated by both a VLM flag and a low listing price compounds differently than either signal alone.

---

## Core Flow

```
Property URL
      ↓
Data Collection Agent
      ↓ canonical property schema + image set
      ├──────────────────────────────────────────┐──────────────────────────────────────────┐
      ↓                                          ↓                                          ↓
Valuation Engine                   Inspection Intelligence Engine         Trajectory Intelligence Engine
(price signal + distress)          (VLM photo analysis)                   (municipal RAG pipeline)
      ↓                                          ↓                                          ↓
      └──────────────────────────────────────────┴──────────────────────────────────────────┘
                                                 ↓
                                    Cross-Agent Evidence Synthesis
                                                 ↓
                                    Investment Thesis Agent
                                                 ↓
                              ┌──────────────────┴──────────────────┐
                              ↓                                      ↓
                           BUY → LOI + Full Report            PASS → Full Report only
```

Agents 2, 3, and 4 run in parallel after Agent 1. Their outputs — including raw evidence, not just scores — are passed together to the Investment Thesis Agent.

---

## OpenClaw (Orchestrator)

OpenClaw runs on ClawComp (M4 Mac) and coordinates the agent graph. It is not a chatbot loop.

**Responsibilities:**

- Parallel DAG execution of agents 2, 3, 4
- Typed schema passing between agents — no free-text handoffs
- SQLite ledger: every agent output persisted per property run
- Failure recovery: partial signal fallback, not silent skip
- Evidence aggregation before Agent 5

**ClawComp Hardware:**

| Layer | Tool |
| --- | --- |
| Text LLM | Llama 3 8B 4-bit via MLX |
| Vision LLM | Qwen2.5-VL-7B 4-bit via mlx-vlm |
| Embeddings | BGE-Small / Sentence Transformers (Neural Engine) |
| Vector DB | Qdrant (local) |
| Relational | SQLite |
| ML Models | XGBoost / LightGBM (CPU) |
| Constrained Decoding | outlines / llguidance |
| Document Output | PandaDoc API (only external call) |

No property data, listing content, or analysis leaves the machine except for the final PandaDoc document generation.

---

## Agent 1 — Data Collection

**Goal:** Convert a listing URL into a canonical property schema and image set passed to all downstream agents.

**Sources:** Realtor.ca, Zillow, MLS, MPAC / public property records

**Input:**

```json
{ "listingUrl": "https://www.realtor.ca/..." }
```

**Output:**

```json
{
  "address": "123 Main St, Toronto, ON M5V 2T6",
  "price": 820000,
  "bedrooms": 3,
  "bathrooms": 2,
  "sqft": 1450,
  "lotSize": 2200,
  "yearBuilt": 1987,
  "propertyType": "Semi-Detached",
  "description": "...",
  "images": ["img_01.jpg", "img_02.jpg", "img_03.jpg"],
  "daysOnMarket": 34,
  "priceHistory": [
    { "date": "2024-11-01", "price": 859000 },
    { "date": "2024-12-15", "price": 835000 },
    { "date": "2025-01-20", "price": 820000 }
  ]
}
```

`priceHistory` is a first-order distress signal — a listing that has dropped twice in 60 days before Agent 2 even runs. It is included in the canonical schema so all agents can reference it.

---

## Agent 2 — Valuation & Mispricing Engine

**Goal:** Determine whether the property is fairly priced, and why.

### Signal A — Historical Valuation

Model: XGBoost or LightGBM, trained on historical MLS sales.

Features: sale price (target), sqft, lot size, bedrooms, bathrooms, postal code, year built, property type.

Runs fully on ClawComp CPU. No cloud inference.

```json
{ "estimatedValue": 890000 }
```

### Signal B — Listing Context Analysis

Model: Llama 3 8B 4-bit via MLX. Constrained decoding via outlines enforces JSON output — no free-form responses accepted.

The model reads the listing description and price history from the canonical schema. Price history isn't just a number — the pattern of reductions (how many, how fast, how large) is fed as structured context, not just the current price.

Detected signals:

- `motivated seller`, `estate sale`, `cash only`, `as-is`, `handyman special`
- price reduction cadence (e.g. two cuts in 60 days = elevated urgency score)
- days on market relative to neighbourhood average

```json
{
  "sellerUrgency": 0.82,
  "distressSale": true,
  "priceReductionCount": 2,
  "priceReductionTotal": 39000,
  "daysOnMarket": 34,
  "urgencyModifier": -0.045
}
```

### Evidence Artifact (passed to Agent 5)

```json
{
  "agent": "valuation",
  "evidence": [
    {
      "type": "price_reduction",
      "detail": "Two reductions totalling $39K over 79 days",
      "weight": "high"
    },
    {
      "type": "context_signal",
      "detail": "Listing description contains 'motivated seller' and 'as-is'",
      "weight": "medium"
    }
  ]
}
```

### Combined Output

```json
{
  "askingPrice": 820000,
  "estimatedValue": 890000,
  "mispricing": 70000,
  "mispricingPct": 0.085,
  "sellerUrgency": 0.82,
  "distressSale": true,
  "evidence": [...]
}
```

---

## Agent 3 — Inspection Intelligence Engine

**Goal:** AI-powered structural and condition analysis from listing photos. Primary product differentiator.

### Model

Qwen2.5-VL-7B 4-bit via mlx-vlm. Runs locally on ClawComp M4 GPU. Every inference call uses constrained decoding (outlines / llguidance) — the model cannot return free-form text.

### Fine-Tuning

Apply LoRA only if sufficient labeled data exists (annotated inspection reports, defect datasets, repair records). Otherwise use base model with structured prompting. LoRA adapters are cheap to run on M4 — they don't require retraining base weights.

### What Gets Flagged

Each image in the listing is passed to the VLM individually. The model returns a per-image assessment against a fixed schema:

```json
{
  "imageIndex": 8,
  "roofRisk": 0.31,
  "waterRisk": 0.65,
  "foundationRisk": 0.12,
  "electricalRisk": 0.20,
  "renovationScore": 84,
  "flags": [
    {
      "issue": "possible water damage",
      "location": "kitchen ceiling",
      "reason": "visible staining near skylight joint",
      "confidence": 0.81
    }
  ]
}
```

### Cross-Agent Evidence Consumption

Agent 3 receives the `priceHistory` and `sellerUrgency` from Agent 2's output before finalising its risk scores. The logic: if the seller is highly motivated and has cut the price twice, unresolved inspection issues become more likely explanations for why the property isn't moving. The VLM's confidence threshold for flagging an issue is lowered slightly when `sellerUrgency > 0.7` — it would rather surface a marginal flag for human review than suppress it.

Conversely, if Agent 2 detected `distressSale: false` and strong listing language, the inspection model treats ambiguous visual signals more conservatively.

### Evidence Artifact (passed to Agent 5)

```json
{
  "agent": "inspection",
  "evidence": [
    {
      "type": "visual_flag",
      "issue": "water damage",
      "imageIndex": 8,
      "reason": "ceiling staining near skylight",
      "confidence": 0.81,
      "weight": "high"
    },
    {
      "type": "visual_flag",
      "issue": "aging roof",
      "imageIndex": 3,
      "reason": "curling shingles on exterior shot",
      "confidence": 0.67,
      "weight": "medium"
    }
  ]
}
```

### Agent Output

```json
{
  "repairRisk": 22,
  "renovationScore": 84,
  "estimatedRepairCost": 18000,
  "evidence": [...]
}
```

---

## Agent 4 — Trajectory Intelligence Engine

**Goal:** Determine future appreciation potential by reading the urban signals surrounding the property. The question this agent answers: *Is this neighbourhood going to be worth materially more in 5–10 years, and what specifically drives that?*

This agent does not summarise documents. It extracts structured, investment-relevant signals and annotates each one with its source, recency, and evidential weight.

### 4.1 — Data Sources

**Transit**

- Regional transit authority capital plans (LRT, BRT, subway extensions)
- Station area planning documents
- GTFS data (current frequency, coverage gaps)
- Key signal: confirmed transit stop within 800m, validated by coordinate distance from property

**Zoning & Development**

- Active rezoning applications (OP amendments, site-specific variances)
- Development permit applications and approvals
- Secondary plan documents that unlock density
- Key signal: neighbourhood upzoning from single-family to mid-rise or higher — one of the strongest price catalysts in urban markets

**Council & Planning Minutes**

- City council meeting minutes (ward-level)
- Planning committee decisions and deferrals
- Community consultation records
- Key signal: council posture — pro-development vs. NIMBY — predicts permit velocity and development risk

**Infrastructure**

- Municipal capital budgets: road, sewer, watermain renewal schedules
- Parks and greenspace expansion plans
- School board capital plans
- Key signal: infrastructure investment is a leading indicator of price growth, not a lagging one

**Economic Anchors**

- Major employer announcements (HQ relocations, campus expansions)
- Hospital, university, government facility expansions
- Industrial-to-mixed-use conversion
- Key signal: sustained employment density growth within commute range drives durable housing demand

### 4.2 — RAG Pipeline (ClawComp, fully local)

```
Documents (PDF, HTML)
      ↓
Chunking (512 tokens, 64 overlap)
      ↓
Embeddings: BGE-Small / Sentence Transformers (M4 Neural Engine)
      ↓
Qdrant (local) — indexed by postal FSA + document type + recency
      ↓
Structured queries (one per output field)
      ↓
Synthesis: Llama 3 8B 4-bit via MLX + outlines constrained decoding
      ↓
Structured signal output with source citations
```

### 4.3 — Structured Queries

The agent fires a defined set of queries — one per output field. Each response includes the source chunk, document, and a recency-adjusted evidential weight.

| Query | Output Field | Weight Logic |
| --- | --- | --- |
| Will transit access improve within 5 years? | `transitExpansion` | Approved capital plan > environmental assessment > council motion > staff report |
| Is rezoning approved or pending for this ward? | `rezoningActive` | Approved bylaw > approved OPA > application filed > staff recommendation |
| Are 100+ unit developments permitted nearby? | `majorDevelopment` | Permit issued > site plan approved > application filed |
| What is council's posture on development? | `councilSentiment` | Derived from voting record across last 8 relevant motions |
| Is infrastructure renewal scheduled? | `infraRenewal` | Approved capital budget line > draft budget > staff recommendation |
| Are major employers expanding within 5km? | `employmentGrowth` | Signed lease / construction started > announced > rumoured |

### 4.4 — Evidence-Weighted Scoring

Each signal is scored based on **what evidence was actually found**, not on a fixed rubric. The same signal can score differently depending on whether it's backed by an approved permit or a staff report from two years ago.

**Example — Transit Expansion:**

| Evidence Found | Score Contribution |
| --- | --- |
| Approved capital plan + construction started | 28–30 / 30 |
| Approved capital plan, construction pending | 22–27 / 30 |
| Environmental assessment complete | 15–21 / 30 |
| Council motion passed, no EA yet | 8–14 / 30 |
| Staff report only, no motion | 2–7 / 30 |
| No evidence found | 0 / 30 |

The same pattern applies to each signal. The synthesis model has access to the source chunks and is instructed to assign a contribution score based on evidential strength — not to interpolate a number from thin air.

### 4.5 — Cross-Agent Evidence Consumption

Agent 4 receives the inspection output before finalising its trajectory assessment. Specifically:

- High `repairRisk` + strong trajectory signals = the thesis agent needs to weigh near-term cost against long-horizon upside. Agent 4 surfaces this tension explicitly rather than ignoring it.
- If Agent 3 flagged foundation risk, Agent 4 checks whether infrastructure renewal data includes anything about the block (e.g. watermain replacement, which can cause foundation movement). A hit here elevates foundation risk confidence.
- Agent 4 also receives `daysOnMarket` from Agent 1 — a property sitting in a high-trajectory neighbourhood for 34 days warrants a note. It either means the market hasn't priced the signals yet (opportunity) or there's a property-specific issue suppressing demand (risk).

### 4.6 — Agent Output

```json
{
  "trajectoryScore": 89,
  "signals": {
    "transitExpansion": {
      "value": true,
      "detail": "Eglinton Crosstown extension: new stop at 680m, opening 2026",
      "evidenceStrength": "approved_capital_plan",
      "scoreContribution": 27
    },
    "rezoningActive": {
      "value": true,
      "detail": "Ward 14 upzoned to permit 6-storey as-of-right — bylaw approved 2024",
      "evidenceStrength": "approved_bylaw",
      "scoreContribution": 23
    },
    "majorDevelopment": {
      "value": true,
      "detail": "834-unit mixed-use tower at 200 Keele, 1.1km NE — site plan approved",
      "evidenceStrength": "site_plan_approved",
      "scoreContribution": 17
    },
    "councilSentiment": {
      "value": "positive",
      "detail": "6/8 recent development motions approved in Ward 14",
      "evidenceStrength": "voting_record",
      "scoreContribution": 12
    },
    "infraRenewal": {
      "value": false,
      "detail": "No scheduled renewal found for this block",
      "evidenceStrength": "no_evidence",
      "scoreContribution": 0
    },
    "employmentGrowth": {
      "value": true,
      "detail": "Hospital campus expansion: 1,200 roles, 2.3km west — construction started",
      "evidenceStrength": "construction_started",
      "scoreContribution": 10
    }
  },
  "evidenceChunks": [
    "metrolinx_capital_plan_2024_p14.pdf",
    "council_minutes_2024_03_12.pdf",
    "rezoning_ward14_bylaw_approval.pdf",
    "200keele_site_plan_approval.pdf"
  ],
  "tensions": [
    "Property has been on market 34 days in a high-trajectory ward — warrants note in thesis"
  ]
}
```

---

## Cross-Agent Evidence Synthesis

Before Agent 5 runs, OpenClaw assembles a unified evidence object. This is not a merge of scores — it is a structured pass of every artifact each agent produced, so the thesis agent can reason across them.

```json
{
  "property": { "...Agent 1 schema..." },
  "valuation": {
    "mispricing": 70000,
    "mispricingPct": 0.085,
    "sellerUrgency": 0.82,
    "evidence": [
      { "type": "price_reduction", "detail": "Two cuts totalling $39K over 79 days", "weight": "high" },
      { "type": "context_signal", "detail": "'motivated seller' + 'as-is' in listing", "weight": "medium" }
    ]
  },
  "inspection": {
    "repairRisk": 22,
    "renovationScore": 84,
    "estimatedRepairCost": 18000,
    "evidence": [
      { "type": "visual_flag", "issue": "water damage", "imageIndex": 8, "confidence": 0.81, "weight": "high" },
      { "type": "visual_flag", "issue": "aging roof", "imageIndex": 3, "confidence": 0.67, "weight": "medium" }
    ]
  },
  "trajectory": {
    "trajectoryScore": 89,
    "signals": { "...Agent 4 signals..." },
    "tensions": ["34 days on market in high-trajectory ward"]
  }
}
```

Agent 5 receives this full object. It is not summarised or compressed before handoff.

---

## Agent 5 — Investment Thesis Agent

**Goal:** Synthesise all agent outputs and evidence into a coherent investment thesis. This is where OpenClaw reasons — not scores.

### What the Agent Actually Does

Agent 5 does not apply a fixed formula. It uses Llama 3 8B 4-bit (MLX) with constrained decoding to reason across the full evidence object and produce a structured thesis. The model is instructed to:

1. **Surface corroboration** — where multiple agents point to the same conclusion through different signals. Example: seller urgency (Agent 2) + water damage (Agent 3) + 34 days on market (Agent 1) is a coherent cluster. The thesis names it.
2. **Surface conflicts** — where agents point in different directions. Example: trajectory score 89 but inspection flags foundation risk. The thesis doesn't average these — it names the tension and states what would need to be true for each scenario.
3. **Weight evidence by strength** — a trajectory signal backed by an approved bylaw carries more weight than one inferred from a staff report. A VLM flag with 0.81 confidence carries more weight than one at 0.51. The thesis reflects this.
4. **Make a recommendation with explicit reasoning** — not a score, but a stated position with the logic visible.

### Output

```json
{
  "recommendation": "BUY",
  "confidence": "high",
  "thesis": {
    "corroborations": [
      {
        "finding": "Seller is under pressure and the listing reflects it",
        "sources": [
          "Two price reductions totalling $39K over 79 days (Agent 1 / Agent 2)",
          "'motivated seller' + 'as-is' language in listing description (Agent 2)",
          "34 days on market in a ward with strong trajectory (Agent 1 / Agent 4 tension)"
        ]
      },
      {
        "finding": "Neighbourhood has strong, well-evidenced appreciation drivers",
        "sources": [
          "Eglinton Crosstown stop at 680m — approved capital plan (Agent 4)",
          "Ward 14 upzoned to 6-storey as-of-right — approved bylaw 2024 (Agent 4)",
          "834-unit development 1.1km NE — site plan approved (Agent 4)"
        ]
      }
    ],
    "conflicts": [
      {
        "tension": "Water damage flag vs. strong trajectory",
        "detail": "Agent 3 flagged probable water damage (confidence 0.81) in image 8. Estimated repair cost $18K. This does not undermine the trajectory thesis but must be priced into the offer or verified pre-offer. If the damage is contained to the kitchen ceiling, the math still works at asking. If it is structural, reassess.",
        "resolution": "Conditional offer with professional inspection clause recommended"
      },
      {
        "tension": "34 days on market in a high-demand ward",
        "detail": "A listing sitting 34 days in Ward 14 (council sentiment: positive, trajectory score 89) is anomalous. Three explanations: (1) the water damage is known locally and suppressing offers, (2) the initial ask at $859K was above market and buyers waited, (3) the listing has poor exposure. Explanation (2) is most consistent with the price reduction pattern.",
        "resolution": "Consistent with distress sale thesis. Not a red flag on the property itself."
      }
    ],
    "recommendation_basis": "Undervalued by $70K (8.5%) with a motivated seller. Trajectory backed by three high-strength signals (approved capital plan, approved bylaw, approved site plan). Repair risk manageable at estimated $18K. Conflicts are explainable and do not change the thesis.",
    "risks": [
      "Water damage extent unknown — professional inspection required before firm offer",
      "Aging roof flagged at 0.67 confidence — lower priority but should be assessed"
    ]
  },
  "recommendation": "BUY",
  "confidence": "high",
  "nextStep": "LOI"
}
```

**On a PASS:**

```json
{
  "recommendation": "PASS",
  "confidence": "medium",
  "thesis": {
    "corroborations": [...],
    "conflicts": [...],
    "recommendation_basis": "Trajectory score insufficient (51/100) — rezoning application filed but no approval, no transit expansion confirmed. Inspection flags foundation risk at 0.74 confidence with no comparable evidence to explain seller urgency. Risk profile is asymmetric against the buyer.",
    "risks": [...]
  },
  "nextStep": "report_only"
}
```

The full thesis is always generated. `nextStep` determines whether PandaDoc runs.

---

## Agent 6 — PandaDoc Automation Agent

**Trigger:** `nextStep === "LOI"` in Agent 5 output.

On `"report_only"`, the full investment report is generated but no LOI is created.

### Outputs

**On BUY:**

- Letter of Intent — pre-populated with offer price, conditions, property address
- Investment Report — full thesis with all agent reasoning and evidence citations
- Property Summary — 1-pager for broker handoff

**On PASS:**

- Investment Report only

### PandaDoc Variable Mapping

```json
{
  "[Property.Address]": "123 Main St, Toronto, ON M5V 2T6",
  "[Offer.Price]": "$820,000",
  "[Buyer.Name]": "...",
  "[Valuation.Mispricing]": "$70,000 (8.5%)",
  "[Trajectory.Score]": "89/100",
  "[Inspection.RepairRisk]": "22/100",
  "[Thesis.Summary]": "Undervalued by 8.5% with motivated seller. Trajectory backed by approved transit plan, approved rezoning bylaw, and approved major development. Repair risk manageable at ~$18K."
}
```

### Signing Workflow (BUY only)

```
Broker → Buyer
```

---

## ClawComp Stack — Full Reference

| Layer | Tool | Used By |
| --- | --- | --- |
| Orchestration | OpenClaw agent graph | All |
| Text LLM | Llama 3 8B 4-bit / MLX | Agents 2, 4, 5 |
| Vision LLM | Qwen2.5-VL-7B 4-bit / mlx-vlm | Agent 3 |
| Embeddings | BGE-Small / Sentence Transformers | Agent 4 |
| Vector DB | Qdrant (local) | Agent 4 |
| Relational | SQLite | OpenClaw state, all agents |
| ML Models | XGBoost / LightGBM | Agent 2 |
| Constrained Decoding | outlines / llguidance | Agents 2, 3, 4, 5 |
| Document Output | PandaDoc API | Agent 6 only |

All inference is local. PandaDoc is the only external network call.