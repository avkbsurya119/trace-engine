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
    "state clearly what worked and what failed. If there is no history, say "
    "so plainly. Write 2-4 plain sentences, no markdown, no bullet points."
)

# Matches the incident ID formats used by seed data and live reports,
# e.g. TRC-CNC-001, INC-20260928-1A2B3C4D.
INCIDENT_ID_PATTERN = re.compile(r"\b(?:TRC|INC)-[A-Z0-9-]+\b")


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
        historical: List[HistoricalIncident],
        successful: List[Dict[str, Any]],
        failed: List[Dict[str, Any]],
    ) -> Recommendation:
        """
        Return the recommendation with LLM-phrased reasoning, or the
        original recommendation untouched if phrasing is not possible.
        """

        if self._client is None:
            return recommendation

        facts = self._build_facts(
            incident, recommendation, historical, successful, failed
        )

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

        allowed_ids = {incident.incident_id} | {
            h.incident.incident_id for h in historical
        }
        unknown_ids = set(INCIDENT_ID_PATTERN.findall(text)) - allowed_ids

        if unknown_ids:
            logger.warning(
                "LLM cited incident IDs not in evidence %s, using deterministic reasoning",
                sorted(unknown_ids),
            )
            return recommendation

        return recommendation.model_copy(
            update={"reasoning": text, "reasoning_source": "llm"}
        )

    @staticmethod
    def _build_facts(
        incident: Incident,
        recommendation: Recommendation,
        historical: List[HistoricalIncident],
        successful: List[Dict[str, Any]],
        failed: List[Dict[str, Any]],
    ) -> str:
        by_id = {h.incident.incident_id: h.incident for h in historical}

        lines = [
            "CURRENT INCIDENT",
            f"- Machine: {incident.machine_id} ({incident.machine_type})",
            f"- Defect: {incident.defect_type}",
            f"- Symptoms: {', '.join(incident.symptoms) or 'none reported'}",
            "",
            "DECISION (already made; do not change)",
            f"- Recommended action: {recommendation.suggested_action}",
            f"- Confidence: {recommendation.confidence}",
            f"- Relevant historical incidents found: {len(historical)}",
            "",
            "SUCCESSFUL PAST INTERVENTIONS",
        ]

        if successful:
            for s in successful:
                past = by_id.get(s["incident_id"])
                machine = f" on {past.machine_id}" if past else ""
                cause = f"; confirmed cause: {s['root_cause']}" if s.get("root_cause") else ""
                lines.append(f"- {s['incident_id']}{machine}: \"{s['action']}\" -> SUCCESS{cause}")
        else:
            lines.append("- none")

        lines += ["", "FAILED PAST INTERVENTIONS"]

        if failed:
            for f in failed:
                past = by_id.get(f["incident_id"])
                machine = f" on {past.machine_id}" if past else ""
                lines.append(f"- {f['incident_id']}{machine}: \"{f['action']}\" -> FAILED")
        else:
            lines.append("- none")

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
