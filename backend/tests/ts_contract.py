"""
Tiny reader for the TypeScript interfaces in frontend/src/types/incident.ts,
used to check that API responses carry every field the frontend requires.
"""

import re
from pathlib import Path
from typing import Dict, Tuple

TYPES_FILE = Path(__file__).resolve().parents[2] / "frontend" / "src" / "types" / "incident.ts"
HEADER = re.compile(r"export interface (\w+)(?: extends (\w+))? \{")
FIELD = re.compile(r"^\s{2}(\w+)(\?)?:\s*(.+?);?$")


def load_interfaces() -> Dict[str, Dict[str, Tuple[bool, str]]]:
    """{interface: {field: (required, ts_type)}} for top-level fields only."""
    source = TYPES_FILE.read_text()
    interfaces: Dict[str, Dict[str, Tuple[bool, str]]] = {}
    parents: Dict[str, str] = {}
    for match in HEADER.finditer(source):
        name, parent = match.group(1), match.group(2)
        depth, i = 1, match.end()
        body_start = i
        while depth:
            depth += {"{": 1, "}": -1}.get(source[i], 0)
            i += 1
        fields = {}
        for line in source[body_start:i - 1].splitlines():
            m = FIELD.match(line)
            if m and not line.startswith("   "):
                fields[m.group(1)] = (m.group(2) is None, m.group(3).rstrip(";").strip())
        interfaces[name] = fields
        if parent:
            parents[name] = parent
    for child, parent in parents.items():
        interfaces[child] = {**interfaces[parent], **interfaces[child]}
    return interfaces


def check(value, interface: str, interfaces, path: str = "") -> list:
    """Return a list of contract violations for value against interface."""
    problems = []
    if not isinstance(value, dict):
        return [f"{path or interface}: expected object, got {type(value).__name__}"]
    for field, (required, ts_type) in interfaces[interface].items():
        where = f"{path}.{field}" if path else f"{interface}.{field}"
        if field not in value or (value[field] is None and "null" not in ts_type):
            if required:
                problems.append(f"{where}: missing (frontend type {ts_type})")
            continue
        inner = ts_type.replace("| null", "").strip()
        is_list = inner.endswith("[]")
        inner = inner[:-2] if is_list else inner
        if inner in interfaces and value[field] is not None:
            items = value[field] if is_list else [value[field]]
            if is_list and not isinstance(value[field], list):
                problems.append(f"{where}: expected array")
                continue
            for n, item in enumerate(items[:5]):
                problems += check(item, inner, interfaces, f"{where}[{n}]" if is_list else where)
    return problems
