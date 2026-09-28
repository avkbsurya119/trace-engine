#!/bin/bash
# Render startup script: seed database if empty, then start server

echo "Checking database..."
python -c "
import asyncio
from app.db.database import engine, Base
from app.db.models import IncidentDB
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

async def check_and_seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    from sqlalchemy.orm import sessionmaker
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(select(func.count(IncidentDB.incident_id)))
        count = result.scalar()

    if count == 0:
        print(f'Database empty, seeding...')
        import subprocess
        subprocess.run(['python', 'seed_data.py'], check=True)
    else:
        print(f'Database has {count} incidents, skipping seed')

asyncio.run(check_and_seed())
"

echo "Starting server..."
exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
