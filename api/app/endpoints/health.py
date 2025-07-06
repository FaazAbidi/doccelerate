from fastapi import APIRouter
from datetime import datetime
from ..schemas.common import HealthCheck
from ..settings import settings
from app.services import openai_service

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/", response_model=HealthCheck)
async def health_check():
    """Health check endpoint"""
    return HealthCheck(
        status="healthy",
        version=settings.app_version,
        timestamp=datetime.now()
    )

@router.get("/services")
async def services_health_check():
    """
    Detailed health check endpoint for all services
    """
    health_status = {
        "status": "healthy",
        "services": {}
    }
    
    # Check OpenAI service
    try:
        openai_healthy = await openai_service.health_check()
        health_status["services"]["openai"] = {
            "status": "healthy" if openai_healthy else "unhealthy",
            "model": openai_service.embedding_model,
            "dimensions": openai_service.embedding_dimensions
        }
        
        if not openai_healthy:
            health_status["status"] = "degraded"
            
    except Exception as e:
        health_status["services"]["openai"] = {
            "status": "error",
            "error": str(e)
        }
        health_status["status"] = "degraded"
    
    return health_status
