import asyncio

from hindsight_client import Hindsight
from app.core.config import settings


async def main():
    client = Hindsight(
        base_url=settings.hindsight_api_url,
        api_key=settings.hindsight_api_key,
    )

    result = await client.arecall(
        bank_id=settings.hindsight_namespace,
        query="CNC-TEST surface roughness spindle vibration",
    )

    print("RESULT TYPE:", type(result))
    print("NUMBER OF RESULTS:", len(result.results))

    if result.results:
        item = result.results[0]

        print("\nITEM TYPE:", type(item))
        print("ITEM:", item)
        print("\nMODEL FIELDS:", getattr(item, "model_fields", None))
        print("\nDICT:", item.model_dump())

    await client.aclose()


if __name__ == "__main__":
    asyncio.run(main())
