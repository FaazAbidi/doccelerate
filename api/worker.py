#!/usr/bin/env python3
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
    # Start the Celery worker
    celery_app.start([
        "worker",
        "--loglevel=info",
        "--concurrency=1",  # Single worker for Railway
        "--pool=solo",      # Use solo pool for better Railway compatibility
    ]) 