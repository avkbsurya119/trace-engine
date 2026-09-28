from datetime import datetime, timedelta, timezone

from app.models import ActionOutcome, HistoricalIncident, Incident

BASE = datetime(2026, 1, 1, tzinfo=timezone.utc)


def incident(incident_id="INC-NEW", machine_id="CNC-204", defect="spindle_vibration", **kw) -> Incident:
    return Incident(
        incident_id=incident_id,
        machine_id=machine_id,
        machine_type=kw.pop("machine_type", "CNC_Machining_Center"),
        production_line="Machining Cell 2",
        defect_type=defect,
        symptoms=kw.pop("symptoms", ["high spindle vibration"]),
        description="Spindle vibration alarm",
        timestamp=kw.pop("timestamp", BASE),
        **kw,
    )


def past(incident_id, category, outcome, machine_id="CNC-201", defect="spindle_vibration",
         similarity=0.9, days=0, **kw) -> HistoricalIncident:
    return HistoricalIncident(
        incident=incident(
            incident_id, machine_id, defect,
            intervention_category=category,
            action_taken=f"{category} (action text)",
            action_outcome=ActionOutcome(outcome),
            timestamp=BASE - timedelta(days=days),
            **kw,
        ),
        similarity_score=similarity,
        relevance_factors=[],
    )
