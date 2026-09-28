"""
Seed TRACE with synthetic (but operationally realistic) maintenance history.

    python seed_data.py            # reset SQLite + Hindsight bank, load history
    python seed_data.py --sqlite   # reset and load SQLite only (no Hindsight calls)

The history is generated deterministically (fixed RNG seed) by
app/data/generator.py, so every teammate gets the same work orders.
"""

import argparse
import asyncio
import time
from datetime import timezone

from app.core.config import settings
from app.data.generator import generate_history
from app.db.database import Base, engine
from app.hindsight.memory import MemoryService
from app.models import ActionOutcome, Incident

BATCH_SIZE = 25
CONCURRENCY = 4
BANK_MISSION = (
    "Maintenance memory for a manufacturing plant's equipment fleet (CNC machining "
    "centers, hydraulic presses, screw air compressors, belt conveyors, injection "
    "molding machines). Remember each work order: machine, problem, readings, what "
    "the technician suspected, what was done, and whether it worked."
)


def to_incident(record: dict) -> Incident:
    record = dict(record)
    record["action_outcome"] = ActionOutcome(record["action_outcome"])
    record["timestamp"] = record["timestamp"].astimezone(timezone.utc)
    return Incident(**record)


async def reset_sqlite():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)


async def retain_all(service: MemoryService, incidents):
    batches = [incidents[i:i + BATCH_SIZE] for i in range(0, len(incidents), BATCH_SIZE)]
    semaphore = asyncio.Semaphore(CONCURRENCY)
    done = 0
    failed = []

    async def run(batch):
        nonlocal done
        async with semaphore:
            for attempt in range(3):
                try:
                    await service.retain_many(batch)
                    done += len(batch)
                    print(f"  retained {done}/{len(incidents)}", flush=True)
                    return
                except Exception as exc:  # network / capacity errors
                    if attempt == 2:
                        failed.extend(i.incident_id for i in batch)
                        print(f"  batch failed: {exc}", flush=True)
                    await asyncio.sleep(3 * (attempt + 1))

    await asyncio.gather(*(run(b) for b in batches))
    return failed


async def main(sqlite_only: bool):
    from app.db.models import IncidentDB  # noqa: F401  (register table)

    started = time.time()
    records = generate_history()
    incidents = [to_incident(r) for r in records]
    print(f"Generated {len(incidents)} work orders "
          f"({incidents[0].timestamp:%Y-%m-%d} to {incidents[-1].timestamp:%Y-%m-%d}).")

    await reset_sqlite()
    service = MemoryService()
    await service.repository.create_many(incidents)
    print(f"SQLite: inserted {len(incidents)} incidents into {settings.database_url}")

    if sqlite_only:
        await service.close()
        return

    print(f"Hindsight: recreating bank '{service.client.bank_id}'")
    await service.client.delete_bank()
    await service.client.create_bank(BANK_MISSION)
    failed = await retain_all(service, incidents)
    await service.close()

    print(f"\nDone in {time.time() - started:.0f}s. "
          f"Retained {len(incidents) - len(failed)}/{len(incidents)} in Hindsight.")
    if failed:
        print("Failed to retain:", ", ".join(failed))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--sqlite", action="store_true", help="SQLite only, skip Hindsight")
    args = parser.parse_args()
    asyncio.run(main(args.sqlite))
