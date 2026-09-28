"""
Dashboard API

Endpoints for dashboard statistics and overview data.
"""

from fastapi import APIRouter
from typing import Dict, Any

from app.data.catalog import fleet_summary
from app.hindsight import MemoryService

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


@router.get("/health")
async def health_check() -> Dict[str, str]:
    """
    Health check endpoint.
    """
    return {"status": "healthy", "service": "TRACE API"}
