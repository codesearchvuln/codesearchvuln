# Deployment Guide

> This source snapshot is provided under the repository license; separate commercial delivery/support terms may apply outside the license.

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

## Supported Environments

- `docker compose`
- The sourcecode branch exposes only the full Docker Compose deployment route: root `docker-compose.yml`

## Deployment Command

Prefer the source branch script; it prepares `.env`, then runs the full local build and startup:

```bash
./start-local-services.sh
```

You can also use the single Compose file directly:

```bash
docker compose up --build
```

## Common Maintenance Commands

```bash
./stop-local-services.sh
docker compose ps
docker compose logs -f
docker compose down
```
