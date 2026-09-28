# TRACE — Troubleshooting & Root-Cause Adaptive Context Engine

An AI-powered manufacturing defect resolution system that uses persistent memory to assist engineers with troubleshooting machine defects. TRACE learns from every resolved incident, building organizational knowledge that improves recommendations over time.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Frontend Components](#frontend-components)
- [The Memory Loop](#the-memory-loop)
- [Demo Scenarios](#demo-scenarios)
- [Development](#development)
- [License](#license)

## Overview

TRACE maintains a persistent memory of manufacturing incidents, including:

- **Machine-specific incidents** — Tracked by machine ID and type
- **Observed symptoms** — What operators noticed (vibration, noise, surface defects)
- **Sensor readings** — Quantitative data at time of incident
- **Operating conditions** — Material, coolant status, environmental factors
- **Root causes** — Both suspected and confirmed after investigation
- **Interventions** — Actions taken and their outcomes (SUCCESS/PARTIAL/FAILED)
- **Resolution details** — How issues were ultimately resolved

As incidents accumulate, TRACE becomes increasingly effective at recommending interventions based on **verified historical outcomes** — not generic knowledge, but your organization's actual experience.

## Key Features

### Semantic Memory Search
Uses Hindsight to find similar incidents even when described differently. "Surface roughness" matches "rough finish" and "poor surface quality."

### Machine Type Isolation
CNC incidents inform CNC recommendations. Hydraulic press solutions won't contaminate laser cutter advice.

### Evidence-Based Recommendations
Every recommendation cites specific historical incidents. See exactly which past cases support the suggested action.

### Success/Failure Tracking
Learn not just what worked, but what didn't. Failed interventions are flagged as warnings.

### LLM-Enhanced Reasoning
Groq-powered natural language explanations make recommendations human-readable, with fallback to deterministic reasoning.

### Confidence Levels
- **HIGH** — Multiple successful interventions, no failures
- **MEDIUM** — Some evidence, mixed results
- **LOW** — Limited data, single success
- **INSUFFICIENT_DATA** — No relevant history, general guidance only

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js 14)                         │
│  ┌───────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────┐ │
│  │ Dashboard │ │ Report Incident│ │Incident Analysis│ │Machine Mem │ │
│  │  Stats    │ │     Form       │ │ + Recommendation│ │   History  │ │
│  └───────────┘ └────────────────┘ └────────────────┘ └────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼ REST API
┌─────────────────────────────────────────────────────────────────────┐
│                         Backend (FastAPI)                            │
│  ┌────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐ │
│  │  Incidents API │ │  Dashboard API  │ │   Analysis Service      │ │
│  │  /analyze      │ │  /stats         │ │   - Recall similar      │ │
│  │  /outcome      │ │  /health        │ │   - Score interventions │ │
│  │  /machine/mem  │ │                 │ │   - Generate recommend  │ │
│  └────────────────┘ └─────────────────┘ └─────────────────────────┘ │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                      Memory Service                              ││
│  │  - Store incidents (SQLite + Hindsight)                         ││
│  │  - Search similar (Hindsight semantic search)                   ││
│  │  - Filter by machine type                                       ││
│  │  - Update outcomes                                              ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Hindsight   │     │   SQLite     │     │  Groq LLM    │
│  (Semantic   │     │  (Structured │     │  (Reasoning  │
│   Memory)    │     │   Records)   │     │   Phrasing)  │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Data Flow

1. **Incident Reported** → Stored in SQLite (structured) + Hindsight (semantic)
2. **Analysis Requested** → Hindsight recalls similar incidents → SQLite provides full records
3. **Recommendation Generated** → Deterministic scoring → LLM phrasing (optional)
4. **Outcome Recorded** → Updates both SQLite and Hindsight for future recall

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS | Modern React UI with server components |
| Backend | Python 3.11+, FastAPI, Pydantic | Async API with type validation |
| Memory | Hindsight | Semantic search and persistent memory |
| Database | SQLite + aiosqlite | Structured incident storage |
| LLM | Groq (OpenAI-compatible) | Natural language reasoning |
| Icons | Lucide React | Consistent iconography |

## Project Structure

```
trace-engine/
├── frontend/                      # Next.js application
│   ├── src/
│   │   ├── app/                   # App router
│   │   │   ├── layout.tsx         # Root layout
│   │   │   └── page.tsx           # Main page (view router)
│   │   ├── components/
│   │   │   ├── Dashboard.tsx      # Stats overview
│   │   │   ├── ReportIncident.tsx # Incident form
│   │   │   ├── IncidentAnalysis.tsx # Full analysis view
│   │   │   ├── MachineMemory.tsx  # Machine history
│   │   │   └── Sidebar.tsx        # Navigation
│   │   ├── lib/
│   │   │   ├── api.ts             # API client
│   │   │   └── utils.ts           # Helpers
│   │   └── types/
│   │       └── incident.ts        # TypeScript interfaces
│   ├── tailwind.config.ts
│   └── package.json
│
├── backend/                       # FastAPI application
│   ├── app/
│   │   ├── api/
│   │   │   ├── incidents.py       # /incidents/* routes
│   │   │   └── dashboard.py       # /dashboard/* routes
│   │   ├── core/
│   │   │   └── config.py          # Environment config
│   │   ├── db/
│   │   │   ├── database.py        # SQLite setup
│   │   │   ├── models.py          # SQLAlchemy models
│   │   │   └── repository.py      # CRUD operations
│   │   ├── hindsight/
│   │   │   ├── client.py          # Hindsight API client
│   │   │   └── memory.py          # Memory service
│   │   ├── models/
│   │   │   └── incident.py        # Pydantic schemas
│   │   └── services/
│   │       ├── analysis.py        # Analysis orchestration
│   │       ├── recommendation.py  # Scoring engine
│   │       └── phrasing.py        # LLM reasoning
│   ├── main.py                    # FastAPI app
│   ├── seed_data.py               # Sample data loader
│   ├── requirements.txt
│   └── .env.example
│
├── DEMO.md                        # Demo script
└── README.md                      # This file
```

## Getting Started

### Prerequisites

- **Node.js** 18+ (for frontend)
- **Python** 3.11+ (for backend)
- **Hindsight API Key** — Get from [Hindsight](https://hindsight.vectorize.io)
- **Groq API Key** (optional) — For LLM-enhanced reasoning

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Seed sample data (13 manufacturing incidents)
python seed_data.py

# Start server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:3000

## Configuration

### Backend Environment Variables

Create `backend/.env`:

```env
# Application
APP_NAME=TRACE
APP_ENV=development
DEBUG=true

# Hindsight (Required)
HINDSIGHT_API_URL=https://api.hindsight.vectorize.io
HINDSIGHT_API_KEY=hsk_your_api_key_here
HINDSIGHT_NAMESPACE=trace-manufacturing

# Groq LLM (Optional - falls back to deterministic reasoning)
GROQ_API_KEY=gsk_your_groq_key_here
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.1-70b-versatile
LLM_TIMEOUT_SECONDS=30

# Database
DATABASE_URL=sqlite+aiosqlite:///./trace.db

# CORS
CORS_ORIGINS=["http://localhost:3000"]
```

### Frontend Environment Variables

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

## API Reference

### Dashboard

#### GET /api/dashboard/health
Health check endpoint.

```json
{"status": "healthy", "service": "TRACE API"}
```

#### GET /api/dashboard/stats
Get overall statistics.

```json
{
  "total_incidents": 13,
  "incidents_with_outcome": 12,
  "unique_machines": 13,
  "outcome_distribution": {
    "SUCCESS": 7,
    "PARTIAL": 2,
    "FAILED": 2,
    "UNKNOWN": 1
  },
  "defect_type_distribution": {
    "surface_roughness": 4,
    "tool_wear": 1,
    "short_shot": 2
  }
}
```

### Incidents

#### POST /api/incidents/analyze
Submit an incident for analysis.

**Request:**
```json
{
  "machine_id": "CNC-07",
  "machine_type": "CNC",
  "production_line": "LINE-A",
  "defect_type": "surface_roughness",
  "symptoms": ["rough surface finish", "high spindle vibration"],
  "sensor_values": {"spindle_vibration": 7.5, "spindle_speed": 4200},
  "operating_conditions": {"material": "aluminum", "coolant": "ON"},
  "description": "Surface finish degraded during machining",
  "suspected_root_cause": "excessive spindle speed"
}
```

**Response:**
```json
{
  "current_incident": { /* Incident object with generated ID */ },
  "historical_incidents": [
    {
      "incident": { /* Full incident record */ },
      "similarity_score": 0.85,
      "relevance_factors": ["Same machine type", "Same defect type"]
    }
  ],
  "successful_interventions": [
    {
      "incident_id": "TRC-CNC-001",
      "action": "Reduced spindle speed to 3500 RPM",
      "root_cause": "Excessive spindle speed",
      "similarity": 0.85,
      "relevance": ["Same machine type", "Same defect type"]
    }
  ],
  "failed_interventions": [],
  "recommendation": {
    "suggested_action": "Reduced spindle speed to 3500 RPM",
    "confidence": "MEDIUM",
    "reasoning": "Based on 3 similar CNC incidents...",
    "reasoning_source": "llm",
    "supporting_incidents": ["TRC-CNC-001"],
    "warnings": []
  },
  "memory_contribution": "Found 3 relevant historical incidents..."
}
```

#### PATCH /api/incidents/{incident_id}/outcome
Record the outcome of an intervention.

**Request:**
```json
{
  "action_taken": "Reduced spindle speed to 3500 RPM",
  "action_outcome": "SUCCESS",
  "confirmed_root_cause": "Excessive spindle speed",
  "resolution_details": "Surface finish returned to spec",
  "resolution_time_minutes": 18,
  "technician_notes": "Also checked tool wear"
}
```

#### GET /api/incidents/machine/{machine_id}/memory
Get accumulated memory for a specific machine.

```json
{
  "machine_id": "CNC-01",
  "total_incidents": 3,
  "recurring_defects": [["surface_roughness", 2], ["tool_wear", 1]],
  "successful_interventions": {
    "Reduced spindle speed to 3500 RPM": ["surface_roughness"]
  },
  "failed_interventions": {
    "Increased feed rate": ["surface_roughness"]
  },
  "recent_incidents": [
    {
      "incident_id": "TRC-CNC-001",
      "timestamp": "2026-09-24T12:00:00Z",
      "defect_type": "surface_roughness",
      "action_outcome": "SUCCESS"
    }
  ]
}
```

## Frontend Components

### Dashboard
- Stats cards: Total incidents, outcomes, unique machines, success rate
- Outcome distribution bar chart
- Defect type distribution

### Report Incident
- Machine ID and type selection
- Production line input
- Defect type dropdown (aligned with seed data)
- Symptom tag selector with custom input
- Description textarea
- Optional suspected root cause

### Incident Analysis
- Current incident summary
- AI recommendation with confidence badge
- Reasoning source indicator (AI-phrased / Rule-based)
- Historical evidence (expandable cards with similarity scores)
- Successful interventions list
- Failed interventions list (warnings)
- Record outcome form

### Machine Memory
- Stats overview (total incidents, success/fail counts)
- Recurring defects chart
- Recent incidents timeline
- What has worked vs what hasn't

### Sidebar
- Navigation links
- Machine ID search input
- Hindsight memory status indicator

## The Memory Loop

TRACE implements a continuous learning loop:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. REPORT        2. RECALL         3. RECOMMEND               │
│  New incident  →  Find similar   →  Suggest action             │
│                   incidents         based on evidence           │
│                                                                 │
│       ▲                                        │                │
│       │                                        ▼                │
│                                                                 │
│  5. LEARN         4. RECORD                                    │
│  Future recalls ← Store outcome  ←  Engineer acts              │
│  cite this         in memory        and records result         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### First Incident (No History)
- Returns `INSUFFICIENT_DATA` confidence
- Generic troubleshooting guidance
- Warning: "First recorded incident of this type"

### Subsequent Incidents
- Recalls similar past incidents
- Scores interventions by success/failure
- Confidence increases with evidence
- Cites specific supporting incidents

## Demo Scenarios

See [DEMO.md](DEMO.md) for a complete 6-scene walkthrough including:

1. Dashboard overview
2. Report incident with history (CNC surface roughness)
3. Report incident with no history (new machine type)
4. Record outcome (building memory)
5. Memory loop verification (new similar incident recalls first)
6. Machine memory view

## Development

### Running Tests

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm test
```

### Code Style

```bash
# Backend
ruff check .
black .

# Frontend
npm run lint
```

### Building for Production

```bash
# Frontend
cd frontend
npm run build

# Backend - use production ASGI server
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## Key Design Decisions

1. **Dual Storage**: SQLite for structured queries, Hindsight for semantic search
2. **Machine Type Isolation**: Prevents cross-contamination of recommendations
3. **Recall Before Store**: New incidents can't match themselves
4. **LLM Fallback**: Deterministic reasoning if Groq unavailable
5. **Confidence Thresholds**: Based on evidence count and success ratio

## License

MIT

---

> **TRACE does not simply know manufacturing knowledge. It remembers your organization's own troubleshooting experience and uses verified historical outcomes to assist engineers with future incidents.**
