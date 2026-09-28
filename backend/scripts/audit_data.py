"""
Data-quality audit of the SQLite history (and, optionally, of what the
recommendation pipeline picks across many problems).

    python -m scripts.audit_data
    python -m scripts.audit_data --recommendations   # also runs recall + scoring per problem
"""

import argparse
import asyncio
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timezone

from app.data.catalog import FLEET
from app.db.repository import IncidentRepository

# Physical sanity bounds per sensor (well outside anything plausible).
BOUNDS = {
    "_pct": (0, 150), "_temp_c": (-10, 350), "_bar": (0, 2500), "_mm_s": (0, 30),
    "_rpm": (0, 30000), "_um": (0, 200), "_a": (0, 400), "_mm": (0, 50), "_s": (0, 600),
    "_mbar": (0, 500), "_m_s": (0, 5), "_c": (-10, 300),
}
CONTRADICTIONS = {
    "SUCCESS": ["no change", "did not fix", "no improvement"],
    "FAILED": ["confirmed", "readings back to normal", "no recurrence"],
}


def bound_for(key):
    for suffix, bounds in BOUNDS.items():
        if key.endswith(suffix):
            return bounds
    return None


async def audit():
    incidents = await IncidentRepository().list_all()
    history = [i for i in incidents if i.incident_id.startswith("WO-")]
    problems = defaultdict(list)
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    ids = Counter(i.incident_id for i in incidents)
    problems["duplicate incident IDs"] = [k for k, v in ids.items() if v > 1]

    for i in incidents:
        spec = FLEET.get(i.machine_type)
        if not spec or i.machine_id not in spec["machines"]:
            problems["machine not in fleet for its type"].append(i.incident_id)
        elif spec["machines"][i.machine_id]["line"] != i.production_line:
            problems["production line mismatch"].append(i.incident_id)
        if i.timestamp > now:
            problems["timestamp in the future"].append(i.incident_id)
        if i.downtime_minutes is not None and (i.downtime_minutes <= 0 or (i.resolution_time_minutes or 0) > i.downtime_minutes):
            problems["downtime <= 0 or shorter than repair time"].append(i.incident_id)
        for key, value in (i.sensor_values or {}).items():
            b = bound_for(key)
            if isinstance(value, (int, float)) and b and not (b[0] <= value <= b[1]):
                problems["impossible sensor value"].append(f"{i.incident_id} {key}={value}")
        if spec and i.intervention_category:
            known = set(spec["interventions"]) | {r[3] for r in spec["rare"]}
            if i.incident_id.startswith("WO-") and i.intervention_category not in known:
                problems["intervention not valid for machine type"].append(i.incident_id)
        notes = (i.technician_notes or "").lower()
        outcome = i.action_outcome.value if i.action_outcome else None
        for phrase in CONTRADICTIONS.get(outcome, []):
            if phrase in notes and not notes.startswith(("follow-up", "recurring")):
                problems["notes contradict outcome"].append(f"{i.incident_id} {outcome}: '{phrase}'")

    by_machine = defaultdict(list)
    for i in history:
        by_machine[i.machine_id].append(i)
    for machine, items in by_machine.items():
        items.sort(key=lambda x: x.timestamp)
        for a, b in zip(items, items[1:]):
            days = (b.timestamp - a.timestamp).total_seconds() / 86400
            if b.operating_hours < a.operating_hours or (b.operating_hours - a.operating_hours) > days * 24 + 1:
                problems["operating hours impossible"].append(f"{machine} {a.incident_id}->{b.incident_id}")

    print(f"Incidents: {len(incidents)} ({len(history)} generated history, {len(incidents) - len(history)} live)")
    counts = [len(v) for v in by_machine.values()]
    print(f"Machines with history: {len(by_machine)}; incidents per machine min {min(counts)} / median "
          f"{statistics.median(counts)} / max {max(counts)}")
    stamps = [i.timestamp for i in history]
    print(f"Time span: {min(stamps):%Y-%m-%d} to {max(stamps):%Y-%m-%d}; "
          f"duplicate timestamps: {len(stamps) - len(set(stamps))}")
    print(f"Distinct descriptions: {len({i.description for i in history})}/{len(history)}; "
          f"distinct technician notes: {len({i.technician_notes for i in history})}/{len(history)}")
    outcome_by_type = defaultdict(Counter)
    for i in history:
        outcome_by_type[i.machine_type][i.action_outcome.value] += 1
    print("Outcome mix per machine type (S/P/F/U %):")
    for t, c in outcome_by_type.items():
        total = sum(c.values())
        print(f"   {t:28} " + " / ".join(f"{100 * c[o] // total:2d}" for o in ("SUCCESS", "PARTIAL", "FAILED", "UNKNOWN")))
    sev = Counter(i.severity for i in history)
    print("Severity:", dict(sev))
    downtime = sorted(i.downtime_minutes for i in history)
    print(f"Downtime h: p10 {downtime[len(downtime) // 10] / 60:.1f}, median {downtime[len(downtime) // 2] / 60:.1f}, "
          f"p90 {downtime[9 * len(downtime) // 10] / 60:.1f}, max {downtime[-1] / 60:.1f}")
    mixed = defaultdict(set)
    for i in history:
        mixed[i.intervention_category].add(i.action_outcome.value)
    both = sum(1 for v in mixed.values() if {"SUCCESS", "FAILED"} <= v)
    print(f"Interventions that both succeeded and failed somewhere: {both}/{len(mixed)}")

    print("\nChecks:")
    failed = 0
    for name in [
        "duplicate incident IDs", "machine not in fleet for its type", "production line mismatch",
        "timestamp in the future", "downtime <= 0 or shorter than repair time", "impossible sensor value",
        "intervention not valid for machine type", "notes contradict outcome", "operating hours impossible",
    ]:
        found = problems.get(name, [])
        failed += bool(found)
        print(f"   [{'FAIL' if found else ' OK '}] {name}" + (f": {found[:5]}" if found else ""))
    return failed


