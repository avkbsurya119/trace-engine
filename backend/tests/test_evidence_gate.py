"""Relevance gate between Hindsight recall and scoring."""

from datetime import datetime, timezone

from app.services import analysis
from app.services.analysis import calculate_recency, select_evidence
from tests.helpers import incident, past

CURRENT = incident(symptoms=["high spindle vibration", "audible spindle noise"])


def test_same_defect_is_kept_regardless_of_similarity():
    kept = select_evidence(CURRENT, [past("WO-1", "Bearings", "SUCCESS", similarity=0.5)])
    assert [h.incident.incident_id for h in kept] == ["WO-1"]


def test_other_defect_needs_shared_symptom_and_high_similarity():
    related = past("WO-1", "Holder", "SUCCESS", defect="tool_breakage", similarity=0.85, symptoms=["high spindle vibration"])
    weak = past("WO-2", "Holder", "SUCCESS", defect="tool_breakage", similarity=0.79, symptoms=["high spindle vibration"])
    unrelated = past("WO-3", "Holder", "SUCCESS", defect="tool_breakage", similarity=0.95, symptoms=["broken drill in part"])
    kept = select_evidence(CURRENT, [related, weak, unrelated])
    assert [h.incident.incident_id for h in kept] == ["WO-1"]
    assert "Related defect (high similarity)" in kept[0].relevance_factors


def test_same_machine_first_then_similarity_and_cap(monkeypatch):
    monkeypatch.setattr(analysis, "MAX_EVIDENCE", 3)
    recalled = [
        past("WO-A", "X", "SUCCESS", similarity=0.95),
        past("WO-B", "X", "SUCCESS", similarity=0.93),
        past("WO-C", "X", "SUCCESS", similarity=0.80, machine_id="CNC-204"),
        past("WO-D", "X", "SUCCESS", similarity=0.91),
    ]
    kept = select_evidence(CURRENT, recalled)
    assert [h.incident.incident_id for h in kept] == ["WO-C", "WO-A", "WO-B"]


def test_calculate_recency_handles_naive_timestamps():
    """Regression: SQLite stores naive datetimes; must not crash when now is aware."""
    naive_incident = datetime(2026, 1, 1, 12, 0, 0)  # no tzinfo
    aware_now = datetime(2026, 2, 1, 12, 0, 0, tzinfo=timezone.utc)
    score, label, days = calculate_recency(naive_incident, aware_now)
    assert days == 31
    assert label == "high"
    assert score == 1.0


def test_calculate_recency_handles_both_naive():
    """Ensure it works when both datetimes are naive."""
    naive_incident = datetime(2026, 1, 1, 12, 0, 0)
    naive_now = datetime(2026, 5, 1, 12, 0, 0)
    score, label, days = calculate_recency(naive_incident, naive_now)
    assert days == 120
    assert label == "medium"
