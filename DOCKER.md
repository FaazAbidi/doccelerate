# Docker Setup Guide

This guide explains how to run the Doccelerate application using Docker Compose.

## Prerequisites

- Docker and Docker Compose installed on your system
- A `.env` file in the root directory with required environment variables

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DATABASE_URL="postgresql://user:password@localhost:5432/doccelerate"
DIRECT_URL="postgresql://user:password@localhost:5432/doccelerate"

# Supabase Configuration
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"

# OpenAI Configuration
OPENAI_API_KEY="your-openai-api-key"

# Redis Configuration (use your hosted Redis service URL)
REDIS_URL="redis://your-hosted-redis-url:6379"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret"

# GitHub OAuth (if using GitHub authentication)
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# API Configuration
NEXT_PUBLIC_API_URL="http://localhost:8000"

# Environment
NODE_ENV="development"
```

## Quick Start

### Using Make Commands (Recommended)

```bash
# Build and start all services
make docker-dev

# Start services in background
make docker-up

# View logs
make docker-logs

# Stop all services
make docker-down

# Build images only
make docker-build
```

### Using Docker Compose Directly

```bash
# Build and start all services (development mode)
docker-compose up --build

# Start services in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Rebuild specific service
docker-compose build api
docker-compose build web
```

## Services

The Docker setup includes the following services:

### 1. API (`api`)
- **Port**: 8000
- **Purpose**: FastAPI backend with Celery workers
- **Build**: `./api/Dockerfile`
- **Dependencies**: External Redis service (configured via REDIS_URL)

### 2. Web (`web`)
- **Port**: 3000
- **Purpose**: Next.js frontend
- **Build**: `./web/Dockerfile` (development target)
- **Dependencies**: API service

**Note**: This setup uses your hosted Redis service instead of a local Redis container. Make sure to configure the `REDIS_URL` environment variable to point to your hosted Redis instance.

## Development Features

- **Hot Reload**: Both API and web services support hot reloading
- **Volume Mounting**: Source code is mounted for live development
- **Health Checks**: All services include health checks for reliable startup
- **Dependency Management**: Services start in the correct order

## Production Deployment

For production, update the docker-compose.yml:

1. Change the web service target to `production`:
```yaml
web:
  build:
    context: ./web
    dockerfile: Dockerfile
    target: production  # Change from development
```

2. Remove volume mounts and use environment-specific configs

## Troubleshooting

### Common Issues

1. **Port conflicts**: Make sure ports 3000 and 8000 are available
2. **Environment variables**: Ensure your `.env` file exists and contains all required variables
3. **Database connection**: Verify your DATABASE_URL is correct and accessible
4. **Redis connection**: Ensure your hosted Redis service is accessible and REDIS_URL is correctly configured
5. **Prisma client not generated**: If you see "The Client hasn't been generated yet" error, the Prisma client is generated during the build process, but you can manually run:
   ```bash
   docker-compose exec api uv run prisma generate
   ```

### Useful Commands

```bash
# Check service status
docker-compose ps

# View logs for specific service
docker-compose logs api
docker-compose logs web

# Restart a specific service
docker-compose restart api

# Rebuild and restart
docker-compose up --build --no-deps api

# Access a running container
docker-compose exec api bash
docker-compose exec web sh
```

### Database Operations

```bash
# Run database migrations from API container
docker-compose exec api uv run prisma db push

# Generate Prisma client
docker-compose exec api uv run prisma generate

# Access database console (if using local PostgreSQL)
docker-compose exec api uv run prisma studio
```

## Switching Between Local and Docker Development

You can easily switch between local development and Docker:

- **Local**: `make up` (uses local Node.js and Python)
- **Docker**: `make docker-dev` (uses containerized environment)

Both environments use the same `.env` file and connect to the same hosted Redis service. 