from fastapi import APIRouter
from datetime import datetime
from ..schemas.common import HealthCheck
from ..settings import settings

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/", response_model=HealthCheck)
async def health_check():
    """Health check endpoint"""
    return HealthCheck(
        status="healthy",
        version=settings.app_version,
        timestamp=datetime.now()
    )


@router.get("/readiness")
async def readiness_check():
    """Readiness check endpoint"""
    return {"status": "ready", "timestamp": datetime.now()}


@router.get("/liveness")
async def liveness_check():
    """Liveness check endpoint"""
    return {"status": "alive", "timestamp": datetime.now()} 