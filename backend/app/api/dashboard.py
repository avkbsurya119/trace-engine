"""
Dashboard API

Endpoints for dashboard statistics and overview data.
"""

from fastapi import APIRouter
from typing import Dict, Any

import asyncio
import time

from sqlalchemy import text

from app.core.config import settings
from app.data.catalog import HERO_MACHINES, fleet_summary
from app.db.database import engine
from app.hindsight import MemoryService
from app.hindsight.client import HindsightClient
from app.models import IncidentCreate
from app.services import AnalysisService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=Dict[str, Any])
async def get_dashboard_stats() -> Dict[str, Any]:
    """
    Get overall dashboard statistics.

    Returns:
    - Total incidents
    - Incidents with outcomes
    - Unique machines
    - Outcome distribution (SUCCESS/PARTIAL/FAILED/UNKNOWN)
    - Defect type distribution
    """
    memory = MemoryService()
    try:
        return await memory.get_statistics()
    finally:
        await memory.close()


@router.get("/fleet", response_model=Dict[str, Any])
async def get_fleet() -> Dict[str, Any]:
    """
    Machine types, machines, defect types, symptoms and intervention
    categories known to TRACE. The frontend builds its forms from this.
    """
    return fleet_summary()


@router.get("/hero-machines", response_model=Dict[str, Any])
async def get_hero_machines() -> Dict[str, Any]:
    """
    Showcase machines with a live before/after-memory comparison.
    Both sides are computed now from Hindsight recall and deterministic
    scoring; nothing is stored and no LLM is called.
    """
    service = AnalysisService()
    try:
        impacts = await asyncio.gather(*(
            service.memory_impact(IncidentCreate(**hero["incident"])) for hero in HERO_MACHINES
        ))
        return {
            "hero_machines": [
                {**{k: hero[k] for k in ("key", "title", "story", "incident")}, **impact}
                for hero, impact in zip(HERO_MACHINES, impacts)
            ]
        }
    finally:
        await service.close()


_health_cache: Dict[str, Any] = {"at": 0.0, "value": None}
HEALTH_TTL_SECONDS = 30


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """
    Real dependency check: SQLite reachable, Hindsight bank reachable with
    the configured key, LLM phrasing configured. Cached for 30 s so the
    sidebar can poll it cheaply.
    """
    now = time.monotonic()
    if _health_cache["value"] and now - _health_cache["at"] < HEALTH_TTL_SECONDS:
        return _health_cache["value"]

    checks: Dict[str, Any] = {}

    try:
        async with engine.connect() as conn:
            count = (await conn.execute(text("SELECT COUNT(*) FROM incidents"))).scalar_one()
        checks["sqlite"] = {"ok": True, "incidents": count}
    except Exception as exc:
        checks["sqlite"] = {"ok": False, "error": str(exc)}

    client = HindsightClient()
    try:
        await asyncio.wait_for(client.check_bank(), timeout=8)
        checks["hindsight"] = {"ok": True, "bank": client.bank_id}
    except Exception as exc:
        checks["hindsight"] = {"ok": False, "bank": client.bank_id, "error": str(exc)[:200] or type(exc).__name__}
    finally:
        await client.close()

    checks["llm"] = {"ok": bool(settings.groq_api_key), "model": settings.llm_model if settings.groq_api_key else None}

    healthy = checks["sqlite"]["ok"] and checks["hindsight"]["ok"]
    value = {
        "status": "healthy" if healthy else "degraded",
        "service": "TRACE API",
        "checks": checks,
    }
    _health_cache.update(at=now, value=value)
    return value
