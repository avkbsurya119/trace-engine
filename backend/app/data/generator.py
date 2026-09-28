"""
Synthetic maintenance history generator.

Produces a reproducible (fixed RNG seed), longitudinal work-order history
for the fleet in catalog.py. The data is synthetic but operationally
realistic:

* each defect family has several root causes; a machine can have its own
  dominant cause (e.g. one press keeps losing cylinder seals)
* technicians often suspect the wrong cause and try the cheap fix first
* an intervention only reliably works when it addresses the true cause, so
  the same action succeeds on one incident and fails on another
* failed / partial repairs lead to follow-up work orders days later
* some records stay uncertain (could not reproduce, not verified)
* a few rare one-off faults have no precedent at all

A handful of scripted chains (STORIES) are merged in so that validation
scenarios have a known, explainable history to check against.
"""

import random
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.data.catalog import FLEET, TECHNICIANS

SEED = 20260928
WINDOW_START = datetime(2025, 6, 2, tzinfo=timezone.utc)
WINDOW_END = datetime(2026, 9, 18, tzinfo=timezone.utc)
FIRST_WORK_ORDER = 4100

# Machines deliberately left without history (the "fresh machine" demo).
NO_HISTORY_MACHINES = {"AC-407"}

OUTCOME_WEIGHTS = {
    # (SUCCESS, PARTIAL, FAILED, UNKNOWN)
    "fix": (0.80, 0.10, 0.06, 0.04),
    "partial": (0.12, 0.55, 0.20, 0.13),
    "wrong": (0.08, 0.20, 0.52, 0.20),
}
OUTCOMES = ("SUCCESS", "PARTIAL", "FAILED", "UNKNOWN")

# ----------------------------------------------------------------------
# Scripted chains: (date, defect, true cause, intervention, outcome, note)
# ----------------------------------------------------------------------
STORIES: Dict[str, List[Tuple[str, str, str, str, str, str]]] = {
    "CNC-204": [
        ("2025-11-04 21:40", "spindle_vibration", "spindle bearing degradation", "Spindle alignment / tramming", "FAILED",
         "Tram and ballbar within spec after adjustment; vibration back to {v} mm/s within 2 h of restart. Noise seems to come from the front bearing housing, suspect bearing degradation rather than alignment."),
        ("2025-11-07 07:15", "spindle_vibration", "spindle bearing degradation", "Spindle bearing replacement", "SUCCESS",
         "Confirmed spindle bearing degradation after teardown: front bearing outer race spalled, grease black. Vibration 1.4 mm/s after run-in. Alignment on 04-Nov was not the cause."),
        ("2026-06-19 14:30", "spindle_vibration", "spindle bearing degradation", "Spindle re-lubrication", "PARTIAL",
         "Vibration dropped from {v} to 3.9 mm/s after re-lubrication but not back to baseline. Recurring issue after bearing replacement in Nov-2025; temporary fix until bearings arrive."),
        ("2026-06-26 06:50", "spindle_vibration", "spindle bearing degradation", "Spindle bearing replacement", "SUCCESS",
         "Recurring issue: second bearing failure in ~7.5 months. Replaced front and rear sets, 1.3 mm/s after run-in. Air-oil lubrication unit found with low flow, repaired at same time - probable contributor."),
    ],
    "HP-303": [
        ("2025-08-12 10:05", "pressure_loss", "internal leakage past cylinder seals", "Relief valve adjustment", "PARTIAL",
         "Raised relief setting, press reaches 196 bar but pressure still decays in dwell. Multiple possible causes: cylinder seals or pump wear."),
        ("2025-08-20 08:30", "pressure_loss", "internal leakage past cylinder seals", "Hydraulic pump replacement", "FAILED",
         "New pump installed, no improvement in dwell pressure decay. Pump was not the cause. Drift test on cylinder now shows 6 mm/min creep."),
        ("2025-09-02 07:00", "pressure_loss", "internal leakage past cylinder seals", "Cylinder reseal", "SUCCESS",
         "Confirmed internal leakage: piston seal extruded on teardown. After reseal holds 200 bar through dwell, drift 0.3 mm/min."),
        ("2026-04-15 13:20", "pressure_loss", "relief valve drifting open", "Cylinder reseal", "FAILED",
         "Same symptom as Aug-2025 so resealed cylinder again, but pressure still limited to ~178 bar. Drift test OK this time - different cause than last year."),
        ("2026-04-18 09:40", "pressure_loss", "relief valve drifting open", "Relief valve replacement", "SUCCESS",
         "Relief valve seat worn, cracking at 175 bar. Replaced cartridge, press holds 200 bar. Root cause confirmed; cylinder reseal on 15-Apr was unnecessary."),
    ],
    "AC-404": [
        ("2025-12-02 11:25", "oil_carryover", "failed separator element", "Oil and separator service", "SUCCESS",
         "Separator element ruptured, dP 1.1 bar. New separator and oil; no oil at downstream filters after one week."),
    ],
    "AC-401": [
        ("2026-05-21 16:05", "oil_carryover", "scavenge line blocked", "Oil and separator service", "PARTIAL",
         "Oil carryover reduced but not gone after new separator. Scavenge line suspected but not checked yet - no sight glass flow."),
    ],
    "CV-507": [
        ("2026-02-10 15:10", "belt_mistracking", "worn / seized return idler", "Belt tracking adjustment", "PARTIAL",
         "Re-tracked belt, runs centred for now but two return idlers are noisy. Temporary fix - idlers on order."),
        ("2026-03-03 22:45", "belt_mistracking", "worn / seized return idler", "Idler replacement", "SUCCESS",
         "Recurring issue from 10-Feb. Replaced 4 return idlers (2 seized). Belt tracking stable over full shift. Earlier tracking adjustment only masked the problem."),
    ],
}


