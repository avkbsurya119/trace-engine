from typing import Optional, List

from sqlalchemy import select

from app.db.database import AsyncSessionLocal
from app.db.models import IncidentDB
from app.models import Incident, ActionOutcome


class IncidentRepository:
    """Database operations for manufacturing incidents."""

    async def create(self, incident: Incident) -> Incident:
        async with AsyncSessionLocal() as session:
            db_incident = IncidentDB(
                incident_id=incident.incident_id,
                machine_id=incident.machine_id,
                machine_type=incident.machine_type,
                production_line=incident.production_line,
                timestamp=incident.timestamp,
                defect_type=incident.defect_type,
                symptoms=incident.symptoms,
                sensor_values=incident.sensor_values,
                operating_conditions=incident.operating_conditions,
                description=incident.description,
                suspected_root_cause=incident.suspected_root_cause,
                confirmed_root_cause=incident.confirmed_root_cause,
                action_taken=incident.action_taken,
                action_outcome=(
                    incident.action_outcome.value
                    if incident.action_outcome
                    else None
                ),
                resolution_details=incident.resolution_details,
                resolution_time_minutes=incident.resolution_time_minutes,
                technician_notes=incident.technician_notes,
            )

            session.add(db_incident)
            await session.commit()

        return incident

    async def get(self, incident_id: str) -> Optional[Incident]:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(IncidentDB).where(
                    IncidentDB.incident_id == incident_id
                )
            )

            db_incident = result.scalar_one_or_none()

            if not db_incident:
                return None

            return self._to_schema(db_incident)

    async def update(self, incident: Incident) -> Optional[Incident]:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(IncidentDB).where(
                    IncidentDB.incident_id == incident.incident_id
                )
            )

            db_incident = result.scalar_one_or_none()

            if not db_incident:
                return None

            db_incident.confirmed_root_cause = incident.confirmed_root_cause
            db_incident.action_taken = incident.action_taken
            db_incident.action_outcome = (
                incident.action_outcome.value
                if incident.action_outcome
                else None
            )
            db_incident.resolution_details = incident.resolution_details
            db_incident.resolution_time_minutes = (
                incident.resolution_time_minutes
            )
            db_incident.technician_notes = incident.technician_notes

            await session.commit()

            return self._to_schema(db_incident)

    async def list_by_machine(
        self,
        machine_id: str,
        limit: int = 50,
    ) -> List[Incident]:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(IncidentDB)
                .where(IncidentDB.machine_id == machine_id)
                .order_by(IncidentDB.timestamp.desc())
                .limit(limit)
            )

            return [
                self._to_schema(item)
                for item in result.scalars().all()
            ]

    async def list_all(
        self,
        limit: int = 1000,
    ) -> List[Incident]:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(IncidentDB)
                .order_by(IncidentDB.timestamp.desc())
                .limit(limit)
            )

            return [
                self._to_schema(item)
                for item in result.scalars().all()
            ]

    @staticmethod
    def _to_schema(db_incident: IncidentDB) -> Incident:
        return Incident(
            incident_id=db_incident.incident_id,
            machine_id=db_incident.machine_id,
            machine_type=db_incident.machine_type,
            production_line=db_incident.production_line,
            timestamp=db_incident.timestamp,
            defect_type=db_incident.defect_type,
            symptoms=db_incident.symptoms or [],
            sensor_values=db_incident.sensor_values,
            operating_conditions=db_incident.operating_conditions,
            description=db_incident.description,
            suspected_root_cause=db_incident.suspected_root_cause,
            confirmed_root_cause=db_incident.confirmed_root_cause,
            action_taken=db_incident.action_taken,
            action_outcome=(
                ActionOutcome(db_incident.action_outcome)
                if db_incident.action_outcome
                else None
            ),
            resolution_details=db_incident.resolution_details,
            resolution_time_minutes=db_incident.resolution_time_minutes,
            technician_notes=db_incident.technician_notes,
        )
