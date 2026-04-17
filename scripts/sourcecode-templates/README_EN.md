# AuditTool Source Deployment Guide

This directory only documents the source-delivery deployment path. The only supported startup contract is the full local build with `docker-compose.yml` + `docker-compose.full.yml`. Do not reuse the release-package online/offline refresh scripts here.

## Deployment Preparation

1. Copy the backend environment file:

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

2. Review at least these variables:
   `LLM_API_KEY`, `LLM_PROVIDER`, `LLM_MODEL`

3. Generate the container socket settings in the root `.env`:

```bash
bash scripts/setup-env.sh
```

You can also use the shortcut:

```bash
make setup
```

## Supported Environments

- `docker compose`
- `podman compose`
- `make` auto-detects `docker compose`, `podman compose`, or `docker-compose`
- Every direct compose command must keep `-f docker-compose.yml -f docker-compose.full.yml`

## Deployment Command

Preferred full local build entrypoint:

```bash
docker compose -f docker-compose.yml -f docker-compose.full.yml up --build
```

If the host uses Podman:

```bash
podman compose -f docker-compose.yml -f docker-compose.full.yml up --build
```

If you prefer one wrapper command:

```bash
make up-full
```

## Common Maintenance Commands

```bash
make ps
make logs
make down
```

If you are not using `Makefile`, keep the same compose file set on every command:

```bash
docker compose -f docker-compose.yml -f docker-compose.full.yml ps
docker compose -f docker-compose.yml -f docker-compose.full.yml logs -f
docker compose -f docker-compose.yml -f docker-compose.full.yml down
```
