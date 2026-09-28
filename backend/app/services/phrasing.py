"""
Reasoning Phrasing

Turns the deterministic recommendation into one readable reasoning
paragraph using a small LLM call.

The LLM never decides anything. RecommendationEngine has already picked
the action, confidence, and supporting incidents; this module only
rewords those facts. If the LLM is unavailable, errors, or mentions an
incident ID that is not in the evidence, the deterministic reasoning is
kept unchanged.
"""

import logging
import re
from typing import Any, Dict, List, Optional

from openai import AsyncOpenAI

from app.core.config import settings
from app.models import HistoricalIncident, Incident, Recommendation

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You write the reasoning paragraph for a manufacturing troubleshooting "
    "recommendation. Use ONLY the facts given below. Do not add, infer, or "
    "assume anything that is not listed: no new causes, actions, numbers, "
    "incident IDs, or safety advice. Do not change the recommended action or "
    "the confidence level. Cite supporting incidents by their exact IDs and "
    "state clearly what worked and what failed. If there is no evidence-backed "
    "recommendation, say so plainly and do not suggest any action. Write 2-4 "
    "plain sentences, no markdown, no bullet points."
)

CONFIDENCE_WORDS = {
    "HIGH": "high",
    "MEDIUM": "medium",
    "LOW": "low",
    "INSUFFICIENT_DATA": "insufficient evidence (no recommendation)",
}

# Matches the incident ID formats used by seed data and live reports,
# e.g. WO-2026-05431 (history), INC-20260928-1A2B3C (live reports).
INCIDENT_ID_PATTERN = re.compile(r"\b(?:WO|INC|TRC)-[A-Z0-9-]+\b")


class ReasoningPhraser:
    """Rewrites deterministic reasoning into natural language."""

    def __init__(self):
        self._client: Optional[AsyncOpenAI] = None

        if settings.groq_api_key:
            self._client = AsyncOpenAI(
                api_key=settings.groq_api_key,
                base_url=settings.llm_base_url,
                timeout=settings.llm_timeout_seconds,
                max_retries=1,
            )

    async def close(self):
        if self._client:
            await self._client.close()

    async def phrase(
        self,
        incident: Incident,
        recommendation: Recommendation,
        evidence: List[HistoricalIncident],
    ) -> Recommendation:
        """
        Return the recommendation with LLM-phrased reasoning, or the
        original recommendation untouched if phrasing is not possible.
        """

        if self._client is None:
            return recommendation

        facts = self._build_facts(incident, recommendation, evidence)

        try:
            response = await self._client.chat.completions.create(
                model=settings.llm_model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": facts},
                ],
                temperature=0.2,
                max_completion_tokens=1024,
            )
        except Exception as exc:
            logger.warning("LLM phrasing failed, using deterministic reasoning: %s", exc)
            return recommendation

        text = self._clean(response.choices[0].message.content or "")

        if not text:
            logger.warning("LLM returned empty reasoning, using deterministic reasoning")
            return recommendation

        allowed_ids = {incident.incident_id} | {h.incident.incident_id for h in evidence}
        unknown_ids = set(INCIDENT_ID_PATTERN.findall(text)) - allowed_ids

        if unknown_ids:
            logger.warning(
                "LLM cited incident IDs not in evidence %s, using deterministic reasoning",
                sorted(unknown_ids),
            )
            return recommendation

        if (
            recommendation.confidence == "INSUFFICIENT_DATA"
            and recommendation.intervention_category is None
            and not any(w in text.lower() for w in ("no ", "not ", "insufficient", "none"))
        ):
            logger.warning("LLM reasoning did not acknowledge missing evidence, using deterministic reasoning")
            return recommendation

        return recommendation.model_copy(
            update={"reasoning": text, "reasoning_source": "llm"}
        )

    @staticmethod
    def _build_facts(
        incident: Incident,
        recommendation: Recommendation,
        evidence: List[HistoricalIncident],
    ) -> str:
        lines = [
            "CURRENT INCIDENT",
            f"- Machine: {incident.machine_id} ({incident.machine_type.replace('_', ' ')})",
            f"- Problem: {incident.defect_type.replace('_', ' ')}",
            f"- Symptoms: {', '.join(incident.symptoms) or 'none reported'}",
            "",
            "DECISION (computed by deterministic scoring; do not change it)",
            f"- Recommended intervention: {recommendation.suggested_action}",
            f"- Confidence: {CONFIDENCE_WORDS.get(recommendation.confidence, recommendation.confidence)}",
            f"- Basis: {recommendation.basis}",
            "",
            "EVIDENCE PER INTERVENTION (from past work orders)",
        ]

        if recommendation.evidence:
            for s in recommendation.evidence:
                ids = "; ".join(f"{k}: {', '.join(v)}" for k, v in s.incident_ids.items())
                lines.append(
                    f"- {s.intervention_category}: {s.successes} success, {s.partials} partial, "
                    f"{s.failures} failed, {s.unknowns} unverified [{ids}]"
                )
        else:
            lines.append("- none: no similar past incident with a recorded outcome")

        same_machine = [h for h in evidence if h.incident.machine_id == incident.machine_id]
        if same_machine:
            lines += ["", f"HISTORY ON {incident.machine_id} ITSELF (newest first)"]
            for h in sorted(same_machine, key=lambda h: h.incident.timestamp, reverse=True)[:4]:
                p = h.incident
                lines.append(
                    f"- {p.incident_id} ({p.timestamp:%Y-%m-%d}): {p.intervention_category} -> "
                    f"{p.action_outcome.value if p.action_outcome else 'no outcome'}"
                )

        if recommendation.warnings:
            lines += ["", "WARNINGS"]
            lines += [f"- {w}" for w in recommendation.warnings]

        lines += [
            "",
            "REFERENCE WORDING (factually correct; rephrase it, do not extend it)",
            recommendation.reasoning,
        ]

        return "\n".join(lines)

    @staticmethod
    def _clean(text: str) -> str:
        # Some reasoning models (e.g. qwen3) inline their thinking.
        text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
        return " ".join(text.split()).strip()
