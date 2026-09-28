from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class IncidentDB(Base):
    """SQLite persistence model for a manufacturing incident."""

    __tablename__ = "incidents"

    incident_id: Mapped[str] = mapped_column(
        String(100),
        primary_key=True,
    )

    machine_id: Mapped[str] = mapped_column(
        String(100),
        index=True,
    )

    machine_type: Mapped[str] = mapped_column(
        String(100),
        index=True,
    )

    production_line: Mapped[str] = mapped_column(
        String(100),
        index=True,
    )

    timestamp: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        index=True,
    )

    defect_type: Mapped[str] = mapped_column(
        String(150),
        index=True,
    )

    symptoms: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
    )

    sensor_values: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON,
        nullable=True,
    )

    operating_conditions: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON,
        nullable=True,
    )

    description: Mapped[str] = mapped_column(
        Text,
    )

    suspected_root_cause: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    confirmed_root_cause: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    action_taken: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    action_outcome: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        index=True,
    )

    resolution_details: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    resolution_time_minutes: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )

    technician_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )
