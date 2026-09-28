"""The LLM may only reword; every unsafe answer falls back to deterministic text."""

from types import SimpleNamespace as NS

from app.services.phrasing import ReasoningPhraser
from app.services.recommendation import RecommendationEngine
from tests.helpers import incident, past

CURRENT = incident(incident_id="INC-20260928-ABC123")
EVIDENCE = [past("WO-2025-04637", "Bearings", "SUCCESS", machine_id="CNC-204"), past("WO-2025-04631", "Alignment", "FAILED", days=3)]
REC = RecommendationEngine().generate_recommendation(CURRENT, EVIDENCE)
EMPTY = RecommendationEngine().generate_recommendation(CURRENT, [])


def phraser(reply=None, error=None):
    p = ReasoningPhraser()

    async def create(**kwargs):
        p.last_request = kwargs
        if error:
            raise error
        return NS(choices=[NS(message=NS(content=reply))])

    p._client = NS(chat=NS(completions=NS(create=create)), close=lambda: None)
    return p


async def test_no_key_keeps_deterministic_text():
    p = ReasoningPhraser()
    p._client = None
    out = await p.phrase(CURRENT, REC, EVIDENCE)
    assert out.reasoning_source == "deterministic" and out.reasoning == REC.reasoning


async def test_valid_reply_is_used_and_think_tags_stripped():
    out = await phraser("<think>hidden</think> Bearings fixed WO-2025-04637; alignment failed in WO-2025-04631.").phrase(CURRENT, REC, EVIDENCE)
    assert out.reasoning_source == "llm"
    assert out.reasoning.startswith("Bearings fixed") and "hidden" not in out.reasoning


async def test_llm_cannot_change_the_decision():
    out = await phraser("Replace the spindle motor, very confident.").phrase(CURRENT, REC, EVIDENCE)
    assert out.suggested_action == REC.suggested_action and out.confidence == REC.confidence


async def test_invented_incident_id_is_rejected():
    out = await phraser("As WO-2024-99999 showed, bearings work.").phrase(CURRENT, REC, EVIDENCE)
    assert out.reasoning_source == "deterministic"


async def test_api_error_and_empty_reply_fall_back():
    assert (await phraser(error=TimeoutError("slow")).phrase(CURRENT, REC, EVIDENCE)).reasoning_source == "deterministic"
    assert (await phraser("   ").phrase(CURRENT, REC, EVIDENCE)).reasoning_source == "deterministic"


async def test_no_evidence_reply_must_admit_it():
    bad = await phraser("Replace the bearings right away.").phrase(CURRENT, EMPTY, [])
    good = await phraser("There is no historical evidence, so no action can be recommended.").phrase(CURRENT, EMPTY, [])
    assert bad.reasoning_source == "deterministic"
    assert good.reasoning_source == "llm"


async def test_prompt_contains_only_computed_facts():
    p = phraser("Bearings fixed WO-2025-04637.")
    await p.phrase(CURRENT, REC, EVIDENCE)
    system, user = p.last_request["messages"]
    assert "Use ONLY the facts" in system["content"]
    assert "Bearings: 1 success" in user["content"] and "WO-2025-04631" in user["content"]
