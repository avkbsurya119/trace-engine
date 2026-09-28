import asyncio

from hindsight_client import Hindsight

from app.core.config import settings


async def main():
    client = Hindsight(
        base_url=settings.hindsight_api_url,
        api_key=settings.hindsight_api_key,
    )

    print("1. Retaining test incident...")

    retain_result = await client.aretain(
        bank_id=settings.hindsight_namespace,
        content=(
            "TRACE test incident. "
            "Machine CNC-TEST experienced excessive surface roughness "
            "with high spindle vibration. "
            "The technician reduced spindle speed and the defect was resolved successfully."
        ),
        document_id="trace-test-001",
        metadata={
            "machine_id": "CNC-TEST",
            "defect_type": "surface_roughness",
            "action_outcome": "SUCCESS",
        },
    )

    print("Retain successful!")
    print(retain_result)

    print("\n2. Recalling test incident...")

    recall_result = await client.arecall(
        bank_id=settings.hindsight_namespace,
        query=(
            "What happened previously with CNC-TEST when it had "
            "surface roughness and high spindle vibration? "
            "What action successfully resolved it?"
        ),
    )

    print("Recall successful!")
    print(recall_result)

    await client.aclose()


if __name__ == "__main__":
    asyncio.run(main())
