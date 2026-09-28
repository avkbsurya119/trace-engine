"""
TRACE Intelligence

Read-only analytics over the factory's accumulated memory. Everything here is
computed from the SQLite work orders and the existing deterministic
RecommendationEngine (used unchanged). Nothing is invented and no LLM is used.

Two computations do the heavy lifting:

* Knowledge per problem: the engine scores every (equipment type, problem)
  over all recorded outcomes, as a fleet-level view of what TRACE would
  recommend and how confidently.
* Chronological replay: walking the history in time order, each work order is
  compared with what memory held *before* it (earlier outcomes for the same
  problem on the same equipment type). This shows how knowledge grew, how
  often memory was available, and how outcomes differed when the technician's
  action matched what memory would have recommended. Recall itself is not
  logged, so the replay uses the exact records as the stand-in for recall.
"""

import math
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.data.catalog import FLEET
from app.models import ActionOutcome, HistoricalIncident, Incident, Recommendation
from app.services.recommendation import RecommendationEngine

CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW", "INSUFFICIENT_DATA"]
RELIABLE_MIN_ATTEMPTS = 5   # repairs with fewer attempts are listed but not ranked
RECURRING_MIN = 3           # same problem on the same machine this many times


def wilson_lower_bound(successes: int, attempts: int, z: float = 1.96) -> float:
    """Conservative (95%) lower bound of a success rate; small samples score low."""
    if attempts == 0:
        return 0.0
    p = successes / attempts
    denom = 1 + z * z / attempts
    centre = p + z * z / (2 * attempts)
    margin = z * math.sqrt((p * (1 - p) + z * z / (4 * attempts)) / attempts)
    return max(0.0, (centre - margin) / denom)


FLEET_ID = "FLEET"  # placeholder machine for fleet-level questions (never a real machine)


def _fleet_incident(machine_type: str, defect_type: str, machine_id: str = FLEET_ID) -> Incident:
    """The 'current incident' used to ask the engine about a problem in general."""
    return Incident(
        incident_id="INTELLIGENCE",
        machine_id=machine_id,
        machine_type=machine_type,
        production_line="-",
        defect_type=defect_type,
        description="Knowledge check",
    )


def _as_evidence(incident: Incident) -> HistoricalIncident:
    return HistoricalIncident(incident=incident, similarity_score=1.0)


def _verified(outcome: Optional[ActionOutcome]) -> bool:
    return outcome in (ActionOutcome.SUCCESS, ActionOutcome.PARTIAL, ActionOutcome.FAILED)


