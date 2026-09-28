"""
Analysis Service

Incident -> Hindsight recall -> relevance gate -> deterministic scoring
-> LLM phrasing of the already-computed result.
"""

import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List

from app.data.catalog import FLEET
from app.hindsight import MemoryService
from app.models import (
    ActionOutcome,
    AnalysisResult,
    HistoricalIncident,
    Incident,
    IncidentCreate,
)

from .phrasing import ReasoningPhraser
from .recommendation import RecommendationEngine

# A recalled incident counts as evidence if it is the same defect type, or
# a closely related one (shared symptom AND high semantic similarity).
RELATED_MIN_SIMILARITY = 0.80
MAX_EVIDENCE = 15


def select_evidence(
    incident: IncidentCreate,
    recalled: List[HistoricalIncident],
) -> List[HistoricalIncident]:
    """Deterministic relevance gate over what Hindsight recalled."""

    evidence = []
    current_symptoms = {s.lower() for s in incident.symptoms}
    for hist in recalled:
        past = hist.incident
        if past.defect_type == incident.defect_type:
            evidence.append(hist)
        elif (
            current_symptoms & {s.lower() for s in past.symptoms}
            and hist.similarity_score >= RELATED_MIN_SIMILARITY
        ):
            hist.relevance_factors.append("Related defect (high similarity)")
            evidence.append(hist)
    # This machine's own history first, then the closest fleet matches.
    evidence.sort(
        key=lambda h: (h.incident.machine_id == incident.machine_id, h.similarity_score),
        reverse=True,
    )
    return evidence[:MAX_EVIDENCE]


def _intervention(hist: HistoricalIncident, incident: IncidentCreate) -> Dict[str, Any]:
    past = hist.incident
    return {
        "incident_id": past.incident_id,
        "action": past.action_taken,
        "category": past.intervention_category or past.action_taken,
        "outcome": past.action_outcome.value if past.action_outcome else None,
        "root_cause": past.confirmed_root_cause,
        "machine_id": past.machine_id,
        "same_machine": past.machine_id == incident.machine_id,
        "date": past.timestamp.isoformat(),
        "similarity": hist.similarity_score,
        "relevance": hist.relevance_factors,
    }


