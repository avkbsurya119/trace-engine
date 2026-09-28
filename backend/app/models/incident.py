from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class ActionOutcome(str, Enum):
    """Possible outcomes for troubleshooting actions."""

    SUCCESS = "SUCCESS"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"
    UNKNOWN = "UNKNOWN"


class IncidentCreate(BaseModel):
    """Schema for creating a new incident."""

    machine_id: str = Field(..., description="Unique identifier for the machine")
    machine_type: str = Field(..., description="Type/category of machine")
    production_line: str = Field(..., description="Production line identifier")
    defect_type: str = Field(..., description="Type of defect observed")
    symptoms: List[str] = Field(default_factory=list, description="Observed symptoms")
    sensor_values: Optional[Dict[str, Any]] = Field(
        default=None, description="Relevant sensor readings"
    )
    operating_conditions: Optional[Dict[str, Any]] = Field(
        default=None, description="Operating conditions at time of incident"
    )
    description: str = Field(..., description="Free-text incident description")
    suspected_root_cause: Optional[str] = Field(
        default=None, description="Initial suspected root cause"
    )


class Incident(IncidentCreate):
    """Complete incident record."""

    incident_id: str = Field(..., description="Unique incident identifier")
    timestamp: datetime = Field(
        default_factory=datetime.utcnow, description="When the incident was reported"
    )
    confirmed_root_cause: Optional[str] = Field(
        default=None, description="Verified root cause after investigation"
    )
    action_taken: Optional[str] = Field(
        default=None, description="Troubleshooting action performed"
    )
    action_outcome: Optional[ActionOutcome] = Field(
        default=None, description="Result of the action"
    )
    resolution_details: Optional[str] = Field(
        default=None, description="Details of how the issue was resolved"
    )
    resolution_time_minutes: Optional[int] = Field(
        default=None, description="Time taken to resolve in minutes"
    )
    technician_notes: Optional[str] = Field(
        default=None, description="Additional notes from technician"
    )


class IncidentUpdate(BaseModel):
    """Schema for updating an incident with outcome."""

    action_taken: str = Field(..., description="Action that was performed")
    action_outcome: ActionOutcome = Field(..., description="Result of the action")
    confirmed_root_cause: Optional[str] = Field(
        default=None, description="Verified root cause"
    )
    resolution_details: Optional[str] = Field(
        default=None, description="Resolution details"
    )
    resolution_time_minutes: Optional[int] = Field(
        default=None, description="Time to resolve"
    )
    technician_notes: Optional[str] = Field(default=None, description="Additional notes")


class IncidentOutcome(BaseModel):
    """Recorded outcome for an incident."""

    incident_id: str
    action_taken: str
    action_outcome: ActionOutcome
    confirmed_root_cause: Optional[str] = None
    resolution_details: Optional[str] = None
    resolution_time_minutes: Optional[int] = None
    technician_notes: Optional[str] = None
    recorded_at: datetime = Field(default_factory=datetime.utcnow)


class HistoricalIncident(BaseModel):
    """Historical incident retrieved from memory."""

    incident: Incident
    similarity_score: float = Field(
        ..., ge=0.0, le=1.0, description="Relevance score 0-1"
    )
    relevance_factors: List[str] = Field(
        default_factory=list, description="Why this incident is relevant"
    )


class Recommendation(BaseModel):
    """Troubleshooting recommendation."""

    suggested_action: str = Field(..., description="Recommended action to take")
    confidence: str = Field(
        ..., description="Confidence level: HIGH, MEDIUM, LOW, INSUFFICIENT_DATA"
    )
    reasoning: str = Field(..., description="Why this action is recommended")
    supporting_incidents: List[str] = Field(
        default_factory=list, description="Incident IDs supporting this recommendation"
    )
    warnings: List[str] = Field(
        default_factory=list, description="Any cautions or warnings"
    )
    reasoning_source: str = Field(
        default="deterministic",
        description="Who wrote the reasoning text: 'llm' or 'deterministic' (fallback)",
    )


class AnalysisResult(BaseModel):
    """Complete analysis result for an incident."""

    current_incident: Incident
    historical_incidents: List[HistoricalIncident] = Field(default_factory=list)
    successful_interventions: List[Dict[str, Any]] = Field(default_factory=list)
    failed_interventions: List[Dict[str, Any]] = Field(default_factory=list)
    recommendation: Recommendation
    memory_contribution: str = Field(
        ..., description="Explanation of how memory contributed to analysis"
    )
