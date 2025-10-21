# Astradio MVP Development Makefile

.PHONY: help dev dev-infra smoke down clean rebuild logs test

# Default target
help:
	@echo "Astradio MVP Development Commands:"
	@echo ""
	@echo "  make dev        - Start full development stack (app + infra)"
	@echo "  make dev-infra  - Start only infrastructure (postgres, redis, minio)"
	@echo "  make smoke      - Run smoke tests"
	@echo "  make down       - Stop all services"
	@echo "  make clean      - Stop services and remove volumes"
	@echo "  make rebuild    - Clean rebuild of all services"
	@echo "  make logs       - Show logs for all services"
	@echo "  make test       - Run endpoint validation tests"
	@echo ""

# Start full development stack
dev:
	@echo "🚀 Starting full development stack..."
	docker compose -f docker-compose.dev.yml --profile app --profile infra up --build

# Start only infrastructure
dev-infra:
	@echo "🏗️ Starting infrastructure services..."
	docker compose -f docker-compose.dev.yml --profile infra up -d

# Run smoke tests
smoke:
	@echo "🔬 Running smoke tests..."
	@if [ -f "scripts/dev-smoke-test.sh" ]; then \
		chmod +x scripts/dev-smoke-test.sh && \
		./scripts/dev-smoke-test.sh; \
	elif [ -f "scripts/dev-smoke-test.ps1" ]; then \
		powershell -ExecutionPolicy Bypass -File scripts/dev-smoke-test.ps1; \
	else \
		echo "❌ No smoke test script found"; \
		exit 1; \
	fi

# Stop all services
down:
	@echo "🛑 Stopping all services..."
	docker compose -f docker-compose.dev.yml down

# Clean stop and remove volumes
clean:
	@echo "🧹 Cleaning up (stopping services and removing volumes)..."
	docker compose -f docker-compose.dev.yml down -v
	docker system prune -f

# Rebuild everything
rebuild: clean
	@echo "🔄 Rebuilding all services..."
	docker compose -f docker-compose.dev.yml --profile app --profile infra up --build

# Show logs
logs:
	@echo "📋 Showing logs for all services..."
	docker compose -f docker-compose.dev.yml logs -f

# Run endpoint validation tests
test:
	@echo "🧪 Running endpoint validation tests..."
	@if [ -f "scripts/validate-endpoints.ps1" ]; then \
		powershell -ExecutionPolicy Bypass -File scripts/validate-endpoints.ps1; \
	elif [ -f "scripts/validate-endpoints.sh" ]; then \
		chmod +x scripts/validate-endpoints.sh && \
		./scripts/validate-endpoints.sh; \
	else \
		echo "❌ No validation script found"; \
		exit 1; \
	fi

# Development shortcuts
dev-app:
	@echo "🚀 Starting app only (requires infra to be running)..."
	docker compose -f docker-compose.dev.yml --profile app up --build

dev-logs:
	@echo "📋 Showing app logs..."
	docker compose -f docker-compose.dev.yml logs -f app

dev-shell:
	@echo "🐚 Opening shell in app container..."
	docker compose -f docker-compose.dev.yml exec app bash

# CI targets
ci-build:
	@echo "🏗️ Building for CI..."
	docker build -f Dockerfile.dev -t astradio-dev .

ci-test: ci-build
	@echo "🧪 Running CI tests..."
	$(MAKE) smoke

# Production targets
prod-build:
	@echo "🏭 Building production image..."
	docker build -f Dockerfile.prod -t astradio-prod .

# Database targets
db-reset:
	@echo "🗄️ Resetting database..."
	docker compose -f docker-compose.dev.yml down postgres
	docker volume rm astradio-mvp_postgres-data || true
	docker compose -f docker-compose.dev.yml --profile infra up -d postgres

db-migrate:
	@echo "🔄 Running database migrations..."
	docker compose -f docker-compose.dev.yml run --rm migrations

# Storage targets
storage-reset:
	@echo "🗄️ Resetting storage..."
	docker compose -f docker-compose.dev.yml down minio
	docker volume rm astradio-mvp_minio-data || true
	docker compose -f docker-compose.dev.yml --profile infra up -d minio minio-init
