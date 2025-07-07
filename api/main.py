from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.settings import settings
from app.endpoints import health_router, query_router, index_router
from app.database import connect_db, disconnect_db

# Application lifespan handler
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    await connect_db()

    # Application is now live
    yield

    # Shutdown logic
    await disconnect_db()

# Create FastAPI app with settings
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
    description="A modern API for document acceleration and management",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers with API v1 prefix
app.include_router(health_router, prefix=settings.api_prefix)
app.include_router(query_router, prefix=settings.api_prefix)
app.include_router(index_router, prefix=settings.api_prefix)

# Root endpoint
@app.get("/")
async def read_root():
    return {
        "message": f"Welcome to {settings.app_name}",
        "version": settings.app_version,
        "docs_url": "/docs",
        "api_prefix": settings.api_prefix
    }


# Additional metadata endpoint
@app.get("/info")
async def get_info():
    return {
        "app_name": settings.app_name,
        "version": settings.app_version,
        "debug": settings.debug,
        "api_prefix": settings.api_prefix
    }

