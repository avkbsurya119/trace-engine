"""End-to-end through the FastAPI app (fake Hindsight, no LLM)."""

import pytest

from tests.ts_contract import check, load_interfaces

INTERFACES = load_interfaces()

AC407 = {
    "machine_id": "AC-407", "machine_type": "Screw_Air_Compressor", "production_line": "Utilities - Molding Hall",
    "defect_type": "condensate_drain_failure", "symptoms": ["water in compressed air line", "auto drain not cycling"],
    "description": "Electronic drain on the wet receiver is not cycling; water at the drops.",
}
CV507 = {
    "machine_id": "CV-507", "machine_type": "Belt_Conveyor", "production_line": "Packing",
    "defect_type": "belt_mistracking", "symptoms": ["belt running off to one side", "belt edge fraying"],
    "description": "Belt tracking to the drive side again, edge fraying near the tail.",
}


def assert_contract(body, interface):
    problems = check(body, interface, INTERFACES)
    assert not problems, "\n".join(problems)


async def test_contract_types_were_parsed():
    for name in ("AnalysisResult", "Recommendation", "EvidenceSummary", "DashboardStats",
                 "MachineMemory", "Fleet", "HeroMachine", "HealthStatus", "Incident"):
        assert INTERFACES.get(name), name


def test_contract_checker_catches_missing_fields():
    broken = {"current_incident": {}, "recommendation": {"evidence": [{}]}}
    problems = check(broken, "AnalysisResult", INTERFACES)
    assert "AnalysisResult.current_incident.machine_id: missing (frontend type string)" in problems
    assert any(p.startswith("AnalysisResult.memory_trace") for p in problems)
    assert any("recommendation.evidence[0].intervention_category" in p for p in problems)


async def test_health_reports_every_dependency(client):
    body = (await client.get("/api/dashboard/health")).json()
    assert body["status"] == "healthy"
    assert_contract(body, "HealthStatus")


async def test_health_degraded_when_hindsight_down(client, fake_hindsight, monkeypatch):
    async def broken(self):
        raise ConnectionError("down")
    monkeypatch.setattr(fake_hindsight, "check_bank", broken)
    body = (await client.get("/api/dashboard/health")).json()
    assert body["status"] == "degraded" and body["checks"]["hindsight"]["ok"] is False


async def test_stats_and_fleet_match_frontend(client, seeded):
    stats = (await client.get("/api/dashboard/stats")).json()
    assert_contract(stats, "DashboardStats")
    assert stats["total_incidents"] == len(seeded)
    assert sum(stats["outcome_distribution"].values()) == stats["incidents_with_outcome"]

    fleet = (await client.get("/api/dashboard/fleet")).json()
    assert_contract(fleet, "Fleet")
    types = {t["machine_type"] for t in fleet["machine_types"]}
    assert types == set(stats["machine_type_distribution"])
    heroes = {t["hero_machine_id"] for t in fleet["machine_types"]} - {None}
    assert heroes == {"CNC-204", "HP-303", "CV-507"}


async def test_memory_loop_end_to_end(client, seeded):
    # 1. new problem on a machine with no history: no evidence, no action
    first = await client.post("/api/incidents/analyze", json=AC407)
    assert first.status_code == 200
    r1 = first.json()
    assert_contract(r1, "AnalysisResult")
    assert r1["recommendation"]["confidence"] == "INSUFFICIENT_DATA"
    assert r1["recommendation"]["intervention_category"] is None
    assert r1["historical_incidents"] == []
    id1 = r1["current_incident"]["incident_id"]

    # 2. record what worked
    outcome = await client.patch(f"/api/incidents/{id1}/outcome", json={
        "action_taken": "Replaced condensate drain", "intervention_category": "Condensate drain replacement",
        "action_outcome": "SUCCESS", "downtime_minutes": 90,
    })
    assert outcome.status_code == 200
    assert_contract(outcome.json(), "Incident")
    assert (await client.get(f"/api/incidents/{id1}")).json()["action_outcome"] == "SUCCESS"

    # 3. similar incident recalls it and recommends it
    r2 = (await client.post("/api/incidents/analyze", json=AC407)).json()
    assert [h["incident"]["incident_id"] for h in r2["historical_incidents"]] == [id1]
    assert r2["recommendation"]["intervention_category"] == "Condensate drain replacement"
    assert r2["recommendation"]["supporting_incidents"] == [id1]
    assert r2["successful_interventions"][0]["same_machine"] is True

    # 4. machine memory shows both, newest first
    memory = (await client.get("/api/incidents/machine/AC-407/memory")).json()
    assert_contract(memory, "MachineMemory")
    assert memory["total_incidents"] == 2
    assert memory["timeline"][1]["incident_id"] == id1
    assert memory["successful_interventions"] == {"Condensate drain replacement": ["condensate_drain_failure"]}


async def test_recurring_incident_uses_machine_history(client, seeded):
    body = (await client.post("/api/incidents/analyze", json=CV507)).json()
    same_machine = {i["outcome"] for i in body["successful_interventions"] + body["partial_interventions"] if i["same_machine"]}
    assert {"SUCCESS", "PARTIAL"} <= same_machine
    ids = {h["incident"]["incident_id"] for h in body["historical_incidents"]}
    assert set(body["recommendation"]["supporting_incidents"]) <= ids
    assert body["memory_trace"]["evidence_incidents"] == len(body["historical_incidents"])
    assert body["recommendation"]["reasoning_source"] == "deterministic"  # LLM disabled in tests


