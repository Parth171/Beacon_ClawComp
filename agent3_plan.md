# ClawComp – Agent 3 Enhancement Plan

## Objective
Extend Agent 3 from image analysis into a property intelligence agent by adding:
1. LoRA fine-tuning on a wall damage dataset
2. NYC permit/violation lookup
3. Unified risk assessment combining visual and municipal signals

---

## Current State (keep intact)
```
Property Images → Qwen2.5-VL → Defect Analysis → Agent 3 Report
```

---

## Enhancement 1: LoRA Fine-Tuning

**Goal:** Improve Qwen2.5-VL's detection of wall damage defects (cracks, water intrusion, mold, moisture, facade issues, ceiling/structural damage).

**Dataset:** Existing wall damage dataset, converted to instruction format:
```
Instruction: Analyze this property image and identify any visible defects.
Output: Visible foundation crack on exterior wall. Estimated severity: Moderate. Recommend structural inspection.
```

**Training constraints:**
- QLoRA/LoRA only — do NOT modify base weights
- Target modules: `q_proj`, `k_proj`, `v_proj`, `o_proj`
- Keep adapters lightweight for local inference

**Deliverable:** `trained_lora/` containing `adapter_config.json` + `adapter_model.safetensors`

---

## Enhancement 2: NYC Municipal Lookup Tool

**Goal:** Retrieve NYC property records for any address.

**Source:** https://regwatch.nyc/

**Create:** `municipal_lookup_tool.py`

Input:
```json
{ "address": "127 Madsen Ave Staten Island NY" }
```

Output:
```json
{ "permits": [...], "violations": [...], "complaints": [...] }
```

**Extract and normalize:**
- **Permits:** type, issue date, status, description
- **Violations:** type, severity, status, date issued
- **Complaints:** type, date, status

---

## Enhancement 3: Municipal Risk Engine

**Create:** `municipal_risk_engine.py`

Input: permits, violations, complaints
Output:
```json
{ "municipal_risk_score": 0-100, "signals": [...] }
```

**Scoring logic:**

| Risk Level | Signals |
|---|---|
| High | Open DOB violations, stop-work orders, unsafe structure notices, repeated complaints |
| Medium | Multiple unresolved/expired permits |
| Low | Recent approved renovation permits, resolved violations |

---

## Enhancement 4: Unified Risk Assessment

**New pipeline:**
```
Image   → Qwen2.5-VL + LoRA → Visual Defects     ─┐
Address → Municipal Lookup  → Permits/Violations  ─┤→ Unified Risk Engine → Final Report
```

**Final report format:**
```
Visual Findings:    Roof wear, foundation crack
Municipal Findings: 2 open violations, no major renovation permits since 2016
Risk Score:         High Deferred Maintenance Risk (Confidence: 78%)
Recommended Action: Structural inspection recommended
```

---

