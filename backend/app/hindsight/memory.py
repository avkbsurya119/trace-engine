"""
Memory Service

High-level service for managing manufacturing incident memories.

Architecture:
    SQLite   -> exact structured source of truth
    Hindsight -> semantic memory and similarity retrieval

TRACE uses Hindsight to remember and retrieve relevant historical
incidents, but always gets the complete authoritative incident record
from SQLite.
"""

from typing import List, Optional, Dict, Any

from app.models import (
    Incident,
    IncidentCreate,
    IncidentUpdate,
    HistoricalIncident,
    ActionOutcome,
)

from app.db.repository import IncidentRepository

from .client import HindsightClient


class MemoryService:
    """Service for storing and retrieving manufacturing incident memories."""

    def __init__(self):
        self.client = HindsightClient()
        self.repository = IncidentRepository()

    async def close(self):
        """Close the underlying Hindsight client."""
        await self.client.close()

    # ------------------------------------------------------------------
    # Incident conversion helpers
    # ------------------------------------------------------------------

    def _incident_to_memory(self, incident: Incident) -> Dict[str, Any]:
        """
        Convert an Incident into structured content for Hindsight.
        """

        return {
            "type": "manufacturing_incident",
            "incident_id": incident.incident_id,
            "machine_id": incident.machine_id,
            "machine_type": incident.machine_type,
            "production_line": incident.production_line,
            "timestamp": incident.timestamp.isoformat(),
            "defect_type": incident.defect_type,
            "symptoms": incident.symptoms,
            "sensor_values": incident.sensor_values,
            "operating_conditions": incident.operating_conditions,
            "description": incident.description,
            "suspected_root_cause": incident.suspected_root_cause,
            "confirmed_root_cause": incident.confirmed_root_cause,
            "action_taken": incident.action_taken,
            "action_outcome": (
                incident.action_outcome.value
                if incident.action_outcome
                else None
            ),
            "resolution_details": incident.resolution_details,
            "resolution_time_minutes": incident.resolution_time_minutes,
            "technician_notes": incident.technician_notes,
            "searchable_text": self._build_searchable_text(incident),
        }

    def _build_searchable_text(self, incident: Incident) -> str:
        """
        Build natural-language text for semantic retrieval.
        """

        parts = [
            f"Machine: {incident.machine_id} ({incident.machine_type})",
            f"Line: {incident.production_line}",
            f"Defect: {incident.defect_type}",
            f"Symptoms: {', '.join(incident.symptoms)}",
            f"Description: {incident.description}",
        ]

        if incident.sensor_values:
            parts.append(
                f"Sensor values: {incident.sensor_values}"
            )

        if incident.operating_conditions:
            parts.append(
                f"Operating conditions: {incident.operating_conditions}"
            )

        if incident.suspected_root_cause:
            parts.append(
                f"Suspected cause: {incident.suspected_root_cause}"
            )

        if incident.confirmed_root_cause:
            parts.append(
                f"Confirmed cause: {incident.confirmed_root_cause}"
            )

        if incident.action_taken:
            parts.append(
                f"Action: {incident.action_taken}"
            )

        if incident.action_outcome:
            parts.append(
                f"Outcome: {incident.action_outcome.value}"
            )

        if incident.resolution_details:
            parts.append(
                f"Resolution: {incident.resolution_details}"
            )

        if incident.technician_notes:
            parts.append(
                f"Technician notes: {incident.technician_notes}"
            )

        return " | ".join(parts)

    # ------------------------------------------------------------------
    # Store
    # ------------------------------------------------------------------

    async def store_incident(self, incident: Incident) -> str:
        """
        Store an incident in both SQLite and Hindsight.

        SQLite is the authoritative structured store.
        Hindsight provides semantic memory.
        """

        # --------------------------------------------------------------
        # 1. Store exact incident in SQLite
        # --------------------------------------------------------------
        await self.repository.create(incident)

        # --------------------------------------------------------------
        # 2. Store semantic representation in Hindsight
        # --------------------------------------------------------------
        content = self._incident_to_memory(incident)

        metadata = {
            "incident_id": incident.incident_id,
            "machine_id": incident.machine_id,
            "machine_type": incident.machine_type,
            "production_line": incident.production_line,
            "defect_type": incident.defect_type,
            "has_outcome": (
                incident.action_outcome is not None
            ),
            "outcome": (
                incident.action_outcome.value
                if incident.action_outcome
                else None
            ),
        }

        await self.client.store_memory(
            memory_id=incident.incident_id,
            content=content,
            metadata=metadata,
        )

        return incident.incident_id

    # ------------------------------------------------------------------
    # Semantic search
    # ------------------------------------------------------------------

    async def search_similar_incidents(
        self,
        incident: IncidentCreate,
        limit: int = 10,
    ) -> List[HistoricalIncident]:
        """
        Search Hindsight for semantically similar incidents.

        Hindsight identifies candidate memories.

        SQLite then provides the exact incident records.

        Only incidents with recorded outcomes are returned because
        TRACE needs historical evidence about what happened after
        an intervention.
        """

        # --------------------------------------------------------------
        # Build semantic query
        # --------------------------------------------------------------

        query_parts = [
            f"Machine type: {incident.machine_type}",
            f"Defect: {incident.defect_type}",
            f"Symptoms: {', '.join(incident.symptoms)}",
            f"Description: {incident.description}",
        ]

        if incident.suspected_root_cause:
            query_parts.append(
                f"Suspected cause: {incident.suspected_root_cause}"
            )

        if incident.sensor_values:
            query_parts.append(
                f"Sensor values: {incident.sensor_values}"
            )

        if incident.operating_conditions:
            query_parts.append(
                f"Operating conditions: {incident.operating_conditions}"
            )

        query = " ".join(query_parts)

        # Ask for more candidates than the final limit because:
        # - Hindsight may return observations and world memories
        # - multiple memories can refer to the same incident
        # - some candidates may not have an outcome
        candidate_limit = max(limit * 4, 20)

        memories = await self.client.search_memories(
            query=query,
            limit=candidate_limit,
        )

        # --------------------------------------------------------------
        # Extract unique incident IDs from Hindsight
        # --------------------------------------------------------------

        candidate_ids: List[str] = []
        candidate_scores: Dict[str, float] = {}

        for memory in memories:
            incident_id = self._extract_incident_id(memory)

            if not incident_id:
                continue

            # Avoid duplicate incidents caused by multiple Hindsight
            # memory types such as observation + world.
            if incident_id not in candidate_ids:
                candidate_ids.append(incident_id)

            score = self._extract_score(memory)

            # Keep the strongest score seen for this incident.
            previous_score = candidate_scores.get(incident_id, 0.0)

            if score > previous_score:
                candidate_scores[incident_id] = score

        # --------------------------------------------------------------
        # Fetch exact records from SQLite
        # --------------------------------------------------------------

        results: List[HistoricalIncident] = []

        for incident_id in candidate_ids:
            if len(results) >= limit:
                break

            historical = await self.repository.get(incident_id)

            if historical is None:
                continue

            # All machine types share one Hindsight bank, so semantic
            # recall also surfaces other machine types. Their actions
            # (e.g. "increase press force") are not evidence for this
            # machine, so keep only the same machine type.
            if historical.machine_type != incident.machine_type:
                continue

            # Only historical incidents with an actual recorded
            # troubleshooting outcome are useful evidence.
            if historical.action_outcome is None:
                continue

            similarity = candidate_scores.get(
                incident_id,
                0.0,
            )

            relevance_factors = self._compute_relevance_factors(
                incident,
                historical,
            )

            results.append(
                HistoricalIncident(
                    incident=historical,
                    similarity_score=similarity,
                    relevance_factors=relevance_factors,
                )
            )

        # Highest semantic similarity first.
        results.sort(
            key=lambda item: item.similarity_score,
            reverse=True,
        )

        return results[:limit]

    # ------------------------------------------------------------------
    # Hindsight result helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_incident_id(
        memory: Dict[str, Any],
    ) -> Optional[str]:
        """
        Extract the TRACE incident ID from a Hindsight RecallResult.

        Hindsight can expose the ID through:
        1. document_id
        2. metadata.incident_id
        3. incident_id tag
        """

        document_id = memory.get("document_id")

        if document_id:
            return str(document_id)

        metadata = memory.get("metadata") or {}

        incident_id = metadata.get("incident_id")

        if incident_id:
            return str(incident_id)

        tags = memory.get("tags") or []

        for tag in tags:
            if isinstance(tag, str) and tag.startswith(
                "incident_id:"
            ):
                return tag.split(":", 1)[1]

        return None

    @staticmethod
    def _extract_score(
        memory: Dict[str, Any],
    ) -> float:
        """
        Extract a usable 0-1 similarity score from Hindsight.

        Hindsight's final ranking score is not necessarily a
        probability, so semantic score is preferred when available.
        """

        scores = memory.get("scores") or {}

        if isinstance(scores, dict):
            value = scores.get("semantic")

            if value is None:
                value = scores.get("final")

            if value is not None:
                try:
                    value = float(value)
                    return max(0.0, min(1.0, value))
                except (TypeError, ValueError):
                    pass

        # Compatibility with older response formats.
        for key in (
            "similarity_score",
            "score",
        ):
            value = memory.get(key)

            if value is not None:
                try:
                    value = float(value)
                    return max(0.0, min(1.0, value))
                except (TypeError, ValueError):
                    pass

        return 0.0

    # ------------------------------------------------------------------
    # Relevance
    # ------------------------------------------------------------------

    def _compute_relevance_factors(
        self,
        current: IncidentCreate,
        historical: Incident,
    ) -> List[str]:
        """
        Explain why a historical incident is relevant.
        """

        factors = []

        if current.machine_id == historical.machine_id:
            factors.append("Same machine")

        if current.machine_type == historical.machine_type:
            factors.append("Same machine type")

        if current.production_line == historical.production_line:
            factors.append("Same production line")

        if current.defect_type == historical.defect_type:
            factors.append("Same defect type")

        current_symptoms = set(
            symptom.lower()
            for symptom in current.symptoms
        )

        historical_symptoms = set(
            symptom.lower()
            for symptom in historical.symptoms
        )

        overlap = current_symptoms & historical_symptoms

        if overlap:
            factors.append(
                "Shared symptoms: "
                + ", ".join(sorted(overlap))
            )

        return factors

    # ------------------------------------------------------------------
    # Exact incident lookup
    # ------------------------------------------------------------------

    async def get_incident(
        self,
        incident_id: str,
    ) -> Optional[Incident]:
        """
        Retrieve an exact incident from SQLite.

        SQLite is the source of truth.
        """

        return await self.repository.get(incident_id)

    # ------------------------------------------------------------------
    # Update outcome
    # ------------------------------------------------------------------

    async def update_incident_outcome(
        self,
        incident_id: str,
        update: IncidentUpdate,
    ) -> Optional[Incident]:
        """
        Record the outcome of a troubleshooting intervention.

        The updated incident is written to SQLite first and then
        the corresponding Hindsight memory is refreshed.
        """

        # --------------------------------------------------------------
        # 1. Get exact incident from SQLite
        # --------------------------------------------------------------

        incident = await self.repository.get(incident_id)

        if not incident:
            return None

        # --------------------------------------------------------------
        # 2. Update outcome fields
        # --------------------------------------------------------------

        incident.action_taken = update.action_taken

        incident.action_outcome = update.action_outcome

        if update.confirmed_root_cause:
            incident.confirmed_root_cause = (
                update.confirmed_root_cause
            )

        incident.resolution_details = (
            update.resolution_details
        )

        incident.resolution_time_minutes = (
            update.resolution_time_minutes
        )

        incident.technician_notes = (
            update.technician_notes
        )

        # --------------------------------------------------------------
        # 3. Update SQLite
        # --------------------------------------------------------------

        updated_incident = await self.repository.update(
            incident
        )

        if updated_incident is None:
            return None

        # --------------------------------------------------------------
        # 4. Refresh Hindsight memory
        # --------------------------------------------------------------

        content = self._incident_to_memory(
            updated_incident
        )

        metadata = {
            "incident_id": updated_incident.incident_id,
            "machine_id": updated_incident.machine_id,
            "machine_type": updated_incident.machine_type,
            "production_line": updated_incident.production_line,
            "defect_type": updated_incident.defect_type,
            "has_outcome": True,
            "outcome": (
                updated_incident.action_outcome.value
                if updated_incident.action_outcome
                else None
            ),
        }

        await self.client.update_memory(
            memory_id=incident_id,
            content=content,
            metadata=metadata,
        )

        return updated_incident

    # ------------------------------------------------------------------
    # Machine history
    # ------------------------------------------------------------------

    async def get_machine_history(
        self,
        machine_id: str,
        limit: int = 50,
    ) -> List[Incident]:
        """
        Get exact incident history for a machine from SQLite.
        """

        return await self.repository.list_by_machine(
            machine_id=machine_id,
            limit=limit,
        )

    # ------------------------------------------------------------------
    # Statistics
    # ------------------------------------------------------------------

    async def get_statistics(self) -> Dict[str, Any]:
        """
        Get overall TRACE statistics from SQLite.

        Statistics should use the exact structured database rather
        than semantic recall.
        """

        incidents = await self.repository.list_all(
            limit=10000
        )

        total = len(incidents)

        with_outcome = 0

        outcomes = {
            "SUCCESS": 0,
            "PARTIAL": 0,
            "FAILED": 0,
            "UNKNOWN": 0,
        }

        machines = set()

        defect_types: Dict[str, int] = {}

        for incident in incidents:

            machines.add(incident.machine_id)

            defect = incident.defect_type

            if defect:
                defect_types[defect] = (
                    defect_types.get(defect, 0) + 1
                )

            outcome = incident.action_outcome

            if outcome:
                with_outcome += 1

                outcome_value = (
                    outcome.value
                    if isinstance(outcome, ActionOutcome)
                    else str(outcome)
                )

                if outcome_value in outcomes:
                    outcomes[outcome_value] += 1
                else:
                    outcomes[outcome_value] = 1

        return {
            "total_incidents": total,
            "incidents_with_outcome": with_outcome,
            "unique_machines": len(machines),
            "outcome_distribution": outcomes,
            "defect_type_distribution": defect_types,
        }