class _Fmt(dict):
    def __missing__(self, key):
        return "?"


def _round(value: float, decimals: int) -> float:
    rounded = round(value, decimals)
    return int(rounded) if decimals <= 0 else rounded


def _weighted(rng: random.Random, items: Dict[str, float]) -> str:
    keys = list(items.keys())
    return rng.choices(keys, weights=[items[k] for k in keys], k=1)[0]


def _shift_time(rng: random.Random, day: datetime) -> Tuple[datetime, str]:
    shift = rng.choices(["day", "swing", "night"], weights=[0.47, 0.34, 0.19])[0]
    start = {"day": 6, "swing": 14, "night": 22}[shift]
    offset = rng.randint(0, 8 * 60 - 1)
    ts = day.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(hours=start, minutes=offset)
    return ts, shift


def _round5(minutes: float) -> int:
    return max(5, int(round(minutes / 5.0)) * 5)


class HistoryGenerator:
    def __init__(self, seed: int = SEED):
        self.rng = random.Random(seed)
        self.records: List[Dict[str, Any]] = []
        self.machine_hpd: Dict[str, float] = {}

    # ------------------------------------------------------------------
    def generate(self) -> List[Dict[str, Any]]:
        for machine_type, spec in FLEET.items():
            for machine_id, machine in spec["machines"].items():
                self.machine_hpd[machine_id] = self.rng.uniform(*spec["hours_per_day"])
                if machine_id in NO_HISTORY_MACHINES:
                    continue
                scripted = STORIES.get(machine_id, [])
                for row in scripted:
                    self.records.append(self._scripted(machine_type, spec, machine_id, machine, row))
                excluded = {row[1] for row in scripted}
                self._machine_history(machine_type, spec, machine_id, machine, excluded, len(scripted))

        self.records.sort(key=lambda r: r["timestamp"])
        seq = FIRST_WORK_ORDER
        for record in self.records:
            record["incident_id"] = f"WO-{record['timestamp'].year}-{seq:05d}"
            seq += self.rng.randint(1, 4)  # other work orders (PMs etc.) interleave
        self._fill_operating_hours()
        self._add_recurrence_notes()
        for record in self.records:
            record.pop("_cause", None)
        return self.records

    # ------------------------------------------------------------------
    def _machine_history(self, machine_type, spec, machine_id, machine, excluded, already):
        rng = self.rng
        target = max(rng.randint(8, 20) - already, 4)

        family_weights = {
            name: d["weight"] for name, d in spec["defects"].items()
            if d["weight"] > 0 and name not in excluded
        }
        common = [f for f, w in family_weights.items() if w >= 0.1]
        for chronic in rng.sample(common, k=min(2, len(common))):
            family_weights[chronic] *= rng.uniform(2.0, 3.5)

        cause_weights: Dict[str, Dict[str, float]] = {}
        for name in family_weights:
            causes = {c: v["p"] for c, v in spec["defects"][name]["causes"].items()}
            if rng.random() < 0.45:
                dominant = rng.choice(list(causes))
                causes[dominant] *= 3.0
            cause_weights[name] = causes

        span = (WINDOW_END - WINDOW_START).total_seconds()
        last_success: Dict[str, str] = {}
        produced = 0
        busy_until = WINDOW_START
        starts = sorted(
            WINDOW_START + timedelta(seconds=rng.uniform(0, span))
            for _ in range(int(target * 0.8) + 1)
        )
        tries = 0
        while produced < target and tries < 60:
            tries += 1
            if starts:
                t = starts.pop(0)
            else:
                t = WINDOW_START + timedelta(seconds=rng.uniform(0, span))
            if t < busy_until:
                t = busy_until + timedelta(days=rng.uniform(1, 12))
            if t >= WINDOW_END:
                continue
            if rng.random() < 0.035 and spec["rare"]:
                self.records.append(self._rare(machine_type, spec, machine_id, machine, t))
                produced += 1
                continue
            family = _weighted(rng, family_weights)
            cause = _weighted(rng, cause_weights[family])
            chain = self._episode(machine_type, spec, machine_id, machine, t, family, cause, last_success)
            self.records.extend(chain)
            produced += len(chain)
            busy_until = max(busy_until, chain[-1]["timestamp"])

    def _episode(self, machine_type, spec, machine_id, machine, t, family, cause, last_success):
        rng = self.rng
        family_spec = spec["defects"][family]
        cause_spec = family_spec["causes"][cause]
        chain: List[Dict[str, Any]] = []
        tried: set = set()

        for attempt in range(3):
            suspected = self._suspect(family_spec, cause, attempt)
            intervention = self._choose(spec, family_spec, cause, suspected, last_success.get(family), tried, attempt)
            tried.add(intervention)
            kind = "fix" if intervention in cause_spec["fixes"] else "partial" if intervention in cause_spec["partial"] else "wrong"
            outcome = rng.choices(OUTCOMES, weights=OUTCOME_WEIGHTS[kind])[0]
            chain.append(self._build(machine_type, spec, machine_id, machine, t, family, cause, suspected, intervention, kind, outcome))

            if outcome == "SUCCESS":
                if kind == "fix":
                    last_success[family] = intervention
                break
            follow = {"FAILED": 0.75, "PARTIAL": 0.55, "UNKNOWN": 0.35}[outcome]
            if rng.random() > follow:
                break
            gap_days = {"FAILED": (0.4, 6), "PARTIAL": (6, 40), "UNKNOWN": (2, 21)}[outcome]
            t = t + timedelta(days=rng.uniform(*gap_days))
            if t >= WINDOW_END:
                break
        return chain

    def _suspect(self, family_spec, cause, attempt) -> str:
        rng = self.rng
        causes = list(family_spec["causes"])
        others = [c for c in causes if c != cause]
        p_right = 0.6 if attempt == 0 else 0.8
        roll = rng.random()
        if roll < p_right or not others:
            return cause
        if roll < p_right + 0.15 and len(causes) > 1:
            a, b = rng.sample(causes, 2)
            return f"unclear - {a} or {b}"
        return rng.choice(others)

    def _choose(self, spec, family_spec, cause, suspected, previous_fix, tried, attempt) -> str:
        rng = self.rng
        plausible: List[str] = []
        for c in family_spec["causes"].values():
            for option in c["fixes"] + c["partial"]:
                if option not in plausible:
                    plausible.append(option)
        available = [p for p in plausible if p not in tried] or plausible

        if attempt == 0 and previous_fix in available and rng.random() < 0.6:
            return previous_fix

        suspected_cause = suspected if suspected in family_spec["causes"] else None
        if suspected_cause:
            options = [o for o in family_spec["causes"][suspected_cause]["fixes"] if o in available]
            cheap = [o for o in family_spec["causes"][suspected_cause]["partial"] if o in available]
            if cheap and attempt == 0 and rng.random() < 0.35:
                return rng.choice(cheap)
            if options:
                return rng.choice(options)

        costs = spec["interventions"]
        return rng.choices(available, weights=[1.0 / costs[a]["cost"] for a in available])[0]

    # ------------------------------------------------------------------
    def _sensors(self, spec, overrides) -> Dict[str, Any]:
        rng = self.rng
        values = {}
        for name, (low, high, dec) in spec["sensors"].items():
            if name in overrides:
                low, high, dec = overrides[name]
            values[name] = _round(rng.uniform(low, high), dec)
        return values

    def _base(self, machine_type, spec, machine_id, machine, t, family, symptoms_pool, overrides):
        rng = self.rng
        ts, shift = _shift_time(rng, t)
        sensors = self._sensors(spec, overrides)
        conditions: Dict[str, Any] = {"shift": shift}
        if spec["materials"]:
            conditions["product"] = rng.choice(spec["materials"])
        if machine_type == "Screw_Air_Compressor":
            conditions["plant_demand"] = rng.choice(["normal", "normal", "high (all press lines running)", "low (weekend)"])
        else:
            conditions["utilisation_pct"] = rng.randint(55, 97)
        techs = [x["id"] for x in TECHNICIANS if machine_type in x["types"]]
        k = min(len(symptoms_pool), rng.choice([1, 2, 2, 3]))
        return {
            "machine_id": machine_id,
            "machine_type": machine_type,
            "production_line": machine["line"],
            "timestamp": ts,
            "defect_type": family,
            "symptoms": rng.sample(symptoms_pool, k),
            "sensor_values": sensors,
            "operating_conditions": conditions,
            "technician_id": rng.choice(techs),
        }

    def _describe(self, templates, sensors, conditions, symptoms) -> str:
        rng = self.rng
        values = _Fmt(sensors)
        values.update(
            material=conditions.get("product", "the part"),
            ra=f"{rng.uniform(2.4, 4.8):.1f}",
            drift=f"{rng.uniform(0.02, 0.08):.2f}",
            tool=rng.choice(["6.8 mm drill", "M8 tap", "10 mm end mill"]),
            axis=rng.choice(["X", "Y", "Z"]),
            leak_l=rng.randint(8, 40),
        )
        body = rng.choice(templates).format_map(values)
        opener = rng.choice([
            "", "", "",
            f"{conditions.get('shift', 'day').capitalize()} shift operator reported: ",
            "Raised by line lead - ",
            "Andon call: ",
            "Found during PM round: ",
            "Quality hold: ",
        ])
        extra = []
        if len(symptoms) > 1 and rng.random() < 0.5:
            extra.append(f"Also noted {symptoms[-1]}.")
        extra.append(rng.choice([
            "", "", "Machine stopped.", "Running at reduced rate until checked.",
            "Production switched to backup where possible.", "Started after the weekend start-up.",
            f"First noticed around {rng.randint(1, 12)}:{rng.choice(['00', '15', '30', '45'])}.",
        ]))
        if opener and body:
            body = body[0].lower() + body[1:] if not body[:3].isupper() and not body[1:2].isdigit() and "-" not in body[:7] else body
        return " ".join(part for part in [opener + body] + extra if part).strip()

    def _timing(self, spec, intervention, outcome, severity_base) -> Tuple[int, int, str]:
        rng = self.rng
        iv = spec["interventions"][intervention]
        repair = rng.uniform(*iv["minutes"])
        if outcome == "UNKNOWN":
            repair *= rng.uniform(0.4, 0.9)
        diagnosis = rng.uniform(15, 120)
        waiting = rng.uniform(90, 2400) if rng.random() < iv["parts_wait"] else 0.0
        resolution = _round5(repair)
        downtime = _round5(diagnosis + repair + waiting)
        score = severity_base + (1 if downtime > 600 else 0) + (1 if downtime > 2000 else 0)
        severity = ["LOW", "MEDIUM", "HIGH", "CRITICAL"][min(3, max(0, score - 1))]
        return resolution, downtime, severity

    def _build(self, machine_type, spec, machine_id, machine, t, family, cause, suspected, intervention, kind, outcome):
        rng = self.rng
        family_spec = spec["defects"][family]
        cause_spec = family_spec["causes"][cause]
        record = self._base(machine_type, spec, machine_id, machine, t, family, family_spec["symptoms"], cause_spec["sensors"])
        sensors = record["sensor_values"]
        finding = rng.choice(cause_spec["findings"]).format_map(_Fmt(sensors))
        action = rng.choice(spec["interventions"][intervention]["actions"])
        resolution, downtime, severity = self._timing(spec, intervention, outcome, family_spec["severity_base"])
        others = [c for c in family_spec["causes"] if c != cause]

        confirmed: Optional[str] = None
        if outcome == "SUCCESS" and kind == "fix":
            confirmed = cause
        elif outcome == "PARTIAL" and rng.random() < 0.4:
            confirmed = f"probable {cause} (not confirmed)"

        if outcome == "SUCCESS" and kind == "fix":
            notes = rng.choice([
                f"Confirmed {cause} after inspection: {finding}. {self._verify()}",
                f"{finding[0].upper() + finding[1:]}. After repair {self._verify().lower()}",
                f"Root cause confirmed on teardown - {finding}. {self._verify()}",
            ])
            details = f"{action}. Readings back within normal range."
        elif outcome == "SUCCESS":
            notes = rng.choice([
                "Fault cleared after this work but root cause not confirmed; monitoring.",
                f"Symptoms gone after {intervention.lower()}. Not fully convinced this was the cause - {cause} still possible.",
            ])
            details = f"{action}. Fault cleared, cause not confirmed."
        elif outcome == "PARTIAL":
            notes = rng.choice([
                f"Improved but not fully resolved. {finding[0].upper() + finding[1:]}. Temporary fix, proper repair planned.",
                f"Partial improvement only. Suspect {cause}; parts on order.",
                f"Better for now but expect recurrence. Possible {cause}.",
            ])
            details = f"{action}. Partial improvement."
        elif outcome == "FAILED":
            alt = rng.choice(others) if others else cause
            notes = rng.choice([
                f"No improvement after {intervention.lower()}. Now suspect {cause}.",
                f"No change. Multiple possible causes: {cause} or {alt}.",
                f"Did not fix it - fault returned within the shift. {intervention} ruled out.",
            ])
            details = f"{action}. No change in fault."
        else:
            notes = rng.choice([
                f"Could not reproduce the fault during {rng.randint(1, 4)} h observation. Released to production, monitoring.",
                "Intermittent - cleared after reset, cause not confirmed.",
                "Machine returned to production before verification; outcome not confirmed by operator.",
            ])
            details = f"{action}. Result not verified."

        record.update(
            description=self._describe(family_spec["descriptions"], sensors, record["operating_conditions"], record["symptoms"]),
            suspected_root_cause=suspected,
            confirmed_root_cause=confirmed,
            action_taken=action,
            intervention_category=intervention,
            action_outcome=outcome,
            resolution_details=details,
            resolution_time_minutes=resolution,
            downtime_minutes=downtime,
            severity=severity,
            technician_notes=notes,
            _cause=cause,
        )
        return record

    def _verify(self) -> str:
        return self.rng.choice([
            "Ran test cycles for 30 min, readings back to normal.",
            "Monitored for one shift, no recurrence.",
            "First-off parts approved by quality.",
            "Verified with operator at shift handover.",
        ])

    def _rare(self, machine_type, spec, machine_id, machine, t):
        rng = self.rng
        defect, description, action, category = rng.choice(spec["rare"])
        record = self._base(machine_type, spec, machine_id, machine, t, defect, [defect.replace("_", " ")], {})
        outcome = rng.choices(OUTCOMES, weights=(0.5, 0.2, 0.1, 0.2))[0]
        repair = rng.uniform(40, 300)
        downtime = _round5(repair + rng.uniform(20, 240))
        record.update(
            description=description,
            suspected_root_cause="unclear - first occurrence on this machine",
            confirmed_root_cause=None,
            action_taken=action,
            intervention_category=category,
            action_outcome=outcome,
            resolution_details=f"{action}.",
            resolution_time_minutes=_round5(repair),
            downtime_minutes=downtime,
            severity=rng.choice(["MEDIUM", "HIGH"]),
            technician_notes={
                "SUCCESS": "One-off fault, no previous record found. Fixed and tested.",
                "PARTIAL": "Working again but cause not fully understood. Escalated to OEM.",
                "FAILED": "Attempt did not fix it; OEM service engineer booked.",
                "UNKNOWN": "Could not reproduce after restart. Left running, monitoring.",
            }[outcome],
        )
        return record

    def _scripted(self, machine_type, spec, machine_id, machine, row):
        rng = self.rng
        date, family, cause, intervention, outcome, note = row
        t = datetime.strptime(date, "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
        family_spec = spec["defects"][family]
        cause_spec = family_spec["causes"][cause]
        record = self._base(machine_type, spec, machine_id, machine, t, family, family_spec["symptoms"], cause_spec["sensors"])
        record["timestamp"] = t
        record["operating_conditions"]["shift"] = "night" if t.hour >= 22 or t.hour < 6 else "day" if t.hour < 14 else "swing"
        sensors = record["sensor_values"]
        vib = sensors.get("spindle_vibration_mm_s", "")
        kind = "fix" if intervention in cause_spec["fixes"] else "partial"
        resolution, downtime, severity = self._timing(spec, intervention, outcome, family_spec["severity_base"])
        record.update(
            description=self._describe(family_spec["descriptions"], sensors, record["operating_conditions"], record["symptoms"]),
            suspected_root_cause=cause if outcome == "SUCCESS" else rng.choice(list(family_spec["causes"])),
            confirmed_root_cause=cause if outcome == "SUCCESS" else None,
            action_taken=rng.choice(spec["interventions"][intervention]["actions"]),
            intervention_category=intervention,
            action_outcome=outcome,
            resolution_details={"SUCCESS": "Fault resolved and verified.", "PARTIAL": "Partial improvement.", "FAILED": "No change in fault."}[outcome],
            resolution_time_minutes=resolution,
            downtime_minutes=downtime,
            severity=severity,
            technician_notes=note.format(v=vib),
            _cause=cause,
            _scripted=True,
        )
        return record

    # ------------------------------------------------------------------
    def _fill_operating_hours(self):
        for record in self.records:
            machine = FLEET[record["machine_type"]]["machines"][record["machine_id"]]
            days = (record["timestamp"] - WINDOW_START).total_seconds() / 86400.0
            record["operating_hours"] = int(machine["start_hours"] + days * self.machine_hpd[record["machine_id"]])

    def _add_recurrence_notes(self):
        """Mention the previous occurrence, the way technicians do."""
        last: Dict[Tuple[str, str], Dict[str, Any]] = {}
        for record in self.records:
            key = (record["machine_id"], record["defect_type"])
            previous = last.get(key)
            if previous and not record.pop("_scripted", False):
                days = (record["timestamp"] - previous["timestamp"]).days
                if days <= 60 and previous["action_outcome"] != "SUCCESS":
                    prefix = f"Follow-up to {previous['incident_id']} ({previous['action_outcome'].lower()} {days} d ago). "
                    record["technician_notes"] = prefix + record["technician_notes"]
                elif previous["action_outcome"] == "SUCCESS" and self.rng.random() < 0.6:
                    months = max(1, round(days / 30))
                    prefix = f"Recurring issue - same fault as {previous['incident_id']} ~{months} month(s) ago. "
                    record["technician_notes"] = prefix + record["technician_notes"]
            else:
                record.pop("_scripted", None)
            last[key] = record


def generate_history(seed: int = SEED) -> List[Dict[str, Any]]:
    return HistoryGenerator(seed).generate()


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
