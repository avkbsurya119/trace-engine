# TRACE — Troubleshooting & Root-Cause Adaptive Context Engine

TRACE helps maintenance technicians fix recurring machine faults by remembering what was tried before on the same kind of problem, and whether it worked.

When a new incident is reported, TRACE recalls similar past work orders from **Hindsight** memory, separates what worked from what failed, scores the interventions deterministically, and only then asks an LLM to put the already-computed result into a readable sentence. When there is no relevant history, it says so and does not suggest an action.

## Table of Contents

- [Pipeline](#pipeline)
- [How Hindsight memory is used](#how-hindsight-memory-is-used)
- [Dataset](#dataset)
- [Hero machines](#hero-machines)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Frontend](#frontend)
- [Verification](#verification)
- [Demo](#demo-1-minute)
- [Limitations](#limitations)

## Pipeline

```
Report incident
  -> Hindsight recall (two passes: fleet of this machine type, and this machine itself)
  -> group recalled memory facts by document_id -> load exact work orders from SQLite
  -> relevance gate      (same defect type, or shared symptom with similarity >= 0.80)
  -> deterministic score (per intervention: successes + 0.5*partials - failures, same-machine weighted)
  -> confidence          (HIGH / MEDIUM / LOW / INSUFFICIENT_DATA from outcome counts)
  -> LLM phrasing        (Groq, wording only; falls back to rule-based text)
Record outcome -> SQLite update -> Hindsight memory replaced -> used by the next similar incident
```

| Concern | Where | Notes |
|---|---|---|
| Source of truth | SQLite (`backend/app/db`) | Every structured field, dashboard stats, machine timelines |
| Memory / retrieval | Hindsight (`backend/app/hindsight`) | One document per incident, `document_id = incident_id` |
| Decision | `backend/app/services/recommendation.py` | Pure Python, no LLM |
| Relevance gate | `backend/app/services/analysis.py` (`select_evidence`) | Deterministic |
| Wording | `backend/app/services/phrasing.py` | Facts-only prompt; rejected if it cites an ID not in the evidence |

Confidence rules: **HIGH** = ≥3 successes and ≥75% success rate (or ≥2 successes on this same machine with none failed there, ≥3 overall, ≥60%); **MEDIUM** = ≥2 successes and ≥50%; **LOW** = any other positive evidence; **INSUFFICIENT_DATA** = no evidence, or nothing has ever worked (no action is suggested).

## How Hindsight memory is used

**Retain.** Every incident becomes one Hindsight document (`MemoryService.build_narrative`) written as a short maintenance record rather than a field dump, for example:

> Maintenance record WO-2026-05416, 2026-06-26 (day shift). CNC-204, 5-axis vertical machining center on Machining Cell 2, 33,814 operating hours. Problem: spindle vibration. … Readings: spindle vibration 8.6 mm/s (normal 0.9-2.4) … Technician T-109 suspected spindle bearing degradation. Intervention (Spindle bearing replacement): Replaced front and rear spindle bearings … Outcome: SUCCESS. Confirmed cause: spindle bearing degradation. Technician notes: Recurring issue: second bearing failure in ~7.5 months …

Each document carries `document_id=<incident_id>`, the incident `timestamp`, metadata (outcome, intervention category), and tags `machine_type:<type>`, `machine:<id>`, `defect:<type>`. When an outcome is recorded, the document is re-retained with `update_mode="replace"`, so memory always reflects the latest known result.

**Recall.** `MemoryService.search_similar_incidents` builds a natural-language query from the new report and runs two `recall()` calls in parallel:

1. tags `[machine_type:<type>]` (`all_strict`): similar incidents across the fleet of this equipment type;
2. tags `[machine_type:<type>, machine:<id>]`: this machine's own history, so a recurring fault is never crowded out by look-alikes on other machines.

Only `world`/`experience` facts are requested because they carry `document_id`. Facts are grouped by document, the best semantic score becomes the incident's similarity, and the exact record is loaded from SQLite. The recalled fact text is shown in the UI under each evidence card ("Recalled from Hindsight memory"), so it is visible that the evidence came from memory rather than a table scan.

In practice recall ranks same-problem work orders at ~0.85–0.93 semantic similarity and unrelated ones at ~0.72–0.79. The relevance gate keeps the former, which is why a novel problem correctly produces no evidence even though recall always returns *something*.

## Dataset

The history is **synthetic but operationally realistic** — it is not data from a real plant. It is generated deterministically (fixed seed) by `backend/app/data/generator.py` from the fleet model in `backend/app/data/catalog.py`:

- **567 work orders**, 2 Jun 2025 – 17 Sep 2026 (~15.5 months), 8–20 per machine
- **5 equipment types, 39 machines with history** (+ AC-407, commissioned 2026-08 with none): CNC machining centers (8), hydraulic presses (7), screw air compressors (6+1), belt conveyors (10), injection molding machines (8)
- **Outcomes:** 47% SUCCESS, 19% PARTIAL, 22% FAILED, 9% UNKNOWN
- Fields: technician ID, operating hours (monotonic per machine), shift, product, sensor readings with normal ranges, suspected vs confirmed cause, intervention category + action text, repair time, downtime, severity, technician notes

How outcomes arise: each defect family has 2–3 possible root causes, each intervention only truly fixes some of them, technicians often suspect the wrong cause or try the cheap fix first, and failed/partial repairs create follow-up work orders days later. So the same intervention succeeds on one machine and fails on another (49 of 71 intervention types have both).

`python -m scripts.audit_data` checks for duplicate IDs, future timestamps, impossible sensor values, downtime shorter than repair time, machine/line mismatches, interventions invalid for the machine type, notes contradicting outcomes, and impossible operating-hour progressions.

## Hero machines

Three showcase machines have scripted chains in the history (`generator.STORIES`) and are listed in `catalog.HERO_MACHINES`:

| Machine | Problem | History on that machine |
|---|---|---|
| **CNC-204** | Spindle vibration | Alignment FAILED → bearing replacement SUCCESS → re-lubrication PARTIAL (7 months later) → bearing replacement SUCCESS |
| **HP-303** | Pressure loss | Relief valve adjustment PARTIAL → pump replacement FAILED → cylinder reseal SUCCESS; a year later reseal FAILED (different cause) → relief valve replacement SUCCESS |
| **CV-507** | Belt mistracking | Tracking adjustment PARTIAL (temporary) → idler replacement SUCCESS |

The dashboard's **See Memory Impact** modal (`BeforeAfterMemory.tsx`, `GET /api/dashboard/hero-machines`) runs each hero incident live through the same deterministic scorer twice — once with no evidence, once with Hindsight recall — and shows what trial and error actually cost that machine (attempts that didn't work and their downtime, from SQLite). Nothing in the modal is hardcoded and nothing is stored.

## Quick start

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # set HINDSIGHT_API_KEY and GROQ_API_KEY
python seed_data.py             # resets SQLite + the Hindsight bank, loads the history (~1 min)
uvicorn main:app --port 8000 --reload

# Frontend
cd frontend
npm install
cp .env.example .env.local
npm run dev                     # http://localhost:3000
```

`seed_data.py` deletes and recreates the Hindsight bank named in `HINDSIGHT_NAMESPACE` (default `trace-maintenance`). Use your own bank name if you share an account. `python seed_data.py --sqlite` loads SQLite only.

## Configuration

`backend/.env`:

```env
APP_NAME=TRACE
APP_ENV=development
DEBUG=false

# Hindsight (required)
HINDSIGHT_API_URL=https://api.hindsight.vectorize.io
HINDSIGHT_API_KEY=hsk_...
HINDSIGHT_NAMESPACE=trace-maintenance

# LLM phrasing (optional - without a key TRACE uses rule-based wording)
GROQ_API_KEY=gsk_...
LLM_MODEL=openai/gpt-oss-120b
# LLM_BASE_URL=https://api.groq.com/openai/v1
# LLM_TIMEOUT_SECONDS=20

DATABASE_URL=sqlite+aiosqlite:///./trace.db
CORS_ORIGINS=["http://localhost:3000"]
```

`frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

## API reference

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/incidents/analyze` | Recall → gate → score → phrase. Returns `current_incident`, `historical_incidents` (with `similarity_score`, `relevance_factors`, `recalled_facts`), `successful/failed/partial_interventions`, `recommendation` (`suggested_action`, `intervention_category`, `confidence`, `basis`, `evidence[]` tallies, `warnings`, `reasoning`, `reasoning_source`), `memory_contribution`, `memory_trace` |
| PATCH | `/api/incidents/{id}/outcome` | Record `action_taken`, `intervention_category`, `action_outcome`, root cause, repair time, downtime, notes; updates SQLite and replaces the Hindsight memory |
| GET | `/api/incidents/{id}` | One incident from SQLite |
| GET | `/api/incidents/machine/{machine_id}/memory` | Machine summary: outcome counts, downtime, recurring defects, what worked / failed, full `timeline` |
| GET | `/api/dashboard/stats` | Counts, outcome / defect / machine-type distributions, downtime, history range, memory bank |
| GET | `/api/dashboard/fleet` | Machine types, machines, defect types + symptoms, intervention categories, hero machine per type (drives the forms) |
| GET | `/api/dashboard/hero-machines` | Live with/without-memory comparison for the hero machines |
| GET | `/api/dashboard/health` | Health check |

Interactive docs: `http://localhost:8000/docs`.

## Frontend

- **Dashboard** — memory health banner, key metrics, outcome and problem distributions, fleet cards per machine type (open that type's hero machine), *See Memory Impact* modal.
- **Report Incident** — built from `/api/dashboard/fleet`: machine type → machine (line fills in) → problem (or a new, unlisted one) → that problem's symptoms.
- **Incident Analysis** — pipeline panel and memory moment, then the numbered flow: what happened · what TRACE remembered (grouped by outcome, each with the recalled memory text) · recommendation with computed basis and evidence tally · AI-written summary in a separate dashed box · where the evidence came from · record outcome.
- **Machine Memory** — outcome counts, recurring defects, what has / hasn't worked, intervention chart, full maintenance timeline.

## Verification

With the backend running:

```bash
cd backend
python -m scripts.validate_scenarios   # 6 scenarios, real recall + real LLM, cleans up after itself
python -m scripts.demo --runs 3        # before/after-memory demo, reset between runs
python -m scripts.audit_data --recommendations
```

| Scenario | Incident | Expected and observed |
|---|---|---|
| A strong history | CV-505 roller bearing noise | HIGH: idler replacement 7/7 successes, 4 on CV-505 |
| B conflicting | CNC-204 spindle vibration | LOW: bearing replacement 3 of 7 succeeded, 2 failed; CNC-204's own failed alignment shown |
| C sparse | AC-402 oil carryover | LOW: only 2 matches (1 success, 1 partial) |
| D no history | AC-407 condensate drain failure | INSUFFICIENT_DATA, no action suggested |
| E novel | CNC-203 chip conveyor jam | INSUFFICIENT_DATA; recall ran but nothing relevant |
| F recurring | CV-507 belt mistracking | Retrieves CV-507's earlier PARTIAL tracking adjustment and SUCCESS idler replacement |

## Demo (≈1 minute)

See [DEMO.md](DEMO.md) for the full script.

1. `python -m scripts.demo --reset` so AC-407 has no history.
2. Report Incident → Rotary screw air compressor → **AC-407** → Condensate drain failure → *water in compressed air line*, *auto drain not cycling* → **Insufficient evidence, no recommendation.**
3. Record outcome: *Condensate drain replacement*, SUCCESS, notes.
4. Report a similar incident on AC-407 → TRACE recalls incident 1 (tagged *this machine*), shows what was done and that it worked, recommends it with **LOW** confidence (one success), and the AI summary cites incident 1's ID.
5. Dashboard → **See Memory Impact** → CNC-204 / HP-303 / CV-507 with and without memory.

## Tech stack

Next.js 14 + TypeScript + Tailwind · FastAPI + SQLAlchemy (SQLite) · Hindsight (`hindsight-client`) · Groq `openai/gpt-oss-120b` via the OpenAI SDK

## Limitations

- Similarity is Hindsight's semantic score; thresholds (0.80 related-problem gate, 15 evidence items) were tuned on this synthetic fleet.
- Intervention categories for new reports come from the catalog list or free text; free-text categories only group with identical text.
- Live reports don't get a severity rating.
- The demo and validation scripts share AC-407 and reset it; `seed_data.py` rebuilds everything.

## License

MIT
