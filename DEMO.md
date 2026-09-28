# TRACE Demo Script

## Prerequisites

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env            # fill in HINDSIGHT_API_KEY and GROQ_API_KEY
python seed_data.py             # 567 synthetic work orders into SQLite + Hindsight (~1 min)
uvicorn main:app --port 8000 --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev

# Before each live demo: make sure AC-407 has no history
cd backend && python -m scripts.demo --reset
```

Open http://localhost:3000. To rehearse the memory loop without the UI: `python -m scripts.demo --runs 3`.

---

## Scene 1: Dashboard overview

- 567 incidents, 39 machines across 5 equipment types, ~15 months of history.
- The subtitle states the history is synthetic but operationally realistic.
- Outcome mix: roughly half the repairs worked; failed and partial repairs are kept as evidence.

## Scene 2: Memory impact on the hero machines

1. Click **See Memory Impact**.
2. Walk the three tabs: **CNC-204** spindle vibration, **HP-303** pressure loss, **CV-507** belt mistracking.

**Expected (computed live, nothing stored):**
- *Without memory:* "No evidence-backed recommendation", insufficient evidence.
- *With memory:* a specific intervention with a computed basis, e.g. HP-303 → Relief valve replacement, HIGH ("7 of 7 recorded attempts succeeded").
- *Trial and error cost on that machine:* e.g. HP-303 lost 3 attempts and ~75 h of downtime before the right fix.

## Scene 3: A brand-new problem (no history)

1. **Report Incident** → Rotary screw air compressor → **AC-407** (commissioned 2026-08) → problem **Condensate drain failure**.
2. Symptoms: *water in compressed air line*, *auto drain not cycling*.
3. Description: "Water spitting from the air drops at the molding hall. Electronic drain on the wet receiver is not cycling."
4. **Analyze Incident**.

**Expected:**
- "No Relevant History Found": Hindsight recalled ~67 compressor work orders, none about this problem.
- Recommendation: **No evidence-backed recommendation** (Insufficient evidence). TRACE does not guess.
- The AI-written summary (dashed purple box) says the same.

## Scene 4: Record the outcome

1. **Record what was done and whether it worked**.
2. Intervention type: *Condensate drain replacement*; action: "Replaced zero-loss condensate drain on wet receiver and cleaned inlet strainer"; outcome **SUCCESS**; root cause "Drain inlet strainer blocked with rust"; repair 55 min, downtime 90 min.
3. **Save to memory** → "Saved to SQLite and Hindsight".

## Scene 5: The memory loop

1. Report a similar incident on **AC-407**: symptoms *water in compressed air line*, *wet receiver tank level high*; "Moisture again at molding hall drops; drain does not seem to discharge."
2. Analyze.

**Expected:**
- "TRACE Found 1 Related Historical Incident (1 on AC-407)".
- *What TRACE remembered → Worked:* the incident from Scene 3 (tagged **this machine**, ~85% match), with its action, confirmed cause, technician notes and the text recalled from Hindsight.
- Recommendation: **Condensate drain replacement**, **LOW** confidence, basis "1 of 1 recorded attempt … succeeded (1 on AC-407)".
- The AI summary cites the Scene 3 incident ID.

## Scene 6: Machine memory

1. Sidebar → Machine Memory → `CNC-204` (or click the CNC card on the dashboard).

**Expected:**
- 15 incidents, recurring problems, what has / hasn't worked.
- Timeline shows the spindle chain: Nov 2025 alignment **FAILED** → bearing replacement **SUCCESS**; Jun 2026 re-lubrication **PARTIAL** → bearing replacement **SUCCESS**, with the technicians' notes.

Optional contrast: report CNC-204 spindle vibration and show that bearing replacement comes back with **LOW** confidence because it also failed on other machines where the cause was different, and that CNC-204's failed alignment is listed.

---

## Key demo points

1. **Memory, not lookup:** Hindsight ranks work orders by meaning; each evidence card shows the memory text it recalled.
2. **Machine-type isolation:** recall is tag-filtered, so press repairs never appear as evidence for a CNC.
3. **Failures are evidence:** failed and partial repairs are shown and lower confidence.
4. **Deterministic decision:** action and confidence come from outcome counts; the LLM only writes the summary and cannot cite anything that wasn't retrieved.
5. **Honest when empty:** no history → no recommendation.

---

## CLI

```bash
curl http://localhost:8000/api/dashboard/stats
curl http://localhost:8000/api/dashboard/hero-machines
curl http://localhost:8000/api/incidents/machine/CV-507/memory

curl -X POST http://localhost:8000/api/incidents/analyze -H "Content-Type: application/json" -d '{
  "machine_id": "CV-507", "machine_type": "Belt_Conveyor", "production_line": "Packing",
  "defect_type": "belt_mistracking",
  "symptoms": ["belt running off to one side", "belt edge fraying"],
  "description": "Belt tracking 21 mm to the drive side again, edge fraying near the tail."
}'

python -m scripts.validate_scenarios   # all six scenarios with checks
```
