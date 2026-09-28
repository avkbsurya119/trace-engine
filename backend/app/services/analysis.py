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
    CrossMachineEvidence,
    HistoricalIncident,
    Incident,
    IncidentCreate,
    PatternAlert,
)

from .phrasing import ReasoningPhraser
from .recommendation import RecommendationEngine

# A recalled incident counts as evidence if it is the same defect type, or
# a closely related one (shared symptom AND high semantic similarity).
RELATED_MIN_SIMILARITY = 0.80
MAX_EVIDENCE = 15

# Recency decay thresholds (days)
RECENCY_HIGH_DAYS = 60      # < 2 months = high relevance
RECENCY_MEDIUM_DAYS = 240   # < 8 months = medium relevance
# > 8 months = low relevance


def calculate_recency(incident_date: datetime, now: datetime) -> tuple[float, str, int]:
    """Calculate recency score and label for an incident."""
    # Ensure both datetimes are timezone-aware (SQLite stores naive timestamps)
    if incident_date.tzinfo is None:
        incident_date = incident_date.replace(tzinfo=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    days_ago = (now - incident_date).days
    if days_ago < 0:
        days_ago = 0

    if days_ago <= RECENCY_HIGH_DAYS:
        score = 1.0
        label = "high"
    elif days_ago <= RECENCY_MEDIUM_DAYS:
        # Linear decay from 1.0 to 0.6
        score = 1.0 - 0.4 * ((days_ago - RECENCY_HIGH_DAYS) / (RECENCY_MEDIUM_DAYS - RECENCY_HIGH_DAYS))
        label = "medium"
    else:
        # Linear decay from 0.6 to 0.3 (minimum)
        years_past = (days_ago - RECENCY_MEDIUM_DAYS) / 365
        score = max(0.3, 0.6 - 0.15 * years_past)
        label = "low"

    return round(score, 2), label, days_ago


def detect_pattern(
    defect_type: str,
    machine_type: str,
    evidence: List[HistoricalIncident],
) -> PatternAlert | None:
    """Detect if this defect is a recurring pattern."""
    # Filter to same defect type
    matching = [h for h in evidence if h.incident.defect_type == defect_type]

    if len(matching) < 2:
        return None

    # Sort by timestamp
    sorted_incidents = sorted(matching, key=lambda h: h.incident.timestamp)

    success = sum(1 for h in matching if h.incident.action_outcome == ActionOutcome.SUCCESS)
    failed = sum(1 for h in matching if h.incident.action_outcome == ActionOutcome.FAILED)
    partial = sum(1 for h in matching if h.incident.action_outcome == ActionOutcome.PARTIAL)
    machines = list(set(h.incident.machine_id for h in matching))

    return PatternAlert(
        defect_type=defect_type,
        total_occurrences=len(matching),
        first_occurrence=sorted_incidents[0].incident.timestamp.strftime("%B %Y"),
        most_recent=sorted_incidents[-1].incident.timestamp.strftime("%B %Y"),
        successful_resolutions=success,
        failed_resolutions=failed,
        partial_resolutions=partial,
        machines_affected=machines,
        is_recurring=len(matching) >= 3,
    )


def aggregate_cross_machine_evidence(
    current_machine_id: str,
    machine_type: str,
    evidence: List[HistoricalIncident],
) -> List[CrossMachineEvidence]:
    """Find interventions that worked across multiple machines of the same type."""
    # Group by intervention category
    by_intervention: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
        "example_action": "",
        "machines_succeeded": set(),
        "machines_failed": set(),
    })

    for hist in evidence:
        inc = hist.incident
        if inc.machine_type != machine_type:
            continue
        if inc.machine_id == current_machine_id:
            continue  # We want cross-machine evidence

        category = inc.intervention_category or inc.action_taken
        if not category:
            continue

        by_intervention[category]["example_action"] = inc.action_taken or category

        if inc.action_outcome == ActionOutcome.SUCCESS:
            by_intervention[category]["machines_succeeded"].add(inc.machine_id)
        elif inc.action_outcome == ActionOutcome.FAILED:
            by_intervention[category]["machines_failed"].add(inc.machine_id)

    results = []
    for category, data in by_intervention.items():
        succeeded = list(data["machines_succeeded"])
        failed = list(data["machines_failed"])
        success_count = len(succeeded)
        total = success_count + len(failed)

        if success_count < 2:
            continue  # Need at least 2 machines for cross-machine evidence

        # Determine confidence
        if success_count >= 3 and len(failed) == 0:
            confidence = "strong"
        elif success_count >= 2 and success_count > len(failed):
            confidence = "moderate"
        elif success_count >= 2:
            confidence = "weak"
        else:
            confidence = "none"

        results.append(CrossMachineEvidence(
            intervention_category=category,
            example_action=data["example_action"],
            machines_succeeded=succeeded,
            machines_failed=failed,
            success_count=success_count,
            total_count=total,
            cross_machine_confidence=confidence,
        ))

    # Sort by success count descending
    results.sort(key=lambda x: x.success_count, reverse=True)
    return results


def select_evidence(
    incident: IncidentCreate,
    recalled: List[HistoricalIncident],
    now: datetime | None = None,
) -> List[HistoricalIncident]:
    """Deterministic relevance gate over what Hindsight recalled."""
    if now is None:
        now = datetime.now(timezone.utc)

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

    # Calculate recency for all evidence
    for hist in evidence:
        score, label, days = calculate_recency(hist.incident.timestamp, now)
        hist.recency_score = score
        hist.recency_label = label
        hist.days_ago = days
        if label == "high":
            hist.relevance_factors.append("Recent (< 2 months)")
        elif label == "low":
            hist.relevance_factors.append("Older incident (> 8 months)")

    # Sort: same machine first, then by combined score (similarity * recency)
    evidence.sort(
        key=lambda h: (
            h.incident.machine_id == incident.machine_id,
            h.similarity_score * h.recency_score,
        ),
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
        # Recency data
        "recency_score": hist.recency_score,
        "recency_label": hist.recency_label,
        "days_ago": hist.days_ago,
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

        # 2. Relevance gate (deterministic) with recency scoring.
        evidence = select_evidence(incident_data, recalled, now)
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

        # 5. Pattern detection - "We've seen this before"
        pattern_alert = detect_pattern(
            incident_data.defect_type,
            incident_data.machine_type,
            evidence,
        )

        # 6. Cross-machine learning
        cross_machine = aggregate_cross_machine_evidence(
            incident_data.machine_id,
            incident_data.machine_type,
            evidence,
        )

        return AnalysisResult(
            current_incident=incident,
            historical_incidents=evidence,
            successful_interventions=by_outcome[ActionOutcome.SUCCESS],
            failed_interventions=by_outcome[ActionOutcome.FAILED],
            partial_interventions=by_outcome[ActionOutcome.PARTIAL],
            recommendation=recommendation,
            memory_contribution=self._explain(incident, trace, evidence),
            memory_trace=trace,
            pattern_alert=pattern_alert,
            cross_machine_evidence=cross_machine,
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
