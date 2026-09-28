from typing import List, Optional

from sqlalchemy import delete, select

from app.db.database import AsyncSessionLocal
from app.db.models import IncidentDB
from app.models import Incident, ActionOutcome

# Fields copied 1:1 between the pydantic schema and the SQLite row.
_FIELDS = [
    "incident_id",
    "machine_id",
    "machine_type",
    "production_line",
    "timestamp",
    "defect_type",
    "symptoms",
    "sensor_values",
    "operating_conditions",
    "description",
    "suspected_root_cause",
    "confirmed_root_cause",
    "action_taken",
    "resolution_details",
    "resolution_time_minutes",
    "technician_notes",
    "intervention_category",
    "severity",
    "downtime_minutes",
    "technician_id",
    "operating_hours",
]

# Fields an outcome update is allowed to change.
_OUTCOME_FIELDS = [
    "confirmed_root_cause",
    "action_taken",
    "resolution_details",
    "resolution_time_minutes",
    "technician_notes",
    "intervention_category",
    "downtime_minutes",
]


class IncidentRepository:
    """Database operations for manufacturing incidents."""

    @staticmethod
    def _to_row(incident: Incident) -> IncidentDB:
        values = {field: getattr(incident, field) for field in _FIELDS}
        # SQLite stores naive datetimes; keep everything in UTC.
        if values["timestamp"] is not None and values["timestamp"].tzinfo is not None:
            values["timestamp"] = values["timestamp"].replace(tzinfo=None)
        values["action_outcome"] = (
            incident.action_outcome.value if incident.action_outcome else None
        )
        return IncidentDB(**values)

    async def create(self, incident: Incident) -> Incident:
        async with AsyncSessionLocal() as session:
            session.add(self._to_row(incident))
            await session.commit()

        return incident

    async def create_many(self, incidents: List[Incident]) -> int:
        async with AsyncSessionLocal() as session:
            session.add_all([self._to_row(i) for i in incidents])
            await session.commit()

        return len(incidents)

    async def get(self, incident_id: str) -> Optional[Incident]:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(IncidentDB).where(IncidentDB.incident_id == incident_id)
            )
            db_incident = result.scalar_one_or_none()

            if not db_incident:
                return None

            return self._to_schema(db_incident)

    async def get_many(self, incident_ids: List[str]) -> List[Incident]:
        if not incident_ids:
            return []

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(IncidentDB).where(IncidentDB.incident_id.in_(incident_ids))
            )
            return [self._to_schema(item) for item in result.scalars().all()]

    async def update(self, incident: Incident) -> Optional[Incident]:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(IncidentDB).where(IncidentDB.incident_id == incident.incident_id)
            )
            db_incident = result.scalar_one_or_none()

            if not db_incident:
                return None

            for field in _OUTCOME_FIELDS:
                setattr(db_incident, field, getattr(incident, field))
            db_incident.action_outcome = (
                incident.action_outcome.value if incident.action_outcome else None
            )

            await session.commit()

            return self._to_schema(db_incident)

    async def delete_many(self, incident_ids: List[str]) -> int:
        if not incident_ids:
            return 0

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                delete(IncidentDB).where(IncidentDB.incident_id.in_(incident_ids))
            )
            await session.commit()
            return result.rowcount or 0

    async def list_by_machine(
        self,
        machine_id: str,
        limit: int = 200,
    ) -> List[Incident]:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(IncidentDB)
                .where(IncidentDB.machine_id == machine_id)
                .order_by(IncidentDB.timestamp.desc())
                .limit(limit)
            )

            return [self._to_schema(item) for item in result.scalars().all()]

    async def list_all(
        self,
        limit: int = 10000,
    ) -> List[Incident]:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(IncidentDB)
                .order_by(IncidentDB.timestamp.desc())
                .limit(limit)
            )

            return [self._to_schema(item) for item in result.scalars().all()]

    @staticmethod
    def _to_schema(db_incident: IncidentDB) -> Incident:
        values = {field: getattr(db_incident, field) for field in _FIELDS}
        values["symptoms"] = values["symptoms"] or []
        values["action_outcome"] = (
            ActionOutcome(db_incident.action_outcome)
            if db_incident.action_outcome
            else None
        )
        return Incident(**values)
