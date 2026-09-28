"""
Fleet catalog for TRACE's synthetic maintenance history.

The dataset is synthetic but modelled on how maintenance work orders are
actually written: a defect family has several possible root causes, each
intervention only truly fixes some of them, and technicians often try the
cheap fix first. Outcomes in the generated history emerge from that model
rather than from a fixed defect -> action mapping.

Everything the frontend needs to build its forms (machine types, machines,
defect families, symptoms, intervention categories) is served from here via
GET /api/dashboard/fleet so the UI never drifts from the data.
"""

from typing import Any, Dict, List

# Sensor baselines: (low, high, decimals) for normal operation.
# Cause-specific overrides replace some of these with abnormal ranges.

FLEET: Dict[str, Dict[str, Any]] = {
    # ------------------------------------------------------------------
    "CNC_Machining_Center": {
        "label": "CNC machining center",
        "hours_per_day": (15, 21),
        "machines": {
            "CNC-201": {"line": "Machining Cell 1", "model": "5-axis vertical machining center", "start_hours": 21400},
            "CNC-202": {"line": "Machining Cell 1", "model": "5-axis vertical machining center", "start_hours": 18950},
            "CNC-203": {"line": "Machining Cell 1", "model": "4-axis horizontal machining center", "start_hours": 33120},
            "CNC-204": {"line": "Machining Cell 2", "model": "5-axis vertical machining center", "start_hours": 26780},
            "CNC-205": {"line": "Machining Cell 2", "model": "3-axis vertical machining center", "start_hours": 41200},
            "CNC-206": {"line": "Machining Cell 2", "model": "3-axis vertical machining center", "start_hours": 9800},
            "CNC-207": {"line": "Machining Cell 3", "model": "4-axis horizontal machining center", "start_hours": 15630},
            "CNC-208": {"line": "Machining Cell 3", "model": "5-axis vertical machining center", "start_hours": 6420},
        },
        "materials": ["6061-T6 aluminium housing", "7075 aluminium bracket", "42CrMo4 steel shaft", "316L stainless flange", "cast iron pump body"],
        "sensors": {
            "spindle_vibration_mm_s": (0.9, 2.4, 1),
            "spindle_speed_rpm": (6000, 14000, -2),
            "spindle_temp_c": (29, 38, 1),
            "spindle_load_pct": (28, 62, 0),
            "coolant_concentration_pct": (6.5, 8.5, 1),
            "axis_following_error_um": (2, 7, 0),
        },
        "defects": {
            "spindle_vibration": {
                "weight": 0.24,
                "severity_base": 2,
                "symptoms": ["high spindle vibration", "chatter marks on finished surface", "audible spindle noise", "spindle temperature rising", "vibration alarm on spindle monitor"],
                "descriptions": [
                    "Operator reported chatter marks on {material} and a rising pitch from the spindle during finishing passes.",
                    "Spindle condition monitor raised a vibration alarm at {spindle_speed_rpm} rpm; parts at the end of the batch showed chatter.",
                    "Noticeable spindle noise at high speed, vibration trend has been climbing over the last two shifts.",
                    "Quality flagged waviness on the finishing face of {material}; operator also reports vibration through the enclosure.",
                ],
                "causes": {
                    "spindle bearing degradation": {
                        "p": 0.45,
                        "sensors": {"spindle_vibration_mm_s": (5.8, 11.5, 1), "spindle_temp_c": (41, 56, 1)},
                        "findings": ["front bearing outer race showed spalling", "grease discoloured and contaminated with fines", "bearing noise audible with stethoscope at front housing", "preload loss measured on front bearing set"],
                        "fixes": ["Spindle bearing replacement"],
                        "partial": ["Spindle re-lubrication"],
                    },
                    "tool holder imbalance / runout": {
                        "p": 0.30,
                        "sensors": {"spindle_vibration_mm_s": (3.6, 6.8, 1)},
                        "findings": ["runout of 18 um measured at tool tip", "damaged HSK taper face on holder", "holder balance grade out of spec after re-shrink"],
                        "fixes": ["Tool holder replacement / rebalancing"],
                        "partial": [],
                    },
                    "spindle head misalignment after crash": {
                        "p": 0.25,
                        "sensors": {"spindle_vibration_mm_s": (3.2, 6.0, 1), "axis_following_error_um": (9, 16, 0)},
                        "findings": ["tram out by 0.04 mm over 300 mm", "witness marks on head casting from earlier collision", "ballbar test showed squareness error"],
                        "fixes": ["Spindle alignment / tramming"],
                        "partial": ["Tool holder replacement / rebalancing"],
                    },
                },
            },
            "surface_finish_defect": {
                "weight": 0.18,
                "severity_base": 1,
                "symptoms": ["rough surface finish", "Ra above drawing limit", "built-up edge on tool", "burnishing marks", "inconsistent finish across batch"],
                "descriptions": [
                    "CMM/profilometer check shows Ra {ra} um on {material} against a 1.6 um limit.",
                    "Finish on sealing face is visibly rough, several parts from this shift held for rework.",
                    "Operator notes built-up edge on finishing insert and dull finish on {material}.",
                ],
                "causes": {
                    "coolant concentration too low / contaminated": {
                        "p": 0.40,
                        "sensors": {"coolant_concentration_pct": (2.8, 4.6, 1)},
                        "findings": ["refractometer read {coolant_concentration_pct}% vs 7% target", "tramp oil layer on coolant sump", "coolant smelled rancid, bacterial growth suspected"],
                        "fixes": ["Coolant flush and recharge"],
                        "partial": ["Coolant concentration top-up"],
                    },
                    "worn finishing insert": {
                        "p": 0.35,
                        "sensors": {"spindle_load_pct": (58, 78, 0)},
                        "findings": ["flank wear 0.3 mm on finishing insert", "insert chipped on cutting corner"],
                        "fixes": ["Insert / tool change"],
                        "partial": [],
                    },
                    "incorrect cutting parameters": {
                        "p": 0.25,
                        "sensors": {},
                        "findings": ["feed per tooth doubled in last program revision", "surface speed set for steel on aluminium job"],
                        "fixes": ["Cutting parameter adjustment"],
                        "partial": ["Insert / tool change"],
                    },
                },
            },
            "dimensional_drift": {
                "weight": 0.18,
                "severity_base": 2,
                "symptoms": ["bore diameter drifting", "parts out of tolerance after warm-up", "position error on Z axis", "inconsistent dimensions between first and last part"],
                "descriptions": [
                    "Bore diameter drifted +{drift} mm over the shift on {material}; first-off was in tolerance.",
                    "SPC chart for critical bore out of control on the afternoon run.",
                    "Z depth varies by up to {drift} mm part to part; operator suspects machine not tool.",
                ],
                "causes": {
                    "thermal growth of spindle": {
                        "p": 0.40,
                        "sensors": {"spindle_temp_c": (40, 49, 1)},
                        "findings": ["drift correlated with spindle temperature log", "chiller setpoint had been changed to 26 C"],
                        "fixes": ["Thermal compensation / warm-up cycle"],
                        "partial": ["Tool offset correction"],
                    },
                    "ballscrew wear / backlash": {
                        "p": 0.35,
                        "sensors": {"axis_following_error_um": (10, 22, 0)},
                        "findings": ["backlash of 22 um measured on Z", "ballscrew nut showing wear, lubrication starved"],
                        "fixes": ["Ballscrew replacement"],
                        "partial": ["Backlash compensation update", "Tool offset correction"],
                    },
                    "fixture clamping problem": {
                        "p": 0.25,
                        "sensors": {},
                        "findings": ["hydraulic clamp pressure low on station 2", "chips under fixture locator"],
                        "fixes": ["Fixture repair / cleaning"],
                        "partial": [],
                    },
                },
            },
            "tool_breakage": {
                "weight": 0.14,
                "severity_base": 2,
                "symptoms": ["repeated tool breakage", "spindle load spikes", "broken drill in part", "tool breakage detection alarm"],
                "descriptions": [
                    "Third broken {tool} this week on the same operation, part scrapped each time.",
                    "Tool breakage detection alarm; spindle load spiked to {spindle_load_pct}% just before break.",
                ],
                "causes": {
                    "chip evacuation / coolant through spindle blocked": {
                        "p": 0.45,
                        "sensors": {"spindle_load_pct": (80, 115, 0)},
                        "findings": ["through-spindle coolant filter clogged", "chips packed in flutes, coolant pressure 12 bar instead of 40"],
                        "fixes": ["Coolant filter / TSC system service"],
                        "partial": ["Cutting parameter adjustment"],
                    },
                    "incorrect cutting parameters": {
                        "p": 0.35,
                        "sensors": {"spindle_load_pct": (85, 120, 0)},
                        "findings": ["peck depth removed in new program", "feed override left at 140%"],
                        "fixes": ["Cutting parameter adjustment"],
                        "partial": [],
                    },
                    "tool holder imbalance / runout": {
                        "p": 0.20,
                        "sensors": {"spindle_vibration_mm_s": (3.4, 5.5, 1)},
                        "findings": ["runout 25 um on drill holder", "collet worn"],
                        "fixes": ["Tool holder replacement / rebalancing"],
                        "partial": [],
                    },
                },
            },
            "axis_servo_fault": {
                "weight": 0.10,
                "severity_base": 3,
                "symptoms": ["servo alarm on axis", "axis stops during rapid", "following error alarm", "intermittent drive fault"],
                "descriptions": [
                    "Machine stopped with following error alarm on {axis} axis during rapid traverse.",
                    "Intermittent servo drive fault on {axis}, clears on reset then returns after 1-2 hours.",
                ],
                "causes": {
                    "encoder cable damage": {
                        "p": 0.45,
                        "sensors": {"axis_following_error_um": (25, 60, 0)},
                        "findings": ["encoder cable jacket chafed in cable carrier", "intermittent continuity on encoder signal pair"],
                        "fixes": ["Encoder cable replacement"],
                        "partial": ["Drive reset / parameter reload"],
                    },
                    "servo motor failure": {
                        "p": 0.25,
                        "sensors": {"axis_following_error_um": (30, 80, 0)},
                        "findings": ["motor winding insulation low on megger test", "motor brake dragging"],
                        "fixes": ["Servo motor replacement"],
                        "partial": [],
                    },
                    "way lube starvation": {
                        "p": 0.30,
                        "sensors": {"axis_following_error_um": (15, 30, 0)},
                        "findings": ["way lube reservoir empty, level switch stuck", "lube line to Y ways kinked"],
                        "fixes": ["Lubrication system repair"],
                        "partial": ["Drive reset / parameter reload"],
                    },
                },
            },
        },
        "interventions": {
            "Spindle bearing replacement": {"cost": 5, "minutes": (360, 720), "parts_wait": 0.45, "actions": ["Replaced front spindle bearing set and reset preload, 2 h run-in", "Spindle cartridge swapped with rebuilt spare", "Replaced front and rear spindle bearings, run-in per OEM procedure"]},
            "Spindle re-lubrication": {"cost": 1, "minutes": (40, 90), "parts_wait": 0.0, "actions": ["Re-greased spindle bearings and ran warm-up cycle", "Purged and re-lubricated spindle, checked air-oil supply"]},
            "Tool holder replacement / rebalancing": {"cost": 1, "minutes": (30, 90), "parts_wait": 0.1, "actions": ["Replaced tool holder and rebalanced assembly to G2.5", "Swapped damaged HSK holder, cleaned taper", "Re-shrunk and balanced tool holder"]},
            "Spindle alignment / tramming": {"cost": 3, "minutes": (180, 360), "parts_wait": 0.0, "actions": ["Re-trammed spindle head and ran ballbar check", "Laser alignment of spindle head, shimmed and re-torqued"]},
            "Coolant flush and recharge": {"cost": 2, "minutes": (120, 240), "parts_wait": 0.0, "actions": ["Drained sump, cleaned tank and recharged coolant at 7%", "Full coolant change with system cleaner cycle"]},
            "Coolant concentration top-up": {"cost": 1, "minutes": (15, 40), "parts_wait": 0.0, "actions": ["Topped up coolant concentrate to 7%", "Adjusted coolant mix, skimmed tramp oil"]},
            "Insert / tool change": {"cost": 1, "minutes": (15, 45), "parts_wait": 0.0, "actions": ["Changed finishing insert and re-measured tool", "Replaced worn end mill, updated tool life counter"]},
            "Cutting parameter adjustment": {"cost": 1, "minutes": (30, 90), "parts_wait": 0.0, "actions": ["Corrected feed and speed in program with process engineer", "Restored peck cycle and reduced feed by 20%"]},
            "Thermal compensation / warm-up cycle": {"cost": 2, "minutes": (60, 150), "parts_wait": 0.0, "actions": ["Restored chiller setpoint and added 20 min warm-up program", "Enabled spindle thermal compensation and re-qualified bore"]},
            "Ballscrew replacement": {"cost": 5, "minutes": (480, 900), "parts_wait": 0.6, "actions": ["Replaced Z-axis ballscrew and nut, re-mapped pitch error", "Installed new ballscrew assembly on Z, laser calibrated"]},
            "Backlash compensation update": {"cost": 1, "minutes": (45, 90), "parts_wait": 0.0, "actions": ["Updated backlash compensation parameter on Z", "Measured and re-entered backlash comp values"]},
            "Tool offset correction": {"cost": 1, "minutes": (10, 30), "parts_wait": 0.0, "actions": ["Adjusted tool wear offset to bring bore back in tolerance", "Re-touched tool length offset"]},
            "Fixture repair / cleaning": {"cost": 2, "minutes": (60, 180), "parts_wait": 0.2, "actions": ["Cleaned fixture locators and replaced clamp cylinder seal", "Repaired hydraulic clamp on station 2"]},
            "Coolant filter / TSC system service": {"cost": 2, "minutes": (60, 150), "parts_wait": 0.15, "actions": ["Replaced through-spindle coolant filter and verified 40 bar", "Serviced TSC pump and cleaned rotary union"]},
            "Encoder cable replacement": {"cost": 3, "minutes": (120, 240), "parts_wait": 0.35, "actions": ["Replaced encoder feedback cable and re-routed in carrier", "New encoder cable installed, strain relief added"]},
            "Servo motor replacement": {"cost": 5, "minutes": (240, 480), "parts_wait": 0.6, "actions": ["Replaced axis servo motor and re-set reference", "Swapped servo motor with spare, re-tuned drive"]},
            "Lubrication system repair": {"cost": 2, "minutes": (60, 180), "parts_wait": 0.2, "actions": ["Repaired way lube pump and replaced level switch", "Replaced kinked lube line and purged system"]},
            "Drive reset / parameter reload": {"cost": 1, "minutes": (20, 60), "parts_wait": 0.0, "actions": ["Reset servo drive and reloaded parameters from backup", "Power-cycled drive, cleared alarm history"]},
        },
        "rare": [
            ("tool_changer_misindex", "Tool changer arm stopped mid-swap after a power dip; carousel lost position.", "Re-referenced tool changer and re-taught pocket 1", "Carousel re-referencing"),
            ("electrical_cabinet_overheating", "Cabinet over-temperature warning; door filter mats blocked with oil mist.", "Replaced cabinet filter mats and cleaned heat exchanger", "Cabinet cooling service"),
            ("rotary_union_leak", "Coolant dripping from spindle rear during TSC use.", "Replaced rotary union seal kit", "Rotary union service"),
        ],
    },
    # ------------------------------------------------------------------
    "Hydraulic_Press": {
        "label": "Hydraulic press",
        "hours_per_day": (11, 18),
        "machines": {
            "HP-301": {"line": "Press Shop A", "model": "400 t four-column hydraulic press", "start_hours": 38200},
            "HP-302": {"line": "Press Shop A", "model": "250 t C-frame hydraulic press", "start_hours": 29500},
            "HP-303": {"line": "Press Shop A", "model": "400 t four-column hydraulic press", "start_hours": 44100},
            "HP-304": {"line": "Press Shop B", "model": "630 t straight-side hydraulic press", "start_hours": 17800},
            "HP-305": {"line": "Press Shop B", "model": "250 t C-frame hydraulic press", "start_hours": 52300},
            "HP-306": {"line": "Press Shop B", "model": "630 t straight-side hydraulic press", "start_hours": 12400},
            "HP-307": {"line": "Press Shop B", "model": "160 t trimming press", "start_hours": 23900},
        },
        "materials": ["DC04 deep-draw steel panel", "S355 bracket blank", "aluminium 5754 inner panel", "HSLA reinforcement"],
        "sensors": {
            "system_pressure_bar": (190, 210, 0),
            "oil_temp_c": (41, 52, 1),
            "cycle_time_s": (8.2, 10.8, 1),
            "pump_current_a": (42, 56, 0),
            "ram_parallelism_mm": (0.02, 0.05, 2),
            "tonnage_pct": (58, 84, 0),
        },
        "defects": {
            "pressure_loss": {
                "weight": 0.28,
                "severity_base": 3,
                "symptoms": ["press not reaching tonnage", "pressure drops during hold", "slow pressure build-up", "pump running louder than normal"],
                "descriptions": [
                    "Press only reaching {system_pressure_bar} bar against 200 bar setpoint, parts under-formed.",
                    "Pressure decays during dwell; tonnage monitor shows {tonnage_pct}% at bottom dead centre.",
                    "Operator reports slow build-up and pressure dropping off during hold on {material}.",
                ],
                "causes": {
                    "internal leakage past cylinder seals": {
                        "p": 0.40,
                        "sensors": {"system_pressure_bar": (150, 178, 0), "oil_temp_c": (55, 64, 1)},
                        "findings": ["cylinder drift test showed 6 mm/min creep", "piston seal extruded on teardown"],
                        "fixes": ["Cylinder reseal"],
                        "partial": ["Relief valve adjustment"],
                    },
                    "worn hydraulic pump": {
                        "p": 0.35,
                        "sensors": {"system_pressure_bar": (140, 175, 0), "pump_current_a": (60, 72, 0)},
                        "findings": ["pump case drain flow 3x spec", "scoring on pump swashplate"],
                        "fixes": ["Hydraulic pump replacement"],
                        "partial": ["Relief valve adjustment"],
                    },
                    "relief valve drifting open": {
                        "p": 0.25,
                        "sensors": {"system_pressure_bar": (165, 182, 0)},
                        "findings": ["relief valve seat worn", "relief valve cracking at 175 bar instead of 215"],
                        "fixes": ["Relief valve replacement"],
                        "partial": ["Relief valve adjustment"],
                    },
                },
            },
            "oil_overheating": {
                "weight": 0.20,
                "severity_base": 2,
                "symptoms": ["hydraulic oil temperature high", "oil over-temperature alarm", "cycle slowing as machine warms up", "oil smells burnt"],
                "descriptions": [
                    "Oil temperature alarm at {oil_temp_c} C mid-shift; press slowed down noticeably.",
                    "Oil running hot ({oil_temp_c} C) since the weekend, cycle time creeping up.",
                ],
                "causes": {
                    "fouled oil cooler": {
                        "p": 0.50,
                        "sensors": {"oil_temp_c": (63, 74, 1)},
                        "findings": ["cooler water side scaled", "cooler delta-T only 2 C"],
                        "fixes": ["Oil cooler cleaning / descaling"],
                        "partial": ["Hydraulic oil change"],
                    },
                    "internal leakage past cylinder seals": {
                        "p": 0.30,
                        "sensors": {"oil_temp_c": (60, 68, 1), "system_pressure_bar": (170, 185, 0)},
                        "findings": ["heat generated across leaking cylinder seals", "cylinder drift test failed"],
                        "fixes": ["Cylinder reseal"],
                        "partial": ["Oil cooler cleaning / descaling"],
                    },
                    "cooling water supply restricted": {
                        "p": 0.20,
                        "sensors": {"oil_temp_c": (62, 70, 1)},
                        "findings": ["cooling water strainer blocked", "water valve half closed after plant maintenance"],
                        "fixes": ["Cooling water strainer cleaning"],
                        "partial": [],
                    },
                },
            },
            "excessive_burr": {
                "weight": 0.20,
                "severity_base": 1,
                "symptoms": ["burrs on cut edge", "uneven burr around part", "die marks on part", "burr height above spec"],
                "descriptions": [
                    "Burr height 0.2-0.3 mm on trimmed edge of {material}, spec is 0.1 mm.",
                    "Uneven burr, worse on operator side; parts sent for manual deburr.",
                ],
                "causes": {
                    "ram / die misalignment": {
                        "p": 0.40,
                        "sensors": {"ram_parallelism_mm": (0.09, 0.18, 2)},
                        "findings": ["ram parallelism 0.14 mm front to back", "gib clearance excessive on left side"],
                        "fixes": ["Ram gib adjustment / die realignment"],
                        "partial": ["Die sharpening"],
                    },
                    "worn die cutting edge": {
                        "p": 0.45,
                        "sensors": {},
                        "findings": ["cutting edge radius worn 0.15 mm", "chipped punch corner"],
                        "fixes": ["Die sharpening"],
                        "partial": [],
                    },
                    "incorrect die clearance for material": {
                        "p": 0.15,
                        "sensors": {},
                        "findings": ["clearance set for 1.5 mm, running 2.0 mm material"],
                        "fixes": ["Die clearance correction"],
                        "partial": ["Die sharpening"],
                    },
                },
            },
            "hydraulic_leak": {
                "weight": 0.18,
                "severity_base": 2,
                "symptoms": ["oil on floor under press", "visible leak at fitting", "reservoir level dropping", "oil mist near valve block"],
                "descriptions": [
                    "Oil pooling under the valve block, roughly {leak_l} L topped up this week.",
                    "Leak at hose near upper cylinder; area barricaded.",
                ],
                "causes": {
                    "failed hose": {
                        "p": 0.45,
                        "sensors": {},
                        "findings": ["outer cover of hose cracked at crimp", "hose rubbing on frame"],
                        "fixes": ["Hose replacement"],
                        "partial": ["Fitting retorque"],
                    },
                    "loose / damaged fitting": {
                        "p": 0.35,
                        "sensors": {},
                        "findings": ["JIC fitting loose from vibration", "O-ring on ORB fitting flattened"],
                        "fixes": ["Fitting retorque", "Fitting O-ring replacement"],
                        "partial": [],
                    },
                    "rod seal wear": {
                        "p": 0.20,
                        "sensors": {},
                        "findings": ["oil film on piston rod", "rod scored near gland"],
                        "fixes": ["Cylinder reseal"],
                        "partial": ["Fitting retorque"],
                    },
                },
            },
            "slow_cycle": {
                "weight": 0.14,
                "severity_base": 1,
                "symptoms": ["cycle time increased", "slow ram approach", "hesitation at transition to pressing speed"],
                "descriptions": [
                    "Cycle time up to {cycle_time_s} s from 9.5 s, output behind plan.",
                    "Ram hesitates at fast-approach to pressing transition.",
                ],
                "causes": {
                    "proportional valve sticking": {
                        "p": 0.45,
                        "sensors": {"cycle_time_s": (12.5, 16, 1)},
                        "findings": ["valve spool varnished", "valve response slow on step test"],
                        "fixes": ["Proportional valve clean / replace"],
                        "partial": ["Hydraulic oil change"],
                    },
                    "worn hydraulic pump": {
                        "p": 0.30,
                        "sensors": {"cycle_time_s": (12, 14.5, 1), "pump_current_a": (58, 68, 0)},
                        "findings": ["pump flow 20% below nameplate on flow test"],
                        "fixes": ["Hydraulic pump replacement"],
                        "partial": [],
                    },
                    "position transducer drift": {
                        "p": 0.25,
                        "sensors": {"cycle_time_s": (11, 13.5, 1)},
                        "findings": ["linear transducer reading 3 mm off at BDC", "transducer connector corroded"],
                        "fixes": ["Position transducer recalibration"],
                        "partial": [],
                    },
                },
            },
        },
        "interventions": {
            "Cylinder reseal": {"cost": 4, "minutes": (360, 720), "parts_wait": 0.4, "actions": ["Resealed main cylinder (piston and rod seals)", "Pulled cylinder, replaced seal kit and wear bands"]},
            "Hydraulic pump replacement": {"cost": 5, "minutes": (300, 600), "parts_wait": 0.55, "actions": ["Replaced main axial piston pump", "Installed exchange pump and set compensator"]},
            "Relief valve adjustment": {"cost": 1, "minutes": (20, 60), "parts_wait": 0.0, "actions": ["Re-set main relief valve to 215 bar", "Adjusted relief valve cracking pressure"]},
            "Relief valve replacement": {"cost": 2, "minutes": (90, 180), "parts_wait": 0.3, "actions": ["Replaced main relief valve cartridge", "New relief valve fitted and set to 215 bar"]},
            "Oil cooler cleaning / descaling": {"cost": 2, "minutes": (120, 300), "parts_wait": 0.0, "actions": ["Descaled plate oil cooler water side", "Cleaned and pressure-tested oil cooler"]},
            "Hydraulic oil change": {"cost": 3, "minutes": (180, 360), "parts_wait": 0.1, "actions": ["Drained and replaced hydraulic oil, new filters", "Oil change plus kidney-loop filtration"]},
            "Cooling water strainer cleaning": {"cost": 1, "minutes": (30, 90), "parts_wait": 0.0, "actions": ["Cleaned cooling water strainer and opened supply valve fully", "Flushed cooling water line and strainer"]},
            "Ram gib adjustment / die realignment": {"cost": 3, "minutes": (180, 360), "parts_wait": 0.0, "actions": ["Adjusted ram gibs and re-shimmed die set", "Re-aligned die to ram, checked parallelism 0.03 mm"]},
            "Die sharpening": {"cost": 2, "minutes": (120, 300), "parts_wait": 0.0, "actions": ["Sent die to toolroom for sharpening", "Sharpened cutting edges 0.2 mm, re-shimmed"]},
            "Die clearance correction": {"cost": 2, "minutes": (90, 240), "parts_wait": 0.0, "actions": ["Changed die clearance for 2.0 mm material", "Swapped punch set for correct clearance"]},
            "Hose replacement": {"cost": 1, "minutes": (45, 120), "parts_wait": 0.1, "actions": ["Replaced leaking hose and added abrasion sleeve", "New hose assembly fitted, re-routed away from frame"]},
            "Fitting retorque": {"cost": 1, "minutes": (15, 45), "parts_wait": 0.0, "actions": ["Re-torqued leaking fittings on valve block", "Tightened fitting and cleaned area to monitor"]},
            "Fitting O-ring replacement": {"cost": 1, "minutes": (40, 90), "parts_wait": 0.0, "actions": ["Replaced O-rings on ORB fittings", "Replaced fitting and seal"]},
            "Proportional valve clean / replace": {"cost": 3, "minutes": (120, 300), "parts_wait": 0.35, "actions": ["Cleaned proportional valve spool and re-tuned ramps", "Replaced proportional valve"]},
            "Position transducer recalibration": {"cost": 1, "minutes": (45, 120), "parts_wait": 0.0, "actions": ["Recalibrated ram position transducer", "Cleaned connector and re-zeroed transducer"]},
        },
        "rare": [
            ("light_curtain_fault", "Safety light curtain tripping with nothing in the field; press locked out.", "Realigned light curtain and replaced receiver cable", "Safety device repair"),
            ("accumulator_precharge_loss", "Accumulator precharge found at 60 bar during PM, press sluggish on first strokes.", "Recharged accumulator with nitrogen", "Accumulator service"),
        ],
    },
    # ------------------------------------------------------------------
    "Screw_Air_Compressor": {
        "label": "Rotary screw air compressor",
        "hours_per_day": (18, 23),
        "machines": {
            "AC-401": {"line": "Utilities - Compressor House", "model": "90 kW oil-injected screw compressor", "start_hours": 61200},
            "AC-402": {"line": "Utilities - Compressor House", "model": "90 kW oil-injected screw compressor", "start_hours": 58700},
            "AC-403": {"line": "Utilities - Compressor House", "model": "75 kW VSD screw compressor", "start_hours": 32400},
            "AC-404": {"line": "Utilities - Press Shop", "model": "55 kW oil-injected screw compressor", "start_hours": 44800},
            "AC-405": {"line": "Utilities - Press Shop", "model": "55 kW oil-injected screw compressor", "start_hours": 47300},
            "AC-406": {"line": "Utilities - Molding Hall", "model": "75 kW VSD screw compressor", "start_hours": 21900},
            "AC-407": {"line": "Utilities - Molding Hall", "model": "75 kW VSD screw compressor (commissioned 2026-08)", "start_hours": 640},
        },
        "materials": [],
        "sensors": {
            "discharge_pressure_bar": (7.0, 7.8, 1),
            "discharge_temp_c": (76, 89, 0),
            "motor_current_a": (138, 162, 0),
            "inlet_filter_dp_mbar": (18, 42, 0),
            "vibration_mm_s": (1.1, 2.6, 1),
            "ambient_temp_c": (18, 34, 0),
        },
        "defects": {
            "high_discharge_temperature": {
                "weight": 0.30,
                "severity_base": 3,
                "symptoms": ["high discharge temperature", "compressor tripped on temperature", "cooling fan running continuously", "oil darker than normal"],
                "descriptions": [
                    "Compressor tripped on element outlet temperature ({discharge_temp_c} C) during afternoon peak.",
                    "Discharge temperature trending up, {discharge_temp_c} C at full load with ambient {ambient_temp_c} C.",
                ],
                "causes": {
                    "blocked oil cooler fins": {
                        "p": 0.45,
                        "sensors": {"discharge_temp_c": (104, 112, 0)},
                        "findings": ["cooler fins packed with dust and fluff", "air-side delta-P across cooler high"],
                        "fixes": ["Oil cooler cleaning"],
                        "partial": [],
                    },
                    "thermostatic valve stuck": {
                        "p": 0.30,
                        "sensors": {"discharge_temp_c": (102, 110, 0)},
                        "findings": ["thermostatic valve element stuck in bypass", "oil return to cooler cold while element hot"],
                        "fixes": ["Thermostatic valve replacement"],
                        "partial": ["Oil cooler cleaning"],
                    },
                    "degraded compressor oil": {
                        "p": 0.25,
                        "sensors": {"discharge_temp_c": (98, 106, 0)},
                        "findings": ["oil analysis: high oxidation, TAN elevated", "oil varnished, service overdue by 900 h"],
                        "fixes": ["Oil and separator service"],
                        "partial": ["Oil cooler cleaning"],
                    },
                },
            },
            "low_discharge_pressure": {
                "weight": 0.25,
                "severity_base": 3,
                "symptoms": ["plant air pressure low", "compressor running loaded continuously", "pressure drop at point of use", "unloading valve cycling"],
                "descriptions": [
                    "Plant header down to {discharge_pressure_bar} bar at shift change, presses alarming on low air.",
                    "Compressor loaded 100% but cannot hold 7.5 bar.",
                ],
                "causes": {
                    "air leaks in distribution": {
                        "p": 0.35,
                        "sensors": {"discharge_pressure_bar": (5.8, 6.6, 1)},
                        "findings": ["ultrasonic leak survey found 14 leaks, est. 90 l/s", "quick couplings leaking in Press Shop B"],
                        "fixes": ["Leak survey and repair"],
                        "partial": [],
                    },
                    "inlet valve not opening fully": {
                        "p": 0.35,
                        "sensors": {"discharge_pressure_bar": (6.0, 6.8, 1), "motor_current_a": (110, 130, 0)},
                        "findings": ["inlet valve piston sticking", "inlet valve solenoid weak"],
                        "fixes": ["Inlet valve overhaul"],
                        "partial": [],
                    },
                    "clogged inlet filter": {
                        "p": 0.30,
                        "sensors": {"inlet_filter_dp_mbar": (65, 95, 0), "discharge_pressure_bar": (6.2, 6.9, 1)},
                        "findings": ["inlet filter dP {inlet_filter_dp_mbar} mbar", "filter visibly loaded"],
                        "fixes": ["Inlet filter replacement"],
                        "partial": [],
                    },
                },
            },
            "abnormal_vibration_noise": {
                "weight": 0.20,
                "severity_base": 2,
                "symptoms": ["knocking noise from air end", "vibration higher than baseline", "rattle at motor coupling", "squeal on start-up"],
                "descriptions": [
                    "New knocking noise from the air end, vibration {vibration_mm_s} mm/s vs 2.0 baseline.",
                    "Operator reports rattle near the coupling guard on start.",
                ],
                "causes": {
                    "motor bearing wear": {
                        "p": 0.40,
                        "sensors": {"vibration_mm_s": (5.0, 9.0, 1)},
                        "findings": ["envelope spectrum shows BPFO on motor DE bearing", "motor DE bearing hot, 78 C"],
                        "fixes": ["Motor bearing replacement"],
                        "partial": ["Coupling alignment"],
                    },
                    "coupling misalignment / worn element": {
                        "p": 0.35,
                        "sensors": {"vibration_mm_s": (4.0, 6.5, 1)},
                        "findings": ["coupling element cracked", "angular misalignment 0.3 mm/100 mm"],
                        "fixes": ["Coupling alignment"],
                        "partial": [],
                    },
                    "air end bearing wear": {
                        "p": 0.25,
                        "sensors": {"vibration_mm_s": (6.0, 11.0, 1), "discharge_temp_c": (92, 99, 0)},
                        "findings": ["air end bearing defect frequencies in spectrum", "oil analysis shows iron and bearing metal"],
                        "fixes": ["Air end overhaul"],
                        "partial": ["Motor bearing replacement"],
                    },
                },
            },
            "oil_carryover": {
                # Sparse by design: only the two scripted records in
                # generator.STORIES exist for this problem.
                "weight": 0.0,
                "severity_base": 2,
                "symptoms": ["oil in compressed air", "oily residue at point of use", "oil consumption high"],
                "descriptions": [
                    "Oil found in air line at paint booth drop; separator dP high.",
                    "Topping up compressor oil twice a week, oily residue at downstream filters.",
                ],
                "causes": {
                    "failed separator element": {
                        "p": 0.65,
                        "sensors": {},
                        "findings": ["separator element ruptured", "separator dP 1.1 bar"],
                        "fixes": ["Oil and separator service"],
                        "partial": [],
                    },
                    "scavenge line blocked": {
                        "p": 0.35,
                        "sensors": {},
                        "findings": ["scavenge line orifice blocked with varnish"],
                        "fixes": ["Scavenge line cleaning"],
                        "partial": ["Oil and separator service"],
                    },
                },
            },
            "condensate_drain_failure": {
                # Present in the catalog (so it can be reported) but with no
                # generated history: it is the "fresh problem" in the demo.
                "weight": 0.0,
                "severity_base": 2,
                "symptoms": ["water in compressed air line", "auto drain not cycling", "wet receiver tank level high", "dryer alarm for high dew point"],
                "descriptions": ["Water found at point-of-use drops; auto drain on wet receiver not cycling."],
                "causes": {
                    "stuck electronic drain valve": {
                        "p": 1.0,
                        "sensors": {},
                        "findings": ["drain valve inlet strainer blocked with rust and sludge"],
                        "fixes": ["Condensate drain replacement"],
                        "partial": ["Condensate drain cleaning"],
                    },
                },
            },
        },
        "interventions": {
            "Oil cooler cleaning": {"cost": 1, "minutes": (60, 150), "parts_wait": 0.0, "actions": ["Blew out and washed oil cooler fins", "Cleaned cooler core and pre-filter mats"]},
            "Thermostatic valve replacement": {"cost": 2, "minutes": (60, 150), "parts_wait": 0.35, "actions": ["Replaced thermostatic valve element", "Fitted new thermostatic valve kit"]},
            "Oil and separator service": {"cost": 3, "minutes": (150, 300), "parts_wait": 0.25, "actions": ["Oil change with new separator element and oil filter", "4000 h service: oil, separator, filters"]},
            "Leak survey and repair": {"cost": 2, "minutes": (240, 600), "parts_wait": 0.0, "actions": ["Ultrasonic leak survey and repaired major leaks", "Fixed leaking couplings and drops found on survey"]},
            "Inlet valve overhaul": {"cost": 3, "minutes": (120, 240), "parts_wait": 0.3, "actions": ["Overhauled inlet valve with service kit", "Replaced inlet valve piston seals and solenoid"]},
            "Inlet filter replacement": {"cost": 1, "minutes": (20, 45), "parts_wait": 0.0, "actions": ["Replaced inlet air filter element", "Changed inlet filter and cleaned housing"]},
            "Motor bearing replacement": {"cost": 4, "minutes": (240, 480), "parts_wait": 0.4, "actions": ["Replaced motor DE and NDE bearings", "Motor sent out for bearing change"]},
            "Coupling alignment": {"cost": 2, "minutes": (90, 180), "parts_wait": 0.1, "actions": ["Laser aligned motor to air end, replaced coupling element", "Re-aligned coupling"]},
            "Air end overhaul": {"cost": 5, "minutes": (600, 1200), "parts_wait": 0.7, "actions": ["Air end exchanged with factory reman unit", "Air end bearings and seals replaced by OEM service"]},
            "Scavenge line cleaning": {"cost": 1, "minutes": (45, 90), "parts_wait": 0.0, "actions": ["Cleaned scavenge line and orifice", "Replaced scavenge line orifice and sight glass"]},
            "Condensate drain replacement": {"cost": 2, "minutes": (45, 120), "parts_wait": 0.2, "actions": ["Replaced zero-loss condensate drain on wet receiver"]},
            "Condensate drain cleaning": {"cost": 1, "minutes": (20, 60), "parts_wait": 0.0, "actions": ["Cleaned drain inlet strainer and tested manual override"]},
        },
        "rare": [
            ("dryer_high_dew_point", "Refrigerant dryer showing +12 C dew point, condenser fan not running.", "Replaced dryer condenser fan motor", "Dryer repair"),
            ("controller_fault", "Controller display blank after thunderstorm, compressor would not restart.", "Replaced controller power supply", "Controller repair"),
        ],
    },
    # ------------------------------------------------------------------
    "Belt_Conveyor": {
        "label": "Belt conveyor",
        "hours_per_day": (14, 20),
        "machines": {
            "CV-501": {"line": "Assembly Line 1", "model": "flat belt conveyor, 18 m", "start_hours": 27400},
            "CV-502": {"line": "Assembly Line 1", "model": "flat belt conveyor, 12 m", "start_hours": 27400},
            "CV-503": {"line": "Assembly Line 2", "model": "incline belt conveyor, 9 m", "start_hours": 19800},
            "CV-504": {"line": "Assembly Line 2", "model": "flat belt conveyor, 22 m", "start_hours": 19800},
            "CV-505": {"line": "Assembly Line 3", "model": "flat belt conveyor, 15 m", "start_hours": 8600},
            "CV-506": {"line": "Assembly Line 3", "model": "curved belt conveyor", "start_hours": 8600},
            "CV-507": {"line": "Packing", "model": "flat belt conveyor, 30 m", "start_hours": 35100},
            "CV-508": {"line": "Packing", "model": "incline belt conveyor, 11 m", "start_hours": 35100},
            "CV-509": {"line": "Shipping", "model": "flat belt conveyor, 25 m", "start_hours": 41900},
            "CV-510": {"line": "Shipping", "model": "accumulation belt conveyor", "start_hours": 12200},
        },
        "materials": ["boxed assemblies", "loose castings in totes", "palletised cartons", "sub-assemblies on carriers"],
        "sensors": {
            "belt_speed_m_s": (1.2, 1.6, 2),
            "motor_current_a": (7.5, 10.5, 1),
            "motor_temp_c": (44, 63, 0),
            "tracking_offset_mm": (0, 6, 0),
            "gearbox_temp_c": (45, 62, 0),
            "bearing_vibration_mm_s": (0.8, 2.3, 1),
        },
        "defects": {
            "belt_mistracking": {
                "weight": 0.28,
                "severity_base": 1,
                "symptoms": ["belt running off to one side", "belt edge fraying", "belt rubbing on frame", "products drifting to the side"],
                "descriptions": [
                    "Belt tracking {tracking_offset_mm} mm to the drive side, edge rubbing on the frame.",
                    "Belt edge frayed on operator side; tracking keeps wandering after adjustment.",
                ],
                "causes": {
                    "worn / seized return idler": {
                        "p": 0.40,
                        "sensors": {"tracking_offset_mm": (18, 35, 0)},
                        "findings": ["two return idlers seized", "idler shell worn flat"],
                        "fixes": ["Idler replacement"],
                        "partial": ["Belt tracking adjustment"],
                    },
                    "material build-up on pulley": {
                        "p": 0.35,
                        "sensors": {"tracking_offset_mm": (14, 28, 0)},
                        "findings": ["label backing and debris wrapped on tail pulley", "carry-back build-up on drive pulley lagging"],
                        "fixes": ["Pulley cleaning and scraper install"],
                        "partial": ["Belt tracking adjustment"],
                    },
                    "belt splice not square": {
                        "p": 0.25,
                        "sensors": {"tracking_offset_mm": (12, 24, 0)},
                        "findings": ["splice 8 mm out of square", "belt camber at splice"],
                        "fixes": ["Belt re-splice"],
                        "partial": ["Belt tracking adjustment"],
                    },
                },
            },
            "belt_slippage": {
                "weight": 0.20,
                "severity_base": 2,
                "symptoms": ["belt slipping on drive pulley", "product flow stops intermittently", "burning rubber smell", "belt speed low"],
                "descriptions": [
                    "Belt stalls under full load, drive pulley keeps turning; speed dropped to {belt_speed_m_s} m/s.",
                    "Burning rubber smell at head end, belt slipping at start-up with loaded belt.",
                ],
                "causes": {
                    "worn drive pulley lagging": {
                        "p": 0.40,
                        "sensors": {"belt_speed_m_s": (0.7, 1.05, 2)},
                        "findings": ["lagging worn smooth", "lagging delaminated in two places"],
                        "fixes": ["Drive pulley relagging"],
                        "partial": ["Belt re-tensioning"],
                    },
                    "belt stretched / low tension": {
                        "p": 0.40,
                        "sensors": {"belt_speed_m_s": (0.9, 1.15, 2)},
                        "findings": ["take-up at end of travel", "belt elongation 1.2%"],
                        "fixes": ["Belt re-tensioning"],
                        "partial": [],
                    },
                    "overloading from upstream": {
                        "p": 0.20,
                        "sensors": {"motor_current_a": (12, 14.5, 1)},
                        "findings": ["upstream cell releasing double loads after PLC change"],
                        "fixes": ["Upstream load control fix"],
                        "partial": ["Belt re-tensioning"],
                    },
                },
            },
            "drive_motor_overheating": {
                "weight": 0.18,
                "severity_base": 2,
                "symptoms": ["motor hot to touch", "motor overload trip", "gearbox noise", "conveyor stops under load"],
                "descriptions": [
                    "Drive motor tripped on overload twice this shift, motor at {motor_temp_c} C.",
                    "Motor casing very hot ({motor_temp_c} C), current {motor_current_a} A vs 9 A nameplate.",
                ],
                "causes": {
                    "gearbox bearing failure": {
                        "p": 0.35,
                        "sensors": {"motor_current_a": (11.5, 14, 1), "gearbox_temp_c": (78, 95, 0)},
                        "findings": ["gearbox output bearing rough", "metal particles in gearbox oil"],
                        "fixes": ["Gearbox replacement"],
                        "partial": ["Gearbox oil change"],
                    },
                    "seized rollers increasing load": {
                        "p": 0.35,
                        "sensors": {"motor_current_a": (11, 13, 1), "motor_temp_c": (82, 96, 0)},
                        "findings": ["several carry rollers seized", "belt drag measured high"],
                        "fixes": ["Idler replacement"],
                        "partial": [],
                    },
                    "motor cooling fan blocked": {
                        "p": 0.30,
                        "sensors": {"motor_temp_c": (85, 98, 0)},
                        "findings": ["fan cowl packed with cardboard dust", "fan blade broken"],
                        "fixes": ["Motor fan cleaning / replacement"],
                        "partial": [],
                    },
                },
            },
            "roller_bearing_noise": {
                "weight": 0.18,
                "severity_base": 1,
                "symptoms": ["squealing roller", "grinding noise along conveyor", "roller not turning", "vibration at tail section"],
                "descriptions": [
                    "Squealing from mid-section rollers, getting louder over the week.",
                    "Grinding noise at tail section, vibration {bearing_vibration_mm_s} mm/s on tail bearing.",
                ],
                "causes": {
                    "failed idler bearings": {
                        "p": 0.60,
                        "sensors": {"bearing_vibration_mm_s": (4.5, 8.5, 1)},
                        "findings": ["three idlers with collapsed bearings"],
                        "fixes": ["Idler replacement"],
                        "partial": ["Bearing re-greasing"],
                    },
                    "tail pulley bearing dry": {
                        "p": 0.40,
                        "sensors": {"bearing_vibration_mm_s": (3.5, 6.5, 1)},
                        "findings": ["tail pulley bearing dry, grease nipple blocked"],
                        "fixes": ["Pulley bearing replacement"],
                        "partial": ["Bearing re-greasing"],
                    },
                },
            },
            "photo_eye_fault": {
                "weight": 0.16,
                "severity_base": 1,
                "symptoms": ["false jam detection", "conveyor stopping with no product", "accumulation zone not releasing", "intermittent sensor fault"],
                "descriptions": [
                    "Conveyor keeps stopping on jam fault with nothing on the belt.",
                    "Accumulation zone 3 not releasing, sensor LED flickering.",
                ],
                "causes": {
                    "dirty / misaligned photo-eye": {
                        "p": 0.55,
                        "sensors": {},
                        "findings": ["reflector covered in dust", "sensor bracket knocked out of line"],
                        "fixes": ["Photo-eye cleaning / realignment"],
                        "partial": [],
                    },
                    "damaged sensor cable": {
                        "p": 0.25,
                        "sensors": {},
                        "findings": ["M12 cable crushed under guard", "intermittent on wiggle test"],
                        "fixes": ["Sensor cable replacement"],
                        "partial": ["Photo-eye cleaning / realignment"],
                    },
                    "failed sensor": {
                        "p": 0.20,
                        "sensors": {},
                        "findings": ["sensor output stuck on", "sensor not responding to teach"],
                        "fixes": ["Photo-eye replacement"],
                        "partial": [],
                    },
                },
            },
        },
        "interventions": {
            "Idler replacement": {"cost": 2, "minutes": (60, 180), "parts_wait": 0.15, "actions": ["Replaced seized idlers", "Changed worn return idlers and checked the rest by hand"]},
            "Belt tracking adjustment": {"cost": 1, "minutes": (20, 60), "parts_wait": 0.0, "actions": ["Adjusted tail pulley tracking screws", "Re-tracked belt with snub idler adjustment"]},
            "Pulley cleaning and scraper install": {"cost": 2, "minutes": (60, 150), "parts_wait": 0.1, "actions": ["Cleaned tail pulley and fitted belt scraper", "Removed build-up from drive pulley, installed V-plough"]},
            "Belt re-splice": {"cost": 3, "minutes": (180, 360), "parts_wait": 0.25, "actions": ["Cut out and re-spliced belt square", "New vulcanised splice by belt contractor"]},
            "Drive pulley relagging": {"cost": 3, "minutes": (240, 480), "parts_wait": 0.35, "actions": ["Relagged drive pulley with ceramic lagging", "Drive pulley exchanged with relagged spare"]},
            "Belt re-tensioning": {"cost": 1, "minutes": (30, 60), "parts_wait": 0.0, "actions": ["Re-tensioned belt at take-up", "Adjusted screw take-up and checked tension"]},
            "Upstream load control fix": {"cost": 2, "minutes": (60, 180), "parts_wait": 0.0, "actions": ["Controls engineer corrected release logic in upstream PLC"]},
            "Gearbox replacement": {"cost": 5, "minutes": (240, 480), "parts_wait": 0.5, "actions": ["Replaced drive gearbox", "Fitted exchange gearmotor"]},
            "Gearbox oil change": {"cost": 1, "minutes": (45, 90), "parts_wait": 0.0, "actions": ["Changed gearbox oil", "Drained gearbox, flushed and refilled"]},
            "Motor fan cleaning / replacement": {"cost": 1, "minutes": (30, 75), "parts_wait": 0.1, "actions": ["Cleaned motor fan cowl", "Replaced broken motor fan"]},
            "Bearing re-greasing": {"cost": 1, "minutes": (20, 60), "parts_wait": 0.0, "actions": ["Re-greased pulley and idler bearings", "Cleared blocked grease nipple and greased"]},
            "Pulley bearing replacement": {"cost": 3, "minutes": (180, 300), "parts_wait": 0.3, "actions": ["Replaced tail pulley bearings", "New plummer block bearings on tail pulley"]},
            "Photo-eye cleaning / realignment": {"cost": 1, "minutes": (10, 40), "parts_wait": 0.0, "actions": ["Cleaned reflector and realigned photo-eye", "Re-taught photo-eye and tightened bracket"]},
            "Sensor cable replacement": {"cost": 1, "minutes": (40, 90), "parts_wait": 0.05, "actions": ["Replaced M12 sensor cable", "Re-routed and replaced damaged sensor cable"]},
            "Photo-eye replacement": {"cost": 1, "minutes": (30, 60), "parts_wait": 0.1, "actions": ["Replaced photo-eye sensor", "Fitted new retro-reflective sensor"]},
        },
        "rare": [
            ("pull_cord_false_trip", "E-stop pull cord tripping without anyone pulling it; tension spring fatigued.", "Replaced pull cord switch spring and re-tensioned cord", "Safety device repair"),
            ("vfd_fault", "Drive showing overvoltage fault on deceleration of loaded incline.", "Enabled braking resistor and extended decel ramp", "Drive parameter change"),
        ],
    },
    # ------------------------------------------------------------------
    "Injection_Molding_Machine": {
        "label": "Injection molding machine",
        "hours_per_day": (18, 23),
        "machines": {
            "IMM-601": {"line": "Molding Hall", "model": "250 t hydraulic IMM", "start_hours": 45300},
            "IMM-602": {"line": "Molding Hall", "model": "250 t hydraulic IMM", "start_hours": 43800},
            "IMM-603": {"line": "Molding Hall", "model": "350 t hybrid IMM", "start_hours": 28100},
            "IMM-604": {"line": "Molding Hall", "model": "150 t all-electric IMM", "start_hours": 14200},
            "IMM-605": {"line": "Molding Hall", "model": "150 t all-electric IMM", "start_hours": 16900},
            "IMM-606": {"line": "Molding Hall", "model": "500 t hydraulic IMM", "start_hours": 51700},
            "IMM-607": {"line": "Molding Hall", "model": "350 t hybrid IMM", "start_hours": 9300},
            "IMM-608": {"line": "Molding Hall", "model": "250 t hydraulic IMM", "start_hours": 36400},
        },
        "materials": ["PP housing (tool T-114)", "ABS cover (tool T-208)", "PA66-GF30 bracket (tool T-311)", "PC lens bezel (tool T-156)"],
        "sensors": {
            "melt_temp_c": (228, 246, 0),
            "injection_pressure_bar": (880, 1250, -1),
            "mold_temp_c": (42, 62, 0),
            "cycle_time_s": (28, 39, 1),
            "cushion_mm": (4.0, 8.0, 1),
            "hydraulic_oil_temp_c": (40, 50, 0),
        },
        "defects": {
            "short_shot": {
                "weight": 0.26,
                "severity_base": 2,
                "symptoms": ["incomplete fill", "short shot at end of flow", "cushion bottoming out", "fill time increased"],
                "descriptions": [
                    "Short shots on {material}, far end of the cavity not filling; cushion at {cushion_mm} mm.",
                    "Intermittent incomplete fill on {material}, about 1 in 20 shots.",
                ],
                "causes": {
                    "worn check ring": {
                        "p": 0.40,
                        "sensors": {"cushion_mm": (0.0, 1.2, 1)},
                        "findings": ["check ring worn, cushion not holding", "screw tip scored"],
                        "fixes": ["Check ring / screw tip replacement"],
                        "partial": ["Injection pressure / shot size increase"],
                    },
                    "blocked vents / gate freeze": {
                        "p": 0.35,
                        "sensors": {},
                        "findings": ["vents clogged with residue", "burn marks at end of fill"],
                        "fixes": ["Mold vent cleaning"],
                        "partial": ["Injection pressure / shot size increase"],
                    },
                    "barrel heater zone failure": {
                        "p": 0.25,
                        "sensors": {"melt_temp_c": (205, 218, 0)},
                        "findings": ["zone 3 heater band open circuit", "thermocouple reading 30 C low"],
                        "fixes": ["Heater band replacement"],
                        "partial": ["Injection pressure / shot size increase"],
                    },
                },
            },
            "flash": {
                "weight": 0.20,
                "severity_base": 1,
                "symptoms": ["flash on parting line", "flash at ejector pins", "part weight high"],
                "descriptions": [
                    "Flash on parting line of {material}, worst on the operator side.",
                    "Thin flash at ejector pins, parts need trimming.",
                ],
                "causes": {
                    "parting line damage": {
                        "p": 0.40,
                        "sensors": {},
                        "findings": ["parting line dented near cavity 2", "shut-off worn"],
                        "fixes": ["Mold parting line repair"],
                        "partial": ["Clamp force increase"],
                    },
                    "insufficient clamp tonnage": {
                        "p": 0.30,
                        "sensors": {},
                        "findings": ["clamp force setpoint 20% low after mold change", "tie bar strain uneven"],
                        "fixes": ["Clamp force increase"],
                        "partial": [],
                    },
                    "excessive melt temperature / pressure": {
                        "p": 0.30,
                        "sensors": {"melt_temp_c": (252, 266, 0)},
                        "findings": ["melt temp 20 C above datasheet", "hold pressure raised by previous shift"],
                        "fixes": ["Process parameter reset"],
                        "partial": ["Clamp force increase"],
                    },
                },
            },
            "sink_marks": {
                "weight": 0.16,
                "severity_base": 1,
                "symptoms": ["sink marks on thick sections", "voids in part", "part dimensions undersize"],
                "descriptions": [
                    "Sink marks over the boss on {material}, cosmetic reject.",
                    "Visible sink on rib side, customer complaint on last batch.",
                ],
                "causes": {
                    "insufficient hold pressure / time": {
                        "p": 0.45,
                        "sensors": {},
                        "findings": ["hold time cut to reduce cycle", "gate freeze study shows 2 s short"],
                        "fixes": ["Process parameter reset"],
                        "partial": [],
                    },
                    "mold cooling channel blocked": {
                        "p": 0.35,
                        "sensors": {"mold_temp_c": (72, 88, 0)},
                        "findings": ["one cooling circuit flow 0.5 l/min", "scale in cooling line"],
                        "fixes": ["Mold cooling line descaling"],
                        "partial": ["Process parameter reset"],
                    },
                    "worn check ring": {
                        "p": 0.20,
                        "sensors": {"cushion_mm": (0.0, 1.5, 1)},
                        "findings": ["cushion drifting to zero during hold"],
                        "fixes": ["Check ring / screw tip replacement"],
                        "partial": ["Process parameter reset"],
                    },
                },
            },
            "barrel_temperature_deviation": {
                "weight": 0.18,
                "severity_base": 2,
                "symptoms": ["barrel zone temperature alarm", "zone not reaching setpoint", "unmelted granules in part"],
                "descriptions": [
                    "Zone 3 deviation alarm, melt temperature {melt_temp_c} C.",
                    "Unmelted granules visible in {material}; barrel zone slow to heat.",
                ],
                "causes": {
                    "failed heater band": {
                        "p": 0.50,
                        "sensors": {"melt_temp_c": (205, 220, 0)},
                        "findings": ["heater band open circuit", "heater band terminal burnt"],
                        "fixes": ["Heater band replacement"],
                        "partial": [],
                    },
                    "faulty thermocouple": {
                        "p": 0.30,
                        "sensors": {"melt_temp_c": (230, 244, 0)},
                        "findings": ["thermocouple reading erratic", "thermocouple tip not seated in well"],
                        "fixes": ["Thermocouple replacement"],
                        "partial": [],
                    },
                    "solid-state relay failure": {
                        "p": 0.20,
                        "sensors": {"melt_temp_c": (208, 225, 0)},
                        "findings": ["SSR failed open", "SSR heatsink fan dead"],
                        "fixes": ["SSR replacement"],
                        "partial": ["Heater band replacement"],
                    },
                },
            },
            "hydraulic_oil_contamination": {
                "weight": 0.10,
                "severity_base": 2,
                "symptoms": ["hydraulic oil cloudy", "valve response sluggish", "filter clogged indicator"],
                "descriptions": [
                    "Hydraulic oil looks milky, filter bypass indicator red.",
                    "Oil sample ISO 21/19/16, target 17/15/12.",
                ],
                "causes": {
                    "water ingress from oil cooler": {
                        "p": 0.45,
                        "sensors": {"hydraulic_oil_temp_c": (38, 44, 0)},
                        "findings": ["water content 900 ppm", "oil cooler tube leak on pressure test"],
                        "fixes": ["Oil cooler repair and oil change"],
                        "partial": ["Hydraulic oil filtration"],
                    },
                    "particle contamination": {
                        "p": 0.55,
                        "sensors": {},
                        "findings": ["breather cap missing", "particle count high after pump change"],
                        "fixes": ["Hydraulic oil filtration"],
                        "partial": [],
                    },
                },
            },
        },
        "interventions": {
            "Check ring / screw tip replacement": {"cost": 4, "minutes": (240, 480), "parts_wait": 0.45, "actions": ["Pulled screw, replaced check ring and screw tip", "Replaced non-return valve assembly"]},
            "Injection pressure / shot size increase": {"cost": 1, "minutes": (10, 30), "parts_wait": 0.0, "actions": ["Increased shot size and injection pressure", "Raised injection pressure by 80 bar"]},
            "Mold vent cleaning": {"cost": 2, "minutes": (60, 150), "parts_wait": 0.0, "actions": ["Cleaned mold vents and parting line", "Mold pulled for vent cleaning in toolroom"]},
            "Heater band replacement": {"cost": 2, "minutes": (60, 120), "parts_wait": 0.2, "actions": ["Replaced barrel heater band zone 3", "New heater band fitted and connections re-made"]},
            "Mold parting line repair": {"cost": 4, "minutes": (300, 900), "parts_wait": 0.0, "actions": ["Toolroom welded and re-cut parting line", "Repaired shut-off surfaces on mold"]},
            "Clamp force increase": {"cost": 1, "minutes": (10, 30), "parts_wait": 0.0, "actions": ["Increased clamp force to mold setting sheet", "Raised clamp tonnage 15%"]},
            "Process parameter reset": {"cost": 1, "minutes": (20, 60), "parts_wait": 0.0, "actions": ["Restored validated process sheet parameters", "Process engineer reset hold pressure and time"]},
            "Mold cooling line descaling": {"cost": 2, "minutes": (90, 180), "parts_wait": 0.0, "actions": ["Descaled mold cooling circuits", "Flushed blocked cooling line"]},
            "Thermocouple replacement": {"cost": 1, "minutes": (30, 60), "parts_wait": 0.1, "actions": ["Replaced barrel thermocouple", "New thermocouple seated in well"]},
            "SSR replacement": {"cost": 1, "minutes": (30, 60), "parts_wait": 0.1, "actions": ["Replaced solid-state relay", "New SSR and heatsink fan"]},
            "Oil cooler repair and oil change": {"cost": 4, "minutes": (300, 600), "parts_wait": 0.4, "actions": ["Replaced oil cooler bundle and changed hydraulic oil"]},
            "Hydraulic oil filtration": {"cost": 2, "minutes": (240, 720), "parts_wait": 0.0, "actions": ["Kidney-loop filtration for 12 h, new breather", "Filtered oil and replaced return filter"]},
        },
        "rare": [
            ("robot_pick_failure", "Sprue picker dropping runners into the mold, mold protect triggered.", "Replaced vacuum generator on sprue picker", "Robot gripper repair"),
            ("mold_water_leak", "Water spraying from mold manifold hose on moving half.", "Replaced mold water hose and quick coupling", "Mold water line repair"),
        ],
    },
}

