"""
Live checks against the running API with real Hindsight and Groq.
Opt-in: start the backend, then run  TRACE_LIVE=1 pytest -m live
"""

import os
import subprocess
import sys
from pathlib import Path

import httpx
import pytest

from tests.conftest import ORIGINAL_ENV

BACKEND = Path(__file__).resolve().parents[1]
API = "http://localhost:8000/api"

pytestmark = [
    pytest.mark.live,
    pytest.mark.skipif(os.environ.get("TRACE_LIVE") != "1", reason="set TRACE_LIVE=1 to run against real services"),
]


def run_script(*args):
    return subprocess.run(
        [sys.executable, "-m", *args], cwd=BACKEND, env=ORIGINAL_ENV,
        capture_output=True, text=True, timeout=600,
    )


def test_live_health():
    body = httpx.get(f"{API}/dashboard/health", timeout=30).json()
    assert body["status"] == "healthy", body
    assert body["checks"]["hindsight"]["ok"] and body["checks"]["llm"]["ok"]


def test_live_validation_scenarios():
    result = run_script("scripts.validate_scenarios")
    assert result.returncode == 0, result.stdout[-3000:] + result.stderr[-2000:]
    assert "ALL CHECKS PASSED" in result.stdout


def test_live_demo_twice_from_reset():
    result = run_script("scripts.demo", "--runs", "2")
    assert result.returncode == 0, result.stdout[-3000:] + result.stderr[-2000:]
    assert result.stdout.count("RESULT: PASS") == 2
    run_script("scripts.demo", "--reset")


def test_live_data_audit():
    result = run_script("scripts.audit_data")
    assert result.returncode == 0, result.stdout[-3000:]
