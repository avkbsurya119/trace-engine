"""
TRACE Intelligence API

Read-only views of the factory's accumulated memory, computed from SQLite and
the deterministic recommendation engine. The full report is cached and only
recomputed when the underlying work orders change.
"""

import hashlib
import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query

from app.db.repository import IncidentRepository
from app.services.intelligence import IntelligenceService

router = APIRouter(prefix="/intelligence", tags=["intelligence"])

_cache: Dict[str, Any] = {"key": None, "value": None}


def _fingerprint(incidents) -> str:
    """Changes whenever a work order is added or its outcome is recorded or edited."""
    digest = hashlib.sha1()
    for i in incidents:
        digest.update(f"{i.incident_id}|{i.action_outcome}|{i.intervention_category}\n".encode())
    return digest.hexdigest()


@router.get("", response_model=Dict[str, Any])
async def get_intelligence() -> Dict[str, Any]:
    incidents = await IncidentRepository().list_all()
    key = _fingerprint(incidents)
    if _cache["key"] != key:
        started = time.perf_counter()
        report = IntelligenceService().build(incidents)
        report["compute_ms"] = round((time.perf_counter() - started) * 1000)
        _cache.update(key=key, value=report)
    return _cache["value"]


@router.get("/problem", response_model=Dict[str, Any])
async def get_problem_knowledge(
    machine_type: str = Query(..., min_length=1),
    defect_type: str = Query(..., min_length=1),
    machine_id: Optional[str] = Query(None, description="Weight evidence from this machine, as the analysis does"),
) -> Dict[str, Any]:
    """What TRACE would recommend for this problem from every recorded outcome, and why."""
    incidents = await IncidentRepository().list_all()
    recommendation, evidence_count = IntelligenceService().problem_knowledge(
        incidents, machine_type, defect_type, machine_id
    )
    if evidence_count == 0 and not any(
        i.machine_type == machine_type and i.defect_type == defect_type for i in incidents
    ):
        raise HTTPException(status_code=404, detail="No work orders for this equipment type and problem")
    return {
        "machine_type": machine_type,
        "defect_type": defect_type,
        "machine_id": machine_id,
        "evidence_count": evidence_count,
        "recommendation": recommendation.model_dump(),
    }
