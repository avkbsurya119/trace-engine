"""
Memory Service

Architecture:
    SQLite    -> exact structured source of truth
    Hindsight -> semantic memory and similarity retrieval

Each incident is retained in Hindsight as a short maintenance-record
narrative (document_id = incident_id), tagged with its machine type so
recall never mixes equipment types. Recall returns memory facts; TRACE
groups them by document_id and loads the authoritative record from SQLite.
"""

import asyncio
from collections import defaultdict
from datetime import timezone
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import settings
from app.core.errors import MemoryUnavailableError
from app.data.catalog import FLEET
from app.data.generator import slug
from app.db.repository import IncidentRepository
from app.models import (
    ActionOutcome,
    HistoricalIncident,
    Incident,
    IncidentCreate,
    IncidentUpdate,
)

from .client import HindsightClient

SENSOR_LABELS = {
    "spindle_vibration_mm_s": ("spindle vibration", "mm/s"),
    "spindle_speed_rpm": ("spindle speed", "rpm"),
    "spindle_temp_c": ("spindle temperature", "C"),
    "spindle_load_pct": ("spindle load", "%"),
    "coolant_concentration_pct": ("coolant concentration", "%"),
    "axis_following_error_um": ("following error", "um"),
    "system_pressure_bar": ("system pressure", "bar"),
    "oil_temp_c": ("oil temperature", "C"),
    "cycle_time_s": ("cycle time", "s"),
    "pump_current_a": ("pump current", "A"),
    "ram_parallelism_mm": ("ram parallelism", "mm"),
    "tonnage_pct": ("tonnage", "%"),
    "discharge_pressure_bar": ("discharge pressure", "bar"),
    "discharge_temp_c": ("discharge temperature", "C"),
    "motor_current_a": ("motor current", "A"),
    "inlet_filter_dp_mbar": ("inlet filter dP", "mbar"),
    "vibration_mm_s": ("vibration", "mm/s"),
    "ambient_temp_c": ("ambient", "C"),
    "belt_speed_m_s": ("belt speed", "m/s"),
    "motor_temp_c": ("motor temperature", "C"),
    "tracking_offset_mm": ("tracking offset", "mm"),
    "gearbox_temp_c": ("gearbox temperature", "C"),
    "bearing_vibration_mm_s": ("bearing vibration", "mm/s"),
    "melt_temp_c": ("melt temperature", "C"),
    "injection_pressure_bar": ("injection pressure", "bar"),
    "mold_temp_c": ("mold temperature", "C"),
    "cushion_mm": ("cushion", "mm"),
    "hydraulic_oil_temp_c": ("hydraulic oil temperature", "C"),
}


def machine_type_tag(machine_type: str) -> str:
    return f"machine_type:{slug(machine_type)}"


