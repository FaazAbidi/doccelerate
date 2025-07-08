.PHONY: api web up docker-up docker-down docker-build docker-logs db-pull db-generate db-sync

api:
	cd api && uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000

web:
	cd web && npm run dev

# Run Celery worker separately
celery-worker:
	cd api && uv run python worker.py

# Alternative: Run Celery worker with standard command
celery-worker-alt:
	cd api && uv run celery -A app.tasks.celery_app worker --loglevel=info

# Run API and Web concurrently (local) - worker runs separately
up:
	$(MAKE) -j 2 api web

# Run all services including worker (local)
up-all:
	$(MAKE) -j 3 api web celery-worker

# Docker commands
docker-build:
	docker-compose build

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

docker-dev:
	docker-compose up --build

# Sync database schema from Supabase for API
db-pull-api:
	cd api && prisma db pull

# Sync database schema from Supabase for Web
db-pull-web:
	cd web && npx prisma db pull

# Generate Prisma clients for API
db-generate-api:
	cd api && prisma generate

# Generate Prisma clients for Web
db-generate-web:
	cd web && npm run generate

# Pull schema from Supabase for both API and Web
db-pull:
	$(MAKE) -j 2 db-pull-api db-pull-web

# Generate Prisma clients for both API and Web
db-generate:
	$(MAKE) -j 2 db-generate-api db-generate-web

# Full sync: pull schema and generate clients for both API and Web
db-sync:
	$(MAKE) db-pull
	$(MAKE) db-generate

# Railway deployment commands
railway-login:
	railway login

# Note: Railway services must be created manually via dashboard for monorepo
# Each service points to different root directories (api/, web/, api/ for worker)

railway-logs-api:
	railway logs --service api

railway-logs-web:
	railway logs --service web

railway-logs-worker:
	railway logs --service celery-worker

railway-status:
	railway status

railway-deploy-api:
	cd api && railway up

railway-deploy-web:
	cd web && railway up

railway-deploy-all:
	$(MAKE) -j 2 railway-deploy-api railway-deploy-web