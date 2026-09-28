"""Hindsight memory layer: narrative, tags, recall grouping, write consistency."""

import pytest

from app.core.errors import MemoryUnavailableError
from app.hindsight.memory import MemoryService, machine_type_tag
from app.models import ActionOutcome, IncidentUpdate
from tests.helpers import incident


def test_narrative_reads_like_a_work_order():
    inc = incident(
        "WO-2026-00001", sensor_values={"spindle_vibration_mm_s": 8.6, "spindle_temp_c": 33},
        operating_hours=33814, technician_id="T-109", suspected_root_cause="spindle bearing degradation",
        intervention_category="Spindle bearing replacement", action_taken="Replaced front bearings",
        action_outcome=ActionOutcome.SUCCESS, technician_notes="Outer race spalled.",
    )
    text = MemoryService.build_narrative(inc)
    for fragment in ("Maintenance record WO-2026-00001", "CNC-204", "33,814 operating hours",
                     "spindle vibration 8.6 mm/s (normal 0.9-2.4)", "Technician T-109 suspected",
                     "Intervention (Spindle bearing replacement)", "Outcome: SUCCESS", "Outer race spalled"):
        assert fragment in text
    assert "spindle temperature" not in text  # normal readings are not repeated


def test_open_incident_says_outcome_not_recorded():
    assert "Outcome: not yet recorded" in MemoryService.build_narrative(incident("INC-1"))


def test_tags_isolate_machine_type_and_machine():
    tags = MemoryService._tags(incident("WO-1"))
    assert tags == [machine_type_tag("CNC_Machining_Center"), "machine:cnc-204", "defect:spindle-vibration"]


async def test_recall_groups_by_document_and_skips_other_types(db, fake_hindsight):
    memory = MemoryService()
    done = incident("WO-1", intervention_category="Bearings", action_taken="x", action_outcome=ActionOutcome.SUCCESS)
    other_type = incident("WO-2", machine_id="HP-303", machine_type="Hydraulic_Press", action_taken="x",
                          action_outcome=ActionOutcome.SUCCESS)
    still_open = incident("WO-3")
    for inc in (done, other_type, still_open):
        await memory.store_incident(inc)

    results, trace = await memory.search_similar_incidents(incident("NEW"))
    assert [h.incident.incident_id for h in results] == ["WO-1"]
    assert results[0].recalled_facts and 0 < results[0].similarity_score <= 1
    assert trace["incidents_recalled"] == 2  # WO-1 and the open WO-3; HP-303 filtered by tag
    await memory.close()


async def test_failed_retain_leaves_no_sqlite_row(db, fake_hindsight):
    memory = MemoryService()
    fake_hindsight.fail_retain = True
    with pytest.raises(MemoryUnavailableError):
        await memory.store_incident(incident("WO-X"))
    assert await memory.get_incident("WO-X") is None


async def test_failed_outcome_update_rolls_back_sqlite(db, fake_hindsight):
    memory = MemoryService()
    await memory.store_incident(incident("WO-Y"))
    fake_hindsight.fail_retain = True
    with pytest.raises(MemoryUnavailableError):
        await memory.update_incident_outcome("WO-Y", IncidentUpdate(action_taken="x", action_outcome=ActionOutcome.SUCCESS))
    assert (await memory.get_incident("WO-Y")).action_outcome is None


async def test_outcome_update_replaces_memory_and_defaults_category(db, fake_hindsight):
    memory = MemoryService()
    await memory.store_incident(incident("WO-Z"))
    updated = await memory.update_incident_outcome(
        "WO-Z", IncidentUpdate(action_taken="Replaced drain valve", action_outcome=ActionOutcome.FAILED, resolution_time_minutes=40)
    )
    assert updated.intervention_category == "Replaced drain valve"
    assert updated.downtime_minutes == 40
    assert "Outcome: FAILED" in fake_hindsight.documents["WO-Z"]["text"]


async def test_delete_removes_both_stores(db, fake_hindsight):
    memory = MemoryService()
    await memory.store_incident(incident("WO-D"))
    assert await memory.delete_incidents(["WO-D"]) == 1
    assert "WO-D" not in fake_hindsight.documents and await memory.get_incident("WO-D") is None
