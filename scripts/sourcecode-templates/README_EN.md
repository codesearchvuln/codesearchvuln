# Deployment Guide
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
- Every direct compose command must keep `-f docker-compose.yml -f docker-compose.full.yml`

## Deployment Command

Preferred full local build entrypoint:

```bash
docker compose -f docker-compose.yml -f docker-compose.full.yml up --build
```

## Common Maintenance Commands

```bash
docker compose -f docker-compose.yml -f docker-compose.full.yml ps
docker compose -f docker-compose.yml -f docker-compose.full.yml logs -f
docker compose -f docker-compose.yml -f docker-compose.full.yml down
```
