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

Use this when you want the core stack to refresh from published, digest-pinned `backend`, scanner runner, and `sandbox-runner` images. The main frontend is still served via `STATIC_FRONTEND_IMAGE` plus the packaged static assets. The script defaults to the fixed Compose project name `VULHUNTER_RELEASE_PROJECT_NAME=vulhunter-release`, pulls current release images first, then cleans up the current release-stack containers and images without removing volumes. It prints a bilingual ready banner only after local port `3000` is actually reachable.

If you want the lower-level path, you can still run:

```bash
docker compose up -d
```

That path remains supported, but it is only the low-level `docker compose up -d`: it does not perform the release refresh pre-pull and cleanup contract and does not guarantee the unified ready prompt.

### 2. Offline deployment (optional)

```bash
cp docker/env/backend/offline-images.env.example docker/env/backend/offline-images.env
bash ./scripts/offline-up.sh
```

If you want startup logs attached in the terminal:

```bash
bash ./scripts/offline-up.sh --attach-logs
```

Use this when you have preloaded the offline image bundle and want the same runtime stack to refresh onto local `vulhunter-local/*` tags, including a local `sandbox-runner` tag for code execution. The script validates the tar bundles first, then cleans up the current `VULHUNTER_RELEASE_PROJECT_NAME=vulhunter-release` release-stack containers and images without removing volumes. The offline path is now Bash/WSL-only; native Windows PowerShell is no longer part of the release contract. Offline reruns still require both tar bundles to remain available. The default mode stays detached; `--attach-logs` switches to foreground output after backend health turns green.

If you downloaded an unreleased GitHub release archive instead of an already extracted release tree, you can also use the standalone bootstrap asset `AuditTool-offline-bootstrap.sh` that is uploaded with the final semantic release. Put it in the same directory as `AuditTool-*.*.*.zip` or `AuditTool-*.*.*.tar.gz` and the two offline image bundles, then run:

```bash
bash ./AuditTool-offline-bootstrap.sh
```

That helper only auto-discovers the files, extracts the release archive, moves the two `vulhunter-*.tar.zst` bundles into the release root, and then delegates to `bash ./scripts/offline-up.sh` inside the extracted release tree. Once you are already inside an extracted release tree, the canonical entrypoint remains `bash ./scripts/offline-up.sh`.

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
