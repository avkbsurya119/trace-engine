"""
Analysis Service

Analyzes incidents using historical memory to generate
evidence-based recommendations.
"""

from typing import List, Dict, Any
from datetime import datetime
import uuid

from app.models import (
    Incident,
    IncidentCreate,
    HistoricalIncident,
    AnalysisResult,
    ActionOutcome,
)
from app.hindsight import MemoryService
from .phrasing import ReasoningPhraser
from .recommendation import RecommendationEngine


class AnalysisService:
    """Service for analyzing incidents and generating recommendations."""

    def __init__(self):
        self.memory = MemoryService()
        self.recommender = RecommendationEngine()
        self.phraser = ReasoningPhraser()

    async def close(self):
        """Close underlying services."""
        await self.memory.close()
        await self.phraser.close()

    async def analyze_incident(
        self,
        incident_data: IncidentCreate,
    ) -> AnalysisResult:
        """
        Analyze an incident by searching historical memory and
        generating a recommendation.

        Args:
            incident_data: The incident to analyze

        Returns:
            Complete analysis result with recommendation
        """
        # Create incident record
        incident = Incident(
            incident_id=f"INC-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}",
            **incident_data.model_dump(),
        )

        # 1. Recall: search memory before storing, so the new incident
        #    can never match itself.
        historical = await self.memory.search_similar_incidents(
            incident_data,
            limit=10,
        )

        # Store incident in memory (without outcome yet)
        await self.memory.store_incident(incident)

        # Separate successful and failed interventions
        successful = []
        failed = []

        for hist in historical:
            if hist.incident.action_outcome == ActionOutcome.SUCCESS:
                successful.append({
                    "incident_id": hist.incident.incident_id,
                    "action": hist.incident.action_taken,
                    "root_cause": hist.incident.confirmed_root_cause,
                    "similarity": hist.similarity_score,
                    "relevance": hist.relevance_factors,
                })
            elif hist.incident.action_outcome == ActionOutcome.FAILED:
                failed.append({
                    "incident_id": hist.incident.incident_id,
                    "action": hist.incident.action_taken,
                    "similarity": hist.similarity_score,
                    "relevance": hist.relevance_factors,
                })

        # 2. Score: deterministic, no LLM involved.
        recommendation = self.recommender.generate_recommendation(
            incident=incident,
            historical_incidents=historical,
            successful_interventions=successful,
            failed_interventions=failed,
        )

        # 3. Phrase: LLM rewords the already-computed evidence only.
        recommendation = await self.phraser.phrase(
            incident=incident,
            recommendation=recommendation,
            historical=historical,
            successful=successful,
            failed=failed,
        )

        # Build memory contribution explanation
        memory_contribution = self._explain_memory_contribution(
            historical, successful, failed
        )

        return AnalysisResult(
            current_incident=incident,
            historical_incidents=historical,
            successful_interventions=successful,
            failed_interventions=failed,
            recommendation=recommendation,
            memory_contribution=memory_contribution,
        )

    def _explain_memory_contribution(
        self,
        historical: List[HistoricalIncident],
        successful: List[Dict[str, Any]],
        failed: List[Dict[str, Any]],
    ) -> str:
        """Generate explanation of how memory contributed."""
        if not historical:
            return (
                "No relevant historical incidents found in memory. "
                "Recommendation is based on general troubleshooting principles. "
                "Recording the outcome of this incident will help improve future recommendations."
            )

        parts = [f"Found {len(historical)} relevant historical incident(s) in memory."]

        if successful:
            parts.append(
                f"{len(successful)} previous intervention(s) were successful."
            )

        if failed:
            parts.append(
                f"{len(failed)} previous intervention(s) failed and should be avoided or reconsidered."
            )

        return " ".join(parts)

    async def get_machine_memory(self, machine_id: str) -> Dict[str, Any]:
        """
        Get comprehensive memory summary for a machine.

        Args:
            machine_id: The machine identifier

        Returns:
            Machine memory summary
        """
        incidents = await self.memory.get_machine_history(machine_id)

        if not incidents:
            return {
                "machine_id": machine_id,
                "total_incidents": 0,
                "message": "No incident history for this machine.",
            }

        # Analyze patterns
        defect_counts = {}
        successful_actions = {}
        failed_actions = {}

        for inc in incidents:
            # Count defect types
            defect_counts[inc.defect_type] = defect_counts.get(inc.defect_type, 0) + 1

            # Track action outcomes
            if inc.action_taken and inc.action_outcome:
                if inc.action_outcome == ActionOutcome.SUCCESS:
                    if inc.action_taken not in successful_actions:
                        successful_actions[inc.action_taken] = []
                    successful_actions[inc.action_taken].append(inc.defect_type)
                elif inc.action_outcome == ActionOutcome.FAILED:
                    if inc.action_taken not in failed_actions:
                        failed_actions[inc.action_taken] = []
                    failed_actions[inc.action_taken].append(inc.defect_type)

        return {
            "machine_id": machine_id,
            "total_incidents": len(incidents),
            "recurring_defects": sorted(
                defect_counts.items(), key=lambda x: x[1], reverse=True
            ),
            "successful_interventions": successful_actions,
            "failed_interventions": failed_actions,
            "recent_incidents": [
                {
                    "incident_id": inc.incident_id,
                    "timestamp": inc.timestamp.isoformat(),
                    "defect_type": inc.defect_type,
                    "action_outcome": inc.action_outcome.value if inc.action_outcome else None,
                }
                for inc in incidents[:5]
            ],
        }
