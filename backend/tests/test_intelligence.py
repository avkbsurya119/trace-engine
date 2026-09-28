"""TRACE Intelligence: read-only analytics computed from SQLite and the unchanged engine."""

from datetime import datetime, timezone

import pytest

from app.services.intelligence import IntelligenceService, wilson_lower_bound
from tests.helpers import past
from tests.ts_contract import check, load_interfaces

INTERFACES = load_interfaces()


def test_wilson_lower_bound_penalises_small_samples():
    assert wilson_lower_bound(0, 0) == 0.0
    assert wilson_lower_bound(2, 2) < wilson_lower_bound(12, 14)   # 2/2 must not beat 12/14
    assert 0 < wilson_lower_bound(12, 14) < 12 / 14


def _history():
    """A tiny chronological history: alignment fails, bearings work repeatedly."""
    rows = [
        past("WO-1", "Alignment", "FAILED", machine_id="CNC-204", days=100),
        past("WO-2", "Bearings", "SUCCESS", machine_id="CNC-204", days=97),
        past("WO-3", "Bearings", "SUCCESS", machine_id="CNC-201", days=60),
        past("WO-4", "Bearings", "SUCCESS", machine_id="CNC-202", days=30),
        past("WO-5", "Alignment", "FAILED", machine_id="CNC-203", days=10),
    ]
    return [h.incident for h in rows]


def test_replay_uses_only_earlier_outcomes():
    report = IntelligenceService().build(_history(), now=datetime(2026, 1, 1, tzinfo=timezone.utc))
    impact = report["memory_impact"]
    # WO-1 had no memory; WO-2 had only a failure (no answer); WO-3/WO-4 followed memory (Bearings);
    # WO-5 had an answer (Bearings) but did Alignment.
    assert impact["no_memory"]["attempts"] == 1
    assert impact["memory_no_answer"]["attempts"] == 1
    assert impact["followed"] == {"attempts": 2, "worked": 2, "success_rate": 1.0, "median_downtime_minutes": None}
    assert impact["not_followed"]["attempts"] == 1 and impact["not_followed"]["worked"] == 0


def test_knowledge_changes_track_confidence_over_time():
    report = IntelligenceService().build(_history(), now=datetime(2026, 1, 1, tzinfo=timezone.utc))
    changes = report["knowledge_changes"][::-1]  # oldest first
    assert [(c["incident_id"], c["confidence_before"], c["confidence_after"]) for c in changes] == [
        ("WO-2", "INSUFFICIENT_DATA", "LOW"),
        ("WO-3", "LOW", "MEDIUM"),
        ("WO-4", "MEDIUM", "HIGH"),
    ]
    assert changes[-1]["confidence_after"] == "HIGH" and changes[-1]["recommended_after"] == "Bearings"


def test_reuse_counts_same_machine_and_fleet_memory():
    reuse = IntelligenceService().build(_history())["reuse"]
    assert reuse["work_orders"] == 5 and reuse["with_prior_memory"] == 4
    assert reuse["with_same_machine_memory"] == 1          # WO-2 had WO-1 from CNC-204
    assert reuse["fleet_only_memory"] == 3                  # WO-3, WO-4, WO-5 only had other machines
    assert reuse["most_cited_work_orders"][0]["incident_id"] == "WO-2"


def test_fleet_problem_knowledge_hides_machine_only_rules():
    rec, count = IntelligenceService().problem_knowledge(_history(), "CNC_Machining_Center", "spindle_vibration")
    assert count == 5 and rec.intervention_category == "Bearings"
    assert all(c.level != "DOWNGRADE" and "this machine" not in c.rule for c in rec.confidence_checks)
    assert not any("FLEET" in w for w in rec.warnings)


async def test_intelligence_endpoint_matches_frontend_types(client, seeded):
    body = (await client.get("/api/intelligence")).json()
    problems = check(body, "IntelligenceReport", INTERFACES)
    assert not problems, "\n".join(problems)

    overview = body["overview"]
    assert overview["total_incidents"] == len(seeded) == overview["memory_entries"]
    assert overview["recorded_outcomes"] == sum(
        overview[k] for k in ("successful_repairs", "failed_repairs", "partial_repairs", "unverified_repairs")
    )
    assert sum(overview["confidence_distribution"].values()) == overview["problems_catalogued"]
    evolution = body["evolution"]
    assert evolution[-1]["cumulative_incidents"] == len(seeded)
    assert [e["cumulative_outcomes"] for e in evolution] == sorted(e["cumulative_outcomes"] for e in evolution)
    ranked = body["reliable_repairs"]["ranked"]
    assert all(r["attempts"] >= body["reliable_repairs"]["min_attempts"] for r in ranked)
    assert [r["reliability"] for r in ranked] == sorted((r["reliability"] for r in ranked), reverse=True)
    assert [m["rank"] for m in body["machines"]] == list(range(1, len(body["machines"]) + 1))


async def test_intelligence_is_cached_until_data_changes(client, seeded):
    first = (await client.get("/api/intelligence")).json()
    again = (await client.get("/api/intelligence")).json()
    assert again["generated_at"] == first["generated_at"]
    incident = seeded[0]
    await client.patch(f"/api/incidents/{incident.incident_id}/outcome", json={"action_taken": "x", "action_outcome": "FAILED"})
    changed = (await client.get("/api/intelligence")).json()
    assert changed["generated_at"] != first["generated_at"]


async def test_problem_endpoint(client, seeded):
    body = (await client.get("/api/intelligence/problem", params={"machine_type": "Belt_Conveyor", "defect_type": "roller_bearing_noise"})).json()
    assert body["evidence_count"] > 0
    assert check(body, "ProblemKnowledge", INTERFACES) == []
    missing = await client.get("/api/intelligence/problem", params={"machine_type": "Belt_Conveyor", "defect_type": "nope"})
    assert missing.status_code == 404
