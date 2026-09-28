"""Deterministic scoring: the rules that decide action and confidence."""

from app.services.recommendation import NO_RECOMMENDATION, RecommendationEngine
from tests.helpers import incident, past

engine = RecommendationEngine()
CURRENT = incident()


def test_no_evidence_gives_no_action():
    rec = engine.generate_recommendation(CURRENT, [])
    assert rec.confidence == "INSUFFICIENT_DATA"
    assert rec.suggested_action == NO_RECOMMENDATION
    assert rec.intervention_category is None
    assert rec.evidence == []


def test_only_failures_gives_no_action_but_lists_them():
    evidence = [past("WO-1", "Alignment", "FAILED"), past("WO-2", "Alignment", "PARTIAL", days=3)]
    rec = engine.generate_recommendation(CURRENT, evidence)
    assert rec.confidence == "INSUFFICIENT_DATA"
    assert rec.intervention_category is None
    assert any("WO-1" in w for w in rec.warnings)


def test_high_needs_three_successes_and_75_percent():
    evidence = [past(f"WO-{i}", "Bearings", "SUCCESS", days=i) for i in range(3)]
    evidence.append(past("WO-9", "Bearings", "FAILED", days=9))
    rec = engine.generate_recommendation(CURRENT, evidence)
    assert rec.intervention_category == "Bearings"
    assert rec.confidence == "HIGH"  # 3 of 4 = 75%


def test_medium_and_low_thresholds():
    two = [past("WO-1", "Bearings", "SUCCESS"), past("WO-2", "Bearings", "SUCCESS", days=1), past("WO-3", "Bearings", "FAILED", days=2)]
    assert engine.generate_recommendation(CURRENT, two).confidence == "MEDIUM"
    one = [past("WO-1", "Bearings", "SUCCESS")]
    assert engine.generate_recommendation(CURRENT, one).confidence == "LOW"


def test_same_machine_rule_can_reach_high():
    evidence = [
        past("WO-1", "Bearings", "SUCCESS", machine_id="CNC-204"),
        past("WO-2", "Bearings", "SUCCESS", machine_id="CNC-204", days=100),
        past("WO-3", "Bearings", "SUCCESS", days=5),
        past("WO-4", "Bearings", "FAILED", days=6),
        past("WO-5", "Bearings", "PARTIAL", days=7),
    ]
    rec = engine.generate_recommendation(CURRENT, evidence)
    assert rec.confidence == "HIGH"  # 3/5 = 60%, but 2 wins and no failures on CNC-204
    assert rec.evidence[0].same_machine_successes == 2


def test_failure_on_this_machine_downgrades_and_warns():
    evidence = [
        past("WO-1", "Bearings", "SUCCESS"), past("WO-2", "Bearings", "SUCCESS", days=1),
        past("WO-3", "Bearings", "SUCCESS", days=2), past("WO-4", "Bearings", "FAILED", machine_id="CNC-204", days=3),
    ]
    rec = engine.generate_recommendation(CURRENT, evidence)
    assert rec.confidence == "MEDIUM"
    assert any("failed on CNC-204" in w for w in rec.warnings)


def test_winner_is_best_score_not_most_attempts():
    evidence = [
        past("WO-1", "Alignment", "SUCCESS"), past("WO-2", "Alignment", "FAILED", days=1),
        past("WO-3", "Alignment", "FAILED", days=2), past("WO-4", "Alignment", "FAILED", days=3),
        past("WO-5", "Bearings", "SUCCESS", days=4), past("WO-6", "Bearings", "SUCCESS", days=5),
    ]
    rec = engine.generate_recommendation(CURRENT, evidence)
    assert rec.intervention_category == "Bearings"
    assert any("Alignment failed 3" in w for w in rec.warnings)


def test_partials_and_unknowns_are_counted_separately():
    evidence = [past("WO-1", "Relube", "PARTIAL"), past("WO-2", "Relube", "UNKNOWN", days=1), past("WO-3", "Relube", "SUCCESS", days=2)]
    summary = RecommendationEngine.tally(CURRENT, evidence)[0]
    assert (summary.successes, summary.partials, summary.failures, summary.unknowns) == (1, 1, 0, 1)
    assert summary.score == 1.5
    assert summary.incident_ids["UNKNOWN"] == ["WO-2"]


def test_example_action_is_most_recent_success():
    evidence = [past("WO-OLD", "Bearings", "SUCCESS", days=300), past("WO-NEW", "Bearings", "SUCCESS", days=1)]
    rec = engine.generate_recommendation(CURRENT, evidence)
    assert rec.supporting_incidents[0] == "WO-NEW"


def test_warns_when_no_history_on_this_machine():
    rec = engine.generate_recommendation(CURRENT, [past("WO-1", "Bearings", "SUCCESS")])
    assert any("No earlier record of this problem on CNC-204" in w for w in rec.warnings)
