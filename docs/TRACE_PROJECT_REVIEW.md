# TRACE — Technical Review Brief

> For an external reviewer (human or AI) who has **not** opened the repository.
> State described: `main` after the TRACE Intelligence, enterprise-polish and dark-glass redesign work (PRs #7–#10), deployed on Render.
> Secrets in `.env` are deliberately omitted.
> Purpose: architecture critique, judging feedback, UI suggestions and demo recommendations.
>
> **Live:** app https://trace-frontend-i5gp.onrender.com/ · API https://trace-api-60le.onrender.com (`/docs`, `/api/dashboard/health`)

---

# 1. Project Overview

**TRACE (Troubleshooting & Root-Cause Adaptive Context Engine)** is a troubleshooting assistant for maintenance teams in manufacturing plants. It works like this:

1. A technician reports a machine fault.
2. TRACE recalls how similar faults were handled before, both on this machine and on the rest of the fleet of the same equipment type.
3. It shows which interventions worked and which failed, and recommends the one with the best recorded track record.
4. It says how confident it is and why.
5. Once the technician records what they actually did, TRACE remembers that outcome for the next similar incident.

A read-only **TRACE Intelligence** page shows what the plant has learned over time.

**Problem.** In real plants, "what fixed this last time" lives in scattered CMMS work orders and in senior technicians' heads.

- Recurring faults get diagnosed from scratch again.
- Cheap but wrong fixes get repeated.
- Failed attempts are rarely surfaced when the symptom comes back.

Trial and error is the main source of wasted downtime.

**Users.**

- **Technicians** (primary): report a fault, get guidance, record the outcome.
- **Maintenance leads and reliability engineers:** review machine histories, recurring problems and reliable repairs.
- **Plant management:** the dashboard, the ROI view and the knowledge-growth view.

**Value.**

- Fewer repeated failed interventions.
- Institutional memory that survives staff turnover.
- Auditable recommendations, where every claim links to a work order.
- Honest behaviour on novel problems: no recommendation rather than a guess.

**Context.** TRACE was built for "AI Agents That Learn Using Hindsight" (HackwithHyderabad 3.0), which requires Hindsight (Vectorize's agent-memory service) as the memory layer.

- **Judging weights:** Innovation 30 %, Use of Hindsight Memory 25 %, Technical Implementation 20 %, User Experience 15 %, Real-world Impact 10 %.
- **Brief requirement:** a clear before/after-memory story within 60 seconds.
- **Source:** [problem statement](HackwithHyderabad%203.0%20Problem%20Statament.docx) in this folder. It lists an *Incident Response Agent* as a model idea, and TRACE applies it to manufacturing maintenance.

---

# 2. Architecture

```
┌──────────── Browser (Next.js 14, React 18, Tailwind, dark navy glass theme) ─────────────┐
│ landing.html (Three.js, iframe) → Sidebar (live health) · Dashboard · Report Incident ·   │
│ Incident Analysis · Machine Memory · TRACE Intelligence · Adaptive Intelligence & ROI     │
│ Before/After Memory modal            lib/api.ts (typed fetch client, GET cache)           │
└───────────────────────────────────────┬──────────────────────────────────────────────────┘
                                        │ JSON over HTTP (NEXT_PUBLIC_API_URL)
┌───────────────────────────────────────▼──────────────────────────────────────────────────┐
│ FastAPI (main.py) — CORS, JSON error handlers                                            │
│  routers: /api/incidents/*   /api/dashboard/*   /api/intelligence*                       │
│  AnalysisService ─┬─ MemoryService ─┬─ IncidentRepository (SQLite, async)                │
│                   │                 └─ HindsightClient (hindsight-client SDK)            │
│                   ├─ select_evidence (relevance gate + recency)                          │
│                   ├─ RecommendationEngine (deterministic, confidence checks, verdicts)   │
│                   └─ ReasoningPhraser (Groq via OpenAI SDK, validated)                   │
│  IntelligenceService (read-only: replay, knowledge per problem, Wilson ranking, cache)   │
│  data: catalog.py (fleet model, hero machines, demo presets) · generator.py              │
└──────────────┬──────────────────────────────┬──────────────────────────────┬────────────┘
               ▼                              ▼                              ▼
     SQLite (trace.db)              Hindsight Cloud bank              Groq (openai/gpt-oss-120b)
     exact records, source of truth  trace-manufacturing (Render)      wording only, optional
                                     trace-maintenance (local default)
```

**Responsibilities.**

- **Frontend:** presentation and input only. Every number comes from an API response, except the explicitly illustrative ROI simulator and learning scrubber (§4).
- **FastAPI:** runs the pipeline and makes every decision.
- **SQLite:** the truth for structured fields. Stats, timelines and Intelligence are computed only from SQLite.
- **Hindsight:** semantic memory. Recall results are mapped back to SQLite rows by `document_id`.
- **Groq:** optional. It rewrites a computed result and never chooses the action or confidence.

**Analyze lifecycle.**

1. `POST /api/incidents/analyze` arrives, and Pydantic validates it.
2. **Recall first**, so the new incident can't match itself. Two parallel recalls run: the fleet of the type and this machine. Facts are grouped by `document_id`, rows are loaded from SQLite, and incidents without an outcome are dropped.
3. The **relevance gate** runs, followed by recency annotation.
4. **Store:** the SQLite insert happens, then the Hindsight retain. If the retain fails, the row is deleted and the API returns 503.
5. **Score:** recommendation, confidence, `confidence_checks`, per-intervention verdicts, warnings, pattern and cross-machine insights.
6. **Phrase** with Groq, validate, and fall back to deterministic text if needed.
7. Return `AnalysisResult`.

`PATCH /outcome` updates SQLite, then re-retains the document with `update_mode="replace"`. If that write fails, the SQLite change is rolled back.

**Deployment.** Render blueprint `render.yaml` (free plan, Oregon):

- `trace-api` (Python 3.11) runs `bash start.sh`, which creates the tables, seeds if the DB is empty, then starts uvicorn.
- `trace-frontend` (Node 20) runs `npm run build` then `npm start`.
- Keys are Render secrets.
- The filesystem is ephemeral, so a redeploy reseeds SQLite and recreates the Hindsight bank.

---

# 3. Folder Structure

| Path | Purpose |
|---|---|
| `README.md` · `DEMO.md` · `docs/` | Project docs, demo script, this brief, hackathon statement and content guide (.docx) |
| `render.yaml` | Render blueprint for both services |
| `backend/main.py` · `start.sh` | FastAPI app (CORS, handlers, routers, startup DB init); deploy start script |
| `backend/app/api/` | `incidents.py`, `dashboard.py` (stats, fleet, hero-machines, health), `intelligence.py` |
| `backend/app/core/` | `config.py` (pydantic-settings), `errors.py` (`MemoryUnavailableError`, readable SDK error text) |
| `backend/app/models/` | Pydantic schemas (`incident.py`) |
| `backend/app/db/` | Async SQLAlchemy engine, ORM table, repository |
| `backend/app/hindsight/` | `client.py` (SDK wrapper), `memory.py` (narratives, tags, retain/recall, rollback, stats) |
| `backend/app/services/` | `analysis.py` (pipeline, gate, insights, machine memory, hero dry run), `recommendation.py`, `phrasing.py`, `intelligence.py` |
| `backend/app/data/` | `catalog.py` (fleet, defects → causes → interventions, technicians, hero machines, demo presets), `generator.py` |
| `backend/seed_data.py` · `scripts/` | Rebuild SQLite + bank; `validate_scenarios.py`, `demo.py`, `audit_data.py`, `scenarios.py` |
| `backend/tests/` | 73 offline tests + 4 live; `fakes.py` (Hindsight fake), `ts_contract.py` (TS interface reader) |
| `frontend/public/` | `landing.html` / `ascend.html` (Three.js landing), `icon.svg` |
| `frontend/src/app/` | `layout.tsx`, `page.tsx` (view switching, `?view=`/`?machine=` deep links, landing iframe), `globals.css` |
| `frontend/src/components/` | Screens (`Dashboard`, `ReportIncident`, `IncidentAnalysis`, `MachineMemory`, `SliderDashboard`, `BeforeAfterMemory`, `Sidebar`), `ui.tsx` primitives, `analysis/*`, `intelligence/*` |
| `frontend/src/lib/` · `types/` | `api.ts` (typed client, cache), `utils.ts`; `incident.ts` (TS mirror of the API) |

---

# 4. Frontend

**Stack.** Next.js 14 (App Router, client components), React 18, TypeScript, Tailwind, lucide-react and Three.js (landing page only). It uses no component library, no state library and no route-based pages.

**Navigation.**

- `page.tsx` keeps `currentView` (`landing | dashboard | report | analysis | memory | intelligence | sliders`) and starts on `landing`, which is a full-screen iframe of `landing.html`.
- The landing page navigates the app through links (`/?view=…&machine=…`) and `postMessage({action:"navigate", view})`.
- `?view=`/`?machine=` are read on load and on `popstate`.
- Each view is re-mounted with a `key`, then scrolls to the top and focuses its `h1`.
- The **sidebar** lists Dashboard, Report Incident, Machine Memory and TRACE Intelligence, each with the question it answers. It polls `/health` every 30 s and shows Hindsight bank, SQLite count and LLM status lights, with the failure reason on hover.

**Data.** Each screen fetches on mount. `lib/api.ts` handles errors ("Cannot reach the TRACE backend at …", flattened 422s, readable 503s) and caches GETs per session (Intelligence, fleet).

**Screens.**

- **Landing:** a 3D planet scene titled "Troubleshoot Smarter, Not Harder", with entry links to the dashboard, report form, showcase machines, sliders and API docs.
- **Dashboard:**
  - Stat tiles: work orders, machines, share of repairs that worked (SUCCESS ÷ recorded outcomes, the same basis as the bars), downtime.
  - Outcome bars and the most frequent problems.
  - Fleet cards per equipment type, which open that type's showcase machine.
  - A subtitle giving the provenance (synthetic data) and the memory bank.
- **Report Incident:**
  - Catalog-driven form (type → machine → problem or free text → symptom chips → description, suspected cause, hours, technician).
  - A *Load a demo incident* picker (backend presets).
  - While the request runs, `AnalysisProgress` names each stage.
- **Incident Analysis:**
  - `DecisionSummary`: the action, or *recommendation intentionally withheld* with what was searched. Its `ConfidenceMeter` shows "N of M recorded attempts worked".
  - `DecisionPipeline`: interactive recall → gate → score → phrase, with the tag filters and counts.
  - `WhyPanel`: the confidence checklist, a verdict for each alternative, and the AI summary in a separate labelled box.
  - `EvidenceList`: evidence grouped Worked / Failed / Partial / Not verified, with recency labels and the raw recalled Hindsight text.
  - `OutcomeForm`: records the outcome and shows *memory grew*.
- **Machine Memory:** a picker, then stats, recurring problems, what has and hasn't worked, and a full timeline with problem filters and repair-chain markers (*follow-up*, *came back after a fix*).
- **TRACE Intelligence:** see §9.
- **Before/After Memory modal** (opened from Intelligence): three showcase machines, each with the live *without* vs *with* memory recommendation, the machine's history and the trial-and-error cost. Nothing is stored.
- **Adaptive Intelligence & ROI** (`?view=sliders`, from the landing page):
  1. A split slider over live `/hero-machines` data.
  2. An **ROI simulator** driven by adjustable assumptions (fleet 39, $1,850/h downtime, 14.5 incidents/yr, 47 % baseline fix rate, 85 % adoption, 45 min saved).
  3. A **learning scrubber** that auto-plays 16 months. Its cards come from formulas of the month position (e.g. `38 + √(month/16)·44` %), so it is an **illustration, not data**. The measured timeline is Intelligence → Knowledge evolution.

**UI principles.**

- Facts and AI text are visually distinct.
- There is never a recommendation without evidence.
- Forms come from the backend catalog.
- The data is labelled synthetic.
- Shared primitives in `ui.tsx` (PageHeader, StatTile, Loading/Empty/ErrorState, ConfidenceMeter, CARD/BUTTON classes) keep screens consistent.
- Motion respects `prefers-reduced-motion`.
- Accessibility: skip link, one `h1` per view, `aria-current`, labelled controls and text alternatives for charts.

**Redesign note.** PR #10 replaced the light "industrial" theme with a dark navy glass theme, and added the landing page and ROI view.

---

# 5. Backend

**App.** `main.py` sets up CORS (`CORS_ORIGINS`), the `/api` routers, table creation on startup (`on_event`), and two handlers: `MemoryUnavailableError` → 503 with a readable reason, and anything else → 500 JSON.

**Routers.**

- **incidents:** analyze, get (404), outcome (404/422/503), machine memory.
- **dashboard:** stats (including monthly memory growth), fleet (catalog, `hero_machine_id`, `demo_presets`, `demo_outcome`), hero-machines (dry run), health (30 s cache, 8 s Hindsight timeout, last real memory error).
- **intelligence:** the full report (cached by data fingerprint) and `problem` (engine over all outcomes for one type/problem, optionally machine-weighted).

**Services.**

- **`AnalysisService`:** analyze, machine memory, memory-impact dry run, and the insights (recency band, pattern alert, cross-machine evidence).
- **`MemoryService`:** narratives, tags, retain (single/batch), two-pass recall mapped to SQLite, replace-on-outcome, deletes for resets, stats.
- **`RecommendationEngine`:** pure scoring plus `confidence_checks` and verdicts.
- **`ReasoningPhraser`:** the LLM call and its guards.
- **`IntelligenceService`:** chronological replay and analytics.

**Design.** Decision logic lives only in `recommendation.py` and `select_evidence`, and Intelligence reuses the engine unchanged. There is no FastAPI `Depends` injection: routes construct services and close them in a `finally` block, and tests monkeypatch `HindsightClient`.

---

# 6. Database

SQLite through async SQLAlchemy 2 (`aiosqlite`), in the file `backend/trace.db` (git-ignored). It has one table, **`incidents`**, and no relationships; machines, technicians and the fleet model live in `catalog.py`.

| Column(s) | Notes |
|---|---|
| `incident_id` (PK) | `WO-YYYY-NNNNN` generated; `INC-YYYYMMDD-XXXXXX` live |
| `machine_id`, `machine_type`, `production_line`, `defect_type`, `intervention_category`, `action_outcome` | Indexed strings; outcome SUCCESS/PARTIAL/FAILED/UNKNOWN/NULL (open) |
| `timestamp`, `created_at` | Naive UTC |
| `symptoms`, `sensor_values`, `operating_conditions` | JSON |
| `description`, `suspected_root_cause`, `confirmed_root_cause`, `action_taken`, `resolution_details`, `technician_notes` | Text |
| `resolution_time_minutes`, `downtime_minutes`, `operating_hours` | Integers; downtime ≥ repair; hours monotonic per machine |
| `severity`, `technician_id` | Generated history only / e.g. T-117 |

**Example chain.**

1. `WO-2025-04551`: CNC-204 spindle vibration of 7.5 mm/s. Laser alignment → **FAILED** ("suspect bearing degradation rather than alignment").
2. Three days later, `WO-2025-04558`: bearing replacement → **SUCCESS**.

**Contents.** 567 generated work orders, plus any live demo incidents. The deployed instance showed 569 at the time of writing.

**Synthetic data, real-data ready.** The data is synthetic because real plant maintenance records aren't publicly shareable, but the system is fully data-driven.

- Nothing in the gate, engine or Intelligence service hardcodes machines, problems or outcomes; every result is computed at request time from the stored work orders.
- A real CMMS export mapped to this schema loads through the same `retain_many` path `seed_data.py` uses.
- New equipment types or problems are a `catalog.py` entry, and free-text problems and interventions already work.
- The generator deliberately models real-world messiness (competing causes, wrong first guesses, follow-ups, unverified outcomes), so the behaviours real data needs are already exercised and tested.

---

# 7. Hindsight Integration

All calls go through `hindsight/client.py` (SDK wrapper) and `hindsight/memory.py`.

**Bank.** There is one bank per deployment, set by `HINDSIGHT_NAMESPACE`: `trace-manufacturing` on Render and `trace-maintenance` by default locally. `seed_data.py` creates it with a mission text. Equipment types are isolated with **tags** rather than separate banks.

**Retain.**

1. **Seeding:** `retain_batch` in batches of 25, 4 concurrent, with retries. About 567 documents take roughly a minute.
2. **Analyze:** the new incident is retained with its outcome "not yet recorded".
3. **Outcome:** re-retained with `update_mode="replace"`.

**Content.** A technician-style narrative (`build_narrative`) containing:

- the ID, date and shift
- the machine, model, line and hours
- the problem, description and symptoms
- **abnormal readings only, each with its normal range**
- the product and the suspected cause
- the intervention and action
- the outcome, confirmed cause and notes
- downtime and severity

Hindsight extracts the facts and embeds them server-side.

**Metadata.** `document_id` = `incident_id`, and `timestamp` = incident time. Metadata holds the IDs, type, defect, outcome and category. Tags are `machine_type:*`, `machine:*` and `defect:*`.

**Recall** (`search_similar_incidents`). A natural-language query ("… What was done before and did it work?") runs twice in parallel with `tags_match="all_strict"`:

- **Fleet:** `[machine_type]`, `max_tokens=6000`
- **Same machine:** `[machine_type, machine]`, `max_tokens=3000`. This pass fixed a real bug: a machine's own history was being crowded out.

Only `world`/`experience` facts are requested, because they carry `document_id`; observations are excluded. Facts are grouped per document, and the best `semantic` score becomes the similarity. Rows are loaded from SQLite, and the top two fact texts are shown as `recalled_facts`. A `memory_trace` records the bank, filters, query and counts.

**Observed scores.** Same-problem work orders score about 0.85–0.93 and unrelated ones about 0.72–0.79. A novel problem still recalls 60–75 work orders, and the gate rejects all of them.

**Why Hindsight.**

- It matches free text by meaning ("chatter marks" vs "waviness").
- It ranks the most similar contexts among 100+ same-type work orders.
- Temporal and entity awareness come built in.
- SQLite stays the authority for *what happened*.

**Errors.** `describe_memory_error` turns SDK exceptions (e.g. exhausted credits, auth, timeouts) into readable messages. These appear in 503 responses and in `/health` (`last_error`).

**Caveat.** For catalogued problems the gate keeps same-`defect_type` matches regardless of similarity. Hindsight retrieves, ranks, recalls same-machine history and discovers related problems, but it does not decide relevance on its own. `reflect()`, mental models, directives and observations are not used. Deletion relies on the SDK's private `_documents_api`.

---

# 8. Recommendation Engine

`services/recommendation.py` is pure Python with no network and no LLM.

**Gate** (`analysis.py::select_evidence`). An incident is kept if it has the same `defect_type`, **or** it shares a symptom and has similarity ≥ 0.80. This machine's incidents come first, then the rest ordered by similarity × recency, with a cap of **15**.

**Tally.** Incidents are grouped by `intervention_category` (falling back to the action text). For each group the engine counts SUCCESS, PARTIAL, FAILED and UNKNOWN with their IDs, plus same-machine successes and failures. The most recent successful action becomes the `example_action`.

**Score.** `successes + 0.5·partials − failures ± 0.5` per same-machine success/failure. UNKNOWN outcomes score 0 and are not attempts. Groups are sorted by `(score, successes, −failures)`, and the winner is the first with ≥ 1 success and a score above 0.

**Confidence** (attempts = successes + partials + failures):

| Level | Rule |
|---|---|
| HIGH | ≥ 3 successes and ≥ 75 %; or ≥ 2 same-machine successes, none failed there, ≥ 3 overall and ≥ 60 % |
| MEDIUM | ≥ 2 successes and ≥ 50 % |
| LOW | Any other positive evidence |
| INSUFFICIENT_DATA | No evidence, or nothing ever succeeded → `"No evidence-backed recommendation"`, no category |
| Downgrade | One level down if the winner failed on this machine and never worked there (with a warning) |

**Explainability outputs.**

- `confidence_checks[]`: each rule with *met / not met* and its numbers.
- Per intervention: `attempts`, `success_rate`, `verdict` (`selected` or `rejected`) and a `verdict_reason` ("Never worked: failed 2 of 2 attempt(s)", "Lower score (1 vs 2)").
- `basis`: a sentence such as "7 of 7 recorded attempts with Relief valve replacement on similar incidents succeeded (1 on HP-303)".
- Warnings about the winner's own failures, other failed fixes, and no history on this machine.

**Insights.**

- A recency label for each item (recent < 2 mo, older < 8 mo, historical).
- `pattern_alert`: how often the problem recurs in the evidence.
- `cross_machine_evidence`: fixes that worked on ≥ 2 other machines.

**Not handled.**

- Recency and similarity don't weight the score (recency only affects ordering).
- Sensor readings and the suspected cause are unused.
- There is no statistical interval in the live engine (Intelligence uses Wilson for ranking).

---

# 9. TRACE Intelligence

`services/intelligence.py` → `GET /api/intelligence`. It is read-only and uses SQLite and the unchanged engine; there is no LLM. The report takes about 100 ms to compute and is cached by a data fingerprint (count + latest update).

It rests on two computations:

- **Knowledge per problem:** the engine over every recorded outcome for each (type, problem).
- **Chronological replay:** for each work order, what memory held *before* it, and whether the action taken matched what the engine would have recommended then. Real recalls aren't logged, and the page says so.

| Section | Content (current data) |
|---|---|
| Overview | Coverage: 24 of 25 known problems have a proven fix; confidence mix; knowledge age |
| Memory impact | Followed memory: **58 %** worked (185 attempts, median 3.1 h downtime) vs a different action: **48 %** (269, 3.8 h); no memory yet: 73 % (n = 26, flagged small/first-occurrence) |
| Knowledge evolution | Monthly: problems answerable 11 → 24, HIGH-confidence problems 0 → 8, share of new work orders with prior memory 57 % → 100 % |
| Knowledge changes | Latest confidence changes, upgrades and downgrades |
| Memory reuse | Same-machine vs fleet-only prior evidence; most-recommended repairs; most-cited work orders |
| Recommendation trust | `GET /intelligence/problem` for any problem: same meter, checklist and verdicts as the analysis page |
| Reliable repairs | 95 % Wilson lower bound, ≥ 5 attempts; least reliable too |
| Failure patterns | Top problems with trend; recurring per machine; per type |
| Machine ranking | By problems with a fix proven on that machine; expandable |
| Knowledge network | Machines → problems → repairs → outcomes (lazy, with text alternative) |

---

# 10. Groq Integration

`services/phrasing.py` uses the OpenAI SDK against `https://api.groq.com/openai/v1`, with model `openai/gpt-oss-120b`, temperature 0.2, 1024 tokens, a 20 s timeout and 1 retry. It is skipped if there is no key.

**Prompt.** "Use ONLY the facts given; don't add causes, actions, numbers, IDs or safety advice; don't change the action or confidence; cite exact IDs; if there is no recommendation, say so; 2–4 sentences."

**What is sent.**

- The incident (machine, type, problem, symptoms).
- The fixed decision block.
- Per-intervention tallies with IDs.
- This machine's last 4 evidence outcomes.
- The warnings.
- The deterministic text, marked "rephrase, don't extend".

**What is not sent:** notes, readings, raw descriptions, Hindsight text, technician IDs or secrets.

**Guards.**

- Only `reasoning` is replaced (`model_copy`), so the decision cannot change.
- `<think>` blocks are stripped.
- The reply is rejected if the call errors, the reply is empty, it cites any unknown `WO-/INC-/TRC-` ID, or (with no evidence) it doesn't admit that.
- `reasoning_source` is shown in the UI.

**Residual risk.** Invented numbers or causes that don't include an ID pass the validator. The UI mitigates this by labelling the text as AI wording.

---

# 11. User Journey

1. The technician enters from the landing page and opens **Report Incident**. They choose type → machine → problem → symptoms, write a description, and click Analyze.
2. The backend runs the two recalls, maps results to SQLite, gates and orders them, stores the new incident (rolling back on a memory failure), scores it and phrases the result. The progress panel shows these stages, which take about 5–8 s with real services.
3. The analysis page shows the decision or the withheld state, the pipeline, the reasons (checks, verdicts, AI box) and the evidence with recalled memory text.
4. The technician records the outcome. SQLite is updated and the Hindsight document replaced, and the page confirms *memory grew*.
5. The next similar incident recalls this outcome (same-machine or fleet pass), and the engine counts it. Machine Memory and Intelligence reflect it immediately; the Intelligence cache is invalidated by the data fingerprint.

---

# 12. APIs

All paths are under `/api`. Errors are JSON `{"detail": …}`: 404, 422 (field errors), 503 (memory unavailable, nothing saved) or 500. Swagger is at `/docs`.

| Method | Path | Returns |
|---|---|---|
| POST | `/incidents/analyze` | `AnalysisResult`: current incident, historical incidents (similarity, relevance factors, recalled facts, recency), successful/failed/partial interventions, recommendation (action, category, confidence, basis, `confidence_checks`, evidence with verdicts, warnings, reasoning, source, supporting IDs), `pattern_alert`, `cross_machine_evidence`, `memory_contribution`, `memory_trace` |
| GET | `/incidents/{id}` | `Incident` or 404 |
| PATCH | `/incidents/{id}/outcome` | Updated `Incident`; 404/422/503 |
| GET | `/incidents/machine/{id}/memory` | Summary, outcome distribution, recurring defects, what worked/failed, full timeline |
| GET | `/dashboard/stats` | Totals, distributions, downtime, history range, memory bank, monthly memory growth |
| GET | `/dashboard/fleet` | Catalog for forms, `hero_machine_id`, `demo_presets`, `demo_outcome` |
| GET | `/dashboard/hero-machines` | Without vs with memory for 3 machines, trial-and-error cost, history (dry run) |
| GET | `/dashboard/health` | `healthy/degraded`; sqlite, hindsight (bank, last error), llm |
| GET | `/intelligence` | Full Intelligence report |
| GET | `/intelligence/problem` | Engine result for one `machine_type` + `defect_type` (optional `machine_id`) |

The dashboard and intelligence endpoints return untyped dicts in OpenAPI. The contract is instead enforced by a test against `frontend/src/types/incident.ts`.

---

# 13. Demo Flow

The full script is in `DEMO.md`. In short:

1. Landing page → Dashboard.
2. Intelligence → **With vs without memory**:
   - CNC-204 → bearings, LOW (3 of 7)
   - HP-303 → relief valve, HIGH (7 of 7; trial and error cost 3 attempts and about 75 h)
   - CV-507 → idler, HIGH
3. **AC-407 condensate drain failure** (preset *Demo 1*): about 67 compressor work orders are recalled and none is relevant, so the recommendation is withheld.
4. Record *Condensate drain replacement*, SUCCESS.
5. Repeat (*Demo 2*): 1 related work order on AC-407 → recommendation at LOW (1 of 1), and the AI cites the Scene 3 ID.
6. Machine Memory CNC-204 shows the chain.
7. Intelligence: the replay (58 % vs 48 %) and the evolution (11 → 24).
8. Optional: the ROI view, presented as assumptions and illustration.

**Resetting.** Locally, `python -m scripts.demo --reset` clears AC-407 (`--runs 3` rehearses from the CLI). On Render, the AC-407 state persists until a redeploy.

---

# 14. Machine vs Fleet History

| | Machine history | Fleet history |
|---|---|---|
| Source | SQLite only | Hindsight recall → SQLite rows |
| Scope | One machine, all problems | One type, relevant problems |
| Order | Chronological | This machine first, then similarity × recency |
| Used for | Timeline, chains, trial-and-error cost | Evidence and scoring |
| Completeness | Exhaustive | Top-ranked, capped at 15 |

In analysis, the same-machine pass, same-machine-first ordering, ±0.5 weighting, the same-machine HIGH rule and the downgrade combine the two. The UI tags such evidence *this machine*.

---

# 15. Testing

**Offline** (`pytest`, **73 tests**, about 2 s). The tests use a temp SQLite file, no Groq key and `FakeHindsightClient`, which honours tag filters, scores by token overlap and can simulate failures.

| File | # | Covers |
|---|---|---|
| `test_recommendation.py` | 16 | No evidence, only failures, thresholds, same-machine rule, downgrade, winner by score, partial/unknown, checks, verdict for every alternative |
| `test_api.py` | 16 | Contract checker, health, stats/fleet vs TS types, full memory loop, recurring incident, hero machines, 404/422, readable 503 + nothing saved, growth, presets, CORS |
| `test_dataset.py` | 9 | Determinism, size, IDs, timestamps, consistency, hours, mixed outcomes, plausible causes, hero chains, demo problem has no history |
| `test_memory.py` | 8 | Narrative, tags, grouping/isolation, rollback on create and update, defaults, delete |
| `test_intelligence.py` | 8 | Wilson ranking, replay, confidence changes, reuse, trust view, cache invalidation, contract |
| `test_phrasing.py` | 7 | Every LLM fallback; LLM cannot change the decision |
| `test_evidence_gate.py` | 5 | Same defect, related-defect rule, ordering, cap, recency with naive timestamps |
| `test_insights.py` | 4 | Recency bands, pattern alert, cross-machine evidence |

**Other checks.**

- **Contract:** `tests/ts_contract.py` parses the TS interfaces (including `extends` and nested types) and validates live responses against them.
- **Live** (`TRACE_LIVE=1 pytest -m live`, 4 tests): health, all scenarios, the demo twice from reset, and the data audit, against real Hindsight and Groq.
- **Scenarios** (`validate_scenarios.py`):

  | Scenario | Result |
  |---|---|
  | A: CV-505 strong | HIGH 7/7 |
  | B: CNC-204 conflicting | LOW 3/7 |
  | C: AC-402 sparse | LOW |
  | D: AC-407 no history | INSUFFICIENT |
  | E: novel custom problem | INSUFFICIENT; recall ran |
  | F: CV-507 recurring | Its own history is retrieved |

- **Data audit:** `audit_data.py` checks integrity, bounds and consistency. `--recommendations` scores every (type, problem) pair.
- **Frontend:** `npm run typecheck` and `npm run build`. There are no component or E2E tests and no ESLint config. CI is not configured.

---

# 16. Technical Decisions

1. **SQLite is truth, Hindsight is retrieval**, joined by `document_id = incident_id`.
2. **Deterministic decisions; the LLM only words them.** This makes decisions testable, and the LLM is optional.
3. **Recall before storing** the new incident.
4. **Two parallel recall passes** (fleet + same machine).
5. **Tags instead of a bank per type** (`all_strict`).
6. **Only `world`/`experience` facts** (they carry document IDs).
7. **Narrative memories** that include only abnormal readings, each with its range.
8. **A relevance gate**, because recall always returns something.
9. **Grouping by intervention category**, not action text.
10. **Same-machine weighting and downgrade.**
11. **No recommendation without evidence** (the hardcoded defaults were removed).
12. **LLM validation** with a deterministic fallback.
13. **Synthetic but modelled data** (cause → fix → outcome, technician behaviour, follow-ups), with a fixed seed.
14. **Scripted hero chains** merged into the emergent history.
15. **A live, computed before/after comparison** instead of a hardcoded one.
16. **Rollback on memory-write failure**, with readable 503s.
17. **A real health endpoint** that drives the UI status lights.
18. **A contract test** built from the TS types.
19. **Catalog-driven forms and demo presets** served by the backend.
20. **Explainability computed in the engine** (checks, verdicts) and rendered as-is by the UI.
21. **Intelligence reuses the engine unchanged**: replay rather than invented logs, Wilson ranking, and a fingerprint cache.
22. **Single-page view switching with URL deep links** (`?view=`) instead of Next.js routes, which keeps the iframe landing page simple.

---

# 17. Strengths

- **Memory is central and visible.** Recall drives the evidence, and the UI shows the recalled text, the pipeline, a live before/after comparison and the knowledge growth over time.
- **Auditable decisions.** Every recommendation is a function of counted outcomes with IDs, plus checks and verdicts.
- **Honesty.** No evidence means no recommendation. Failures are evidence, same-machine failures downgrade confidence, and the illustrative views are labelled.
- **Hallucination containment.** The LLM only rewords; there is hard validation with a fallback, and the AI text is labelled.
- **A measured learning story.** The chronological replay shows repairs that followed memory worked more often (58 % vs 48 %) with less downtime, computed rather than claimed.
- **Realistic, reproducible data** from a causal model with a fixed seed.
- **Consistency between the two stores**, with readable failure reasons.
- **Verification depth.** 73 offline tests, a TS contract test, live tests, six scenarios, a data audit and a resettable demo.
- **Polished, deployed product.** A 3D landing page, a consistent dark glass UI and accessibility basics, publicly deployed on Render.

---

# 18. Files Worth Reading

1. `README.md`: the overview, pipeline, API and testing.
2. `backend/app/services/analysis.py`: the whole pipeline, the gate and the insights.
3. `backend/app/hindsight/memory.py`: how Hindsight is used.
4. `backend/app/services/recommendation.py`: the decision rules, checks and verdicts.
5. `backend/app/services/intelligence.py`: the replay and analytics.
6. `backend/app/services/phrasing.py`: the prompt and its guards.
7. `backend/app/data/generator.py` and `catalog.py`: the data model and hero stories.
8. `frontend/src/components/IncidentAnalysis.tsx` and `analysis/*`: the main screen.
9. `frontend/src/components/intelligence/*` and `BeforeAfterMemory.tsx`: the learning story.
10. `frontend/src/app/page.tsx`, `public/landing.html` and `SliderDashboard.tsx`: the redesign.
11. `backend/tests/test_api.py` and `tests/ts_contract.py`: end-to-end tests and the contract.
12. `DEMO.md`, `render.yaml` and `backend/start.sh`: the demo and deployment.

---

# 19. Summary

TRACE starts from the idea that a plant's most valuable troubleshooting knowledge is its own history: what was tried, on which machine, and whether it worked. It turns that history into memory that is queried whenever a fault is reported and updated whenever an outcome is recorded.

**Architecture.** A Next.js frontend (3D landing page, dashboard, report and analysis flow, machine memory, TRACE Intelligence and an ROI view) talks to a FastAPI backend that owns all the logic. SQLite holds exact work orders. Hindsight holds each one as a natural-language memory and answers "which past incidents are like this one?". Groq only rewords computed results.

**Analysis.** TRACE recalls from Hindsight before storing the new incident. It runs two tag-filtered passes (fleet and same machine), maps the facts to SQLite rows, and applies a deterministic relevance gate. It then scores interventions with explicit rules: successes, partials and failures, same-machine weighting, and confidence thresholds with a same-machine downgrade. It either recommends the best proven fix, with a checklist and a verdict for every alternative, or honestly withholds a recommendation. The LLM's wording is validated against the evidence IDs. Recording an outcome updates both stores atomically.

**Data.** 567 synthetic but causally modelled work orders across 39 machines and 5 equipment types. Three showcase machines have explainable repair chains, and a live comparison shows each recommendation with and without memory.

**Intelligence.** The Intelligence page replays history chronologically. Coverage grew from 11 to 24 of 25 problems, and repairs that followed memory's recommendation worked 58 % of the time versus 48 % with less downtime. All of it is computed by the same engine.

**Quality.** Quality rests on 73 offline tests, a frontend contract test, live tests, six validation scenarios and a data audit.
