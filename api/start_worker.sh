#!/bin/bash
# Celery Worker Startup Script for Railway

echo "Starting Celery Worker..."
echo "Redis URL: ${REDIS_URL}"
echo "Database URL configured: $([ -n "$DATABASE_URL" ] && echo "Yes" || echo "No")"

# Generate Prisma client first
echo "Generating Prisma client..."
uv run prisma generate

# Start Celery worker
echo "Starting Celery worker with uv..."
uv run python worker.py 