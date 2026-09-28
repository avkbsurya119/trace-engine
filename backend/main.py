"""
TRACE — Troubleshooting & Root-Cause Adaptive Context Engine

Main FastAPI application entry point.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.api import incidents_router, dashboard_router, intelligence_router
from app.core.errors import MemoryUnavailableError
from app.db.database import init_db, close_db

logger = logging.getLogger("trace")
# Create FastAPI application
app = FastAPI(
    title="TRACE API",
    description=(
        "Troubleshooting & Root-Cause Adaptive Context Engine - "
        "An AI-powered manufacturing defect resolution agent with persistent memory."
    ),
    version="0.1.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(MemoryUnavailableError)
async def memory_unavailable(request: Request, exc: MemoryUnavailableError):
    logger.error("Hindsight unavailable on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=503,
        content={"detail": f"Memory service unavailable, nothing was saved. {exc}"},
    )


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": f"Internal error: {exc}"})


# Include routers
app.include_router(incidents_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(intelligence_router, prefix="/api")


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "TRACE API",
        "version": "0.1.0",
        "description": "Manufacturing defect resolution agent with persistent memory",
        "docs": "/docs",
    }
@app.on_event("startup")
async def startup():
    await init_db()


@app.on_event("shutdown")
async def shutdown():
    await close_db()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
    )
