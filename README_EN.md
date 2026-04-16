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
bash ./scripts/online-up.sh
```

Use this when you want the core stack to start from published, digest-pinned `backend`, scanner runner, and `sandbox-runner` images. The main frontend is still served via `STATIC_FRONTEND_IMAGE` plus the packaged static assets. The script prints a bilingual ready banner after local port `3000` is actually reachable.

If you want the lower-level path, you can still run:

```bash
docker compose up -d
```

That path remains supported, but it does not guarantee the unified ready prompt.

### 2. Offline deployment (optional)

```bash
cp docker/env/backend/offline-images.env.example docker/env/backend/offline-images.env
bash ./scripts/offline-up.sh
```

If you want startup logs attached in the terminal:

```bash
bash ./scripts/offline-up.sh --attach-logs
```

Use this when you have preloaded the offline image bundle and want the same runtime stack to switch to local `vulhunter-local/*` tags, including a local `sandbox-runner` tag for code execution. The offline path is now Bash/WSL-only; native Windows PowerShell is no longer part of the release contract. The default mode stays detached; `--attach-logs` switches to foreground output after backend health turns green.

## Explicitly outside the release contract

- rebuilding `backend` / `frontend` images inside the release tree
- release delivery that depends on source bundles or local-build overlays
- any distribution model that expects backend or frontend source code in the release tree

## Endpoints

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- OpenAPI: `http://localhost:8000/docs`
- `nexus-web` page: `http://localhost:3000/nexus/`
- `nexus-itemDetail` page: `http://localhost:3000/nexus-item-detail/`

See [`scripts/README-COMPOSE.md`](scripts/README-COMPOSE.md) for the compose contract.