class IntelligenceService:
    def __init__(self):
        self.engine = RecommendationEngine()

    # ------------------------------------------------------------------
    # Problem-level knowledge (the trust panel uses this directly)
    # ------------------------------------------------------------------

    def problem_knowledge(
        self,
        incidents: List[Incident],
        machine_type: str,
        defect_type: str,
        machine_id: Optional[str] = None,
    ) -> Tuple[Recommendation, int]:
        evidence = [
            _as_evidence(i) for i in incidents
            if i.machine_type == machine_type and i.defect_type == defect_type and i.action_outcome
        ]
        current = _fleet_incident(machine_type, defect_type, machine_id or FLEET_ID)
        rec = self.engine.generate_recommendation(current, evidence)
        if machine_id is None:
            # Fleet-level view: rules and warnings about "this machine" don't apply.
            rec.confidence_checks = [
                c for c in rec.confidence_checks
                if c.level != "DOWNGRADE" and not c.rule.startswith("Or: proven on this machine")
            ]
            rec.warnings = [w for w in rec.warnings if FLEET_ID not in w]
        return rec, len(evidence)

    # ------------------------------------------------------------------
    # Full intelligence report
    # ------------------------------------------------------------------

    def build(self, incidents: List[Incident], now: Optional[datetime] = None) -> Dict[str, Any]:
        now = now or datetime.now(timezone.utc)
        history = sorted(incidents, key=lambda i: i.timestamp)
        replay = self._replay(history)
        problems = self._problems(history)
        return {
            "generated_at": now.isoformat(),
            "overview": self._overview(history, problems, now),
            "evolution": self._evolution(history, replay),
            "memory_impact": self._memory_impact(replay),
            "reuse": self._reuse(replay, history),
            "machines": self._machines(history),
            "failure_patterns": self._failure_patterns(history),
            "reliable_repairs": self._reliable_repairs(history),
            "knowledge_changes": replay["changes"][-12:][::-1],
            "network": self._network(history),
            "problems": [
                {k: p[k] for k in ("machine_type", "defect_type", "evidence_count", "confidence", "recommended")}
                for p in problems
            ],
        }

    # ------------------------------------------------------------------

    def _problems(self, history: List[Incident]) -> List[Dict[str, Any]]:
        """Current fleet-level knowledge for every catalogued or observed problem."""
        keys = {(t, d) for t, spec in FLEET.items() for d in spec["defects"]}
        keys |= {(i.machine_type, i.defect_type) for i in history}
        results = []
        for machine_type, defect_type in sorted(keys):
            rec, count = self.problem_knowledge(history, machine_type, defect_type)
            results.append({
                "machine_type": machine_type,
                "defect_type": defect_type,
                "evidence_count": count,
                "confidence": rec.confidence,
                "recommended": rec.intervention_category,
            })
        return results

    def _overview(self, history, problems, now) -> Dict[str, Any]:
        outcomes = Counter(i.action_outcome.value for i in history if i.action_outcome)
        catalogued = [p for p in problems if p["machine_type"] in FLEET and p["defect_type"] in FLEET[p["machine_type"]]["defects"]]
        covered = [p for p in catalogued if p["recommended"]]
        confidence = Counter(p["confidence"] for p in catalogued)
        first = history[0].timestamp if history else None
        age_days = (now.replace(tzinfo=None) - first.replace(tzinfo=None)).days if first else 0
        return {
            "total_incidents": len(history),
            "machines": len({i.machine_id for i in history}),
            "equipment_types": len({i.machine_type for i in history}),
            "successful_repairs": outcomes.get("SUCCESS", 0),
            "failed_repairs": outcomes.get("FAILED", 0),
            "partial_repairs": outcomes.get("PARTIAL", 0),
            "unverified_repairs": outcomes.get("UNKNOWN", 0),
            "recorded_outcomes": sum(outcomes.values()),
            "memory_entries": len(history),
            "problems_catalogued": len(catalogued),
            "problems_with_proven_fix": len(covered),
            "knowledge_coverage": round(len(covered) / len(catalogued), 3) if catalogued else 0.0,
            "confidence_distribution": {level: confidence.get(level, 0) for level in CONFIDENCE_LEVELS},
            "first_record": first.isoformat() if first else None,
            "knowledge_age_days": age_days,
        }

    # ------------------------------------------------------------------
    # Replay
    # ------------------------------------------------------------------

    def _replay(self, history: List[Incident]) -> Dict[str, Any]:
        known: Dict[Tuple[str, str], List[HistoricalIncident]] = defaultdict(list)
        level: Dict[Tuple[str, str], str] = {}
        steps, changes = [], []

        for incident in history:
            key = (incident.machine_type, incident.defect_type)
            prior = known[key]
            step = {
                "incident": incident,
                "had_memory": bool(prior),
                "same_machine_prior": sum(1 for h in prior if h.incident.machine_id == incident.machine_id),
                "fleet_prior": sum(1 for h in prior if h.incident.machine_id != incident.machine_id),
                "recommended": None,
                "supporting": [],
                "followed": None,
            }
            if prior:
                rec = self.engine.generate_recommendation(incident, prior)
                step["recommended"] = rec.intervention_category
                step["supporting"] = rec.supporting_incidents
                if rec.intervention_category and incident.intervention_category:
                    step["followed"] = incident.intervention_category == rec.intervention_category
            steps.append(step)

            if incident.action_outcome is None:
                continue
            before = level.get(key, "INSUFFICIENT_DATA")
            known[key] = prior + [_as_evidence(incident)]
            after_rec = self.engine.generate_recommendation(_fleet_incident(*key), known[key])
            level[key] = after_rec.confidence
            if after_rec.confidence != before:
                changes.append({
                    "incident_id": incident.incident_id,
                    "timestamp": incident.timestamp.isoformat(),
                    "machine_id": incident.machine_id,
                    "machine_type": incident.machine_type,
                    "defect_type": incident.defect_type,
                    "intervention_category": incident.intervention_category,
                    "outcome": incident.action_outcome.value,
                    "confidence_before": before,
                    "confidence_after": after_rec.confidence,
                    "recommended_after": after_rec.intervention_category,
                    "evidence_after": len(known[key]),
                })
        return {"steps": steps, "changes": changes}

    def _evolution(self, history, replay) -> List[Dict[str, Any]]:
        by_month: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for step in replay["steps"]:
            by_month[step["incident"].timestamp.strftime("%Y-%m")].append(step)

        seen_machines, points = set(), []
        cumulative_incidents = cumulative_outcomes = 0
        keys = {(t, d) for t, spec in FLEET.items() for d in spec["defects"]}
        for month in sorted(by_month):
            steps = by_month[month]
            new_machines = {s["incident"].machine_id for s in steps} - seen_machines
            seen_machines |= new_machines
            cumulative_incidents += len(steps)
            outcomes = sum(1 for s in steps if s["incident"].action_outcome)
            cumulative_outcomes += outcomes
            # Confidence of every catalogued problem using outcomes known by month end.
            known = [s["incident"] for s in replay["steps"] if s["incident"].timestamp.strftime("%Y-%m") <= month]
            levels = Counter(self.problem_knowledge(known, t, d)[0].confidence for t, d in keys)
            points.append({
                "month": month,
                "incidents": len(steps),
                "outcomes_recorded": outcomes,
                "successful_repairs": sum(1 for s in steps if s["incident"].action_outcome == ActionOutcome.SUCCESS),
                "new_machines": len(new_machines),
                "cumulative_incidents": cumulative_incidents,
                "cumulative_outcomes": cumulative_outcomes,
                "cumulative_machines": len(seen_machines),
                "problems_high": levels.get("HIGH", 0),
                "problems_medium": levels.get("MEDIUM", 0),
                "problems_low": levels.get("LOW", 0),
                "problems_with_fix": len(keys) - levels.get("INSUFFICIENT_DATA", 0),
                "memory_available_rate": round(sum(1 for s in steps if s["had_memory"]) / len(steps), 3),
            })
        return points

    def _memory_impact(self, replay) -> Dict[str, Any]:
        groups = {"no_memory": [], "memory_no_answer": [], "followed": [], "not_followed": []}
        for step in replay["steps"]:
            incident = step["incident"]
            if not _verified(incident.action_outcome):
                continue
            if not step["had_memory"]:
                groups["no_memory"].append(incident)
            elif step["recommended"] is None:
                groups["memory_no_answer"].append(incident)
            elif step["followed"]:
                groups["followed"].append(incident)
            else:
                groups["not_followed"].append(incident)

        def summary(items: List[Incident]) -> Dict[str, Any]:
            worked = sum(1 for i in items if i.action_outcome == ActionOutcome.SUCCESS)
            downtime = sorted(i.downtime_minutes for i in items if i.downtime_minutes)
            return {
                "attempts": len(items),
                "worked": worked,
                "success_rate": round(worked / len(items), 3) if items else None,
                "median_downtime_minutes": downtime[len(downtime) // 2] if downtime else None,
            }

        return {name: summary(items) for name, items in groups.items()}

    def _reuse(self, replay, history) -> Dict[str, Any]:
        with_memory = [s for s in replay["steps"] if s["had_memory"]]
        recommended = Counter(s["recommended"] for s in with_memory if s["recommended"])
        cited = Counter(i for s in with_memory for i in s["supporting"])
        by_id = {i.incident_id: i for i in history}
        return {
            "work_orders": len(replay["steps"]),
            "with_prior_memory": len(with_memory),
            "with_recommendation": sum(1 for s in with_memory if s["recommended"]),
            "with_same_machine_memory": sum(1 for s in with_memory if s["same_machine_prior"]),
            "with_fleet_memory": sum(1 for s in with_memory if s["fleet_prior"]),
            "fleet_only_memory": sum(1 for s in with_memory if s["fleet_prior"] and not s["same_machine_prior"]),
            "most_recommended_repairs": [{"intervention_category": c, "times": n} for c, n in recommended.most_common(8)],
            "most_cited_work_orders": [
                {
                    "incident_id": incident_id,
                    "times": n,
                    "machine_id": by_id[incident_id].machine_id,
                    "defect_type": by_id[incident_id].defect_type,
                    "intervention_category": by_id[incident_id].intervention_category,
                    "timestamp": by_id[incident_id].timestamp.isoformat(),
                }
                for incident_id, n in cited.most_common(8) if incident_id in by_id
            ],
        }

    # ------------------------------------------------------------------
    # Machines, failures, repairs, network
    # ------------------------------------------------------------------

    def _machines(self, history) -> List[Dict[str, Any]]:
        by_machine: Dict[str, List[Incident]] = defaultdict(list)
        for i in history:
            by_machine[i.machine_id].append(i)

        rows = []
        for machine_id, items in by_machine.items():
            machine_type = items[0].machine_type
            verified = [i for i in items if _verified(i.action_outcome)]
            worked = sum(1 for i in verified if i.action_outcome == ActionOutcome.SUCCESS)
            problems = []
            for defect in sorted({i.defect_type for i in items}):
                rec, evidence = self.problem_knowledge(history, machine_type, defect, machine_id)
                here = [i for i in items if i.defect_type == defect]
                proven_here = sorted({i.intervention_category for i in here if i.action_outcome == ActionOutcome.SUCCESS and i.intervention_category})
                problems.append({
                    "defect_type": defect,
                    "occurrences": len(here),
                    "proven_here": proven_here,
                    "confidence": rec.confidence,
                    "recommended": rec.intervention_category,
                    "fleet_evidence": evidence,
                })
            rows.append({
                "machine_id": machine_id,
                "machine_type": machine_type,
                "production_line": items[0].production_line,
                "model": FLEET.get(machine_type, {}).get("machines", {}).get(machine_id, {}).get("model"),
                "incidents": len(items),
                "verified_outcomes": len(verified),
                "success_rate": round(worked / len(verified), 3) if verified else None,
                "problems_seen": len(problems),
                "problems_with_proven_fix_here": sum(1 for p in problems if p["proven_here"]),
                "memory_completeness": round(len(verified) / len(items), 3),
                "downtime_hours": round(sum(i.downtime_minutes or 0 for i in items) / 60, 1),
                "problems": problems,
            })
        rows.sort(key=lambda r: (r["problems_with_proven_fix_here"], r["verified_outcomes"], r["success_rate"] or 0), reverse=True)
        for rank, row in enumerate(rows, start=1):
            row["rank"] = rank
        return rows

    def _failure_patterns(self, history) -> Dict[str, Any]:
        by_problem = Counter((i.machine_type, i.defect_type) for i in history)
        months = sorted({i.timestamp.strftime("%Y-%m") for i in history})
        top = [k for k, _ in by_problem.most_common(6)]
        monthly = {k: Counter() for k in top}
        for i in history:
            key = (i.machine_type, i.defect_type)
            if key in monthly:
                monthly[key][i.timestamp.strftime("%Y-%m")] += 1
        per_machine = Counter((i.machine_id, i.defect_type) for i in history)
        type_of = {i.machine_id: i.machine_type for i in history}
        outcomes = defaultdict(Counter)
        for i in history:
            if i.action_outcome:
                outcomes[(i.machine_type, i.defect_type)][i.action_outcome.value] += 1
        return {
            "months": months,
            "top_problems": [
                {
                    "machine_type": t,
                    "defect_type": d,
                    "occurrences": n,
                    "machines_affected": len({i.machine_id for i in history if (i.machine_type, i.defect_type) == (t, d)}),
                    "outcomes": dict(outcomes[(t, d)]),
                    "monthly": [monthly[(t, d)].get(m, 0) for m in months] if (t, d) in monthly else None,
                }
                for (t, d), n in by_problem.most_common(12)
            ],
            "by_equipment_type": [
                {
                    "machine_type": t,
                    "incidents": sum(n for (tt, _), n in by_problem.items() if tt == t),
                    "problems": sorted(
                        ({"defect_type": d, "occurrences": n} for (tt, d), n in by_problem.items() if tt == t),
                        key=lambda x: x["occurrences"], reverse=True,
                    ),
                }
                for t in sorted({t for t, _ in by_problem})
            ],
            "recurring": [
                {"machine_id": m, "machine_type": type_of[m], "defect_type": d, "occurrences": n}
                for (m, d), n in per_machine.most_common() if n >= RECURRING_MIN
            ][:15],
        }

    def _reliable_repairs(self, history) -> Dict[str, Any]:
        groups: Dict[Tuple[str, str, str], Counter] = defaultdict(Counter)
        for i in history:
            if i.action_outcome and i.intervention_category:
                groups[(i.machine_type, i.defect_type, i.intervention_category)][i.action_outcome.value] += 1
        rows = []
        for (t, d, c), counts in groups.items():
            attempts = counts["SUCCESS"] + counts["PARTIAL"] + counts["FAILED"]
            rows.append({
                "machine_type": t,
                "defect_type": d,
                "intervention_category": c,
                "attempts": attempts,
                "successes": counts["SUCCESS"],
                "partials": counts["PARTIAL"],
                "failures": counts["FAILED"],
                "unverified": counts["UNKNOWN"],
                "success_rate": round(counts["SUCCESS"] / attempts, 3) if attempts else None,
                "reliability": round(wilson_lower_bound(counts["SUCCESS"], attempts), 3),
                "sample": "strong" if attempts >= 10 else "moderate" if attempts >= RELIABLE_MIN_ATTEMPTS else "small",
            })
        ranked = sorted((r for r in rows if r["attempts"] >= RELIABLE_MIN_ATTEMPTS), key=lambda r: (r["reliability"], r["attempts"]), reverse=True)
        return {
            "min_attempts": RELIABLE_MIN_ATTEMPTS,
            "method": "95% Wilson lower bound of the success rate: a repair must work often AND have been tried often to rank high.",
            "ranked": ranked[:15],
            "least_reliable": sorted((r for r in rows if r["attempts"] >= RELIABLE_MIN_ATTEMPTS), key=lambda r: r["success_rate"] or 0)[:5],
            "small_sample_count": sum(1 for r in rows if r["attempts"] < RELIABLE_MIN_ATTEMPTS),
        }

    def _network(self, history) -> List[Dict[str, Any]]:
        """Equipment type -> problem -> repair, weighted by attempts, per equipment type."""
        tree: Dict[str, Dict[str, Dict[str, Counter]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(Counter)))
        for i in history:
            if i.action_outcome and i.intervention_category:
                tree[i.machine_type][i.defect_type][i.intervention_category][i.action_outcome.value] += 1
        out = []
        for machine_type, problems in sorted(tree.items()):
            problem_nodes = []
            for defect, repairs in sorted(problems.items(), key=lambda kv: -sum(sum(c.values()) for c in kv[1].values())):
                repair_nodes = []
                for category, counts in sorted(repairs.items(), key=lambda kv: -sum(kv[1].values()))[:4]:
                    attempts = counts["SUCCESS"] + counts["PARTIAL"] + counts["FAILED"]
                    repair_nodes.append({
                        "intervention_category": category,
                        "attempts": attempts,
                        "successes": counts["SUCCESS"],
                        "failures": counts["FAILED"],
                        "partials": counts["PARTIAL"],
                        "success_rate": round(counts["SUCCESS"] / attempts, 3) if attempts else None,
                    })
                problem_nodes.append({
                    "defect_type": defect,
                    "occurrences": sum(sum(c.values()) for c in repairs.values()),
                    "repairs": repair_nodes,
                })
            out.append({"machine_type": machine_type, "label": FLEET.get(machine_type, {}).get("label", machine_type), "problems": problem_nodes})
        return out
