from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from multiprocessing import Process

from app.settings import settings
from app.endpoints import health_router, query_router
from app.database import connect_db, disconnect_db

# Celery app & helper to run a worker in-process
from app.tasks.celery_app import celery_app

def _start_celery_worker() -> None:
    """Run a Celery worker inside the current process.

    The worker is started with a minimal argument list and default queue.
    It will inherit the same settings instance (thus same redis_url).
    """
    # We use celery_app.worker_main instead of the CLI command to avoid an
    # extra subprocess spawn layer.
    celery_app.worker_main([
        "worker",
        "--loglevel=info",
        "--pool=solo",  # simpler when embedded – avoids forking issues
    ])

# This global will hold the background Process so we can terminate it on shutdown
_celery_process: Process | None = None

# Application lifespan handler
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _celery_process
    # Startup logic
    await connect_db()

    # Spawn Celery worker in a dedicated background process so it does not
    # block the event loop. We keep a reference to terminate it cleanly.
    _celery_process = Process(target=_start_celery_worker, daemon=True)
    _celery_process.start()

    # Application is now live
    yield

    # Shutdown logic
    if _celery_process and _celery_process.is_alive():
        _celery_process.terminate()
        _celery_process.join(timeout=5)

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

