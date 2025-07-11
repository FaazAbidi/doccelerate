"""
Celery Worker Entry Point

This script starts the Celery worker as a separate process,
decoupled from the FastAPI application.
"""

import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.tasks.celery_app import celery_app

if __name__ == "__main__":
    # Start the Celery worker with multiple threads
    celery_app.start([
        "worker",
        "--loglevel=info",
        "--concurrency=5",
        "--pool=prefork",
    ])