TECHNICIANS: List[Dict[str, Any]] = [
    {"id": "T-104", "types": ["CNC_Machining_Center"]},
    {"id": "T-109", "types": ["CNC_Machining_Center", "Injection_Molding_Machine"]},
    {"id": "T-112", "types": ["Hydraulic_Press"]},
    {"id": "T-117", "types": ["CNC_Machining_Center"]},
    {"id": "T-121", "types": ["Hydraulic_Press", "Screw_Air_Compressor"]},
    {"id": "T-123", "types": ["Belt_Conveyor"]},
    {"id": "T-126", "types": ["Belt_Conveyor", "Screw_Air_Compressor"]},
    {"id": "T-130", "types": ["Injection_Molding_Machine"]},
    {"id": "T-133", "types": ["Injection_Molding_Machine", "Hydraulic_Press"]},
    {"id": "T-138", "types": ["Screw_Air_Compressor"]},
    {"id": "T-141", "types": ["Belt_Conveyor"]},
    {"id": "T-145", "types": ["CNC_Machining_Center", "Belt_Conveyor"]},
    {"id": "T-150", "types": ["Hydraulic_Press", "Injection_Molding_Machine"]},
]


def machine_type_of(machine_id: str) -> str:
    for machine_type, spec in FLEET.items():
        if machine_id in spec["machines"]:
            return machine_type
    return ""


