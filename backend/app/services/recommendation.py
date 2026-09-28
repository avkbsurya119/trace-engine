"""
Recommendation Engine

Deterministic scoring over retrieved historical evidence. No LLM is
involved here: the winning intervention, its confidence and the warnings
are computed from outcome counts so the result can never be hallucinated.

Scoring, per intervention category across the evidence set:
    score = successes + 0.5 * partials - failures
            + 0.5 * same-machine successes - 0.5 * same-machine failures

Confidence for the winning category (UNKNOWN outcomes are not attempts):
    HIGH    >= 3 successes and success rate >= 75%, or
            >= 2 successes on this same machine, none failed there,
            >= 3 successes overall and success rate >= 60%
    MEDIUM  >= 2 successes and success rate >= 50%
    LOW     any other positive evidence
    INSUFFICIENT_DATA  no evidence, or no intervention has ever succeeded
"""

from collections import OrderedDict
from typing import Dict, List

from app.models import (
    ActionOutcome,
    ConfidenceCheck,
    EvidenceSummary,
    HistoricalIncident,
    Incident,
    Recommendation,
)

HIGH_MIN_SUCCESSES = 3
HIGH_MIN_RATE = 0.75
HIGH_SAME_MACHINE_MIN_SUCCESSES = 2
HIGH_SAME_MACHINE_MIN_RATE = 0.6
MEDIUM_MIN_SUCCESSES = 2
MEDIUM_MIN_RATE = 0.5
NO_RECOMMENDATION = "No evidence-backed recommendation"


