"""Realistic validation scenarios shared by the validation suite and probes."""

from app.models import IncidentCreate

SCENARIOS = {
    "A_strong_history": {
        "expect": "HIGH confidence backed by several similar successful incidents",
        "incident": IncidentCreate(
            machine_id="CV-505", machine_type="Belt_Conveyor", production_line="Assembly Line 3",
            defect_type="roller_bearing_noise",
            symptoms=["squealing roller", "grinding noise along conveyor"],
            sensor_values={"bearing_vibration_mm_s": 6.9, "belt_speed_m_s": 1.45, "motor_current_a": 9.8},
            description="Squealing and grinding from the mid-section rollers since start of shift, louder under load.",
            suspected_root_cause="failed idler bearings", operating_hours=16240, technician_id="T-141",
        ),
    },
    "B_conflicting_history": {
        "expect": "successful and failed interventions both shown and explained",
        "incident": IncidentCreate(
            machine_id="CNC-204", machine_type="CNC_Machining_Center", production_line="Machining Cell 2",
            defect_type="spindle_vibration",
            symptoms=["high spindle vibration", "audible spindle noise", "spindle temperature rising"],
            sensor_values={"spindle_vibration_mm_s": 8.4, "spindle_temp_c": 47.5, "spindle_speed_rpm": 12000},
            description="Spindle noise at high speed and vibration alarm at 12000 rpm; chatter on finishing pass of 6061 housings.",
            suspected_root_cause="spindle alignment or bearings", operating_hours=35120, technician_id="T-117",
        ),
    },
    "C_sparse_history": {
        "expect": "MEDIUM or LOW confidence from limited matches",
        "incident": IncidentCreate(
            machine_id="AC-402", machine_type="Screw_Air_Compressor", production_line="Utilities - Compressor House",
            defect_type="oil_carryover",
            symptoms=["oil in compressed air", "oil consumption high"],
            sensor_values={"discharge_temp_c": 86, "discharge_pressure_bar": 7.4},
            description="Oily residue at paint booth filter and topping up compressor oil every few days.",
            operating_hours=67400, technician_id="T-138",
        ),
    },
    "D_no_history": {
        "expect": "INSUFFICIENT_DATA and no invented action",
        "incident": IncidentCreate(
            machine_id="AC-407", machine_type="Screw_Air_Compressor", production_line="Utilities - Molding Hall",
            defect_type="condensate_drain_failure",
            symptoms=["water in compressed air line", "auto drain not cycling"],
            sensor_values={"discharge_pressure_bar": 7.5, "discharge_temp_c": 82},
            description="Water found at molding hall drops; electronic drain on wet receiver is not cycling.",
            operating_hours=1180, technician_id="T-138",
        ),
    },
    "E_novel_incident": {
        "expect": "no close match; explicitly acknowledges insufficient evidence",
        "incident": IncidentCreate(
            machine_id="CNC-203", machine_type="CNC_Machining_Center", production_line="Machining Cell 1",
            defect_type="chip_conveyor_jam",
            symptoms=["chip conveyor motor stalling", "swarf overflowing tray"],
            description="Hinged chip conveyor stalls every hour with long stringy swarf from the new stainless job; tray overflowing.",
            operating_hours=40100, technician_id="T-104",
        ),
    },
    "F_recurring_incident": {
        "expect": "retrieves previous occurrence on the same machine and distinguishes its outcome",
        "incident": IncidentCreate(
            machine_id="CV-507", machine_type="Belt_Conveyor", production_line="Packing",
            defect_type="belt_mistracking",
            symptoms=["belt running off to one side", "belt edge fraying"],
            sensor_values={"tracking_offset_mm": 21, "belt_speed_m_s": 1.4},
            description="Belt tracking 21 mm to the drive side again, edge fraying near the tail.",
            operating_hours=41200, technician_id="T-123",
        ),
    },
}