async def audit_recommendations():
    """Run recall + gate + scoring for every (machine type, problem) and check variety."""
    from app.hindsight.memory import MemoryService
    from app.models import Incident, IncidentCreate
    from app.services.analysis import select_evidence
    from app.services.recommendation import RecommendationEngine

    memory, engine = MemoryService(), RecommendationEngine()
    picks = Counter()
    confidence = Counter()
    print("\nRecommendation per problem (first machine of each type):")
    for machine_type, spec in FLEET.items():
        machine_id, machine = next(iter(spec["machines"].items()))
        for defect, d in spec["defects"].items():
            if d["weight"] == 0:
                continue
            incident = IncidentCreate(
                machine_id=machine_id, machine_type=machine_type, production_line=machine["line"],
                defect_type=defect, symptoms=d["symptoms"][:2], description=d["descriptions"][0].split("{")[0],
            )
            recalled, _ = await memory.search_similar_incidents(incident)
            evidence = select_evidence(incident, recalled)
            rec = engine.generate_recommendation(Incident(incident_id="AUDIT", **incident.model_dump()), evidence)
            picks[rec.suggested_action] += 1
            confidence[rec.confidence] += 1
            print(f"   {machine_id:8} {defect:28} -> {rec.suggested_action:38} {rec.confidence}")
    await memory.close()
    top, n = picks.most_common(1)[0]
    print(f"\nDistinct recommended interventions: {len(picks)} across {sum(picks.values())} problems "
          f"(most common: '{top}' x{n}). Confidence mix: {dict(confidence)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--recommendations", action="store_true")
    args = parser.parse_args()
    failed = asyncio.run(audit())
    if args.recommendations:
        asyncio.run(audit_recommendations())
    raise SystemExit(1 if failed else 0)
