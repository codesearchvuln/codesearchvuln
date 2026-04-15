# VulHunter Deployment Guide

This directory is the image-only VulHunter release runtime package. It ships `docker-compose.yml`, runtime env templates, frontend static assets, bundled `nexus-*` static pages, and offline helper scripts. It does not ship `backend` / `frontend` source code and does not support rebuilding the application inside the release package.

## 1. Supported Scope and Prerequisites

- Supported host environments: `Ubuntu 22.04 LTS`, `Ubuntu 24.04 LTS`, `Windows 10`, `Windows 11`, `Windows 10 WSL2 + Ubuntu 22.04 LTS`, `Windows 11 WSL2 + Ubuntu 22.04 LTS`
- `Windows 10/11` hosts must use `Docker Desktop` with Linux containers enabled
- Offline startup requires host-side `docker` and `zstd`; the `Bash/WSL` path also requires `python3`
- Supported browsers: `Safari`, `Chrome`, `Edge`
- Recommended baseline: `8 CPU cores`, `16 GB RAM`

Offline startup only covers runtime image preload and local tag switching. It does not make cloud LLM providers local. If your selected `LLM_PROVIDER` / `LLM_MODEL` still uses a cloud API, network connectivity is still required at runtime.

## 2. First-Time Configuration

Recommended first step from the release root:

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

At minimum, verify:

- `LLM_API_KEY`
- `LLM_PROVIDER`
- `LLM_MODEL`

If you launch the offline single-entry script without an existing `docker/env/backend/.env`, the script auto-copies it from `docker/env/backend/env.example` and continues. That convenience does not mean the deployment is production-ready; you still need to review the settings above.

## 3. Online Startup

```bash
docker compose up -d
```

Online startup uses the published runtime images directly. The main frontend is served by `STATIC_FRONTEND_IMAGE` plus the packaged static assets, and the bundled `nexus-*` pages remain available through the main frontend:

- `http://localhost:3000/`
- `http://localhost:3000/nexus/`
- `http://localhost:3000/nexus-item-detail/`

## 4. Offline Startup

Download both offline bundles matching your current Docker server architecture and place them in the release root or `images/`:

- `vulhunter-services-images-<arch>.tar.zst`
- `vulhunter-scanner-images-<arch>.tar.zst`

Choose exactly one shell path.

### Bash / WSL

Run in `WSL` or Linux `Bash`:

```bash
bash ./scripts/offline-up.sh
```

### Windows PowerShell

Run in native `Windows 10/11 PowerShell`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\offline-up.ps1
```

Do not mix Bash and PowerShell commands. Do not manually rewrite script execute permissions, do not broaden `/var/run/docker.sock` permissions, and do not treat first startup as `docker compose down` + retry.

The single-entry offline script will automatically:

- auto-copy `docker/env/backend/.env` from `env.example` if it is missing
- auto-copy `docker/env/backend/offline-images.env` from `offline-images.env.example` if it is missing
- validate `docker`, `docker compose`, manifests, and offline bundles
- load both `services` and `scanner` offline bundles
- switch runtime image overrides to `vulhunter-local/*`
- start `docker compose up -d`

`offline-images.env` usually needs no manual edit unless you want custom offline image overrides.

## 5. Offline Means / Does Not Mean

- Offline means: runtime image bundles are preloaded and runtime services switch to local image tags
- Offline does not mean: cloud LLM providers or APIs become local
- Frontend static assets and `nexus-*` pages are already packaged in the release tree and are not driven by frontend image overrides in `offline-images.env`
- Host prerequisites such as `docker`, `zstd`, and `python3` are still required

## 6. Retry, Restart, and Maintenance

Use the same single-entry command for:

- retrying a failed offline startup
- restarting after editing `docker/env/backend/.env`
- restarting after editing `docker/env/backend/offline-images.env`

Recommended retry command:

```bash
bash ./scripts/offline-up.sh
```

Or in `Windows PowerShell`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\offline-up.ps1
```

Follow logs:

```bash
docker compose logs -f
```

Stop services:

```bash
docker compose down
```

Remove services and persistent volumes:

```bash
docker compose down -v
```

`docker compose down -v` removes persistent data such as `postgres_data`, `backend_uploads`, `backend_runtime_data`, `scan_workspace`, and `redis_data`. Use it only when you intentionally want to delete runtime data.

## 7. Common Runtime Overrides

If you need to point the stack at custom runtime images or an existing environment, you can override these values in `docker/env/backend/.env`:

- `BACKEND_IMAGE`
- `POSTGRES_IMAGE`
- `REDIS_IMAGE`
- `ADMINER_IMAGE`
- `SCAN_WORKSPACE_INIT_IMAGE`
- `STATIC_FRONTEND_IMAGE`
- `SCANNER_*_IMAGE`
- `FLOW_PARSER_RUNNER_IMAGE`
- `SANDBOX_RUNNER_IMAGE`

`STATIC_FRONTEND_IMAGE` controls only the nginx base image for the packaged frontend static assets.

## 8. Service Endpoints

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- OpenAPI docs: `http://localhost:8000/docs`
- `nexus-web`: `http://localhost:${VULHUNTER_FRONTEND_PORT:-3000}/nexus/`
- `nexus-itemDetail`: `http://localhost:${VULHUNTER_FRONTEND_PORT:-3000}/nexus-item-detail/`

See [`scripts/README-COMPOSE.md`](scripts/README-COMPOSE.md) for Docker Compose operations and maintenance details.
