.PHONY: up stop build logs dev api-local web-local up-local up-all-local celery-worker celery-worker-alt db-pull db-generate db-sync

# Main Docker commands
up:
	docker-compose up -d

stop:
	docker-compose down

build:
	docker-compose down --volumes --remove-orphans
	docker-compose build --no-cache
	docker-compose up -d

logs:
	docker-compose logs -f

dev:
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
