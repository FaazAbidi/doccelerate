from .users import router as users_router
from .documents import router as documents_router
from .health import router as health_router

__all__ = [
    "users_router",
    "documents_router", 
    "health_router",
]
