# VulHunter Deployment Guide

This package is used to deploy VulHunter with Docker Compose. It includes the startup configuration, environment templates, web UI static assets, and helper scripts required to launch the web interface, backend service, database, Redis, and the default runner components.

## 1. Quick Start

Copy the backend environment template before the first run:

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

Then set at least:

- `LLM_API_KEY`
- `LLM_PROVIDER`
- `LLM_MODEL`

If your deployment needs database, Redis, auth, or other runtime settings, update `docker/env/backend/.env` accordingly.

Once configured, start VulHunter with:

```bash
docker compose up -d
```

## 2. Configuration Overview

`docker/env/backend/.env` is the main runtime configuration file for VulHunter. Typical settings include:

- LLM provider and model
- API keys and endpoints
- database connection settings
- Redis connection settings
- scanner feature flags and image overrides

For a minimal first deployment, `LLM_API_KEY`, `LLM_PROVIDER`, and `LLM_MODEL` are usually enough to get started.

## 3. Online Deployment (Default)

```bash
docker compose up -d
```

By default, VulHunter pulls the required runtime images and starts the full stack. The main web UI static assets and the default nginx configuration are already included in this package; `STATIC_FRONTEND_IMAGE` provides the nginx base image that serves them. The deployment starts `db` and `redis`. The `nexus-web` / `nexus-itemDetail` pages are now served by mounting the local static bundles into the main frontend container instead of starting dedicated containers. Code execution now uses a single `SANDBOX_RUNNER_IMAGE`; the release contract no longer exposes a separate legacy sandbox image override.

## 4. Offline Deployment (Optional)

Download both matching offline bundles for your machine:

- `vulhunter-services-images-<arch>.tar.zst`
- `vulhunter-scanner-images-<arch>.tar.zst`

Place them in the release root or the `images/` directory, then run:

```bash
cp docker/env/backend/offline-images.env.example docker/env/backend/offline-images.env
./scripts/load-images.sh
./scripts/use-offline-env.sh docker compose up -d
```

Offline mode imports both `services` and `scanner` bundles first and then switches runtime services to local `vulhunter-local/*` tags, so the stack can start without pulling images from the network. The web UI and `nexus-*` static assets are still served from the files shipped in this package and are not included in the offline image bundles.

## 5. Run and Maintain

Follow logs:

```bash
docker compose logs -f
```

Stop the stack:

```bash
docker compose down
```

Stop and remove volumes:

```bash
docker compose down -v
```

After changing `.env` or `offline-images.env`, rerun `docker compose up -d` to apply the update.

## 6. Common Image Overrides

If you need to point the stack to custom images or an existing runtime environment, you can override these values in `docker/env/backend/.env`:

- `BACKEND_IMAGE`
- `POSTGRES_IMAGE`
- `REDIS_IMAGE`
- `ADMINER_IMAGE`
- `SCAN_WORKSPACE_INIT_IMAGE`
- `STATIC_FRONTEND_IMAGE`
- `SCANNER_*_IMAGE`
- `FLOW_PARSER_RUNNER_IMAGE`
- `SANDBOX_RUNNER_IMAGE`

`STATIC_FRONTEND_IMAGE` controls the nginx base image used to serve the packaged web UI static assets.

## 7. Service Endpoints

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- OpenAPI docs: `http://localhost:8000/docs`

See [`scripts/README-COMPOSE.md`](scripts/README-COMPOSE.md) for Docker Compose operations and maintenance details.
- `nexus-web`: `http://localhost:${VULHUNTER_FRONTEND_PORT:-3000}/nexus/`
- `nexus-itemDetail`: `http://localhost:${VULHUNTER_FRONTEND_PORT:-3000}/nexus-item-detail/`
