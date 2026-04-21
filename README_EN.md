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

The generated release tree now supports offline deployment only. It does not support online deployment and no longer ships `online-up.sh`.

### 1. Offline deployment

```bash
cp docker/env/backend/offline-images.env.example docker/env/backend/offline-images.env
bash ./scripts/offline-up.sh
```

If you want startup logs attached in the terminal:

```bash
bash ./scripts/offline-up.sh --attach-logs
```

Use this when you have preloaded the offline image bundle and want the same runtime stack to refresh onto local `vulhunter-local/*` tags, including a local `sandbox-runner` tag for code execution. The script validates the tar bundles first, then cleans up the current `VULHUNTER_RELEASE_PROJECT_NAME=vulhunter-release` release-stack containers and images without removing volumes. The offline path is now Bash/WSL-only; native Windows PowerShell is no longer part of the release contract. Offline reruns still require both tar bundles to remain available. The default mode stays detached; `--attach-logs` switches to foreground output after backend health turns green.

If you downloaded the semantic-release source archive instead of an already extracted release tree, you can also use the standalone bootstrap asset `Vulhunter-offline-bootstrap.sh` that is uploaded with the final semantic release. Put it in the same directory as `release_code.zip` or `release_code.tar.gz` and the two offline image bundles, then run:

```bash
bash ./Vulhunter-offline-bootstrap.sh
```

That helper only auto-discovers the files, extracts the `release_code` archive, moves the two `vulhunter-*.tar.zst` bundles into the release root, and then delegates to `bash ./scripts/offline-up.sh` inside the extracted release tree. Once you are already inside an extracted release tree, the canonical entrypoint remains `bash ./scripts/offline-up.sh`.

## Explicitly outside the release contract

- online deployment, or any startup flow that depends on `online-up.sh`
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
