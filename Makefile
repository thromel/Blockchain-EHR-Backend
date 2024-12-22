.PHONY: help install build test clean docker-build docker-up docker-down docker-logs deploy

# Default target
.DEFAULT_GOAL := help

# Variables
DOCKER_COMPOSE := docker-compose
DOCKER_COMPOSE_DEV := $(DOCKER_COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml
NPM := npm

## help: Display this help message
help:
	@echo "Available commands:"
	@grep -E '^##' $(MAKEFILE_LIST) | sed 's/## //g'

## install: Install dependencies
install:
	$(NPM) install

## build: Build TypeScript and compile contracts
build:
	$(NPM) run build
	npx hardhat compile

## test: Run all tests
test:
	npx hardhat test

## test-contracts: Run contract tests only
test-contracts:
	npx hardhat test test/contracts/

## test-e2e: Run E2E tests only
test-e2e:
	npx hardhat test test/e2e/WorkingE2E.test.js

## lint: Run linter
lint:
	$(NPM) run lint || echo "Lint not configured"

## format: Format code
format:
	$(NPM) run format || echo "Format not configured"

## clean: Clean build artifacts
clean:
	rm -rf dist/
	rm -rf artifacts/
	rm -rf cache/
	rm -rf node_modules/

## docker-build: Build Docker image
docker-build:
	docker build -t blockchain-ehr-backend:latest .

## docker-up: Start all services with Docker Compose
docker-up:
	$(DOCKER_COMPOSE) up -d

## docker-up-dev: Start all services in development mode
docker-up-dev:
	$(DOCKER_COMPOSE_DEV) up

## docker-down: Stop all services
docker-down:
	$(DOCKER_COMPOSE) down

## docker-down-volumes: Stop all services and remove volumes
docker-down-volumes:
	$(DOCKER_COMPOSE) down -v

## docker-logs: View logs from all services
docker-logs:
	$(DOCKER_COMPOSE) logs -f

## docker-logs-backend: View backend logs only
docker-logs-backend:
	$(DOCKER_COMPOSE) logs -f backend

## docker-ps: List running containers
docker-ps:
	$(DOCKER_COMPOSE) ps

## migrate: Run database migrations
migrate:
	$(NPM) run migrate

## deploy: Deploy contracts to blockchain
deploy:
	$(NPM) run deploy

## shell-backend: Open shell in backend container
shell-backend:
	$(DOCKER_COMPOSE) exec backend sh

## shell-db: Open PostgreSQL shell
shell-db:
	$(DOCKER_COMPOSE) exec postgres psql -U postgres -d Blockchain-Healthcare

## ci: Run CI pipeline locally
ci: install build test

## prod-build: Build production Docker image
prod-build:
	docker build --target production -t blockchain-ehr-backend:prod .

## security-scan: Run security audit
security-scan:
	$(NPM) audit
	docker scan blockchain-ehr-backend:latest || echo "Docker scan not available"

## start-with-ipfs: Start all services including IPFS
start-with-ipfs:
	$(DOCKER_COMPOSE) --profile with-ipfs up -d

## start-with-pgadmin: Start all services including PgAdmin
start-with-pgadmin:
	$(DOCKER_COMPOSE) --profile with-pgadmin up -d

## start-all: Start all services including optional ones
start-all:
	$(DOCKER_COMPOSE) --profile with-ipfs --profile with-pgadmin up -d
