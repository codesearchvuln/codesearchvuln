# VulHunter Deployment Guide

This directory is the generated release tree runtime package, not the source-repo runtime directory. Run the commands below only from this release root; do not reuse source-repo local-build, hybrid overlay, or `use-offline-env` style commands here.

The release branch is only the channel for the latest generated release tree. It is not a catalog of historical snapshots. If you are deploying offline, keep this release tree and the two offline tarballs from the same snapshot.

The default release backend image now always comes from the Docker `runtime-plain` target. Offline deployment no longer depends on `runtime-release` or any other selective source-hardening target; `runtime-cython` remains only as an extra optional hardened variant.

## 1. Before You Start

- Supported hosts: `Ubuntu 22.04 LTS`, `Ubuntu 24.04 LTS`, `Windows 10 WSL2 + Ubuntu 22.04 LTS`, `Windows 11 WSL2 + Ubuntu 22.04 LTS`
- Offline deployment requires: `docker`, `zstd`
- The `Bash/WSL` path also requires: `python3`
- Recommended browsers: `Safari`, `Chrome`, `Edge`

## 2. Configuration

Create the runtime config first:

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

At minimum, confirm:

- `LLM_API_KEY`
- `LLM_PROVIDER`
- `LLM_MODEL`

If you run the offline script before `.env` exists, the script will auto-copy it from the template. You still need to review the three settings above.

If your deployment uses a cloud model provider, runtime network access to that API is still required. Offline deployment only makes the runtime images local.

## 3. Online Deployment

Start the stack:

```bash
docker compose up -d
```

The default backend started here is also the `runtime-plain` artifact, not a release-only selective `.so` / Cython assembly path.

Check status:

```bash
docker compose ps
```

`http://localhost:3000/` only proves the static frontend is reachable. It does not prove the dashboard API proxy is healthy. Release acceptance still requires checking same-origin `/api/v1/...`.

## 4. Offline Deployment

Download both offline bundles for your current Docker server architecture, make sure they come from the same snapshot as this release tree, and place them in the release root or `images/`. End users still only need these two tarballs:

- `vulhunter-services-images-<arch>.tar.zst`
- `vulhunter-scanner-images-<arch>.tar.zst`

### Bash / WSL

Run in `WSL` or Linux `Bash`:

```bash
bash ./scripts/offline-up.sh
```

If you want startup logs attached in the terminal:

```bash
bash ./scripts/offline-up.sh --attach-logs
```

The offline path now supports `WSL` or Linux `Bash` only. Native `Windows PowerShell` is no longer part of the release contract.

The offline script will automatically:

- auto-copy missing `docker/env/backend/.env`
- auto-copy missing `docker/env/backend/offline-images.env`
- read the bundled `release-snapshot-lock.json`
- validate the `services` and `scanner` tarball filename and SHA256 before `docker load`, so the offline bundles match this release snapshot
- load the `services` and `scanner` offline bundles
- start `docker compose up -d`
- wait for backend `/health`, frontend `/`, and proxied `http://127.0.0.1/api/v1/openapi.json` before reporting ready
- the default mode stays detached; `--attach-logs` switches to foreground `docker compose up` after backend health turns green

If you want to inspect the offline image mapping, check:

- `docker/env/backend/offline-images.env`

After editing `.env` or `offline-images.env`, rerun the same offline command.

## 5. Access After Deployment

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- OpenAPI docs: `http://localhost:8000/docs`
- `nexus-web`: `http://localhost:${VULHUNTER_FRONTEND_PORT:-3000}/nexus/`
- `nexus-itemDetail`: `http://localhost:${VULHUNTER_FRONTEND_PORT:-3000}/nexus-item-detail/`

The main static assets and bundled `nexus-*` static pages are already included in the release package and served by the frontend service.

## 6. Post-Deploy Verification

Run at least these checks; do not stop at “the homepage opens”:

```bash
docker compose ps
docker compose logs backend frontend --tail=100
curl -fsS http://localhost:3000/api/v1/openapi.json >/dev/null
```

Optional dashboard proxy probe:

```bash
curl -i "http://localhost:3000/api/v1/projects/dashboard-snapshot?top_n=10&range_days=14"
```

For this dashboard probe, `200`, `401`, or `403` all mean the proxy path is still alive. `502`, `503`, or `504` mean the release frontend can no longer reach the backend through the bundled proxy contract.

## 7. Common Maintenance Commands

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

`docker compose down -v` removes persistent data. Use it only when you intentionally want to clear runtime data.

See [`scripts/README-COMPOSE.md`](scripts/README-COMPOSE.md) for more Docker Compose commands.
