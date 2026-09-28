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
    # HERO MACHINE 1: CNC-01 - Rich history with surface roughness
    # Shows the learning progression: failed → partial → success
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
            10000,  # 7 days ago - first incident
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

    # CNC-01 second incident - tool wear (different defect type)
    (
        make_incident(
            "TRC-CNC-001-B",
            "CNC-01",
            "CNC",
            "LINE-A",
            "tool_wear",
            [
                "dimensional drift",
                "tool marks visible",
            ],
            {
                "cutting_force": 68,
                "tool_age_hours": 142,
                "spindle_speed": 3500,
            },
            {
                "material": "aluminium",
                "coolant": "ON",
            },
            "Parts showing dimensional drift and visible tool marks on CNC-01.",
            "worn cutting insert",
            8500,  # 6 days ago
        ),
        IncidentUpdate(
            action_taken="Replaced cutting insert",
            action_outcome=ActionOutcome.SUCCESS,
            confirmed_root_cause="Worn cutting insert",
            resolution_details="Dimensional accuracy restored, tool marks eliminated.",
            resolution_time_minutes=15,
            technician_notes="Insert showed flank wear > 0.3mm.",
        ),
    ),

    # CNC-01 third incident - surface roughness returns (memory should recall first fix)
    (
        make_incident(
            "TRC-CNC-001-C",
            "CNC-01",
            "CNC",
            "LINE-A",
            "surface_roughness",
            [
                "rough surface finish",
                "chatter marks",
            ],
            {
                "spindle_vibration": 7.8,
                "spindle_speed": 4100,
                "feed_rate": 330,
            },
            {
                "material": "aluminium",
                "coolant": "ON",
            },
            "Surface roughness reappeared after maintenance, chatter visible.",
            "speed increased after maintenance",
            5500,  # 4 days ago
        ),
        IncidentUpdate(
            action_taken="Reduced spindle speed to 3400 RPM",
            action_outcome=ActionOutcome.SUCCESS,
            confirmed_root_cause="Spindle speed too high post-maintenance",
            resolution_details="Chatter eliminated, surface finish within spec.",
            resolution_time_minutes=12,
            technician_notes="Maintenance team had reset to default speed. Memory helped identify quickly.",
        ),
    ),

    # CNC-01 fourth incident - vibration anomaly (new defect, building knowledge)
    (
        make_incident(
            "TRC-CNC-001-D",
            "CNC-01",
            "CNC",
            "LINE-A",
            "vibration_anomaly",
            [
                "unusual vibration pattern",
                "intermittent noise",
            ],
            {
                "spindle_vibration": 9.2,
                "spindle_speed": 3400,
                "bearing_temperature": 62,
            },
            {
                "material": "steel",
                "coolant": "ON",
            },
            "Unusual vibration detected even at reduced speeds on CNC-01.",
            "bearing issue or spindle imbalance",
            2800,  # 2 days ago
        ),
        IncidentUpdate(
            action_taken="Replaced spindle bearings",
            action_outcome=ActionOutcome.SUCCESS,
            confirmed_root_cause="Worn spindle bearings",
            resolution_details="Vibration returned to normal levels across all speeds.",
            resolution_time_minutes=120,
            technician_notes="Bearings showed wear patterns. Preventive replacement scheduled for other CNCs.",
        ),
    ),

    # CNC-01 fifth incident - most recent, surface roughness (TRACE now has rich history)
    (
        make_incident(
            "TRC-CNC-001-E",
            "CNC-01",
            "CNC",
            "LINE-A",
            "surface_roughness",
            [
                "rough surface finish",
                "slight vibration",
            ],
            {
                "spindle_vibration": 6.5,
                "spindle_speed": 4000,
                "feed_rate": 310,
            },
            {
                "material": "aluminium",
                "coolant": "ON",
            },
            "Minor surface roughness detected during quality check on CNC-01.",
            "unknown",
            1200,  # Recent - 20 hours ago
        ),
        IncidentUpdate(
            action_taken="Reduced spindle speed to 3500 RPM per TRACE recommendation",
            action_outcome=ActionOutcome.SUCCESS,
            confirmed_root_cause="Spindle speed slightly elevated",
            resolution_details="Surface finish improved immediately. TRACE memory was accurate.",
            resolution_time_minutes=8,
            technician_notes="Used TRACE recommendation - fastest resolution yet for this machine.",
        ),
    ),

    # ============================================================
    # CNC - Other machines (spread for variety)
    # ============================================================

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
    # HERO MACHINE 2: IMM-01 - Injection Molding with rich history
    # Shows defect pattern recognition and intervention learning
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
            9500,  # 6.5 days ago - first incident
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

    # IMM-01 second incident - flash defect (different problem)
    (
        make_incident(
            "TRC-IMM-001-B",
            "IMM-01",
            "Injection_Molding",
            "LINE-C",
            "flash_defect",
            [
                "excess material at parting line",
                "sharp edges",
            ],
            {
                "injection_pressure": 98,
                "melt_temperature": 220,
                "clamp_force": 145,
            },
            {
                "material": "ABS",
                "ambient_temperature": 26,
            },
            "Flash appearing at mold parting line on IMM-01.",
            "clamp force too low or pressure too high",
            7800,  # 5 days ago
        ),
        IncidentUpdate(
            action_taken="Reduced injection pressure to 92 bar",
            action_outcome=ActionOutcome.PARTIAL,
            confirmed_root_cause=None,
            resolution_details="Flash reduced but not eliminated.",
            resolution_time_minutes=18,
            technician_notes="May need to increase clamp force as well.",
        ),
    ),

    # IMM-01 third incident - flash resolved with clamp force
    (
        make_incident(
            "TRC-IMM-001-C",
            "IMM-01",
            "Injection_Molding",
            "LINE-C",
            "flash_defect",
            [
                "excess material at parting line",
                "thin flash",
            ],
            {
                "injection_pressure": 92,
                "melt_temperature": 218,
                "clamp_force": 145,
            },
            {
                "material": "ABS",
                "ambient_temperature": 27,
            },
            "Flash still present after pressure reduction on IMM-01.",
            "clamp force insufficient",
            6200,  # 4 days ago
        ),
        IncidentUpdate(
            action_taken="Increased clamp force to 165 tons",
            action_outcome=ActionOutcome.SUCCESS,
            confirmed_root_cause="Insufficient clamp force",
            resolution_details="Flash eliminated completely. Optimal settings documented.",
            resolution_time_minutes=22,
            technician_notes="Combined learning: pressure 92 bar + clamp 165 tons = optimal for ABS.",
        ),
    ),

    # IMM-01 fourth incident - short shot returns (TRACE should recall first fix)
    (
        make_incident(
            "TRC-IMM-001-D",
            "IMM-01",
            "Injection_Molding",
            "LINE-C",
            "short_shot",
            [
                "incomplete filling",
                "voids at flow end",
            ],
            {
                "injection_pressure": 85,
                "melt_temperature": 212,
                "mold_temperature": 55,
            },
            {
                "material": "ABS",
                "ambient_temperature": 24,
            },
            "Short shots returned on IMM-01 during cold morning production.",
            "cold ambient affecting melt flow",
            3500,  # 2.5 days ago
        ),
        IncidentUpdate(
            action_taken="Increased injection pressure to 95 bar per TRACE memory",
            action_outcome=ActionOutcome.SUCCESS,
            confirmed_root_cause="Lower ambient temperature affecting fill",
            resolution_details="Parts filling correctly. TRACE recommendation was accurate.",
            resolution_time_minutes=10,
            technician_notes="TRACE recalled previous short shot fix - saved diagnostic time.",
        ),
    ),

    # IMM-01 fifth incident - sink marks (new defect type)
    (
        make_incident(
            "TRC-IMM-001-E",
            "IMM-01",
            "Injection_Molding",
            "LINE-C",
            "sink_marks",
            [
                "surface depressions",
                "visible at thick sections",
            ],
            {
                "injection_pressure": 95,
                "holding_pressure": 72,
                "cooling_time": 12,
            },
            {
                "material": "ABS",
                "ambient_temperature": 26,
            },
            "Sink marks visible at thick wall sections on IMM-01 parts.",
            "insufficient holding pressure or cooling",
            1500,  # Recent
        ),
        IncidentUpdate(
            action_taken="Increased holding pressure to 85 bar and cooling time to 16s",
            action_outcome=ActionOutcome.SUCCESS,
            confirmed_root_cause="Insufficient holding pressure",
            resolution_details="Sink marks eliminated. New parameters added to machine profile.",
            resolution_time_minutes=25,
            technician_notes="Building IMM-01 knowledge base - now covers short shot, flash, sink marks.",
        ),
    ),

    # ============================================================
    # INJECTION MOLDING - Other machines
    # ============================================================

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
    # HERO MACHINE 3: WELD-01 - Robotic Welder with rich history
    # Shows welding defect patterns and intervention evolution
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
            8800,  # 6 days ago - first incident
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

    # WELD-01 second incident - spatter (different defect)
    (
        make_incident(
            "TRC-WELD-001-B",
            "WELD-01",
            "Robotic_Welder",
            "LINE-F",
            "weld_spatter",
            [
                "excessive spatter",
                "rough weld surface",
            ],
            {
                "shielding_gas_flow": 18,
                "welding_current": 210,
                "arc_voltage": 26,
                "wire_feed_speed": 8.5,
            },
            {
                "material": "mild_steel",
                "gas": "CO2_mix",
            },
            "Excessive spatter during MIG welding on WELD-01.",
            "voltage or wire feed issue",
            7200,  # 5 days ago
        ),
        IncidentUpdate(
            action_taken="Reduced arc voltage to 24V",
            action_outcome=ActionOutcome.PARTIAL,
            confirmed_root_cause=None,
            resolution_details="Spatter reduced but still above acceptable level.",
            resolution_time_minutes=20,
            technician_notes="Need to also check wire feed and contact tip.",
        ),
    ),

    # WELD-01 third incident - spatter resolved
    (
        make_incident(
            "TRC-WELD-001-C",
            "WELD-01",
            "Robotic_Welder",
            "LINE-F",
            "weld_spatter",
            [
                "spatter continuing",
                "contact tip wear",
            ],
            {
                "shielding_gas_flow": 18,
                "welding_current": 205,
                "arc_voltage": 24,
                "wire_feed_speed": 8.5,
            },
            {
                "material": "mild_steel",
                "gas": "CO2_mix",
            },
            "Spatter persisting on WELD-01 after voltage adjustment.",
            "worn contact tip",
            5800,  # 4 days ago
        ),
        IncidentUpdate(
            action_taken="Replaced contact tip and adjusted wire feed to 7.8 m/min",
            action_outcome=ActionOutcome.SUCCESS,
            confirmed_root_cause="Worn contact tip causing erratic arc",
            resolution_details="Spatter eliminated. Clean weld bead achieved.",
            resolution_time_minutes=25,
            technician_notes="Contact tip was heavily worn. Added to weekly inspection.",
        ),
    ),

    # WELD-01 fourth incident - arc deviation
    (
        make_incident(
            "TRC-WELD-001-D",
            "WELD-01",
            "Robotic_Welder",
            "LINE-F",
            "arc_deviation",
            [
                "wandering arc",
                "inconsistent penetration",
            ],
            {
                "shielding_gas_flow": 18,
                "welding_current": 200,
                "arc_voltage": 24,
                "magnetic_field": "detected",
            },
            {
                "material": "mild_steel",
                "gas": "CO2_mix",
            },
            "Arc wandering during welding, causing inconsistent penetration.",
            "arc blow or fixture issue",
            3200,  # 2 days ago
        ),
        IncidentUpdate(
            action_taken="Repositioned ground clamp and demagnetized workpiece",
            action_outcome=ActionOutcome.SUCCESS,
            confirmed_root_cause="Arc blow from magnetic field",
            resolution_details="Arc stabilized after demagnetization.",
            resolution_time_minutes=35,
            technician_notes="Residual magnetism in fixture was causing arc deflection.",
        ),
    ),

    # WELD-01 fifth incident - porosity returns (TRACE should recall first fix)
    (
        make_incident(
            "TRC-WELD-001-E",
            "WELD-01",
            "Robotic_Welder",
            "LINE-F",
            "weld_porosity",
            [
                "subsurface pores",
                "gas bubbles",
            ],
            {
                "shielding_gas_flow": 14,
                "welding_current": 188,
                "arc_voltage": 23,
            },
            {
                "material": "stainless_steel",
                "gas": "argon",
            },
            "Porosity detected in radiograph on WELD-01 stainless welds.",
            "gas flow reduced",
            1600,  # Recent
        ),
        IncidentUpdate(
            action_taken="Increased gas flow to 18 L/min per TRACE recommendation",
            action_outcome=ActionOutcome.SUCCESS,
            confirmed_root_cause="Gas flow had drifted down",
            resolution_details="Porosity eliminated. TRACE memory was accurate.",
            resolution_time_minutes=12,
            technician_notes="TRACE immediately recalled previous porosity fix. Fast resolution.",
        ),
    ),

    # ============================================================
    # WELDING - Other machines
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
