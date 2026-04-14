# VulHunter Release Contract

<p align="center">
  <a href="README.md">简体中文</a> | <strong>English</strong>
</p>

The formal release flow now produces an image-only runtime tree. The generated release tree keeps only runtime compose files, environment templates, and static bundles. It does not ship `backend` / `frontend` source code and does not provide local-build overlays.

## Before You Start

1. Copy the backend environment file:

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

2. Fill in at least:
   `LLM_API_KEY`, `LLM_PROVIDER`, `LLM_MODEL`

3. Make sure Docker Compose is installed and the Docker daemon is reachable.

## Supported Startup Modes

### 1. Online deployment (default)

```bash
docker compose up -d
```

Use this when you want the core stack to start from published, digest-pinned `backend`, scanner runner, and `sandbox-runner` images. The main frontend is still served via `STATIC_FRONTEND_IMAGE` plus the packaged static assets.

### 2. Offline deployment (optional)

```bash
cp docker/env/backend/offline-images.env.example docker/env/backend/offline-images.env
./scripts/load-images.sh
./scripts/use-offline-env.sh docker compose up -d
```

Use this when you have preloaded the offline image bundle and want the same runtime stack to switch to local `vulhunter-local/*` tags, including a local `sandbox-runner` tag for code execution.

## Explicitly outside the release contract

- rebuilding `backend` / `frontend` images inside the release tree
- release delivery that depends on source bundles or local-build overlays
- any distribution model that expects backend or frontend source code in the release tree

## Endpoints

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- OpenAPI: `http://localhost:8000/docs`
- `nexus-web`: `http://localhost:5174`
- `nexus-itemDetail`: `http://localhost:5175`

See [`scripts/README-COMPOSE.md`](scripts/README-COMPOSE.md) for the compose contract.