class RecommendationEngine:
    """Engine for generating troubleshooting recommendations."""

    def generate_recommendation(
        self,
        incident: Incident,
        evidence: List[HistoricalIncident],
    ) -> Recommendation:
        summaries = self.tally(incident, evidence)

        if not evidence:
            return Recommendation(
                suggested_action=NO_RECOMMENDATION,
                confidence="INSUFFICIENT_DATA",
                basis=(
                    f"Memory holds no earlier {incident.defect_type.replace('_', ' ')} incident "
                    f"with a recorded outcome for this machine type."
                ),
                reasoning=(
                    f"TRACE found no earlier {incident.defect_type.replace('_', ' ')} incidents on "
                    f"{incident.machine_type.replace('_', ' ')} machines with a recorded outcome, so it "
                    "has no historical evidence to recommend a specific intervention. Diagnose on site and "
                    "record what was done and whether it worked; the next similar incident will use it."
                ),
                supporting_incidents=[],
                warnings=["No historical evidence: do not treat any action as proven for this problem."],
                evidence=[],
                confidence_checks=[ConfidenceCheck(
                    level="EVIDENCE", rule="At least one similar incident with a recorded outcome",
                    passed=False, detail="0 found; recommendation withheld",
                )],
            )

        winner = next((s for s in summaries if s.successes > 0 and s.score > 0), None)
        self._annotate(summaries, winner)

        if winner is None:
            tried = ", ".join(
                f"{s.intervention_category} ({s.failures} failed, {s.partials} partial)"
                for s in summaries[:3]
            )
            return Recommendation(
                suggested_action=NO_RECOMMENDATION,
                confidence="INSUFFICIENT_DATA",
                basis=f"{len(evidence)} similar incident(s) found, but no intervention has a recorded success.",
                reasoning=(
                    f"TRACE found {len(evidence)} similar incident(s), but none of the interventions tried "
                    f"has a recorded success: {tried}. There is no evidence-backed action; escalate for "
                    "root-cause diagnosis rather than repeating these."
                ),
                supporting_incidents=[h.incident.incident_id for h in evidence],
                warnings=[
                    f"{s.intervention_category} did not resolve this before "
                    f"({', '.join(s.incident_ids.get('FAILED', []) + s.incident_ids.get('PARTIAL', []))})."
                    for s in summaries[:3]
                ],
                evidence=summaries,
                confidence_checks=[
                    ConfidenceCheck(
                        level="EVIDENCE", rule="At least one similar incident with a recorded outcome",
                        passed=True, detail=f"{len(evidence)} found",
                    ),
                    ConfidenceCheck(
                        level="EVIDENCE", rule="At least one intervention has worked before",
                        passed=False, detail="none has a recorded success; recommendation withheld",
                    ),
                ],
            )

        attempts = winner.successes + winner.partials + winner.failures
        rate = winner.successes / attempts if attempts else 0.0
        proven_here = (
            winner.same_machine_successes >= HIGH_SAME_MACHINE_MIN_SUCCESSES
            and winner.same_machine_failures == 0
            and winner.successes >= HIGH_MIN_SUCCESSES
            and rate >= HIGH_SAME_MACHINE_MIN_RATE
        )
        if (winner.successes >= HIGH_MIN_SUCCESSES and rate >= HIGH_MIN_RATE) or proven_here:
            confidence = "HIGH"
        elif winner.successes >= MEDIUM_MIN_SUCCESSES and rate >= MEDIUM_MIN_RATE:
            confidence = "MEDIUM"
        else:
            confidence = "LOW"

        checks = self._confidence_checks(incident, winner, rate, proven_here)

        warnings: List[str] = []
        if winner.same_machine_failures and not winner.same_machine_successes:
            confidence = {"HIGH": "MEDIUM", "MEDIUM": "LOW"}.get(confidence, confidence)
            warnings.append(
                f"{winner.intervention_category} has failed on {incident.machine_id} before "
                f"({', '.join(winner.incident_ids.get('FAILED', []))}) and never succeeded there."
            )
        if winner.failures:
            warnings.append(
                f"{winner.intervention_category} also failed {winner.failures} time(s) on similar incidents "
                f"({', '.join(winner.incident_ids.get('FAILED', []))}): the cause may differ this time."
            )
        for other in summaries:
            if other is winner or other.failures == 0:
                continue
            warnings.append(
                f"{other.intervention_category} failed {other.failures} of "
                f"{other.successes + other.partials + other.failures} attempt(s) "
                f"({', '.join(other.incident_ids.get('FAILED', []))})."
            )
            if len(warnings) >= 4:
                break
        if not any(h.incident.machine_id == incident.machine_id for h in evidence):
            warnings.append(
                f"No earlier record of this problem on {incident.machine_id}; evidence comes from other "
                f"{incident.machine_type.replace('_', ' ')} machines."
            )

        same = winner.same_machine_successes
        basis = (
            f"{winner.successes} of {attempts} recorded attempt(s) with {winner.intervention_category} "
            f"on similar incidents succeeded"
            + (f" ({same} on {incident.machine_id})" if same else "")
            + f"; {winner.failures} failed, {winner.partials} partial."
        )

        return Recommendation(
            suggested_action=winner.intervention_category,
            intervention_category=winner.intervention_category,
            confidence=confidence,
            basis=basis,
            reasoning=self._deterministic_reasoning(incident, evidence, winner, summaries),
            supporting_incidents=winner.incident_ids.get("SUCCESS", []),
            warnings=warnings,
            evidence=summaries,
            confidence_checks=checks,
        )

    # ------------------------------------------------------------------

    @staticmethod
    def _annotate(summaries: List[EvidenceSummary], winner) -> None:
        """Explain, per intervention, why it was or wasn't recommended."""
        for s in summaries:
            if s is winner:
                s.verdict = "selected"
                s.verdict_reason = "Highest score among interventions that have worked"
            elif s.successes == 0 and s.failures:
                s.verdict_reason = f"Never worked: failed {s.failures} of {s.attempts} attempt(s)"
            elif s.successes == 0:
                s.verdict_reason = (
                    f"No verified success ({s.partials} partial, {s.unknowns} unverified)"
                )
            elif s.failures > s.successes:
                s.verdict_reason = f"Failed more often than it worked ({s.failures} vs {s.successes})"
            elif winner is not None and s.score == winner.score:
                s.verdict_reason = "Same score; ranked lower on successes, failures or recency"
            elif winner is not None:
                s.verdict_reason = f"Lower score ({s.score:g} vs {winner.score:g})"
            else:
                s.verdict_reason = "Score not positive"

    @staticmethod
    def _confidence_checks(incident, winner, rate, proven_here) -> List[ConfidenceCheck]:
        pct = f"{winner.successes} of {winner.attempts} = {rate:.0%}"
        here = f"{winner.same_machine_successes} worked, {winner.same_machine_failures} failed on {incident.machine_id}"
        return [
            ConfidenceCheck(level="HIGH", rule=f">= {HIGH_MIN_SUCCESSES} successes",
                            passed=winner.successes >= HIGH_MIN_SUCCESSES, detail=f"{winner.successes} successes"),
            ConfidenceCheck(level="HIGH", rule=f"Success rate >= {HIGH_MIN_RATE:.0%}",
                            passed=rate >= HIGH_MIN_RATE, detail=pct),
            ConfidenceCheck(level="HIGH", rule=(
                f"Or: proven on this machine (>= {HIGH_SAME_MACHINE_MIN_SUCCESSES} successes here, none failed here, "
                f"rate >= {HIGH_SAME_MACHINE_MIN_RATE:.0%})"), passed=proven_here, detail=here),
            ConfidenceCheck(level="MEDIUM", rule=f">= {MEDIUM_MIN_SUCCESSES} successes and rate >= {MEDIUM_MIN_RATE:.0%}",
                            passed=winner.successes >= MEDIUM_MIN_SUCCESSES and rate >= MEDIUM_MIN_RATE, detail=pct),
            ConfidenceCheck(level="DOWNGRADE", rule="Not failed on this machine without ever working here",
                            passed=not (winner.same_machine_failures and not winner.same_machine_successes), detail=here),
        ]

    @staticmethod
    def tally(incident: Incident, evidence: List[HistoricalIncident]) -> List[EvidenceSummary]:
        groups: "OrderedDict[str, Dict]" = OrderedDict()
        # Newest first so example_action is the most recent instance.
        ordered = sorted(evidence, key=lambda h: h.incident.timestamp, reverse=True)

        for hist in ordered:
            past = hist.incident
            category = (past.intervention_category or past.action_taken or "").strip()
            if not category or past.action_outcome is None:
                continue
            g = groups.setdefault(category, {
                "example_action": None, "fallback_action": past.action_taken or category,
                "counts": {o.value: 0 for o in ActionOutcome},
                "ids": {o.value: [] for o in ActionOutcome},
                "same_s": 0, "same_f": 0,
            })
            outcome = past.action_outcome.value
            g["counts"][outcome] += 1
            g["ids"][outcome].append(past.incident_id)
            same_machine = past.machine_id == incident.machine_id
            if outcome == "SUCCESS":
                g["example_action"] = g["example_action"] or past.action_taken
                g["same_s"] += int(same_machine)
            elif outcome == "FAILED":
                g["same_f"] += int(same_machine)

        summaries = []
        for category, g in groups.items():
            c = g["counts"]
            score = (
                c["SUCCESS"] + 0.5 * c["PARTIAL"] - c["FAILED"]
                + 0.5 * g["same_s"] - 0.5 * g["same_f"]
            )
            summaries.append(EvidenceSummary(
                intervention_category=category,
                example_action=g["example_action"] or g["fallback_action"],
                successes=c["SUCCESS"],
                partials=c["PARTIAL"],
                failures=c["FAILED"],
                unknowns=c["UNKNOWN"],
                same_machine_successes=g["same_s"],
                same_machine_failures=g["same_f"],
                score=round(score, 2),
                incident_ids={k: v for k, v in g["ids"].items() if v},
                attempts=c["SUCCESS"] + c["PARTIAL"] + c["FAILED"],
                success_rate=(
                    round(c["SUCCESS"] / (c["SUCCESS"] + c["PARTIAL"] + c["FAILED"]), 3)
                    if c["SUCCESS"] + c["PARTIAL"] + c["FAILED"] else None
                ),
            ))

        summaries.sort(key=lambda s: (s.score, s.successes, -s.failures), reverse=True)
        return summaries

    @staticmethod
    def _deterministic_reasoning(incident, evidence, winner, summaries) -> str:
        parts = [
            f"TRACE found {len(evidence)} similar {incident.defect_type.replace('_', ' ')} incident(s) "
            f"with recorded outcomes."
        ]
        ids = ", ".join(winner.incident_ids.get("SUCCESS", [])[:4])
        parts.append(
            f"{winner.intervention_category} resolved {winner.successes} of them ({ids})."
        )
        if winner.failures:
            parts.append(
                f"It also failed {winner.failures} time(s) "
                f"({', '.join(winner.incident_ids.get('FAILED', [])[:3])})."
            )
        failed_others = [s for s in summaries if s is not winner and s.failures > s.successes]
        if failed_others:
            parts.append(
                "Less effective before: "
                + "; ".join(
                    f"{s.intervention_category} failed {s.failures}x "
                    f"({', '.join(s.incident_ids.get('FAILED', [])[:2])})"
                    for s in failed_others[:2]
                )
                + "."
            )
        return " ".join(parts)
