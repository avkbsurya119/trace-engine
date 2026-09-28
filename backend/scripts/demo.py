"""
Scripted before/after-memory demo against the live API.

AC-407 is a compressor commissioned in 2026-08 with no maintenance history,
and nobody in the fleet has seen a condensate drain failure before.

    python -m scripts.demo              # reset, then run the demo once
    python -m scripts.demo --runs 3     # reset + run three times, check it is repeatable
    python -m scripts.demo --reset      # only remove AC-407 demo incidents

Reset removes every AC-407 incident from SQLite and Hindsight (the generated
history deliberately contains none), so each run starts from the same state.
"""

import argparse
import asyncio
import sys

import httpx

from app.data.catalog import DEMO_OUTCOME, DEMO_PRESETS
from app.hindsight.memory import MemoryService

API = "http://localhost:8000/api"
MACHINE = "AC-407"

INCIDENT_1 = DEMO_PRESETS[0]["incident"]
OUTCOME_1 = DEMO_OUTCOME
INCIDENT_2 = DEMO_PRESETS[1]["incident"]


async def reset() -> int:
    memory = MemoryService()
    ids = [i.incident_id for i in await memory.get_machine_history(MACHINE)]
    removed = await memory.delete_incidents(ids)
    await memory.close()
    return removed


def show(title, result):
    rec = result["recommendation"]
    print(f"\n  {title}: {result['current_incident']['incident_id']}")
    print(f"    recalled {result['memory_trace']['incidents_recalled']} work orders, "
          f"{len(result['historical_incidents'])} kept as evidence")
    for h in result["historical_incidents"]:
        i = h["incident"]
        print(f"      - {i['incident_id']} {i['machine_id']} {i['intervention_category']} -> {i['action_outcome']} "
              f"({round(h['similarity_score'] * 100)}% match)")
    print(f"    recommendation: {rec['suggested_action']} [{rec['confidence']}]")
    print(f"    basis: {rec['basis']}")
    print(f"    reasoning ({rec['reasoning_source']}): {rec['reasoning']}")


async def run_once(client) -> list:
    problems = []
    r1 = (await client.post(f"{API}/incidents/analyze", json=INCIDENT_1)).raise_for_status().json()
    show("Incident 1 (no history)", r1)
    if r1["recommendation"]["confidence"] != "INSUFFICIENT_DATA" or r1["historical_incidents"]:
        problems.append("incident 1 should have no evidence and INSUFFICIENT_DATA")

    id1 = r1["current_incident"]["incident_id"]
    (await client.patch(f"{API}/incidents/{id1}/outcome", json=OUTCOME_1)).raise_for_status()
    print(f"\n  Outcome recorded for {id1}: {OUTCOME_1['intervention_category']} -> SUCCESS")

    r2 = (await client.post(f"{API}/incidents/analyze", json=INCIDENT_2)).raise_for_status().json()
    show("Incident 2 (similar, same machine)", r2)
    evidence_ids = [h["incident"]["incident_id"] for h in r2["historical_incidents"]]
    rec = r2["recommendation"]
    if id1 not in evidence_ids:
        problems.append("incident 2 did not retrieve incident 1")
    if rec["intervention_category"] != OUTCOME_1["intervention_category"]:
        problems.append("incident 2 recommendation is not the intervention that worked on incident 1")
    if id1 not in rec["supporting_incidents"]:
        problems.append("incident 1 is not listed as supporting evidence")
    if rec["reasoning_source"] == "llm" and id1 not in rec["reasoning"]:
        problems.append("LLM reasoning does not cite incident 1")
    return problems


async def main(runs: int, reset_only: bool):
    removed = await reset()
    print(f"Reset: removed {removed} {MACHINE} incident(s) from SQLite and Hindsight.")
    if reset_only:
        return

    all_ok = True
    async with httpx.AsyncClient(timeout=120) as client:
        for n in range(1, runs + 1):
            print(f"\n=== Demo run {n}/{runs} ===")
            problems = await run_once(client)
            print("\n  RESULT:", "PASS" if not problems else "FAIL - " + "; ".join(problems))
            all_ok &= not problems
            if n < runs:
                removed = await reset()
                print(f"\n  Reset: removed {removed} {MACHINE} incident(s).")

    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=1)
    parser.add_argument("--reset", action="store_true", help="only reset the demo machine")
    args = parser.parse_args()
    asyncio.run(main(args.runs, args.reset))
