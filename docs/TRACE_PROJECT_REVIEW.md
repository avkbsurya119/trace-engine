# TRACE — Technical Review Brief

> Prepared for an external reviewer (human or AI) who has **not** opened the repository.
> State described: `main` at commit `e47f607` (merge of PR #7). Secrets in `.env` are deliberately omitted.
> Purpose: enable architecture critique, judging feedback, UI suggestions and demo recommendations.

---

# 1. Project Overview

**TRACE — Troubleshooting & Root-Cause Adaptive Context Engine** is a maintenance-troubleshooting assistant for manufacturing plants. A technician reports a machine fault; TRACE recalls how similar faults were handled before (on this machine and on the rest of the fleet of the same equipment type), shows which interventions worked and which failed, recommends the intervention with the best recorded track record, states how confident it is and why, and — once the technician records what they actually did — remembers that outcome for the next similar incident.

**Problem statement.** In real plants, the knowledge of "what fixed this last time" lives in scattered CMMS work orders and in the heads of senior technicians. Recurring faults get re-diagnosed from scratch; cheap-but-wrong fixes get repeated (e.g. re-aligning a spindle that actually has failing bearings); failed attempts are rarely surfaced when the same symptom returns. Downtime is expensive, and trial and error is the main source of wasted downtime.

**Target users.**
- Maintenance technicians on the floor (primary): report, get guidance, record outcome.
- Maintenance leads / reliability engineers: review machine histories, recurring defects, what has and hasn't worked.
- Plant management (secondary): downtime and outcome overview on the dashboard.

**Business value.**
- Fewer repeat failed interventions → less downtime per incident.
- Institutional memory that survives staff turnover.
- Evidence-backed recommendations that are auditable (every claim links to a specific past work order).
- Honest behaviour on novel problems (no recommendation instead of a guess), which matters for safety-critical equipment.

**Why the project exists.** It was built for a hackathon ("AI Agents That Learn Using Hindsight", HackwithHyderabad 3.0) whose brief requires Hindsight (Vectorize's agent-memory service) as the memory layer. Published judging weights: Innovation 30%, Use of Hindsight Memory 25%, Technical Implementation 20%, User Experience 15%, Real-world Impact 10%. The brief explicitly asks for a clear before/after-memory story visible within 60 seconds. Submission content (articles) must not mention the word "hackathon" — the README and app were written accordingly.

---

# 2. Architecture

```
┌──────────────────────── Browser (Next.js 14, React 18, Tailwind) ────────────────────────┐
│ Sidebar (live health) · Dashboard · Report Incident · Incident Analysis · Machine Memory │
│ Before/After Memory modal                      lib/api.ts (fetch wrapper)               │
└───────────────────────────────────────┬──────────────────────────────────────────────────┘
                                        │ JSON over HTTP  (NEXT_PUBLIC_API_URL, default :8000/api)
┌───────────────────────────────────────▼──────────────────────────────────────────────────┐
│ FastAPI (main.py) — CORS, JSON error handlers                                            │
│  routers: /api/incidents/*   /api/dashboard/*                                            │
│  services: AnalysisService ─┬─ MemoryService (hindsight/memory.py) ─┬─ IncidentRepository│
│                             │                                        │   (SQLite, async) │
│                             │                                        └─ HindsightClient  │
│                             ├─ select_evidence (relevance gate)          (hindsight-client│
│                             ├─ RecommendationEngine (deterministic)       SDK)            │
│                             └─ ReasoningPhraser (Groq via OpenAI SDK)                     │
│  data: catalog.py (fleet model, hero machines) · generator.py (synthetic history)        │
└──────────────┬──────────────────────────────┬──────────────────────────────┬────────────┘
               ▼                              ▼                              ▼
     SQLite (trace.db)              Hindsight Cloud bank              Groq (openai/gpt-oss-120b)
     exact structured records       "trace-maintenance"               wording only, optional
```

**Component responsibilities**
- **Frontend** — presentation and form input only. It holds no business logic about recommendations; every number shown comes from an API response.
- **Backend (FastAPI)** — orchestrates the pipeline, owns all decisions.
- **SQLite** — the source of truth for every structured field (IDs, outcomes, downtime, timestamps, sensor values). Dashboard stats and machine timelines are computed from SQLite only.
- **Hindsight** — semantic memory. Every incident is retained as a narrative document; recall finds similar past incidents by meaning. Recall results are never trusted for structured facts — they are mapped back to SQLite rows by `document_id`.
- **Groq** — optional; rewrites an already-computed result into 2–4 readable sentences. It never chooses the action or confidence.

**Request lifecycle (analyze an incident)**
1. Browser `POST /api/incidents/analyze` with the report.
2. Pydantic validates (empty required strings → 422).
3. `AnalysisService` creates an incident ID and timestamp.
4. **Recall first** (so the new incident cannot match itself): two parallel Hindsight `recall()` calls (fleet-of-type and this-machine), facts grouped by `document_id`, rows loaded from SQLite, incidents without an outcome dropped.
5. **Relevance gate** (deterministic) keeps the evidence set.
6. **Store** the new incident: SQLite insert, then Hindsight retain; if retain fails the SQLite row is deleted and a 503 is returned.
7. **Score** (deterministic) → recommendation, confidence, basis sentence, warnings, per-intervention tallies.
8. **Phrase** (Groq) → reasoning text, validated; on any problem, the deterministic text is kept.
9. Response `AnalysisResult` → UI.

Outcome recording (`PATCH /outcome`) updates SQLite, then re-retains the Hindsight document with `update_mode="replace"`; a failed retain rolls the SQLite change back.

---

# 3. Folder Structure

| Path | Why it exists |
|---|---|
| `README.md` | Accurate project documentation: pipeline, Hindsight usage, dataset, hero machines, config, API table, testing, limitations. |
| `DEMO.md` | Six-scene live demo script with expected outputs and CLI equivalents. |
| `docs/` | The hackathon problem statement and content-submission guide (.docx); this review brief. |
| `backend/main.py` | FastAPI app, CORS, exception handlers, router registration, DB init on startup. |
| `backend/app/api/` | HTTP routers: `incidents.py` (analyze, get, outcome, machine memory), `dashboard.py` (stats, fleet, hero-machines, health). |
| `backend/app/core/` | `config.py` (pydantic-settings from `.env`), `errors.py` (`MemoryUnavailableError`). |
| `backend/app/models/` | Pydantic schemas shared by API and services (`incident.py`). |
| `backend/app/db/` | SQLAlchemy async engine/session, ORM table, repository (all SQL). |
| `backend/app/hindsight/` | `client.py` (thin SDK wrapper), `memory.py` (narratives, tags, retain/recall orchestration, stats). |
| `backend/app/services/` | `analysis.py` (pipeline, relevance gate, machine memory, memory-impact dry run), `recommendation.py` (scoring), `phrasing.py` (LLM wording + guards). |
| `backend/app/data/` | `catalog.py` (fleet model: machine types, machines, defects, causes, interventions, technicians, hero machines), `generator.py` (deterministic synthetic history). |
| `backend/seed_data.py` | Rebuilds SQLite and the Hindsight bank from the generator. |
| `backend/scripts/` | Operational tooling: `validate_scenarios.py` (6 live scenarios with assertions), `demo.py` (scripted before/after demo + reset), `audit_data.py` (data-quality audit), `scenarios.py` (scenario definitions). |
| `backend/tests/` | Pytest suite: offline tests with an in-memory Hindsight fake, plus opt-in live tests. |
| `frontend/src/app/` | Next.js App Router: `layout.tsx` (font, metadata), `page.tsx` (the single page; view switching), `globals.css`. |
| `frontend/src/components/` | All screens: Sidebar, Dashboard, ReportIncident, IncidentAnalysis, MachineMemory, BeforeAfterMemory. |
| `frontend/src/lib/` | `api.ts` (typed API client), `utils.ts` (class merging, formatting, colour helpers). |
| `frontend/src/types/` | `incident.ts` — TypeScript mirror of backend responses (also used by the backend contract test). |

Approximate size: ~8,400 lines across backend Python, scripts, tests and frontend TS/TSX.

---

# 4. Frontend

**Stack.** Next.js 14 (App Router, client components only), React 18, TypeScript, Tailwind CSS with a custom "industrial" palette, lucide-react icons. No UI component library, no state library, no router-based pages.

**Pages / layout.** There is a single route (`/`). `page.tsx` holds a `currentView` state (`dashboard | report | analysis | memory`), the current `AnalysisResult`, the selected machine ID, and whether the Before/After modal is open. Views are swapped in-place; `Sidebar` sits on the left. Components are re-mounted with React `key`s (incident ID, machine ID) so switching analysis or machine never shows stale data.

**State management.** Local `useState` + `useEffect` per component; each screen fetches its own data on mount. No caching layer (SWR/React Query), no global store. The analysis result is passed down from the report form via the page component.

**API calls.** `lib/api.ts` wraps `fetch`: JSON headers, URL-encodes IDs, converts network failures into "Cannot reach the TRACE backend at …", flattens FastAPI 422 validation errors into `field: message` strings. Methods: `analyzeIncident`, `getIncident`, `recordOutcome`, `getMachineMemory`, `getDashboardStats`, `getFleet`, `getHeroMachines`, `healthCheck`.

**Screens**
- **Sidebar** — navigation, machine search (trimmed + upper-cased), and a live status panel polling `/api/dashboard/health` every 30 s: Hindsight bank name (green/red), SQLite incident count, LLM model or "rule-based wording". Shows "Backend unreachable" in red when the API is down.
- **Dashboard** — memory-health banner (stage by memory size), metric cards (total incidents, downtime logged, repairs that worked, resolution rate), outcome distribution, most frequent problems, fleet cards per machine type (count from stats; click opens the type's hero machine from `/fleet`), a "memory is working" card, a provenance line stating the history is synthetic, and a **See Memory Impact** button.
- **Before/After Memory modal** — tabs for three hero machines; each side is computed live by the backend: "Without memory" (scorer given no evidence) vs "With memory" (real recall + scoring), plus the machine's own history for that problem and what trial and error cost it (failed/partial attempts and their downtime). A footer states that nothing is stored.
- **Report Incident** — form driven by `/api/dashboard/fleet`: machine type → machine (production line auto-filled) → problem (catalog list or "Other / not listed" free text) → that problem's symptom chips + custom symptoms → description, suspected cause, operating hours, technician ID.
- **Incident Analysis** — top: a dark "TRACE PIPELINE" panel (facts recalled, work orders recalled, kept as evidence, SQLite cross-reference, scoring result, confidence, whether LLM phrasing applied) and a "Memory Moment" banner (N related incidents, X worked / Y failed / Z partial, top similarity; or "No Relevant History Found"). Then a numbered flow mirroring judge questions:
  1. *What happened* (incident details, readings)
  2–4. *What TRACE remembered* (right column: evidence cards grouped Worked / Failed / Partially worked / Not verified; each expandable with description, action, outcome, confirmed cause, quoted technician notes, downtime, and the **raw text recalled from Hindsight** in monospace)
  5. *What TRACE recommends* (intervention category, most recent successful instance, confidence badge)
  6–7. *Why this confidence (computed)* — the deterministic basis sentence, an **evidence tally table** (worked/partial/failed/unverified/on this machine per intervention, IDs on hover), cautions
  - A visually separate **AI-written summary** box (dashed purple border, italic, labelled "Wording only… cannot change the action or confidence")
  8. *Where the evidence came from* — bank, tag filters, counts, relevance rule, SQLite cross-reference
  - *Record outcome* form (intervention type from catalog datalist or free text, action, outcome buttons, root cause, repair time, downtime, notes).
- **Machine Memory** — health summary (model, line, incidents, defect types, % attempts that worked, downtime), stat cards, recurring defects, what has / hasn't worked (with counts), intervention chart, and the full maintenance timeline (newest first; date, work order, technician, hours, downtime, category + action, outcome, notes).

**Important UI decisions.**
- Historical facts vs AI text are visually distinct; the LLM sentence is never rendered as fact.
- The UI never shows a recommendation when the backend returns none ("No evidence-backed recommendation").
- All forms are built from the backend catalog so the UI cannot offer machine types that have no data.
- The dataset is labelled synthetic on the dashboard.

---

# 5. Backend

**FastAPI structure.** `main.py` creates the app, adds CORS (origins from `CORS_ORIGINS`), registers two routers under `/api`, creates tables on startup (`on_event("startup")`), and installs two exception handlers: `MemoryUnavailableError` → 503 JSON, any other exception → 500 JSON with `detail`.

**Routers.**
- `api/incidents.py` — analyze, get by ID (404 if missing), record outcome (404 if missing), machine memory.
- `api/dashboard.py` — stats, fleet catalog, hero-machine memory impact, health (30 s in-process cache, 8 s Hindsight timeout).

**Services.**
- `AnalysisService` — per-request object composing `MemoryService`, `RecommendationEngine`, `ReasoningPhraser`. Methods: `analyze_incident`, `get_machine_memory`, `memory_impact` (dry run for hero machines). Module-level `select_evidence` is the relevance gate.
- `MemoryService` — narrative building, tags, metadata, retain (single/batch), two-pass recall + SQLite mapping, outcome update with replace, deletes (for resets), machine history, statistics.
- `RecommendationEngine` — pure deterministic scoring.
- `ReasoningPhraser` — Groq call and output validation.

**Models (pydantic).** `IncidentCreate` (report), `Incident` (full record incl. outcome fields, intervention category, downtime, severity, technician, operating hours), `IncidentUpdate` (outcome), `HistoricalIncident` (incident + similarity + relevance factors + recalled facts), `EvidenceSummary` (per-intervention tallies), `Recommendation` (action, category, confidence, basis, evidence, warnings, reasoning, reasoning source, supporting IDs), `AnalysisResult` (everything the analysis screen needs, including `memory_trace`), `ActionOutcome` enum (SUCCESS, PARTIAL, FAILED, UNKNOWN).

**Dependency injection.** None in the FastAPI `Depends` sense: each route instantiates `AnalysisService`/`MemoryService` and closes it in `finally`. Configuration is a module-level `settings` singleton. Tests swap `HindsightClient` via monkeypatching the module attribute.

**Utilities / data.** `catalog.py` is effectively domain configuration (fleet, defects → causes → interventions, sensor normal ranges, technicians, hero machines) and powers both the generator and `/fleet`. `generator.py` produces the synthetic history deterministically.

**Business logic location.** Decision logic lives only in `recommendation.py` and `select_evidence`; everything else is plumbing. This separation is deliberate so the decision can be tested without any external service.

---

# 6. Database

**Engine.** SQLite via SQLAlchemy 2 async (`aiosqlite`); file `backend/trace.db` (git-ignored). Tables created at startup; `seed_data.py` drops and recreates them.

**Table `incidents`** (single table, no relationships).

| Column | Type | Notes |
|---|---|---|
| `incident_id` | String(100), **PK** | `WO-YYYY-NNNNN` for generated history, `INC-YYYYMMDD-XXXXXX` for live reports |
| `machine_id` | String(100), indexed | e.g. CNC-204 |
| `machine_type` | String(100), indexed | e.g. CNC_Machining_Center |
| `production_line` | String(100), indexed | |
| `timestamp` | DateTime, indexed | naive UTC |
| `defect_type` | String(150), indexed | e.g. spindle_vibration |
| `symptoms` | JSON | list of strings |
| `sensor_values` | JSON | dict, keys like `spindle_vibration_mm_s` |
| `operating_conditions` | JSON | shift, product, utilisation or plant demand |
| `description` | Text | operator-style report |
| `suspected_root_cause`, `confirmed_root_cause` | Text | confirmed only when a fix truly addressed the cause |
| `action_taken` | Text | concrete action text |
| `intervention_category` | String(150), indexed | normalised intervention type used for grouping |
| `action_outcome` | String(20), indexed | SUCCESS / PARTIAL / FAILED / UNKNOWN / NULL (open) |
| `resolution_details`, `technician_notes` | Text | |
| `resolution_time_minutes`, `downtime_minutes` | Integer | downtime ≥ repair time |
| `severity` | String(20) | LOW/MEDIUM/HIGH/CRITICAL (generated history only) |
| `technician_id` | String(20) | e.g. T-117 |
| `operating_hours` | Integer | hour meter; monotonic per machine |
| `created_at` | DateTime | |

**Relationships.** None — machines, technicians and the fleet model live in `catalog.py`, not in tables.

**Sample records (abridged).**
- `WO-2025-04551` — CNC-204, CNC machining center, Machining Cell 2, 2025-11-04 21:40, spindle_vibration; readings: vibration 7.5 mm/s at 10,500 rpm, spindle temp 53.6 °C; suspected "tool holder imbalance / runout"; action "Laser alignment of spindle head, shimmed and re-torqued" (category *Spindle alignment / tramming*); **FAILED**; notes "Tram and ballbar within spec after adjustment; vibration back … suspect bearing degradation rather than alignment." Three days later `WO-2025-04558` records bearing replacement **SUCCESS** with confirmed cause *spindle bearing degradation*.
- HP-303 pressure-loss chain: relief valve adjustment PARTIAL → pump replacement FAILED → cylinder reseal SUCCESS (Sep 2025); Apr 2026 same symptom: cylinder reseal FAILED → relief valve replacement SUCCESS (different cause).

**Current contents.** 567 generated work orders (plus whatever live incidents are created by demos; resets remove the demo machine's).

---

# 7. Hindsight Integration

Hindsight is the central memory layer. All interaction goes through `backend/app/hindsight/client.py` (SDK wrapper) and `memory.py` (logic).

**Bank / namespace.** One bank per deployment, `HINDSIGHT_NAMESPACE` (default `trace-maintenance`), created by `seed_data.py` with a mission text describing a maintenance memory for the five equipment types. Machine-type isolation is implemented with **tags**, not separate banks (the original plan proposed one bank per machine type; tags achieve the same isolation in one bank and allow cross-type administration).

**Where retain happens.**
1. `seed_data.py` → `MemoryService.retain_many` → `retain_batch` (25 items per batch, 4 concurrent batches, retries). ~567 documents in about a minute.
2. `POST /incidents/analyze` → `store_incident` → `retain` (new incident, outcome "not yet recorded").
3. `PATCH /incidents/{id}/outcome` → `update_incident_outcome` → `retain(..., update_mode="replace")`.

**What is retained (the "embedding content").** A narrative written like a technician's work-order summary (`build_narrative`), containing only facts from the record: work-order ID and date (+ shift); machine ID, model and line, operating hours; problem; operator description; symptoms; **only abnormal sensor readings with their normal range** (plus one key operating reading); product; the technician's suspected cause; intervention category and action; outcome (or "not yet recorded"); confirmed cause; technician notes; downtime and severity. Hindsight performs its own fact extraction and embedding server-side; TRACE does not compute embeddings.

**Metadata and tags per document.**
- `document_id` = SQLite `incident_id` (the cross-reference key).
- `timestamp` = incident time (gives Hindsight temporal context).
- `metadata` (strings): incident_id, machine_id, machine_type, defect_type, outcome (or NONE), intervention_category.
- `tags`: `machine_type:<slug>`, `machine:<slug>`, `defect:<slug>`.

**Where recall happens.** `MemoryService.search_similar_incidents`, called by `analyze_incident` and `memory_impact`. The query is natural language: "<machine label> <machine id>: <problem>. <description> Symptoms: … Suspected: … What was done before and did it work?"

**Search strategy and filters.** Two recalls run concurrently:
1. **Fleet pass** — `tags=[machine_type:<type>]`, `tags_match="all_strict"`, `max_tokens=6000`.
2. **Same-machine pass** — `tags=[machine_type:<type>, machine:<id>]`, `all_strict`, `max_tokens=3000` — guarantees a machine's own history is never crowded out by look-alikes elsewhere in the fleet (this fixed a real bug found in validation).

Both request only `types=["world","experience"]` facts, because those carry `document_id`; Hindsight's consolidated `observation` facts have no document link and are excluded.

**Retrieved evidence.** Facts are grouped by `document_id`; each document's best fact `scores.semantic` becomes its similarity (0–1); the corresponding rows are loaded from SQLite in one query; rows without an outcome and (defensively) of another machine type are dropped; the top two fact texts are attached as `recalled_facts` and shown in the UI. A `memory_trace` records bank, tag filters, query, facts recalled (fleet vs same-machine), documents recalled, documents with outcome.

**Observed behaviour on the real bank.** Same-problem work orders score ~0.85–0.93; unrelated ones ~0.72–0.79. A novel problem still recalls ~60–75 work orders, which the relevance gate then rejects.

**Why Hindsight instead of SQLite search.**
- Reports are free text written by different people ("chatter marks", "waviness", "spindle noise at high speed"); semantic recall matches meaning, SQL `LIKE` does not.
- Hindsight ranks within a fleet of ~100+ same-type records, surfacing the most similar contexts (same readings, same product, same suspicion) rather than every record with a matching code.
- Temporal and entity-aware memory (timestamps, extracted facts) comes with the service.
- SQLite remains the authority for numbers and outcomes; Hindsight is used for *which past incidents are relevant*, not for *what happened in them*.

**Honest caveat for reviewers.** The relevance gate keeps same-`defect_type` matches regardless of similarity, so for catalogued problems the evidence set is "Hindsight's recalled candidates, filtered by a structured field". Hindsight's role is candidate retrieval, ranking, same-machine recall, related-problem discovery (shared symptom + ≥0.80 similarity) and the displayed memory text; it does not alone decide relevance. Hindsight features such as `reflect()`, mental models, directives and observations are not used.

**Other Hindsight calls.** `aget_bank_config` (health check), `delete_document` via the SDK's internal `_documents_api` (demo/validation resets), `adelete_bank`/`acreate_bank` (seeding).

---

# 8. Recommendation Engine

File: `backend/app/services/recommendation.py`. Pure Python; no network, no LLM.

**Step 0 — Relevance gate** (`services/analysis.py::select_evidence`). From recalled incidents with outcomes, keep an incident if:
- same `defect_type` as the report, **or**
- it shares at least one symptom (case-insensitive) **and** similarity ≥ 0.80 (labelled "Related defect (high similarity)").

Then sort **this machine's incidents first**, then by similarity, and cap at **15**.

**Step 1 — Tally per intervention category.** Evidence is processed newest first. Category = `intervention_category` (fallback: action text). For each category count SUCCESS, PARTIAL, FAILED, UNKNOWN; record incident IDs per outcome; count same-machine successes and failures; the most recent successful action text becomes the `example_action`.

**Step 2 — Score.**
`score = successes + 0.5·partials − failures + 0.5·same_machine_successes − 0.5·same_machine_failures`
UNKNOWN outcomes score 0 and are not counted as attempts.

**Step 3 — Pick the winner.** Categories are sorted by `(score, successes, −failures)` descending; ties beyond that keep newest-first insertion order (the category whose most recent incident is newest wins). The winner is the first category with **≥1 success and score > 0**.

**Step 4 — Confidence** (attempts = successes + partials + failures):
- **HIGH** — ≥3 successes and success rate ≥ 75%, **or** ≥2 successes on this same machine with no failure there, ≥3 successes overall and rate ≥ 60%.
- **MEDIUM** — ≥2 successes and rate ≥ 50%.
- **LOW** — any other positive evidence (e.g. a single success).
- **Downgrade** — if the winner has failed on this machine and never succeeded here: HIGH→MEDIUM, MEDIUM→LOW, plus a warning.

**Step 5 — No-recommendation cases (INSUFFICIENT_DATA).**
- No evidence at all → `suggested_action = "No evidence-backed recommendation"`, category `None`, basis "Memory holds no earlier <problem> incident with a recorded outcome for this machine type", one warning. (The earlier codebase returned hardcoded "default actions" here; that was removed.)
- Evidence exists but nothing ever succeeded → no action; warnings list what failed/partially worked with IDs; reasoning advises escalation for root-cause diagnosis.

**How failures affect results.** They subtract a full point, count as attempts (lowering success rate), can downgrade confidence if on the same machine, and generate warnings: the winner's own failures ("…also failed N time(s) … the cause may differ this time"), and every other category that has failed (up to ~4 warnings). A warning is also added when there is no history of the problem on this machine.

**How partial successes affect results.** +0.5 to the score, counted as attempts (so they reduce the success rate but less harmfully than failures), listed separately in the tally table and evidence cards.

**Output.** `Recommendation` with `suggested_action` (= winning category), `intervention_category`, `confidence`, `basis` (one computed sentence, e.g. "7 of 7 recorded attempt(s) with Relief valve replacement on similar incidents succeeded (1 on HP-303); 0 failed, 0 partial."), `evidence` (all tallies), `warnings`, `supporting_incidents` (winner's SUCCESS IDs), deterministic `reasoning`, `reasoning_source="deterministic"`.

**Edge cases handled/tested.** Empty evidence; only failures; partial/unknown mixes; ties; same-machine failure downgrade; winner by score not by attempt count; evidence from other machines only; new free-text categories (group only on identical text).

**Edge cases not handled.** No recency weighting (a 14-month-old success weighs the same as last week's); similarity does not weight the score; sensor readings and suspected cause are not used by the scorer (so "same symptom, different cause" histories, such as HP-303, are resolved by outcome counts, not by matching readings); no statistical confidence interval.

---

# 9. Groq Integration

File: `backend/app/services/phrasing.py`. Client: OpenAI Python SDK pointed at `https://api.groq.com/openai/v1`, model `openai/gpt-oss-120b` (configurable `LLM_MODEL`), temperature 0.2, `max_completion_tokens` 1024, 20 s timeout, 1 retry. If `GROQ_API_KEY` is empty the step is skipped.

**System prompt (paraphrased).** "You write the reasoning paragraph for a manufacturing troubleshooting recommendation. Use ONLY the facts given below. Do not add, infer, or assume anything not listed: no new causes, actions, numbers, incident IDs, or safety advice. Do not change the recommended action or the confidence level. Cite supporting incidents by their exact IDs and state clearly what worked and what failed. If there is no evidence-backed recommendation, say so plainly and do not suggest any action. 2–4 plain sentences, no markdown."

**What is sent (user message, structured text).**
- Current incident: machine ID and type, problem, symptoms.
- Decision block (marked "computed by deterministic scoring; do not change it"): recommended intervention, confidence in words ("insufficient evidence (no recommendation)" instead of the enum), basis sentence.
- Evidence per intervention: counts of success/partial/failed/unverified and the incident IDs per outcome.
- This machine's own history (up to 4 newest evidence items: ID, date, category, outcome).
- Warnings.
- The deterministic reasoning as "reference wording — rephrase it, do not extend it".

**What is NOT sent.** Raw descriptions, technician notes, sensor readings, operating conditions, confirmed causes of other incidents (except via the reference wording), SQLite rows, Hindsight fact text, technician IDs, any secrets.

**Hallucination prevention and validation.**
1. The LLM never decides: action and confidence are fixed before the call; the result is applied with `model_copy(update={"reasoning": …})` so only the text changes.
2. Output cleaned: `<think>…</think>` blocks stripped (for reasoning models like qwen3), whitespace normalised.
3. Rejected and replaced by the deterministic text when: the API errors or times out; the reply is empty; **any incident ID matching `WO-/INC-/TRC-…` is not in the evidence set or the current incident**; or, for an INSUFFICIENT_DATA result, the reply does not acknowledge missing evidence (must contain "no", "not", "none" or "insufficient").
4. `reasoning_source` ("llm" / "deterministic") is returned and shown in the UI and pipeline panel.
5. Tests cover every fallback path, and a test asserts the model cannot alter action or confidence.

**Residual risk.** The validator cannot detect invented numbers, causes or softer embellishments (e.g. "may involve a different cause") that don't contain IDs; it relies on the prompt for those. The UI mitigates by labelling the text "AI-written… wording only".

---

# 10. Complete User Journey

1. **Technician reports an incident** (Report Incident). The form loads `/api/dashboard/fleet`; they choose type → machine (line auto-fills) → problem → symptoms, and type a description (+ optional suspected cause, hours, technician ID). Submitting calls `POST /api/incidents/analyze`.
2. **Memory is queried.** Backend builds a natural-language query and runs the fleet and same-machine recalls in parallel against the tag-filtered Hindsight bank; facts are grouped per document and mapped to SQLite rows; open incidents are dropped; the relevance gate selects up to 15 evidence incidents (this machine first). The new incident is then stored in SQLite and retained in Hindsight (rollback if Hindsight fails → 503).
3. **Recommendation generated.** Deterministic tally, score, winner, confidence, basis, warnings — or "No evidence-backed recommendation".
4. **Explanation generated.** Groq rewrites the computed result; validation accepts or falls back.
5. **Technician sees the analysis** (~5–8 s end-to-end with real services): pipeline panel, memory moment, evidence grouped by outcome with recalled memory text, recommendation + computed basis + tally table, AI summary box, provenance. They perform the repair on the floor.
6. **Technician submits the outcome** (Record outcome form): intervention type (catalog suggestion or free text), action, SUCCESS/PARTIAL/FAILED/UNKNOWN, root cause, repair time, downtime, notes → `PATCH /api/incidents/{id}/outcome`.
7. **Memory updated.** SQLite row updated (category defaults to the action text if blank; downtime defaults to repair time); the Hindsight document is re-retained with the outcome using `replace`. The next similar incident — on this machine via the same-machine recall pass, or elsewhere in the fleet via the fleet pass — will retrieve it as evidence, and the scorer will count it.

---

# 11. APIs

All paths are prefixed with `/api`. Errors are JSON `{"detail": …}`: 404 unknown incident, 422 validation (list of field errors), 503 Hindsight unavailable (nothing saved), 500 other.

| Method | Path | Purpose | Request | Response (key fields) |
|---|---|---|---|---|
| POST | `/incidents/analyze` | Full pipeline; stores the incident | `IncidentCreate`: machine_id, machine_type, production_line, defect_type, description (all non-empty), symptoms[], sensor_values{}, operating_conditions{}, suspected_root_cause?, operating_hours?, severity?, technician_id? | `AnalysisResult`: current_incident; historical_incidents[] (incident, similarity_score, relevance_factors, recalled_facts); successful/failed/partial_interventions[] (incident_id, action, category, outcome, root_cause, machine_id, same_machine, date, similarity, relevance); recommendation (suggested_action, intervention_category, confidence, basis, evidence[] tallies, warnings, reasoning, reasoning_source, supporting_incidents); memory_contribution; memory_trace |
| GET | `/incidents/{incident_id}` | Fetch one record | — | `Incident` or 404 |
| PATCH | `/incidents/{incident_id}/outcome` | Record outcome; replaces memory | `IncidentUpdate`: action_taken (non-empty), action_outcome (enum), intervention_category?, confirmed_root_cause?, resolution_details?, resolution_time_minutes?, downtime_minutes?, technician_notes? | Updated `Incident`, 404, 422 or 503 |
| GET | `/incidents/machine/{machine_id}/memory` | Machine summary from SQLite | — | machine_id, machine_type, model, production_line, total_incidents, total_downtime_hours, outcome_distribution, recurring_defects [[defect,count]], successful_interventions {category: [defects]}, failed_interventions, recent_incidents (5), timeline[] (all incidents, newest first, with action, outcome, technician, notes, downtime, severity, hours). Unknown machine → total 0, empty lists |
| GET | `/dashboard/stats` | Fleet statistics from SQLite | — | total_incidents, incidents_with_outcome, unique_machines, outcome_distribution, defect_type_distribution, machine_type_distribution, total_downtime_hours, history_start, history_end, memory_bank |
| GET | `/dashboard/fleet` | Catalog for forms | — | machine_types[]: machine_type, label, machines[] (id, line, model), defect_types[] (defect_type, symptoms[]), intervention_categories[], hero_machine_id |
| GET | `/dashboard/hero-machines` | Live before/after comparison (dry run, no LLM, nothing stored) | — | hero_machines[]: key, title, story, incident, without_memory (Recommendation), with_memory (Recommendation), evidence_incidents[], memory_trace, trial_and_error {attempts_that_did_not_work, downtime_minutes, incident_ids}, machine_history[] |
| GET | `/dashboard/health` | Dependency check, cached 30 s | — | status healthy/degraded, checks {sqlite {ok, incidents}, hindsight {ok, bank, error?}, llm {ok, model}} |
| GET | `/` (no prefix) | API info | — | name, version, docs link |

OpenAPI docs at `/docs`. The dashboard endpoints use `Dict[str, Any]` response models (no typed schema in OpenAPI); the frontend↔backend contract is enforced by a test instead.

---

# 12. Demo Flow

**Starting state.** Seeded bank and SQLite (567 work orders); `python -m scripts.demo --reset` run so AC-407 (a compressor "commissioned 2026-08") has no history; nobody in the fleet has ever had a *condensate drain failure* (by design).

**Scene 1 — Dashboard** (`GET /stats`, `/fleet`, `/health`). Show 567 incidents, 39 machines, 5 types, ~4,030 h downtime logged, outcome mix (47% success, 20% partial, 23% failed, 10% not verified), sidebar status green for Hindsight/SQLite/LLM, provenance line "synthetic, operationally realistic".

**Scene 2 — See Memory Impact** (`GET /hero-machines`, ~2 s). Tabs:
- CNC-204 spindle vibration: without memory → insufficient evidence; with memory → *Spindle bearing replacement*, LOW ("3 of 7 … succeeded (2 on CNC-204); 2 failed, 2 partial"); machine history alignment FAILED → bearings SUCCESS → re-lube PARTIAL → bearings SUCCESS; trial-and-error cost 2 attempts, ~9 h.
- HP-303 pressure loss: with memory → *Relief valve replacement*, HIGH (7 of 7); cost 3 attempts, ~75 h.
- CV-507 belt mistracking: → *Idler replacement*, HIGH (4 of 5); cost 1 attempt, ~3 h.

**Scene 3 — New problem, no history** (`GET /fleet`, `POST /analyze`). Report AC-407, condensate drain failure, symptoms "water in compressed air line", "auto drain not cycling". Expected: "No Relevant History Found — Hindsight recalled ~67 compressor work orders, none about this problem"; recommendation "No evidence-backed recommendation"; AI summary says the same.

**Scene 4 — Record outcome** (`PATCH /outcome`). Condensate drain replacement, SUCCESS, root cause, 55 min repair, 90 min downtime → "Saved to SQLite and Hindsight".

**Scene 5 — The memory loop** (`POST /analyze`). Similar AC-407 report. Expected: "TRACE Found 1 Related Historical Incident (1 on AC-407)", evidence card tagged *this machine* (~81–86% match) with action/cause/notes/recalled text; recommendation *Condensate drain replacement*, **LOW** ("1 of 1 … (1 on AC-407)"); AI summary cites the Scene 3 incident ID.

**Scene 6 — Machine Memory** (`GET /machine/CNC-204/memory`). 15 incidents, recurring defects, what worked/failed, the spindle chain in the timeline with technician notes.

The scripted CLI version (`python -m scripts.demo --runs 3`) performs Scenes 3–5 with assertions and resets between runs; it has passed repeatedly.

---

# 13. Machine Memory

**Machine history** (Machine Memory screen, `GET /incidents/machine/{id}/memory`) is read **only from SQLite**: every incident for that machine ordered newest first, aggregated into outcome counts, downtime, recurring defects, per-category successes/failures and a full timeline. It is exact and complete; no semantic ranking.

**Fleet history** is what the analysis uses: Hindsight recall over all machines of the same type (fleet pass), ranked by semantic similarity, filtered by the relevance gate. It answers "what has worked for this problem on machines like this one".

**How they combine in analysis.** The same-machine recall pass pulls the machine's own relevant history from Hindsight; the gate ranks those first; the scorer gives same-machine outcomes extra weight (±0.5), can reach HIGH through the same-machine rule, and downgrades when the fix failed on this machine. The UI tags same-machine evidence ("this machine") and the Memory Moment banner reports "(N on <machine>)".

**Differences.**

| | Machine history | Fleet history |
|---|---|---|
| Source | SQLite | Hindsight recall → SQLite rows |
| Scope | One machine, all problems | One machine type, relevant problems |
| Ordering | Chronological | Similarity (this machine first in evidence) |
| Used for | Human review, timeline, trial-and-error cost | Evidence and scoring |
| Completeness | Exhaustive | Top-ranked, capped at 15 evidence items |

---

# 14. Testing

**Offline suite** (`cd backend && pytest`, 49 tests, ~1–2 s). `conftest.py` points `DATABASE_URL` at a temp SQLite file, blanks `GROQ_API_KEY` (deterministic wording), and monkeypatches `HindsightClient` with `tests/fakes.py::FakeHindsightClient` — same interface; recall scores documents by token overlap and honours tag filters; can simulate retain/recall failures.

| File | Tests |
|---|---|
| `test_recommendation.py` (10) | no-evidence → no action; only failures; HIGH/MEDIUM/LOW thresholds; same-machine HIGH rule; same-machine failure downgrade; winner by score; partial/unknown tallies; most recent success as example; "no history on this machine" warning |
| `test_evidence_gate.py` (3) | same defect kept; related defect needs shared symptom + ≥0.80; same-machine-first ordering and cap |
| `test_phrasing.py` (7) | no key; valid reply + think-tag stripping; LLM cannot change decision; invented ID rejected; API error / empty reply fallback; no-evidence reply must admit it; prompt contains computed facts |
| `test_dataset.py` (9) | determinism; size/coverage; unique IDs; timestamp window; fleet consistency (line, valid intervention, downtime ≥ repair, severity); monotonic operating hours; mixed outcomes; confirmed cause only when plausible; hero chains present; demo problem has no history |
| `test_memory.py` (8) | narrative content and omission of normal readings; open incident wording; tags; recall grouping and tag isolation; rollback on failed retain (create and outcome update); category/downtime defaults; delete from both stores |
| `test_api.py` (12) | contract checker catches missing fields; health healthy/degraded; stats + fleet vs frontend types; full memory loop (analyze → outcome → recall → machine memory); recurring incident uses machine history; hero machines computed, nothing stored; 404/422 JSON errors; 503 on memory outage with nothing saved; unknown machine memory; CORS origins |

**Frontend↔backend contract test.** `tests/ts_contract.py` parses the TypeScript interfaces in `frontend/src/types/incident.ts` (including `extends` and nested interface/array types) and validates real API responses against required fields — frontend/backend drift fails a Python test.

**Live integration tests** (`TRACE_LIVE=1 pytest -m live`, 4 tests, ~2 min, real Hindsight + Groq, running server required). They shell out to the scripts with the real environment: health healthy with Hindsight and LLM ok; `validate_scenarios` all pass; `demo --runs 2` passes twice; `audit_data` passes.

**Validation scenarios** (`scripts/validate_scenarios.py`, assertions per scenario, cleans up created incidents, resets AC-407 first):

| Scenario | Incident | Result |
|---|---|---|
| A strong history | CV-505 roller bearing noise | HIGH — idler replacement 7/7, 4 on CV-505 |
| B conflicting | CNC-204 spindle vibration | LOW — bearings 3 of 7, 2 failed; CNC-204's failed alignment shown |
| C sparse | AC-402 oil carryover | LOW — only 2 matches |
| D no history | AC-407 condensate drain failure | INSUFFICIENT_DATA, no action |
| E novel | CNC-203 chip conveyor jam (custom problem) | INSUFFICIENT_DATA; recall ran (~74 work orders) but nothing relevant |
| F recurring | CV-507 belt mistracking | retrieves CV-507's own PARTIAL and SUCCESS |

**Demo reset.** `scripts/demo.py --reset` deletes every AC-407 incident from SQLite and Hindsight (the generated history has none, so anything there is demo-created). Verified effective: after reset, incident 1 again gets no evidence.

**Data audit.** `scripts/audit_data.py` checks duplicate IDs, machine/type/line consistency, future timestamps, downtime vs repair time, sensor physical bounds, intervention validity per type, notes contradicting outcomes, impossible operating-hour progressions, and prints distribution statistics; `--recommendations` runs recall + scoring for every (type, problem) pair (22 distinct recommendations across 23 problems).

**Frontend.** `npm run typecheck` (tsc) and `npm run build` pass. There are no frontend unit/component/E2E tests and no ESLint configuration; UI flows were verified manually in a browser (form, analysis, outcome, memory loop, modal, lowercase search, backend-down state).

**CI.** None configured.

---

# 15. Technical Decisions

1. **SQLite = truth, Hindsight = retrieval.** Outcomes and numbers must be exact and auditable; semantic memory is for finding relevant history. Every recalled item is mapped back by `document_id = incident_id`.
2. **Deterministic scoring; LLM only for wording.** The decision cannot hallucinate and is unit-testable; the LLM improves readability and can be switched off without changing behaviour.
3. **Recall before storing the new incident.** Prevents the incident matching itself.
4. **Two recall passes (fleet + same machine) in parallel.** Validation showed a machine's own prior occurrences could be crowded out of the fleet top-k.
5. **Tags instead of one bank per machine type.** Same isolation (`all_strict`), single bank to seed/administer, cross-type admin possible.
6. **Only `world`/`experience` facts.** They carry `document_id`; observations cannot be cross-referenced to records.
7. **Narrative retain content, abnormal readings with normal ranges.** Natural-language memory retrieves better than key-value dumps; normal readings are noise.
8. **Relevance gate on structured `defect_type` + high-similarity related matches.** Recall always returns *something*; without a gate a novel problem would be "answered" with unrelated evidence (observed in the original code: hydraulic-press failures cited for a CNC).
9. **Group by intervention category, not action text.** "3500 rpm" vs "3600 rpm" were counted separately before, making HIGH unreachable.
10. **Same-machine weighting and downgrade.** A fix proven on this machine is stronger evidence; a fix that failed here is suspect.
11. **No recommendation without evidence.** Replaced hardcoded default actions; safety/credibility over apparent helpfulness.
12. **LLM output validation (IDs, acknowledgment) with deterministic fallback.** Cheap, strict guard against the most damaging hallucination (citing non-existent work orders).
13. **Synthetic but modelled data.** No real plant data available; a cause→intervention→outcome model with technician behaviour produces realistic, non-trivial histories (same fix succeeds and fails; follow-ups; uncertainty) and is reproducible via a fixed seed.
14. **Scripted hero chains merged into generated data.** Guarantees demonstrable stories and stable validation scenarios while keeping the rest emergent.
15. **Live, computed Before/After view.** Main branch had a hardcoded comparison; replaced with a dry run through the same scorer and real trial-and-error cost, avoiding misleading "time saved" claims the data doesn't support.
16. **Write consistency with rollback.** A failed Hindsight write reverts the SQLite change and returns 503, so the two stores never disagree.
17. **Real health endpoint driving UI status.** Replaced an always-green indicator.
18. **Contract test from TypeScript types.** Hand-maintained TS types are kept honest without codegen.
19. **Forms driven by the backend catalog.** The UI can't drift from the data.
20. **Single-page view switching (no routes).** Simplicity for a demo; trade-off listed below.

---

# 16. Limitations

**Data & realism**
- All history is synthetic (clearly labelled). Thresholds (0.80 gate, cap 15, confidence rules) were tuned on this synthetic fleet and may not transfer.
- Hero chains are scripted; validation scenario A was chosen after inspecting which problem the data supports strongly.
- Severity is only generated for history; live reports never get a severity.
- Live incident timestamps are "now"; no manual date entry.

**Memory / retrieval**
- For catalogued problems the gate largely reduces to "same `defect_type` among recalled candidates" — a critic can fairly say part of the relevance decision is a structured filter, not memory. Hindsight still selects/ranks candidates and provides same-machine and related-problem recall.
- Similarity is the best fact's `semantic` score; reranker/final scores are ignored; not calibrated.
- Hindsight `reflect()`, observations, mental models and directives are unused — Hindsight is used as retrieval, not as a reasoning memory.
- Single shared bank; `seed_data.py` deletes and recreates it (dangerous if teammates share an account/bank).
- Deletion uses a private SDK attribute (`_documents_api`).
- Retain happens synchronously inside the analyze and outcome requests (adds seconds of latency).
- Every analysis stores an incident, including exploratory ones; "open" incidents accumulate without outcomes.

**Scoring**
- No recency weighting, no similarity weighting, no use of sensor readings or suspected cause, no statistical confidence (Wilson interval etc.).
- Free-text intervention categories group only on identical text; no normalisation or clustering.
- "Same symptom, different cause" (HP-303) is handled only by outcome counts, not by matching the current readings to the cause.

**LLM**
- Validation catches invented IDs and missing no-evidence acknowledgment only; invented numbers/causes without IDs pass.
- `qwen/qwen3-32b` path (think-tag stripping) untested live; no function-calling (not needed, but the brief mentions it).

**Backend engineering**
- No auth, users, roles, tenancy, or audit trail of outcome edits (PATCH overwrites).
- New service/SDK clients per request; no connection pooling or FastAPI dependency injection.
- Stats load all rows into Python (fine at 567, not at 500k); no pagination.
- `/hero-machines` runs six recalls on every call; no caching (React strict mode doubles it in dev).
- Dashboard endpoints return untyped dicts (weak OpenAPI).
- Deprecated `on_event` startup hook; health cache is per-process.
- Unused dependencies (`anthropic`, `aiohttp`, `python-multipart`); dev tools (`black`, `ruff`, `pytest`) in runtime requirements.
- No Docker/compose, no CI pipeline, no migrations (schema changes require reseed).

**Frontend**
- Single route with in-memory view state: no deep links, refresh loses the current analysis, browser back doesn't work across views.
- No frontend tests (unit, component or E2E), no ESLint config.
- Hand-maintained TS types (mitigated by the contract test).
- The Report form has no sensor-value inputs; readings shown in the analysis come only from the API payload.
- Accessibility not audited; responsive layout not tested on small screens.

**Process / submission**
- Live tests and validation scripts write to and clean up the real bank (costs API calls; can collide with concurrent demos).
- Article, social post and video required by the content guide are not in the repo.
- API keys were shared in a chat session during development and should be rotated.

---

# 17. Strengths

- **Memory is central and visible.** Recall drives evidence; the UI shows the recalled memory text, recall counts, and a live before/after comparison — directly aligned with the 25% "Use of Hindsight Memory" criterion.
- **Grounded, auditable recommendations.** Every recommendation is a function of counted outcomes with work-order IDs; the basis sentence and tally table make the decision inspectable.
- **Honest failure modes.** No evidence → no recommendation; failed and partial repairs are first-class evidence; confidence downgrades when a fix failed on the same machine.
- **Hallucination containment.** LLM only rewords; hard validation with deterministic fallback; UI labels AI text.
- **Realistic, reproducible data model.** Causes, interventions, technician behaviour, follow-ups, uncertainty, operating hours, downtime — not a toy table — and deterministic via seed.
- **Two-store consistency.** Rollback on memory-write failure; explicit 503s.
- **Test depth for a short project.** 49 offline tests with a service fake, a TS-contract test, live integration tests, six assertion-backed scenarios, a data audit, a repeatable demo with reset.
- **Clean separation of concerns.** Decision logic isolated in two small pure modules; plumbing elsewhere.
- **Demo-ready.** Hero machines with real chains, one-command reset, scripted rehearsal, provenance and health visible in the UI.

---

# 18. Files Worth Reading

1. `README.md` — the accurate high-level picture, pipeline, dataset, API, testing.
2. `backend/app/services/analysis.py` — the pipeline in one place: recall, relevance gate, store, score, phrase, machine memory, memory-impact dry run.
3. `backend/app/hindsight/memory.py` — how Hindsight is used: narratives, tags, two-pass recall, grouping to SQLite, consistency/rollback, stats.
4. `backend/app/services/recommendation.py` — the entire decision logic and confidence rules (short, well-commented).
5. `backend/app/services/phrasing.py` — the LLM prompt, the facts sent, and the validation/fallback rules.
6. `backend/app/data/generator.py` then `catalog.py` — how the synthetic history is produced and what the fleet/defect/cause/intervention model looks like; hero stories.
7. `frontend/src/components/IncidentAnalysis.tsx` — the main judge-facing screen and how evidence vs AI text is separated.
8. `frontend/src/components/BeforeAfterMemory.tsx` + `backend/app/api/dashboard.py` — the live before/after memory view and health check.
9. `backend/tests/test_api.py` + `tests/ts_contract.py` — end-to-end behaviour and the frontend/backend contract enforcement.
10. `backend/scripts/validate_scenarios.py`, `scripts/demo.py` — acceptance scenarios and the rehearsable demo.
11. `DEMO.md` — the intended live walkthrough.
12. `backend/app/hindsight/client.py`, `app/db/repository.py`, `app/models/incident.py` — thin but clarify contracts.

---

# 19. Project Summary

TRACE is a troubleshooting assistant for industrial maintenance whose core idea is that the most valuable knowledge in a plant is not generic engineering knowledge but the plant's own history of what was tried on which machine and whether it worked. It turns that history into a memory that is queried every time a technician reports a fault, and it updates that memory every time a technician reports an outcome.

The system has three layers. A Next.js 14 single-page frontend provides a dashboard, an incident report form, an incident analysis screen, a per-machine memory view, and a "memory impact" modal. A FastAPI backend owns all logic. Two stores sit behind it with deliberately different roles: SQLite is the exact, authoritative record of every work order (IDs, timestamps, readings, actions, outcomes, downtime), while Hindsight — Vectorize's agent-memory service — holds each work order as a natural-language memory document and answers the question "which past incidents are like this one?". Groq (model `openai/gpt-oss-120b`) is optional and used only to reword results.

The heart of the system is the analysis pipeline. When a technician submits a report (machine, problem, symptoms, description), the backend first recalls from Hindsight — before storing the new incident so it can't match itself. Two recall calls run in parallel against one bank: one restricted by tag to the machine's equipment type (the fleet), and one restricted to that specific machine, so a machine's own recurring history is never pushed out by look-alikes elsewhere. Only fact types that carry a document ID are requested; facts are grouped per document, the best semantic score becomes the incident's similarity, and the authoritative rows are loaded from SQLite. A deterministic relevance gate keeps incidents of the same problem type, or of a related problem that shares a symptom and scores at least 0.80 similarity; the machine's own incidents are ordered first and the set is capped at fifteen. This gate exists because semantic recall always returns something, and without it a novel problem would be "answered" with unrelated history.

Scoring is plain Python. Evidence is grouped by intervention category; each category earns one point per success, half a point per partial success, minus one per failure, with an extra half point up or down for outcomes on the same machine. The winner is the best-scoring category that has actually worked at least once. Confidence follows explicit rules: HIGH needs at least three successes at 75% or better, or two successes on this machine with no failures there and 60% overall; MEDIUM needs two successes at 50%; anything else positive is LOW; and if a fix failed on this machine and never worked there, confidence is downgraded. If there is no evidence, or nothing has ever worked, TRACE returns "No evidence-backed recommendation" rather than a generic suggestion. The result includes a one-sentence computed basis, a per-intervention tally with work-order IDs, and warnings about what failed.

Only after the decision is fixed does the LLM see it. The prompt contains only computed facts — the decision, the tallies with IDs, the machine's own recent outcomes, the warnings, and a reference wording — and instructs the model to rephrase without adding anything. Its output is rejected in favour of the deterministic text if the call fails, the reply is empty, it cites any work-order ID not in the evidence, or, for a no-evidence case, it fails to say there is no evidence. The UI renders this text in a visually separate box labelled as AI-written wording.

When the technician records what they did (intervention type, action, outcome, cause, repair time, downtime, notes), SQLite is updated and the Hindsight document is re-retained with replace semantics; if the memory write fails, the SQLite change is rolled back and the API returns 503, so the two stores never disagree. The next similar incident will retrieve this outcome and the scorer will count it — the before/after loop at the centre of the demo: a brand-new condensate-drain problem on compressor AC-407 gets no recommendation; after the fix is recorded, the next similar report recalls it, recommends it with LOW confidence (one success), and the explanation cites the earlier work order.

Because no real plant data was available, the repository includes a deterministic generator that produces 567 synthetic but operationally realistic work orders over fifteen months for 39 machines across five equipment types (CNC machining centers, hydraulic presses, screw air compressors, belt conveyors, injection molding machines). It models root causes per defect, which interventions truly fix which cause, technicians suspecting the wrong cause or trying cheap fixes first, follow-up work orders after failed or partial repairs, uncertain records, rare one-off faults, operating hours, downtime and severity. Outcomes are 47% success, 20% partial, 23% failed, 10% unverified, and most intervention types both succeed and fail somewhere. Three "hero" machines have scripted, explainable chains (CNC-204 bearings vs alignment; HP-303 same symptom with two different causes a year apart; CV-507 a temporary fix before the real one), and a dashboard modal compares, live, what the same scorer recommends for them with and without memory, alongside what trial and error actually cost each machine.

Quality is backed by 49 offline tests (with an in-memory Hindsight fake) covering scoring rules, the gate, LLM guards, dataset invariants, the memory layer and the full HTTP flow; a contract test that validates API responses against the frontend's TypeScript interfaces; four opt-in live tests; six assertion-backed validation scenarios; a data-quality audit; and a demo script that resets and replays the memory loop reliably.

The main weaknesses are those of a short, demo-focused build: synthetic data and tuned thresholds, a relevance gate that leans on a structured field for catalogued problems, scoring without recency or similarity weighting, limited LLM validation beyond IDs, synchronous memory writes, no authentication, no routing or frontend tests, no CI or containerisation, and a seed script that rebuilds the shared memory bank. The strengths are a memory-centric design that is visible to the user, decisions that are deterministic and auditable, honest behaviour when evidence is missing, and unusually thorough verification for the project's size.
