import asyncio

from hindsight_client import Hindsight
from app.core.config import settings


async def main():
    client = Hindsight(
        base_url=settings.hindsight_api_url,
        api_key=settings.hindsight_api_key,
    )

    incident_id = "TRACE-TAG-TEST-001"

    print("1. Retaining tagged incident...")

    result = await client.aretain(
        bank_id=settings.hindsight_namespace,
        content=(
            "Manufacturing incident TRACE-TAG-TEST-001. "
            "Machine CNC-TAG-01 experienced excessive surface roughness "
            "and high spindle vibration. "
            "The technician reduced spindle speed and the defect was "
            "resolved successfully."
        ),
        document_id=incident_id,
        tags=[
            f"incident_id:{incident_id}",
            "machine_id:CNC-TAG-01",
            "defect_type:surface_roughness",
        ],
    )

    print("Retain:", result)

    print("\n2. Recalling tagged incident...")

    recall = await client.arecall(
        bank_id=settings.hindsight_namespace,
        query="CNC-TAG-01 surface roughness spindle vibration",
    )

    print("Results:", len(recall.results))

    for item in recall.results:
        print("\n--- RESULT ---")
        print("ID:", item.id)
        print("Text:", item.text)
        print("Document ID:", item.document_id)
        print("Tags:", item.tags)
        print("Metadata:", item.metadata)

    await client.aclose()


if __name__ == "__main__":
    asyncio.run(main())