async def test_hero_machines_are_computed_not_hardcoded(client, seeded):
    body = (await client.get("/api/dashboard/hero-machines")).json()
    assert [h["incident"]["machine_id"] for h in body["hero_machines"]] == ["CNC-204", "HP-303", "CV-507"]
    for hero in body["hero_machines"]:
        assert_contract(hero, "HeroMachine")
        assert hero["without_memory"]["confidence"] == "INSUFFICIENT_DATA"
        assert hero["with_memory"]["intervention_category"]
        assert hero["trial_and_error"]["attempts_that_did_not_work"] == len(hero["trial_and_error"]["incident_ids"])
    stats = (await client.get("/api/dashboard/stats")).json()
    assert stats["total_incidents"] == len(seeded)  # dry run stored nothing


async def test_errors_are_json_with_detail(client, db):
    missing = await client.get("/api/incidents/NOPE")
    assert missing.status_code == 404 and missing.json()["detail"]
    assert (await client.patch("/api/incidents/NOPE/outcome", json={"action_taken": "x", "action_outcome": "SUCCESS"})).status_code == 404
    bad = await client.post("/api/incidents/analyze", json={**AC407, "machine_id": ""})
    assert bad.status_code == 422 and bad.json()["detail"][0]["loc"][-1] == "machine_id"
    assert (await client.patch("/api/incidents/X/outcome", json={"action_taken": "x", "action_outcome": "MAYBE"})).status_code == 422


async def test_memory_outage_returns_503_and_saves_nothing(client, db, fake_hindsight):
    fake_hindsight.fail_recall = True
    response = await client.post("/api/incidents/analyze", json=AC407)
    assert response.status_code == 503 and "Memory service unavailable" in response.json()["detail"]
    fake_hindsight.fail_recall = False
    fake_hindsight.fail_retain = True
    assert (await client.post("/api/incidents/analyze", json=AC407)).status_code == 503
    assert (await client.get("/api/dashboard/stats")).json()["total_incidents"] == 0


async def test_unknown_machine_memory_is_empty_not_error(client, db):
    body = (await client.get("/api/incidents/machine/NEW-1/memory")).json()
    assert body["total_incidents"] == 0 and body["timeline"] == []
    assert_contract(body, "MachineMemory")


async def test_cors_allows_frontend_origins(client):
    for origin in ("http://localhost:3000", "http://127.0.0.1:3000"):
        r = await client.options("/api/dashboard/stats", headers={"Origin": origin, "Access-Control-Request-Method": "GET"})
        assert r.headers.get("access-control-allow-origin") == origin


async def test_memory_errors_are_readable_and_reported_by_health(client, db, fake_hindsight, monkeypatch):
    from app.hindsight import memory as memory_module

    class CreditsError(Exception):
        status = 402
        body = '{"detail":"Insufficient credits. Please add credits to continue."}'

        def __str__(self):
            return "(402)\nReason: Payment Required\nHTTP response headers: <...lots of headers...>"

    async def refuse(*args, **kwargs):
        raise CreditsError()

    monkeypatch.setattr(fake_hindsight, "recall", refuse)
    try:
        response = await client.post("/api/incidents/analyze", json=AC407)
        detail = response.json()["detail"]
        assert response.status_code == 503
        assert "Hindsight 402: Insufficient credits" in detail and "headers" not in detail

        health = (await client.get("/api/dashboard/health")).json()
        assert health["status"] == "degraded"
        assert "Insufficient credits" in health["checks"]["hindsight"]["error"]
    finally:
        memory_module.MEMORY_STATUS.update(last_error=None, at=0.0)


async def test_stats_include_monotonic_memory_growth(client, seeded):
    stats = (await client.get("/api/dashboard/stats")).json()
    growth = stats["memory_growth"]
    assert [g["month"] for g in growth] == sorted(g["month"] for g in growth)
    cumulative = [g["cumulative_outcomes"] for g in growth]
    assert cumulative == sorted(cumulative) and cumulative[-1] == stats["incidents_with_outcome"]
    assert growth[-1]["cumulative_incidents"] == stats["total_incidents"]


async def test_demo_presets_are_valid_and_shared_with_script(client, db):
    from scripts import demo

    fleet = (await client.get("/api/dashboard/fleet")).json()
    presets = fleet["demo_presets"]
    types = {t["machine_type"]: t for t in fleet["machine_types"]}
    for preset in presets:
        inc = preset["incident"]
        t = types[inc["machine_type"]]
        assert inc["machine_id"] in {m["machine_id"] for m in t["machines"]}
        assert inc["defect_type"] in {d["defect_type"] for d in t["defect_types"]}
    assert demo.INCIDENT_1 == presets[0]["incident"] and demo.INCIDENT_2 == presets[1]["incident"]
    assert demo.OUTCOME_1 == fleet["demo_outcome"]


async def test_demo_first_preset_withholds_then_learns(client, seeded):
    fleet = (await client.get("/api/dashboard/fleet")).json()
    first, second = fleet["demo_presets"][:2]
    r1 = (await client.post("/api/incidents/analyze", json=first["incident"])).json()
    assert r1["recommendation"]["confidence_checks"][0]["passed"] is False
    await client.patch(f"/api/incidents/{r1['current_incident']['incident_id']}/outcome", json=fleet["demo_outcome"])
    r2 = (await client.post("/api/incidents/analyze", json=second["incident"])).json()
    assert r2["recommendation"]["intervention_category"] == fleet["demo_outcome"]["intervention_category"]
    assert r2["recommendation"]["evidence"][0]["verdict"] == "selected"
