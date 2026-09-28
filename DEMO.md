# TRACE Demo Script

## Prerequisites

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env  # Fill in HINDSIGHT_API_KEY and GROQ_API_KEY
python seed_data.py
uvicorn main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

---

## Demo Scenario: The Memory Loop

### Scene 1: Dashboard Overview

1. Open the dashboard at http://localhost:3000
2. Show the stats: 13 incidents, 7 SUCCESS, 2 FAILED
3. Point out the defect type distribution
4. Highlight "Hindsight Memory Active" indicator

### Scene 2: Report Incident with History (CNC)

1. Click "Report Incident"
2. Fill in:
   - Machine ID: `CNC-07`
   - Machine Type: `CNC`
   - Production Line: `LINE-A`
   - Defect Type: `surface_roughness`
   - Symptoms: Select "rough surface finish", "high spindle vibration"
   - Description: "Surface finish degraded during aluminum machining"
3. Click "Analyze Incident"

**Expected Result:**
- Historical incidents found (4 similar CNC incidents, ~85% similarity)
- Recommendation: "Reduced spindle speed to 3500 RPM" (from TRC-CNC-001)
- Confidence: LOW or MEDIUM (based on evidence)
- Reasoning shows AI-phrased badge
- Failed interventions shown (TRC-CNC-002: increased feed rate - FAILED)

### Scene 3: Report Incident with No History (New Machine Type)

1. Click "Report Incident"
2. Fill in:
   - Machine ID: `LASER-NEW-01`
   - Machine Type: `Laser_Cutter`
   - Production Line: `PROTO-LAB`
   - Defect Type: `dross_buildup`
   - Symptoms: Select "dross accumulation", "edge roughness"
   - Description: "Excessive dross on cut edges"
3. Click "Analyze Incident"

**Expected Result:**
- No historical incidents (or few if LASER data exists)
- Recommendation: Generic troubleshooting
- Confidence: INSUFFICIENT_DATA
- Warning: "This is the first recorded incident of this type"

### Scene 4: Record Outcome (Building Memory)

1. From the analysis screen, scroll to "Record Outcome"
2. Fill in:
   - Action Performed: "Reduced cutting speed and increased assist gas pressure"
   - Outcome: SUCCESS
   - Confirmed Root Cause: "Cutting speed too high for material thickness"
   - Resolution Time: 20
   - Notes: "Also cleaned nozzle"
3. Click "Save to Memory"

**Expected Result:**
- "Saved to Memory" confirmation
- This incident is now in Hindsight for future recall

### Scene 5: The Memory Loop (New Similar Incident)

1. Report another incident:
   - Machine ID: `LASER-NEW-02`
   - Machine Type: `Laser_Cutter`
   - Defect Type: `dross_buildup`
   - Description: "Same dross issue on different laser"
2. Analyze

**Expected Result:**
- Now recalls the first LASER incident (~85% similarity)
- Recommends: "Reduced cutting speed and increased assist gas pressure"
- Shows as successful intervention
- Memory is learning!

### Scene 6: Machine Memory View

1. Click "View Machine Memory" from analysis screen
2. Or use sidebar search: enter `CNC-01`

**Expected Result:**
- Shows machine's incident history
- Recurring defects with counts
- What has worked vs what hasn't
- Recent incidents timeline

---

## Key Demo Points

1. **Semantic Search**: Hindsight finds similar incidents even with different wording
2. **Machine Type Isolation**: CNC incidents don't contaminate Laser recommendations
3. **Learning Loop**: First incident builds memory for future incidents
4. **Evidence-Based**: Shows exactly which incidents support the recommendation
5. **LLM Phrasing**: Reasoning is human-readable, not template-based
6. **Fallback**: Works without LLM (deterministic reasoning)

---

## API Endpoints for CLI Demo

```bash
# Health check
curl http://localhost:8000/api/dashboard/health

# Dashboard stats
curl http://localhost:8000/api/dashboard/stats

# Analyze incident
curl -X POST http://localhost:8000/api/incidents/analyze \
  -H "Content-Type: application/json" \
  -d '{"machine_id":"CNC-07","machine_type":"CNC","production_line":"LINE-A","defect_type":"surface_roughness","symptoms":["rough surface finish"],"description":"Surface degraded"}'

# Record outcome
curl -X PATCH http://localhost:8000/api/incidents/{incident_id}/outcome \
  -H "Content-Type: application/json" \
  -d '{"action_taken":"Fixed it","action_outcome":"SUCCESS","confirmed_root_cause":"The cause"}'

# Machine memory
curl http://localhost:8000/api/incidents/machine/CNC-01/memory
```