def fleet_summary() -> Dict[str, Any]:
    """Catalog in the shape the frontend forms use."""

    return {
        "machine_types": [
            {
                "machine_type": machine_type,
                "label": spec["label"],
                "machines": [
                    {"machine_id": mid, "production_line": m["line"], "model": m["model"]}
                    for mid, m in spec["machines"].items()
                ],
                "defect_types": [
                    {"defect_type": name, "symptoms": d["symptoms"]}
                    for name, d in spec["defects"].items()
                ],
                "intervention_categories": sorted(spec["interventions"].keys()),
                "hero_machine_id": next(
                    (h["incident"]["machine_id"] for h in HERO_MACHINES
                     if h["incident"]["machine_type"] == machine_type),
                    None,
                ),
            }
            for machine_type, spec in FLEET.items()
        ],
        "demo_presets": DEMO_PRESETS,
        "demo_outcome": DEMO_OUTCOME,
    }


# Showcase machines for the "memory impact" (before / after) view. Each has a
# real chain in the generated history (see generator.STORIES); the comparison
# itself is computed live from Hindsight recall + deterministic scoring.
HERO_MACHINES: List[Dict[str, Any]] = [
    {
        "key": "cnc",
        "title": "CNC spindle vibration",
        "story": "Alignment failed, bearing replacement fixed it, and the fault came back 7 months later.",
        "incident": {
            "machine_id": "CNC-204",
            "machine_type": "CNC_Machining_Center",
            "production_line": "Machining Cell 2",
            "defect_type": "spindle_vibration",
            "symptoms": ["high spindle vibration", "audible spindle noise", "spindle temperature rising"],
            "sensor_values": {"spindle_vibration_mm_s": 8.4, "spindle_temp_c": 47.5, "spindle_speed_rpm": 12000},
            "description": "Spindle noise at high speed and vibration alarm at 12000 rpm; chatter on finishing pass of 6061 housings.",
        },
    },
    {
        "key": "press",
        "title": "Press pressure loss",
        "story": "Same symptom twice, a different root cause each time; one repair was wasted on the wrong cause.",
        "incident": {
            "machine_id": "HP-303",
            "machine_type": "Hydraulic_Press",
            "production_line": "Press Shop A",
            "defect_type": "pressure_loss",
            "symptoms": ["press not reaching tonnage", "pressure drops during hold"],
            "sensor_values": {"system_pressure_bar": 172, "oil_temp_c": 57.2},
            "description": "Press only reaching 172 bar against 200 bar setpoint, pressure decays during dwell on DC04 panels.",
        },
    },
    {
        "key": "conveyor",
        "title": "Conveyor belt mistracking",
        "story": "A quick re-tracking only masked it; idler replacement three weeks later fixed it.",
        "incident": {
            "machine_id": "CV-507",
            "machine_type": "Belt_Conveyor",
            "production_line": "Packing",
            "defect_type": "belt_mistracking",
            "symptoms": ["belt running off to one side", "belt edge fraying"],
            "sensor_values": {"tracking_offset_mm": 21, "belt_speed_m_s": 1.4},
            "description": "Belt tracking 21 mm to the drive side again, edge fraying near the tail.",
        },
    },
]


