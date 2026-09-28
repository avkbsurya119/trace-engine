# TRACE Demo Script

A 5–7 minute walkthrough: **landing → dashboard → with vs without memory → new problem → record outcome → memory loop → machine history → TRACE Intelligence → ROI view.**

## Where to run it

| | |
|---|---|
| **Live** | https://trace-frontend-i5gp.onrender.com/ (API: https://trace-api-60le.onrender.com). Open it a minute early, because the free tier needs 30–60 s to wake up. The sidebar status lights should show Hindsight memory `trace-manufacturing`, SQLite work orders, and the LLM. |
| **Local** | See the commands below, then open http://localhost:3000 |

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env            # fill in HINDSIGHT_API_KEY and GROQ_API_KEY
python seed_data.py             # 567 synthetic work orders into SQLite + Hindsight (~1 min)
uvicorn main:app --port 8000 --reload

# Frontend (separate terminal)
cd frontend && npm install && npm run dev

# Before each live demo: make sure AC-407 has no recorded outcome
cd backend && python -m scripts.demo --reset
```

**Before you present:**

- **The deployed demo machine keeps its state.** On the Render deployment, anything recorded on **AC-407** stays until the next redeploy, which reseeds the database. If AC-407's Machine Memory page already shows a recorded outcome for *condensate drain failure*, Scene 3 will find that evidence. Either present Scene 5 directly, or run the demo locally after `--reset`.
- **Rehearse without the UI:** `python -m scripts.demo --runs 3` runs the memory loop from the command line.
- **Use the presets:** the Report form has a *Load a demo incident* picker with the same incidents `scripts/demo.py` uses, so nothing needs to be typed live.
- **Use deep links to jump between scenes:** `/?view=dashboard`, `/?view=intelligence`, `/?view=memory&machine=CNC-204`, `/?view=sliders`.

**If you're asked "is the data real?"** No, it's synthetic, but TRACE is data-driven end to end. Nothing is hardcoded: every recommendation and chart is computed from whatever work orders are loaded. A real plant's CMMS export goes in through the same seeding path and TRACE starts learning from that history. (README → *Synthetic data, real-data ready*.)

The demo follows the [problem statement](docs/HackwithHyderabad%203.0%20Problem%20Statament.docx): memory is the star, the before/after is visible in under a minute (Scenes 2–5), and TRACE visibly gets smarter.

---

## Scene 0: Landing page

The app opens on the 3D landing page ("Troubleshoot Smarter, Not Harder"). Use its links to enter the dashboard, report an incident, open a showcase machine's memory, or open the ROI sliders.

## Scene 1: Dashboard ("What is happening?")

- 567 work orders across 39 machines of 5 equipment types, covering about 15 months. The subtitle says the history is synthetic but operationally realistic and names the memory bank.
- The outcome mix: roughly half of the repairs worked. Failed and partial repairs are kept, because they are evidence too.
- Most frequent problems, and the fleet by equipment type (each card opens that type's showcase machine).

## Scene 2: With vs without memory

1. Open **TRACE Intelligence** and click **With vs without memory**.
2. Walk through the three tabs: **CNC-204** spindle vibration, **HP-303** pressure loss and **CV-507** belt mistracking.

**Expected (computed live, nothing stored):**

- *Without memory:* "No evidence-backed recommendation" (insufficient evidence).
- *With memory:* a specific intervention with a computed basis. For example, HP-303 → Relief valve replacement, HIGH ("7 of 7 recorded attempts succeeded").
- *Trial-and-error cost on that machine:* for example, HP-303 went through 3 unsuccessful attempts and about 75 h of downtime before the right fix.

## Scene 3: A brand-new problem (no history)

1. Open **Report Incident** and choose the preset *Demo 1: new problem, no history (AC-407)*, or fill it in by hand:
   - Machine: Rotary screw air compressor → **AC-407** (commissioned 2026-08)
   - Problem: **Condensate drain failure**
   - Symptoms: *water in compressed air line*, *auto drain not cycling*
   - Description: "Water spitting from the air drops at the molding hall. Electronic drain on the wet receiver is not cycling."
2. Click **Analyze Incident**. The progress panel names each stage: recall, filter, score, explain.

**Expected:**

- "No relevant history found." Hindsight recalled about 67 compressor work orders, and none of them was about this problem.
- **The recommendation is intentionally withheld** (insufficient evidence). TRACE does not guess, and the AI summary box says the same.

## Scene 4: Record the outcome

1. Open **Record what was done and whether it worked**.
2. Fill in the outcome:
   - Intervention type: *Condensate drain replacement*
   - Action: "Replaced zero-loss condensate drain on wet receiver and cleaned inlet strainer"
   - Outcome: **SUCCESS**
   - Root cause: "Drain inlet strainer blocked with rust"
   - Repair time 55 min, downtime 90 min
3. Click **Save to memory**. You should see "Saved to SQLite and Hindsight" and *memory grew*.

## Scene 5: The memory loop

1. Report a similar incident on **AC-407**, using the preset *Demo 2: same problem again (AC-407)* or these values:
   - Symptoms: *water in compressed air line*, *wet receiver tank level high*
   - Description: "Moisture again at molding hall drops; drain does not seem to discharge."
2. Analyze it.

**Expected:**

- TRACE finds 1 related work order, and it is on AC-407.
- The evidence (**Worked**) is the Scene 3 incident, tagged **this machine** with about an 85 % match. It shows the action, confirmed cause, notes and the text recalled from Hindsight.
- Recommendation: **Condensate drain replacement** at **LOW** confidence, with the basis "1 of 1 recorded attempt succeeded".
- The AI summary cites the Scene 3 incident ID.

**Point at:**

- **Decision pipeline:** click *Memory retrieval* to show the two tag-filtered recalls.
- ***Why this recommendation*:** the confidence checklist, which shows why this is only LOW.
- **The AI box:** it supplies the wording only.

## Scene 6: Machine memory ("What happened before?")

Open **Machine Memory → CNC-204**, or click the CNC card on the dashboard.

**Expected:**

- 15 work orders, the recurring problems, and what has and hasn't worked on this machine.
- The timeline shows the spindle chain: Nov 2025 alignment **FAILED** → bearing replacement **SUCCESS**; Jun 2026 re-lubrication **PARTIAL** → bearing replacement **SUCCESS**. The chain markers read *follow-up* and *came back after a fix*.

## Scene 7: TRACE Intelligence ("What has TRACE learned?")

- **Memory impact:** in the replay, attempts that matched memory's recommendation worked **58 %** of the time (3.1 h median downtime), versus **48 %** (3.8 h) for a different action.
- **Knowledge evolution:** problems TRACE can answer grew from 11 to 24 of 25, and HIGH-confidence problems from 0 to 8.
- **Recommendation trust:** pick any problem to see the same checklist and verdicts the analysis page uses.
- **Reliable repairs:** ranked by Wilson lower bound. Also show the failure patterns, machine ranking and knowledge network.
- Everything on this page is computed from the work orders by the deterministic engine, with no LLM.

## Scene 8 (optional): Adaptive Intelligence & ROI

Open `/?view=sliders`:

- **Comparison slider:** drag between *without* and *with* memory for the showcase machines. This uses live data.
- **ROI simulator:** adjust fleet size, downtime cost ($/h), adoption and the other inputs.
- **Learning scrubber:** plays 16 months of learning.

Say it plainly: the ROI figures come from the assumptions on screen, and the scrubber is an illustration. The measured history is in Scene 7.

---

## Key points to land

1. **Memory, not lookup.** Hindsight ranks work orders by meaning, and each evidence card shows the memory text it recalled.
2. **Machine-type isolation.** Recall is tag-filtered, so press repairs never appear as evidence for a CNC.
3. **Failures are evidence.** Failed and partial repairs are shown and lower the confidence.
4. **Deterministic decision.** The action and confidence come from outcome counts. The LLM only writes the summary and cannot cite anything that wasn't retrieved.
5. **Honest when empty.** With no history, TRACE makes no recommendation.
6. **It learns.** One recorded outcome changes the next answer.

---

## CLI

```bash
API=https://trace-api-60le.onrender.com/api   # or http://localhost:8000/api

curl $API/dashboard/health
curl $API/dashboard/stats
curl $API/dashboard/hero-machines
curl $API/incidents/machine/CV-507/memory
curl "$API/intelligence/problem?machine_type=Hydraulic_Press&defect_type=pressure_loss"

curl -X POST $API/incidents/analyze -H "Content-Type: application/json" -d '{
  "machine_id": "CV-507", "machine_type": "Belt_Conveyor", "production_line": "Packing",
  "defect_type": "belt_mistracking",
  "symptoms": ["belt running off to one side", "belt edge fraying"],
  "description": "Belt tracking 21 mm to the drive side again, edge fraying near the tail."
}'

python -m scripts.validate_scenarios   # all six scenarios with checks (local)
```
