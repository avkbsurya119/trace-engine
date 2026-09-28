"""Recency, pattern detection and cross-machine evidence computed from retrieved evidence."""

from datetime import datetime, timedelta, timezone

from app.services.analysis import aggregate_cross_machine_evidence, calculate_recency, detect_pattern
from tests.helpers import past

NOW = datetime(2026, 9, 28, tzinfo=timezone.utc)


def test_recency_bands():
    assert calculate_recency(NOW - timedelta(days=30), NOW) == (1.0, "high", 30)
    score, label, _ = calculate_recency(NOW - timedelta(days=150), NOW)
    assert label == "medium" and 0.6 < score < 1.0
    score, label, _ = calculate_recency(NOW - timedelta(days=900), NOW)
    assert label == "low" and score >= 0.3
    assert calculate_recency(NOW + timedelta(days=3), NOW)[2] == 0  # future clamps to 0


def test_pattern_needs_two_and_recurring_needs_three():
    assert detect_pattern("spindle_vibration", "CNC_Machining_Center", [past("WO-1", "B", "SUCCESS")]) is None
    two = [past("WO-1", "B", "SUCCESS"), past("WO-2", "B", "FAILED", machine_id="CNC-202", days=40)]
    alert = detect_pattern("spindle_vibration", "CNC_Machining_Center", two)
    assert alert.total_occurrences == 2 and not alert.is_recurring
    three = two + [past("WO-3", "B", "PARTIAL", days=80)]
    alert = detect_pattern("spindle_vibration", "CNC_Machining_Center", three)
    assert alert.is_recurring
    assert (alert.successful_resolutions, alert.failed_resolutions, alert.partial_resolutions) == (1, 1, 1)
    assert sorted(alert.machines_affected) == ["CNC-201", "CNC-202"]


def test_cross_machine_excludes_current_machine_and_needs_two_machines():
    evidence = [
        past("WO-1", "Bearings", "SUCCESS", machine_id="CNC-201"),
        past("WO-2", "Bearings", "SUCCESS", machine_id="CNC-202"),
        past("WO-3", "Bearings", "SUCCESS", machine_id="CNC-203"),
        past("WO-4", "Bearings", "SUCCESS", machine_id="CNC-204"),  # current machine: ignored
        past("WO-5", "Holder", "SUCCESS", machine_id="CNC-201"),     # one machine only: dropped
    ]
    result = aggregate_cross_machine_evidence("CNC-204", "CNC_Machining_Center", evidence)
    assert [r.intervention_category for r in result] == ["Bearings"]
    assert sorted(result[0].machines_succeeded) == ["CNC-201", "CNC-202", "CNC-203"]
    assert result[0].cross_machine_confidence == "strong"


def test_cross_machine_confidence_drops_with_failures():
    evidence = [
        past("WO-1", "Bearings", "SUCCESS", machine_id="CNC-201"),
        past("WO-2", "Bearings", "SUCCESS", machine_id="CNC-202"),
        past("WO-3", "Bearings", "FAILED", machine_id="CNC-203"),
        past("WO-4", "Bearings", "FAILED", machine_id="CNC-205"),
    ]
    assert aggregate_cross_machine_evidence("CNC-204", "CNC_Machining_Center", evidence)[0].cross_machine_confidence == "weak"