# One-click incidents for the live demo (Report Incident form). The same
# records drive scripts/demo.py, so the UI demo and the scripted demo match.
DEMO_PRESETS: List[Dict[str, Any]] = [
    {
        "key": "demo-new-problem",
        "label": "Demo 1: new problem, no history (AC-407)",
        "incident": {
            "machine_id": "AC-407",
            "machine_type": "Screw_Air_Compressor",
            "production_line": "Utilities - Molding Hall",
            "defect_type": "condensate_drain_failure",
            "symptoms": ["water in compressed air line", "auto drain not cycling"],
            "sensor_values": {"discharge_pressure_bar": 7.5, "discharge_temp_c": 82},
            "description": "Water spitting from the air drops at the molding hall. Electronic drain on the wet receiver is not cycling; manual test button does nothing.",
            "operating_hours": 1180,
            "technician_id": "T-138",
        },
    },
    {
        "key": "demo-repeat-problem",
        "label": "Demo 2: same problem again (AC-407)",
        "incident": {
            "machine_id": "AC-407",
            "machine_type": "Screw_Air_Compressor",
            "production_line": "Utilities - Molding Hall",
            "defect_type": "condensate_drain_failure",
            "symptoms": ["water in compressed air line", "wet receiver tank level high"],
            "sensor_values": {"discharge_pressure_bar": 7.5, "discharge_temp_c": 82},
            "description": "Moisture again at molding hall drops and the wet receiver sight glass is almost full; drain does not seem to discharge.",
            "operating_hours": 1630,
            "technician_id": "T-126",
        },
    },
    {
        "key": "demo-conflicting",
        "label": "Conflicting history (CNC-204 spindle vibration)",
        "incident": {**HERO_MACHINES[0]["incident"], "technician_id": "T-117", "operating_hours": 35120},
    },
    {
        "key": "demo-strong",
        "label": "Strong history (CV-505 roller noise)",
        "incident": {
            "machine_id": "CV-505",
            "machine_type": "Belt_Conveyor",
            "production_line": "Assembly Line 3",
            "defect_type": "roller_bearing_noise",
            "symptoms": ["squealing roller", "grinding noise along conveyor"],
            "sensor_values": {"bearing_vibration_mm_s": 6.9, "belt_speed_m_s": 1.45},
            "description": "Squealing and grinding from the mid-section rollers since start of shift, louder under load.",
            "operating_hours": 16240,
            "technician_id": "T-141",
        },
    },
]

# Outcome recorded between Demo 1 and Demo 2 (used by scripts/demo.py and shown as a hint in the UI).
DEMO_OUTCOME: Dict[str, Any] = {
    "intervention_category": "Condensate drain replacement",
    "action_taken": "Replaced zero-loss condensate drain on wet receiver and cleaned inlet strainer",
    "action_outcome": "SUCCESS",
    "confirmed_root_cause": "Drain inlet strainer blocked with rust and pipe sludge from new installation; valve could not discharge",
    "resolution_time_minutes": 55,
    "downtime_minutes": 90,
    "technician_notes": "Old drain full of rust flakes from the new receiver pipework. Fitted new drain, blew down receiver. Dry air at drops after 1 h.",
}
