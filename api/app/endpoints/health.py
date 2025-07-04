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
