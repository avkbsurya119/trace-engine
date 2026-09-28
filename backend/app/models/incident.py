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

    machine_id: str = Field(..., min_length=1, description="Unique identifier for the machine")
    machine_type: str = Field(..., min_length=1, description="Type/category of machine")
    production_line: str = Field(..., min_length=1, description="Production line identifier")
    defect_type: str = Field(..., min_length=1, description="Type of defect observed")
    symptoms: List[str] = Field(default_factory=list, description="Observed symptoms")
    sensor_values: Optional[Dict[str, Any]] = Field(
        default=None, description="Relevant sensor readings"
    )
    operating_conditions: Optional[Dict[str, Any]] = Field(
        default=None, description="Operating conditions at time of incident"
    )
    description: str = Field(..., min_length=1, description="Free-text incident description")
    suspected_root_cause: Optional[str] = Field(
        default=None, description="Initial suspected root cause"
    )
    operating_hours: Optional[int] = Field(
        default=None, description="Machine hour meter reading at time of incident"
    )
    severity: Optional[str] = Field(
        default=None, description="LOW, MEDIUM, HIGH or CRITICAL"
    )
    technician_id: Optional[str] = Field(
        default=None, description="Technician assigned to the work order"
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
    intervention_category: Optional[str] = Field(
        default=None, description="Normalised intervention type used to group evidence"
    )
    downtime_minutes: Optional[int] = Field(
        default=None, description="Total machine downtime for this incident"
    )


class IncidentUpdate(BaseModel):
    """Schema for updating an incident with outcome."""

    action_taken: str = Field(..., min_length=1, description="Action that was performed")
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
    intervention_category: Optional[str] = Field(
        default=None, description="Intervention type; defaults to the action text"
    )
    downtime_minutes: Optional[int] = Field(default=None, description="Total downtime")


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
    recalled_facts: List[str] = Field(
        default_factory=list, description="Memory text Hindsight returned for this incident"
    )


class EvidenceSummary(BaseModel):
    """Deterministic tally of one intervention type across the evidence."""

    intervention_category: str
    example_action: str = Field(..., description="Most recent action text in this category")
    successes: int = 0
    partials: int = 0
    failures: int = 0
    unknowns: int = 0
    same_machine_successes: int = 0
    same_machine_failures: int = 0
    score: float = Field(..., description="successes + 0.5*partials - failures, same-machine weighted")
    incident_ids: Dict[str, List[str]] = Field(
        default_factory=dict, description="Incident IDs keyed by outcome"
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
    intervention_category: Optional[str] = Field(
        default=None, description="Winning intervention type, None when there is no evidence-backed action"
    )
    basis: str = Field(
        default="", description="One computed sentence stating why the confidence level was assigned"
    )
    evidence: List[EvidenceSummary] = Field(
        default_factory=list, description="Per-intervention tallies the decision was computed from"
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
    partial_interventions: List[Dict[str, Any]] = Field(default_factory=list)
    recommendation: Recommendation
    memory_contribution: str = Field(
        ..., description="Explanation of how memory contributed to analysis"
    )
    memory_trace: Dict[str, Any] = Field(
        default_factory=dict,
        description="What Hindsight recall returned and how much of it passed the relevance gate",
    )
