"""
Dashboard API

Endpoints for dashboard statistics and overview data.
"""

from fastapi import APIRouter
from typing import Dict, Any

import asyncio

from app.data.catalog import HERO_MACHINES, fleet_summary
from app.hindsight import MemoryService
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


@router.get("/health")
async def health_check() -> Dict[str, str]:
    """
    Health check endpoint.
    """
    return {"status": "healthy", "service": "TRACE API"}