class AnalysisService:
    """Service for analyzing incidents and generating recommendations."""

    def __init__(self):
        self.memory = MemoryService()
        self.recommender = RecommendationEngine()
        self.phraser = ReasoningPhraser()

    async def close(self):
        await self.memory.close()
        await self.phraser.close()

    async def analyze_incident(self, incident_data: IncidentCreate) -> AnalysisResult:
        now = datetime.now(timezone.utc)
        incident = Incident(
            incident_id=f"INC-{now:%Y%m%d}-{uuid.uuid4().hex[:6].upper()}",
            timestamp=now,
            **incident_data.model_dump(),
        )

        # 1. Recall before storing, so the new incident can never match itself.
        recalled, trace = await self.memory.search_similar_incidents(incident_data)

        # 2. Relevance gate (deterministic).
        evidence = select_evidence(incident_data, recalled)
        trace["evidence_incidents"] = len(evidence)
        trace["relevance_rule"] = (
            f"same defect type, or shared symptom with similarity >= {RELATED_MIN_SIMILARITY}"
        )

        await self.memory.store_incident(incident)

        # 3. Deterministic scoring.
        recommendation = self.recommender.generate_recommendation(incident, evidence)

        # 4. LLM phrases the computed result; it cannot change it.
        recommendation = await self.phraser.phrase(incident, recommendation, evidence)

        by_outcome = defaultdict(list)
        for hist in evidence:
            by_outcome[hist.incident.action_outcome].append(_intervention(hist, incident_data))

        return AnalysisResult(
            current_incident=incident,
            historical_incidents=evidence,
            successful_interventions=by_outcome[ActionOutcome.SUCCESS],
            failed_interventions=by_outcome[ActionOutcome.FAILED],
            partial_interventions=by_outcome[ActionOutcome.PARTIAL],
            recommendation=recommendation,
            memory_contribution=self._explain(incident, trace, evidence),
            memory_trace=trace,
        )

    async def memory_impact(self, incident_data: IncidentCreate) -> Dict[str, Any]:
        """
        Dry run (nothing is stored, no LLM): the deterministic recommendation
        this incident would get with no memory versus with Hindsight recall.
        """

        incident = Incident(incident_id="PREVIEW", **incident_data.model_dump())
        recalled, trace = await self.memory.search_similar_incidents(incident_data)
        evidence = select_evidence(incident_data, recalled)

        without = self.recommender.generate_recommendation(incident, [])
        with_memory = self.recommender.generate_recommendation(incident, evidence)

        history = await self.memory.get_machine_history(incident_data.machine_id)
        same_problem = sorted(
            (i for i in history if i.defect_type == incident_data.defect_type),
            key=lambda x: x.timestamp,
        )
        not_working = [
            i for i in same_problem
            if i.action_outcome in (ActionOutcome.FAILED, ActionOutcome.PARTIAL)
        ]

        return {
            "without_memory": without,
            "with_memory": with_memory,
            "evidence_incidents": [h.incident.incident_id for h in evidence],
            "memory_trace": {**trace, "evidence_incidents": len(evidence)},
            "trial_and_error": {
                "attempts_that_did_not_work": len(not_working),
                "downtime_minutes": sum(i.downtime_minutes or 0 for i in not_working),
                "incident_ids": [i.incident_id for i in not_working],
            },
            "machine_history": [
                {
                    "incident_id": i.incident_id,
                    "timestamp": i.timestamp.isoformat(),
                    "intervention_category": i.intervention_category,
                    "action_outcome": i.action_outcome.value if i.action_outcome else None,
                    "downtime_minutes": i.downtime_minutes,
                }
                for i in same_problem
            ],
        }

    @staticmethod
    def _explain(incident: Incident, trace: Dict[str, Any], evidence: List[HistoricalIncident]) -> str:
        label = FLEET.get(incident.machine_type, {}).get("label", incident.machine_type)
        text = (
            f"Hindsight recalled {trace['memory_facts_recalled']} memory facts from "
            f"{trace['incidents_recalled']} past work orders on {label}s. "
        )
        if not evidence:
            return text + (
                "None of them describes this problem with a recorded outcome, so there is no "
                "historical evidence to use. Recording the outcome of this incident creates the first."
            )
        same_machine = sum(1 for h in evidence if h.incident.machine_id == incident.machine_id)
        return text + (
            f"{len(evidence)} match this problem and have a recorded outcome; they are the evidence "
            f"below ({same_machine} from {incident.machine_id} itself). Each links to its exact "
            "SQLite work order by incident ID."
        )

    # ------------------------------------------------------------------
    # Machine memory
    # ------------------------------------------------------------------

    async def get_machine_memory(self, machine_id: str) -> Dict[str, Any]:
        incidents = await self.memory.get_machine_history(machine_id)

        if not incidents:
            return {
                "machine_id": machine_id,
                "total_incidents": 0,
                "message": "No incident history for this machine.",
                "recurring_defects": [],
                "successful_interventions": {},
                "failed_interventions": {},
                "recent_incidents": [],
                "timeline": [],
            }

        defect_counts: Dict[str, int] = defaultdict(int)
        successful: Dict[str, List[str]] = defaultdict(list)
        failed: Dict[str, List[str]] = defaultdict(list)
        outcomes: Dict[str, int] = defaultdict(int)
        downtime = 0

        for inc in incidents:
            defect_counts[inc.defect_type] += 1
            downtime += inc.downtime_minutes or 0
            if inc.action_outcome:
                outcomes[inc.action_outcome.value] += 1
            category = inc.intervention_category or inc.action_taken
            if category and inc.action_outcome == ActionOutcome.SUCCESS:
                successful[category].append(inc.defect_type)
            elif category and inc.action_outcome == ActionOutcome.FAILED:
                failed[category].append(inc.defect_type)

        first = incidents[0]
        spec = FLEET.get(first.machine_type, {})
        machine = spec.get("machines", {}).get(machine_id, {})

        timeline = [
            {
                "incident_id": inc.incident_id,
                "timestamp": inc.timestamp.isoformat(),
                "defect_type": inc.defect_type,
                "description": inc.description,
                "action_taken": inc.action_taken,
                "intervention_category": inc.intervention_category,
                "action_outcome": inc.action_outcome.value if inc.action_outcome else None,
                "confirmed_root_cause": inc.confirmed_root_cause,
                "technician_id": inc.technician_id,
                "technician_notes": inc.technician_notes,
                "downtime_minutes": inc.downtime_minutes,
                "severity": inc.severity,
                "operating_hours": inc.operating_hours,
            }
            for inc in incidents
        ]

        return {
            "machine_id": machine_id,
            "machine_type": first.machine_type,
            "model": machine.get("model"),
            "production_line": first.production_line,
            "total_incidents": len(incidents),
            "total_downtime_hours": round(downtime / 60, 1),
            "outcome_distribution": dict(outcomes),
            "recurring_defects": sorted(defect_counts.items(), key=lambda x: x[1], reverse=True),
            "successful_interventions": dict(successful),
            "failed_interventions": dict(failed),
            "recent_incidents": [
                {
                    "incident_id": t["incident_id"],
                    "timestamp": t["timestamp"],
                    "defect_type": t["defect_type"],
                    "action_outcome": t["action_outcome"],
                }
                for t in timeline[:5]
            ],
            "timeline": timeline,
        }
