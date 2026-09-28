"""
Test setup. Offline tests run against a temporary SQLite file and an
in-memory fake Hindsight; the LLM is disabled so phrasing falls back to
the deterministic wording. Nothing touches the real services.
"""

import os
import sys
import tempfile
from pathlib import Path

import pytest

# Real environment, for live tests that shell out to the scripts.
ORIGINAL_ENV = dict(os.environ)

_tmp = tempfile.mkdtemp(prefix="trace-tests-")
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp}/test.db"
os.environ["GROQ_API_KEY"] = ""
os.environ["HINDSIGHT_NAMESPACE"] = "trace-test"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tests.fakes import FakeHindsightClient  # noqa: E402


@pytest.fixture(autouse=True)
def fake_hindsight(monkeypatch, request):
    if request.node.get_closest_marker("live"):
        yield None
        return
    import app.api.dashboard as dashboard_api
    import app.hindsight.memory as memory_module

    FakeHindsightClient.reset()
    memory_module.MEMORY_STATUS.update(last_error=None, at=0.0)
    monkeypatch.setattr(memory_module, "HindsightClient", FakeHindsightClient)
    monkeypatch.setattr(dashboard_api, "HindsightClient", FakeHindsightClient)
    dashboard_api._health_cache.update(at=0.0, value=None)
    yield FakeHindsightClient


@pytest.fixture
async def db():
    from app.db.database import Base, engine
    from app.db.models import IncidentDB  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield


@pytest.fixture
async def seeded(db):
    """The full generated history in SQLite and the fake Hindsight."""
    from app.data.generator import generate_history
    from app.hindsight.memory import MemoryService
    from seed_data import to_incident

    incidents = [to_incident(r) for r in generate_history()]
    memory = MemoryService()
    await memory.repository.create_many(incidents)
    await memory.retain_many(incidents)
    await memory.close()
    return incidents


@pytest.fixture
async def client(db):
    import httpx
    from main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
