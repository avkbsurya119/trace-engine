import asyncio
from datetime import datetime, timedelta, timezone

from app.db.database import init_db
from app.hindsight.memory import MemoryService
from app.models import Incident, IncidentUpdate, ActionOutcome


def make_incident(
    incident_id,
    machine_id,
    machine_type,
    production_line,
    defect_type,
    symptoms,
    sensor_values,
    operating_conditions,
    description,
    suspected_root_cause,
    minutes_ago,
):
    return Incident(
        incident_id=incident_id,
        machine_id=machine_id,
        machine_type=machine_type,
        production_line=production_line,
        timestamp=datetime.now(timezone.utc)
        - timedelta(minutes=minutes_ago),
        defect_type=defect_type,
        symptoms=symptoms,
        sensor_values=sensor_values,
        operating_conditions=operating_conditions,
        description=description,
        suspected_root_cause=suspected_root_cause,
    )


SEED_DATA = [
    # ============================================================
    # CNC - SURFACE ROUGHNESS
    # ============================================================

    (
        make_incident(
            "TRC-CNC-001",
            "CNC-01",
            "CNC",
            "LINE-A",
            "surface_roughness",
            [
                "rough surface finish",
                "high spindle vibration",
            ],
            {
                "spindle_vibration": 8.1,
                "spindle_speed": 4300,
                "feed_rate": 320,
            },
            {
                "material": "aluminium",
                "coolant": "ON",
            },
            "Machined surface became rough with elevated spindle vibration.",
            "excessive spindle speed",
            5000,
        ),
        IncidentUpdate(
            action_taken="Reduced spindle speed to 3500 RPM",
            action_outcome=ActionOutcome.SUCCESS,
            confirmed_root_cause="Excessive spindle speed",
            resolution_details="Surface finish returned to acceptable range.",
            resolution_time_minutes=18,
            technician_notes="Spindle vibration dropped after reducing speed.",
        ),
    ),

    (
        make_incident(
            "TRC-CNC-002",
            "CNC-02",
            "CNC",
            "LINE-A",
            "surface_roughness",
            [
                "rough surface finish",
                "tool chatter",
            ],
            {
                "spindle_vibration": 7.6,
                "spindle_speed": 4200,
                "feed_rate": 340,
            },
            {
                "material": "aluminium",
                "coolant": "ON",
            },
            "Surface roughness observed during high-speed finishing operation.",
            "excessive spindle speed",
            4200,
        ),
        IncidentUpdate(
            action_taken="Changed coolant concentration",
            action_outcome=ActionOutcome.FAILED,
            confirmed_root_cause=None,
            resolution_details="Surface roughness remained after coolant adjustment.",
            resolution_time_minutes=25,
            technician_notes="Coolant adjustment did not reduce vibration.",
        ),
    ),

    (
        make_incident(
            "TRC-CNC-003",
            "CNC-03",
            "CNC",
            "LINE-B",
            "surface_roughness",
            [
                "rough surface finish",
                "high spindle vibration",
            ],
            {
                "spindle_vibration": 8.7,
                "spindle_speed": 4400,
                "feed_rate": 310,
            },
            {
                "material": "aluminium",
                "coolant": "ON",
            },
            "Repeated rough finish and vibration during finishing pass.",
            "high spindle speed or tool imbalance",
            3600,
        ),
        IncidentUpdate(
            action_taken="Reduced spindle speed to 3600 RPM",
            action_outcome=ActionOutcome.SUCCESS,
            confirmed_root_cause="High spindle speed",
            resolution_details="Vibration decreased and finish improved.",
            resolution_time_minutes=20,
            technician_notes="Successful intervention consistent with previous CNC incidents.",
        ),
    ),

    # ============================================================
    # CNC - TOOL WEAR
    # ============================================================

    (
        make_incident(
            "TRC-CNC-004",
            "CNC-04",
            "CNC",
            "LINE-B",
            "tool_wear",
            [
                "dimensional drift",
                "increased cutting force",
            ],
            {
                "cutting_force": 74,
                "tool_age_hours": 185,
                "spindle_speed": 2800,
            },
            {
                "material": "steel",
                "coolant": "ON",
            },
            "Part dimensions gradually drifted outside tolerance.",
            "excessive tool wear",
            3200,
        ),
        IncidentUpdate(
            action_taken="Replaced cutting tool",
            action_outcome=ActionOutcome.SUCCESS,
            confirmed_root_cause="Excessive tool wear",
            resolution_details="Dimensional accuracy returned within tolerance.",
            resolution_time_minutes=12,
            technician_notes="New tool restored dimensional stability.",
        ),
    ),

    # ============================================================
    # INJECTION MOLDING - SHORT SHOT
    # ============================================================

    (
        make_incident(
            "TRC-IMM-001",
            "IMM-01",
            "Injection_Molding",
            "LINE-C",
            "short_shot",
            [
                "incomplete filling",
                "low part weight",
            ],
            {
                "injection_pressure": 82,
                "melt_temperature": 215,
                "mold_temperature": 58,
            },
            {
                "material": "ABS",
                "ambient_temperature": 27,
            },
            "Parts were incompletely filled near the far end of the mold.",
            "insufficient injection pressure",
            2900,
        ),
        IncidentUpdate(
            action_taken="Increased injection pressure to 96 bar",
            action_outcome=ActionOutcome.SUCCESS,
            confirmed_root_cause="Insufficient injection pressure",
            resolution_details="Parts filled completely after pressure adjustment.",
            resolution_time_minutes=14,
            technician_notes="Part weight returned to specification.",
        ),
    ),

    (
        make_incident(
            "TRC-IMM-002",
            "IMM-02",
            "Injection_Molding",
            "LINE-C",
            "short_shot",
            [
                "incomplete filling",
                "low part weight",
            ],
            {
                "injection_pressure": 80,
                "melt_temperature": 208,
                "mold_temperature": 57,
            },
            {
                "material": "ABS",
                "ambient_temperature": 27,
            },
            "Short shots appeared intermittently at the end of the cavity.",
            "low melt temperature",
            2500,
        ),
        IncidentUpdate(
            action_taken="Increased injection pressure",
            action_outcome=ActionOutcome.PARTIAL,
            confirmed_root_cause="Low melt temperature",
            resolution_details="Filling improved but occasional short shots remained.",
            resolution_time_minutes=22,
            technician_notes="Pressure alone was not sufficient.",
        ),
    ),

    # ============================================================
    # INJECTION MOLDING - WARPING
    # ============================================================

    (
        make_incident(
            "TRC-IMM-003",
            "IMM-03",
            "Injection_Molding",
            "LINE-D",
            "warping",
            [
                "part deformation",
                "uneven cooling",
            ],
            {
                "mold_temperature": 72,
                "cooling_time": 11,
                "part_temperature": 84,
            },
            {
                "material": "PP",
                "ambient_temperature": 29,
            },
            "Finished parts showed deformation after ejection.",
            "insufficient cooling time",
            2200,
        ),
        IncidentUpdate(
            action_taken="Increased cooling time to 18 seconds",
            action_outcome=ActionOutcome.SUCCESS,
            confirmed_root_cause="Insufficient cooling time",
            resolution_details="Part deformation reduced to within tolerance.",
            resolution_time_minutes=17,
            technician_notes="Longer cooling cycle stabilized the part.",
        ),
    ),

    # ============================================================
    # PRESS - BURR
    # ============================================================

    (
        make_incident(
            "TRC-PRESS-001",
            "PRESS-01",
            "Hydraulic_Press",
            "LINE-E",
            "excessive_burr",
            [
                "sharp edges",
                "increased burr height",
            ],
            {
                "press_force": 142,
                "burr_height_mm": 0.42,
                "stroke_rate": 38,
            },
            {
                "material": "mild_steel",
                "die_condition": "worn",
            },
            "Stamped components developed excessive burr along the cut edge.",
            "die misalignment or wear",
            1800,
        ),
        IncidentUpdate(
            action_taken="Realigned cutting die",
            action_outcome=ActionOutcome.SUCCESS,
            confirmed_root_cause="Die misalignment",
            resolution_details="Burr height returned below 0.15 mm.",
            resolution_time_minutes=30,
            technician_notes="Die alignment corrected the cutting profile.",
        ),
    ),

    (
        make_incident(
            "TRC-PRESS-002",
            "PRESS-02",
            "Hydraulic_Press",
            "LINE-E",
            "excessive_burr",
            [
                "sharp edges",
                "increased burr height",
            ],
            {
                "press_force": 145,
                "burr_height_mm": 0.46,
                "stroke_rate": 40,
            },
            {
                "material": "mild_steel",
                "die_condition": "worn",
            },
            "Burr formation increased during stamping production.",
            "worn cutting die",
            1600,
        ),
        IncidentUpdate(
            action_taken="Increased press force",
            action_outcome=ActionOutcome.FAILED,
            confirmed_root_cause=None,
            resolution_details="Higher press force did not resolve burr formation.",
            resolution_time_minutes=28,
            technician_notes="Die inspection recommended.",
        ),
    ),

    # ============================================================
    # WELDING - POROSITY
    # ============================================================

    (
        make_incident(
            "TRC-WELD-001",
            "WELD-01",
            "Robotic_Welder",
            "LINE-F",
            "weld_porosity",
            [
                "gas pores",
                "surface cavities",
            ],
            {
                "shielding_gas_flow": 12,
                "welding_current": 185,
                "arc_voltage": 23.5,
            },
            {
                "material": "stainless_steel",
                "gas": "argon",
            },
            "Weld inspection detected repeated surface porosity.",
            "insufficient shielding gas",
            1400,
        ),
        IncidentUpdate(
            action_taken="Increased shielding gas flow to 18 L/min",
            action_outcome=ActionOutcome.SUCCESS,
            confirmed_root_cause="Insufficient shielding gas",
            resolution_details="Porosity was eliminated in subsequent welds.",
            resolution_time_minutes=16,
            technician_notes="Gas flow adjustment restored weld quality.",
        ),
    ),

    # ============================================================
    # WELDING - POROSITY PARTIAL
    # ============================================================

    (
        make_incident(
            "TRC-WELD-002",
            "WELD-02",
            "Robotic_Welder",
            "LINE-F",
            "weld_porosity",
            [
                "gas pores",
                "surface cavities",
            ],
            {
                "shielding_gas_flow": 13,
                "welding_current": 190,
                "arc_voltage": 24,
            },
            {
                "material": "stainless_steel",
                "gas": "argon",
            },
            "Intermittent porosity appeared during robotic welding.",
            "shielding gas instability",
            1100,
        ),
        IncidentUpdate(
            action_taken="Cleaned gas nozzle",
            action_outcome=ActionOutcome.PARTIAL,
            confirmed_root_cause=None,
            resolution_details="Porosity frequency decreased but did not disappear.",
            resolution_time_minutes=21,
            technician_notes="Further inspection of gas delivery system required.",
        ),
    ),

    # ============================================================
    # PACKAGING - SEAL FAILURE
    # ============================================================

    (
        make_incident(
            "TRC-PACK-001",
            "PACK-01",
            "Packaging_Line",
            "LINE-G",
            "seal_failure",
            [
                "weak seal",
                "package leakage",
            ],
            {
                "sealing_temperature": 168,
                "sealing_pressure": 4.1,
                "dwell_time": 0.8,
            },
            {
                "film_type": "PE",
                "ambient_temperature": 26,
            },
            "Packages failed seal integrity testing after production.",
            "insufficient sealing temperature",
            900,
        ),
        IncidentUpdate(
            action_taken="Increased sealing temperature to 180 C",
            action_outcome=ActionOutcome.SUCCESS,
            confirmed_root_cause="Insufficient sealing temperature",
            resolution_details="Seal integrity passed subsequent testing.",
            resolution_time_minutes=11,
            technician_notes="Temperature adjustment resolved leakage.",
        ),
    ),

    # ============================================================
    # UNKNOWN OUTCOME
    # ============================================================

    (
        make_incident(
            "TRC-CNC-005",
            "CNC-05",
            "CNC",
            "LINE-A",
            "surface_roughness",
            [
                "rough surface finish",
                "intermittent vibration",
            ],
            {
                "spindle_vibration": 6.9,
                "spindle_speed": 3900,
            },
            {
                "material": "steel",
                "coolant": "ON",
            },
            "Surface finish degraded intermittently during machining.",
            "unknown",
            700,
        ),
        IncidentUpdate(
            action_taken="Inspected spindle and tooling",
            action_outcome=ActionOutcome.UNKNOWN,
            confirmed_root_cause=None,
            resolution_details="Further investigation required.",
            resolution_time_minutes=35,
            technician_notes="No definitive cause identified.",
        ),
    ),
]


async def main():
    await init_db()
    service = MemoryService()

    print("\n========================================")
    print("TRACE SEED DATA")
    print("========================================\n")

    stored = 0
    failed = 0

    for incident, outcome in SEED_DATA:

        try:
            print(
                f"Storing {incident.incident_id} "
                f"({incident.machine_type} / "
                f"{incident.defect_type})..."
            )

            await service.store_incident(incident)

            await service.update_incident_outcome(
                incident.incident_id,
                outcome,
            )

            stored += 1

            print(
                f"  ✓ Outcome: "
                f"{outcome.action_outcome.value}"
            )

        except Exception as e:
            failed += 1

            print(
                f"  ✗ Failed: {e}"
            )

    await service.close()

    print("\n========================================")
    print("SEED COMPLETE")
    print("========================================")
    print(f"Stored: {stored}")
    print(f"Failed: {failed}")
    print(f"Total:  {len(SEED_DATA)}")


if __name__ == "__main__":
    asyncio.run(main())
