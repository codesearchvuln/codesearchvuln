SHELL := /bin/bash
.DEFAULT_GOAL := help

COMPOSE_FILES := -f docker-compose.yml -f docker-compose.full.yml

define DETECT_RUNTIME
	@if docker compose version >/dev/null 2>&1; then \
		COMPOSE_CMD="docker compose"; \
	elif podman compose version >/dev/null 2>&1; then \
		COMPOSE_CMD="podman compose"; \
	elif command -v docker-compose >/dev/null 2>&1; then \
		COMPOSE_CMD="docker-compose"; \
	else \
		echo "[ERROR] no compose tool found (docker compose / podman compose / docker-compose)" >&2; \
		exit 1; \
	fi
endef

.PHONY: help
help:
	@echo ""
	@echo "AuditTool public source branch"
	@echo "──────────────────────────────────────────────────────────"
	@echo "  make setup      Detect container runtime and write root .env"
	@echo "  make up-full    Full local build + startup"
	@echo "  make down       Stop and remove containers"
	@echo "  make logs       Follow service logs"
	@echo "  make ps         Show container status"
	@echo ""

.PHONY: setup
setup:
	@bash scripts/setup-env.sh

.PHONY: up-full
up-full:
	$(DETECT_RUNTIME); \
	$$COMPOSE_CMD $(COMPOSE_FILES) up --build

.PHONY: down
down:
	$(DETECT_RUNTIME); \
	$$COMPOSE_CMD $(COMPOSE_FILES) down

.PHONY: logs
logs:
	$(DETECT_RUNTIME); \
	$$COMPOSE_CMD $(COMPOSE_FILES) logs -f

.PHONY: ps
ps:
	$(DETECT_RUNTIME); \
	$$COMPOSE_CMD $(COMPOSE_FILES) ps
