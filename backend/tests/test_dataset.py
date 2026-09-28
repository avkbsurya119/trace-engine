"""The generated history: reproducible, within bounds, internally consistent."""

from collections import Counter, defaultdict

import pytest

from app.data.catalog import FLEET, HERO_MACHINES
from app.data.generator import NO_HISTORY_MACHINES, WINDOW_END, WINDOW_START, generate_history


@pytest.fixture(scope="module")
def history():
    return generate_history()


def test_deterministic(history):
    again = generate_history()
    assert [r["incident_id"] for r in again] == [r["incident_id"] for r in history]
    assert [r["technician_notes"] for r in again] == [r["technician_notes"] for r in history]


def test_size_and_coverage(history):
    assert 400 <= len(history) <= 800
    per_machine = Counter(r["machine_id"] for r in history)
    assert min(per_machine.values()) >= 8 and max(per_machine.values()) <= 21
    assert {r["machine_type"] for r in history} == set(FLEET)
    assert not NO_HISTORY_MACHINES & set(per_machine)


def test_ids_unique_and_timestamps_in_window(history):
    assert len({r["incident_id"] for r in history}) == len(history)
    assert all(WINDOW_START <= r["timestamp"] <= WINDOW_END for r in history)


def test_records_consistent_with_fleet(history):
    for r in history:
        spec = FLEET[r["machine_type"]]
        assert spec["machines"][r["machine_id"]]["line"] == r["production_line"]
        assert r["intervention_category"] in set(spec["interventions"]) | {x[3] for x in spec["rare"]}
        assert r["downtime_minutes"] >= r["resolution_time_minutes"] > 0
        assert r["severity"] in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}


def test_operating_hours_monotonic(history):
    by_machine = defaultdict(list)
    for r in sorted(history, key=lambda r: r["timestamp"]):
        by_machine[r["machine_id"]].append(r["operating_hours"])
    for hours in by_machine.values():
        assert hours == sorted(hours)


def test_outcomes_are_mixed_not_hardcoded(history):
    share = Counter(r["action_outcome"] for r in history)
    for outcome in ("SUCCESS", "PARTIAL", "FAILED", "UNKNOWN"):
        assert share[outcome] / len(history) > 0.05
    outcomes = defaultdict(set)
    for r in history:
        outcomes[r["intervention_category"]].add(r["action_outcome"])
    mixed = [c for c, o in outcomes.items() if {"SUCCESS", "FAILED"} <= o]
    assert len(mixed) >= len(outcomes) // 3


def test_confirmed_cause_only_when_plausible(history):
    for r in history:
        if r["action_outcome"] in ("FAILED", "UNKNOWN"):
            assert not r["confirmed_root_cause"]


def test_hero_machine_chains_present(history):
    for hero in HERO_MACHINES:
        inc = hero["incident"]
        chain = [r for r in history if r["machine_id"] == inc["machine_id"] and r["defect_type"] == inc["defect_type"]]
        outcomes = {r["action_outcome"] for r in chain}
        assert len(chain) >= 2 and "SUCCESS" in outcomes and outcomes & {"FAILED", "PARTIAL"}


def test_demo_problem_has_no_history(history):
    assert not [r for r in history if r["defect_type"] == "condensate_drain_failure"]
