from pydantic import BaseModel
from datetime import datetime


class HealthCheck(BaseModel):
    """Health check response schema"""
    status: str = "healthy"
    version: str
    timestamp: datetime