class MemoryService:
    """Service for storing and retrieving manufacturing incident memories."""

    def __init__(self):
        self.client = HindsightClient()
        self.repository = IncidentRepository()

    async def close(self):
        await self.client.close()

    # ------------------------------------------------------------------
    # Narrative
    # ------------------------------------------------------------------

    @staticmethod
    def build_narrative(incident: Incident) -> str:
        """
        A concise maintenance record, written the way a technician would
        summarise a work order. Only facts present on the record are used.
        """

        spec = FLEET.get(incident.machine_type, {})
        machine = spec.get("machines", {}).get(incident.machine_id, {})
        label = spec.get("label", incident.machine_type.replace("_", " ").lower())
        conditions = incident.operating_conditions or {}
        shift = conditions.get("shift")

        header = f"Maintenance record {incident.incident_id}, {incident.timestamp:%Y-%m-%d}"
        if shift:
            header += f" ({shift} shift)"
        where = f"{incident.machine_id}, {machine.get('model', label)} on {incident.production_line}"
        if incident.operating_hours:
            where += f", {incident.operating_hours:,} operating hours"
        parts = [f"{header}. {where}."]

        parts.append(f"Problem: {incident.defect_type.replace('_', ' ')}. {incident.description}")
        if incident.symptoms:
            parts.append(f"Symptoms: {', '.join(incident.symptoms)}.")

        readings = MemoryService._notable_readings(incident)
        if readings:
            parts.append(f"Readings: {readings}.")
        if conditions.get("product"):
            parts.append(f"Running {conditions['product']}.")
        if incident.suspected_root_cause:
            who = f"Technician {incident.technician_id}" if incident.technician_id else "Technician"
            parts.append(f"{who} suspected {incident.suspected_root_cause}.")

        if incident.action_taken:
            category = f" ({incident.intervention_category})" if incident.intervention_category else ""
            parts.append(f"Intervention{category}: {incident.action_taken}.")
        if incident.action_outcome:
            parts.append(f"Outcome: {incident.action_outcome.value}.")
        else:
            parts.append("Outcome: not yet recorded.")
        if incident.confirmed_root_cause:
            parts.append(f"Confirmed cause: {incident.confirmed_root_cause}.")
        if incident.technician_notes:
            parts.append(f"Technician notes: {incident.technician_notes}")
        if incident.downtime_minutes:
            parts.append(f"Downtime {incident.downtime_minutes / 60:.1f} h, severity {incident.severity or 'n/a'}.")

        return " ".join(p.strip() for p in parts if p)

    @staticmethod
    def _notable_readings(incident: Incident) -> str:
        values = incident.sensor_values or {}
        spec = FLEET.get(incident.machine_type, {}).get("sensors", {})
        notable = []
        for key, value in values.items():
            label, unit = SENSOR_LABELS.get(key, (key.replace("_", " "), ""))
            normal = spec.get(key)
            if normal and isinstance(value, (int, float)):
                low, high, _ = normal
                if value < low or value > high:
                    notable.append(f"{label} {value} {unit} (normal {low}-{high})".replace("  ", " "))
                    continue
            if len(notable) < 1 and key in ("spindle_speed_rpm", "system_pressure_bar", "discharge_pressure_bar", "belt_speed_m_s", "melt_temp_c"):
                notable.append(f"{label} {value} {unit}".strip())
        return ", ".join(notable)

    @staticmethod
    def _tags(incident: Incident) -> List[str]:
        return [
            machine_type_tag(incident.machine_type),
            f"machine:{slug(incident.machine_id)}",
            f"defect:{slug(incident.defect_type)}",
        ]

    @staticmethod
    def _metadata(incident: Incident) -> Dict[str, Any]:
        return {
            "incident_id": incident.incident_id,
            "machine_id": incident.machine_id,
            "machine_type": incident.machine_type,
            "defect_type": incident.defect_type,
            "outcome": incident.action_outcome.value if incident.action_outcome else "NONE",
            "intervention_category": incident.intervention_category,
        }

    def _retain_item(self, incident: Incident) -> Dict[str, Any]:
        timestamp = incident.timestamp
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)
        return {
            "document_id": incident.incident_id,
            "narrative": self.build_narrative(incident),
            "tags": self._tags(incident),
            "metadata": self._metadata(incident),
            "timestamp": timestamp,
        }

    # ------------------------------------------------------------------
    # Store
    # ------------------------------------------------------------------

    async def store_incident(self, incident: Incident) -> str:
        """SQLite first (source of truth), then Hindsight."""

        await self.repository.create(incident)
        item = self._retain_item(incident)
        try:
            await self.client.retain(
                document_id=item["document_id"],
                narrative=item["narrative"],
                tags=item["tags"],
                metadata=item["metadata"],
                timestamp=item["timestamp"],
            )
        except Exception as exc:
            # Keep the two stores consistent: no SQLite row without a memory.
            await self.repository.delete_many([incident.incident_id])
            raise MemoryUnavailableError(f"Could not store incident in Hindsight: {exc}") from exc
        return incident.incident_id

    async def retain_many(self, incidents: List[Incident]) -> int:
        """Bulk retain for seeding (SQLite rows are inserted separately)."""

        return await self.client.retain_batch([self._retain_item(i) for i in incidents])

    # ------------------------------------------------------------------
    # Semantic search
    # ------------------------------------------------------------------

    @staticmethod
    def build_query(incident: IncidentCreate) -> str:
        label = FLEET.get(incident.machine_type, {}).get("label", incident.machine_type)
        parts = [
            f"{label} {incident.machine_id}: {incident.defect_type.replace('_', ' ')}.",
            incident.description,
        ]
        if incident.symptoms:
            parts.append(f"Symptoms: {', '.join(incident.symptoms)}.")
        if incident.suspected_root_cause:
            parts.append(f"Suspected: {incident.suspected_root_cause}.")
        parts.append("What was done before and did it work?")
        return " ".join(parts)

    async def search_similar_incidents(
        self,
        incident: IncidentCreate,
        exclude_ids: Optional[List[str]] = None,
    ) -> Tuple[List[HistoricalIncident], Dict[str, Any]]:
        """
        Recall memories for this machine type, group the returned facts by
        document (= incident), and load each incident from SQLite.

        Returns every recalled incident that has a recorded outcome, best
        match first, plus a trace of what recall returned. Deciding which of
        them count as evidence is the caller's (deterministic) job.
        """

        query = self.build_query(incident)
        type_tag = machine_type_tag(incident.machine_type)
        machine_tag = f"machine:{slug(incident.machine_id)}"

        # Two recalls in parallel: similar incidents across the fleet of this
        # machine type, and this machine's own history (so a recurring fault
        # is never crowded out by look-alikes on other machines).
        try:
            fleet_memories, machine_memories = await asyncio.gather(
                self.client.recall(query=query, tags=[type_tag]),
                self.client.recall(query=query, tags=[type_tag, machine_tag], max_tokens=3000),
            )
        except Exception as exc:
            raise MemoryUnavailableError(f"Hindsight recall failed: {exc}") from exc
        memories = fleet_memories + machine_memories

        facts_by_doc: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for memory in memories:
            document_id = memory.get("document_id")
            if document_id:
                facts_by_doc[str(document_id)].append(memory)

        exclude = set(exclude_ids or [])
        records = await self.repository.get_many([d for d in facts_by_doc if d not in exclude])

        results: List[HistoricalIncident] = []
        for historical in records:
            if historical.action_outcome is None:
                continue
            # Tags already restrict recall to this machine type; keep the
            # check as a guard against untagged legacy documents.
            if historical.machine_type != incident.machine_type:
                continue
            facts = sorted(facts_by_doc[historical.incident_id], key=self._score, reverse=True)
            results.append(
                HistoricalIncident(
                    incident=historical,
                    similarity_score=self._score(facts[0]),
                    relevance_factors=self._relevance_factors(incident, historical),
                    recalled_facts=[f.get("text", "") for f in facts[:2]],
                )
            )

        results.sort(key=lambda item: item.similarity_score, reverse=True)
        trace = {
            "bank": self.client.bank_id,
            "tag_filter": [type_tag, f"{type_tag} + {machine_tag}"],
            "query": query,
            "memory_facts_recalled": len(memories),
            "fleet_facts": len(fleet_memories),
            "same_machine_facts": len(machine_memories),
            "incidents_recalled": len(facts_by_doc),
            "incidents_with_outcome": len(results),
        }
        return results, trace

    @staticmethod
    def _score(memory: Dict[str, Any]) -> float:
        """Hindsight's semantic similarity (0-1) for a recalled fact."""

        scores = memory.get("scores") or {}
        value = scores.get("semantic")
        if value is None:
            return 0.0
        return max(0.0, min(1.0, float(value)))

    @staticmethod
    def _relevance_factors(current: IncidentCreate, historical: Incident) -> List[str]:
        factors = []
        if current.machine_id == historical.machine_id:
            factors.append("Same machine")
        else:
            factors.append("Same machine type")
        if current.defect_type == historical.defect_type:
            factors.append("Same defect type")
        overlap = {s.lower() for s in current.symptoms} & {s.lower() for s in historical.symptoms}
        if overlap:
            factors.append("Shared symptoms: " + ", ".join(sorted(overlap)))
        return factors

    # ------------------------------------------------------------------
    # Lookups and updates
    # ------------------------------------------------------------------

    async def get_incident(self, incident_id: str) -> Optional[Incident]:
        return await self.repository.get(incident_id)

    async def update_incident_outcome(
        self,
        incident_id: str,
        update: IncidentUpdate,
    ) -> Optional[Incident]:
        """Write the outcome to SQLite, then replace the Hindsight memory."""

        incident = await self.repository.get(incident_id)
        if not incident:
            return None
        previous = incident.model_copy(deep=True)

        incident.action_taken = update.action_taken
        incident.action_outcome = update.action_outcome
        incident.intervention_category = (update.intervention_category or update.action_taken).strip()
        if update.confirmed_root_cause:
            incident.confirmed_root_cause = update.confirmed_root_cause
        incident.resolution_details = update.resolution_details
        incident.resolution_time_minutes = update.resolution_time_minutes
        incident.downtime_minutes = update.downtime_minutes or update.resolution_time_minutes
        incident.technician_notes = update.technician_notes

        updated = await self.repository.update(incident)
        if updated is None:
            return None

        item = self._retain_item(updated)
        try:
            await self.client.retain(
                document_id=item["document_id"],
                narrative=item["narrative"],
                tags=item["tags"],
                metadata=item["metadata"],
                timestamp=item["timestamp"],
                replace=True,
            )
        except Exception as exc:
            # Roll SQLite back so it never claims an outcome memory lacks.
            await self.repository.update(previous)
            raise MemoryUnavailableError(f"Could not update Hindsight memory: {exc}") from exc
        return updated

    async def delete_incidents(self, incident_ids: List[str]) -> int:
        """Remove incidents from both stores (used by demo/validation resets)."""

        for incident_id in incident_ids:
            await self.client.delete_document(incident_id)
        return await self.repository.delete_many(incident_ids)

    async def get_machine_history(self, machine_id: str, limit: int = 200) -> List[Incident]:
        return await self.repository.list_by_machine(machine_id=machine_id, limit=limit)

    # ------------------------------------------------------------------
    # Statistics (always from SQLite, never from semantic recall)
    # ------------------------------------------------------------------

    async def get_statistics(self) -> Dict[str, Any]:
        incidents = await self.repository.list_all()

        outcomes = {o.value: 0 for o in ActionOutcome}
        defect_types: Dict[str, int] = defaultdict(int)
        machine_types: Dict[str, int] = defaultdict(int)
        machines = set()
        with_outcome = 0
        downtime = 0

        for incident in incidents:
            machines.add(incident.machine_id)
            machine_types[incident.machine_type] += 1
            defect_types[incident.defect_type] += 1
            downtime += incident.downtime_minutes or 0
            if incident.action_outcome:
                with_outcome += 1
                outcomes[incident.action_outcome.value] += 1

        timestamps = [i.timestamp for i in incidents]
        return {
            "total_incidents": len(incidents),
            "incidents_with_outcome": with_outcome,
            "unique_machines": len(machines),
            "outcome_distribution": outcomes,
            "defect_type_distribution": dict(defect_types),
            "machine_type_distribution": dict(machine_types),
            "total_downtime_hours": round(downtime / 60, 1),
            "history_start": min(timestamps).isoformat() if timestamps else None,
            "history_end": max(timestamps).isoformat() if timestamps else None,
            "memory_bank": settings.hindsight_namespace,
        }
