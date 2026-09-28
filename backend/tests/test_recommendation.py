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


# ---------------------------------------------------------------- explainability

def _checks(rec):
    return {(c.level, c.rule.split(" (")[0]): c.passed for c in rec.confidence_checks}


def test_confidence_checks_explain_high():
    evidence = [past(f"WO-{i}", "Bearings", "SUCCESS", days=i) for i in range(3)] + [past("WO-9", "Bearings", "FAILED", days=9)]
    rec = engine.generate_recommendation(CURRENT, evidence)
    levels = {c.level for c in rec.confidence_checks}
    assert levels == {"HIGH", "MEDIUM", "DOWNGRADE"}
    high = [c for c in rec.confidence_checks if c.level == "HIGH"]
    assert high[0].passed and high[1].passed and "3 of 4 = 75%" in high[1].detail


def test_confidence_checks_show_why_not_high():
    evidence = [past("WO-1", "Bearings", "SUCCESS"), past("WO-2", "Bearings", "SUCCESS", days=1), past("WO-3", "Bearings", "FAILED", days=2)]
    rec = engine.generate_recommendation(CURRENT, evidence)
    assert rec.confidence == "MEDIUM"
    by_level = {}
    for c in rec.confidence_checks:
        by_level.setdefault(c.level, []).append(c.passed)
    assert by_level["HIGH"] == [False, False, False]
    assert by_level["MEDIUM"] == [True]


def test_no_evidence_has_single_failed_evidence_check():
    rec = engine.generate_recommendation(CURRENT, [])
    assert [(c.level, c.passed) for c in rec.confidence_checks] == [("EVIDENCE", False)]


def test_only_failures_checks_explain_withholding():
    rec = engine.generate_recommendation(CURRENT, [past("WO-1", "Alignment", "FAILED")])
    assert [(c.level, c.passed) for c in rec.confidence_checks] == [("EVIDENCE", True), ("EVIDENCE", False)]
    assert rec.evidence[0].verdict == "rejected"
    assert rec.evidence[0].verdict_reason == "Never worked: failed 1 of 1 attempt(s)"


def test_every_alternative_gets_a_reason():
    evidence = [
        past("WO-1", "Bearings", "SUCCESS"), past("WO-2", "Bearings", "SUCCESS", days=1),
        past("WO-3", "Alignment", "FAILED", days=2), past("WO-4", "Alignment", "FAILED", days=3),
        past("WO-5", "Relube", "PARTIAL", days=4),
        past("WO-6", "Holder", "SUCCESS", days=5), past("WO-7", "Holder", "FAILED", days=6), past("WO-8", "Holder", "FAILED", days=7),
        past("WO-9", "Coolant", "SUCCESS", days=8),
    ]
    rec = engine.generate_recommendation(CURRENT, evidence)
    reasons = {e.intervention_category: (e.verdict, e.verdict_reason) for e in rec.evidence}
    assert reasons["Bearings"] == ("selected", "Highest score among interventions that have worked")
    assert reasons["Alignment"][1] == "Never worked: failed 2 of 2 attempt(s)"
    assert reasons["Relube"][1] == "No verified success (1 partial, 0 unverified)"
    assert reasons["Holder"][1] == "Failed more often than it worked (2 vs 1)"
    assert reasons["Coolant"][1] == "Lower score (1 vs 2)"
    assert [e for e in rec.evidence if e.verdict == "selected"] == [rec.evidence[0]]


def test_attempts_and_success_rate_exclude_unknown():
    evidence = [past("WO-1", "Bearings", "SUCCESS"), past("WO-2", "Bearings", "UNKNOWN", days=1), past("WO-3", "Bearings", "FAILED", days=2)]
    summary = RecommendationEngine.tally(CURRENT, evidence)[0]
    assert summary.attempts == 2 and summary.success_rate == 0.5
