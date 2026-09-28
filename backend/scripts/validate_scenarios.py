"""
Validation suite: runs realistic scenarios through the live API
(real Hindsight recall, real deterministic scoring, real LLM phrasing)
and checks the behaviour a judge would expect. Incidents created by the
suite are removed from SQLite and Hindsight afterwards.

    uvicorn main:app --port 8000        # in another terminal
    python -m scripts.validate_scenarios
"""

import asyncio
import re
import sys

import httpx

from app.hindsight.memory import MemoryService
from scripts.demo import MACHINE as DEMO_MACHINE, reset as reset_demo_machine
from scripts.scenarios import SCENARIOS

API = "http://localhost:8000/api"
ID_PATTERN = re.compile(r"\b(?:WO|INC)-[A-Z0-9-]+\b")


def check(name, result):
    rec = result["recommendation"]
    evidence_ids = {h["incident"]["incident_id"] for h in result["historical_incidents"]}
    succ = result["successful_interventions"]
    fail = result["failed_interventions"]
    part = result["partial_interventions"]
    checks = []

    cited = set(ID_PATTERN.findall(rec["reasoning"])) - {result["current_incident"]["incident_id"]}
    checks.append(("reasoning cites only retrieved incidents", cited <= evidence_ids))

    if name == "A_strong_history":
        winner = next((e for e in rec["evidence"] if e["intervention_category"] == rec["intervention_category"]), None)
        checks.append(("confidence HIGH", rec["confidence"] == "HIGH"))
        checks.append((">= 3 supporting successes", bool(winner) and winner["successes"] >= 3))
    elif name == "B_conflicting_history":
        checks.append(("has successful interventions", len(succ) > 0))
        checks.append(("has failed interventions", len(fail) > 0))
        checks.append(("warnings explain failures", any("fail" in w.lower() for w in rec["warnings"])))
        checks.append(("shows CNC-204's own failed alignment attempt",
                       any(i["same_machine"] and i["category"] == "Spindle alignment / tramming" for i in fail)))
    elif name == "C_sparse_history":
        checks.append(("confidence MEDIUM or LOW", rec["confidence"] in ("MEDIUM", "LOW")))
        checks.append(("limited evidence (<= 3)", len(evidence_ids) <= 3))
    elif name in ("D_no_history", "E_novel_incident"):
        checks.append(("INSUFFICIENT_DATA", rec["confidence"] == "INSUFFICIENT_DATA"))
        checks.append(("no invented action", rec["intervention_category"] is None))
        checks.append(("no evidence shown", len(evidence_ids) == 0))
        checks.append(("recall ran", result["memory_trace"].get("incidents_recalled", 0) > 0))
    elif name == "F_recurring_incident":
        same = [i for i in succ + fail + part if i["same_machine"]]
        outcomes = {i["outcome"] for i in same}
        checks.append(("retrieves earlier CV-507 occurrences", len(same) >= 2))
        checks.append(("distinguishes SUCCESS vs PARTIAL on CV-507", {"SUCCESS", "PARTIAL"} <= outcomes))
    return checks


async def main():
    # D uses the demo machine, which must have no learned history.
    removed = await reset_demo_machine()
    print(f"Reset {DEMO_MACHINE}: removed {removed} earlier demo incident(s).")
    created = []
    failures = 0
    async with httpx.AsyncClient(timeout=120) as client:
        for name, scenario in SCENARIOS.items():
            response = await client.post(f"{API}/incidents/analyze", json=scenario["incident"].model_dump())
            response.raise_for_status()
            result = response.json()
            created.append(result["current_incident"]["incident_id"])
            rec = result["recommendation"]
            print(f"\n=== {name}  (expect: {scenario['expect']})")
            print(f"    evidence: {len(result['historical_incidents'])} incidents "
                  f"(recalled {result['memory_trace']['incidents_recalled']} work orders)")
            print(f"    -> {rec['suggested_action']}  [{rec['confidence']}]  reasoning by {rec['reasoning_source']}")
            print(f"    basis: {rec['basis']}")
            for e in rec["evidence"][:4]:
                print(f"       {e['intervention_category']:38} S{e['successes']} P{e['partials']} F{e['failures']} U{e['unknowns']}"
                      f"  (this machine: S{e['same_machine_successes']} F{e['same_machine_failures']})")
            print(f"    reasoning: {rec['reasoning']}")
            for label, ok in check(name, result):
                failures += not ok
                print(f"    [{'PASS' if ok else 'FAIL'}] {label}")

    memory = MemoryService()
    await memory.delete_incidents(created)
    await memory.close()
    print(f"\nCleaned up {len(created)} validation incidents.")
    print("ALL CHECKS PASSED" if failures == 0 else f"{failures} CHECK(S) FAILED")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    asyncio.run(main())
