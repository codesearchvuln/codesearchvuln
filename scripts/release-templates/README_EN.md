# VulHunter Deployment Guide

This directory is the generated release tree runtime package, not the source-repo runtime directory. Run the commands below only from this release root; do not reuse source-repo local-build, hybrid overlay, or `use-offline-env` style commands here.

The release branch is only the channel for the latest generated release tree. It is not a catalog of historical snapshots. If you are deploying offline, keep this release tree and the two offline tarballs from the same snapshot.

The default release backend image now always comes from the Docker `runtime-plain` target. Offline deployment no longer depends on `runtime-release` or any other selective source-hardening target; `runtime-cython` remains only as an extra optional hardened variant.

This is a breaking database-compatibility change: old `postgres_data` volumes are no longer expected to start successfully or auto-upgrade under a newer release. Back up the old database volume and `backend_uploads` before upgrading. The new release only supports empty-database bootstrap or restoring a snapshot that already matches the current version.

`online-up.sh` and `offline-up.sh` now refresh the current release stack instead of only starting it once. The default fixed Compose project name is `VULHUNTER_RELEASE_PROJECT_NAME=vulhunter-release`; the scripts only touch that release stack, and after online pulls or offline bundle prevalidation complete they stop and remove the current release-stack containers and their images, but never any Docker volumes.

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

Refresh the current release stack:

```bash
bash ./scripts/online-up.sh
```

The default backend refreshed here is also the `runtime-plain` artifact, not a release-only selective `.so` / Cython assembly path. The script pulls the current release images first, then cleans up the current `VULHUNTER_RELEASE_PROJECT_NAME=vulhunter-release` release-stack containers and images before starting again. It prints a bilingual ready banner only after local port `3000` is actually reachable. Online reruns pull again, but never remove volumes.

If you want the lower-level path, you can still run:

```bash
docker compose up -d
```

That path remains supported, but it is only the low-level `docker compose up -d`: it does not do the refresh pull-and-cleanup sequence and does not guarantee the unified ready prompt.

Check status:

```bash
docker compose ps
```

`http://localhost:3000/` only proves the static frontend entry is reachable. It does not prove the dashboard API proxy or the `nexus-*` static bundles are healthy. Release acceptance still requires checking same-origin `/api/v1/...`, `/nexus/`, `/nexus-item-detail/`, and the static assets they reference.
If the homepage does not come up at all, backend may be refusing to start because the database contract is incompatible, which also blocks frontend startup through `depends_on backend: service_healthy`.

## 4. Offline Deployment

Download both offline bundles for your current Docker server architecture, make sure they come from the same snapshot as this release tree, and place them in the release root or `images/`. End users still only need these two tarballs:

- `codesearchvuln-services-images-<arch>.tar.zst`
- `codesearchvuln-scanner-images-<arch>.tar.zst`

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
- validate the `services` and `scanner` tarball filename and SHA256 before cleaning up the current release stack, so the offline bundles match this release snapshot
- load the `services` and `scanner` offline bundles
- stop and remove only the current `VULHUNTER_RELEASE_PROJECT_NAME=vulhunter-release` release-stack containers and their images, never volumes and never other Compose projects
- run staged `docker compose up -d` again to restore the release stack
- wait for backend container health, then run host-side probes for frontend `/`, proxied `http://127.0.0.1/api/v1/openapi.json`, proxied `http://127.0.0.1/api/v1/projects/?skip=0&limit=1&include_metrics=true`, proxied `http://127.0.0.1/api/v1/projects/dashboard-snapshot?top_n=10&range_days=14`, `http://127.0.0.1/nexus/`, `http://127.0.0.1/nexus-item-detail/`, and the first JS/CSS assets referenced by those two bundle entry pages before reporting ready
- frontend readiness no longer depends on `sh` / `wget` being present inside the static frontend image
- the default mode stays detached; `--attach-logs` switches to foreground `docker compose up` after backend health turns green

If startup logs include `DB_SCHEMA_EMPTY`, `DB_SCHEMA_MISMATCH`, or `DB_SCHEMA_UNSUPPORTED_STATE`, do not keep trying to repair the old database in place. Recreate the `postgres_data` volume and bootstrap a fresh database, or restore a database snapshot that matches the current release.

If you want to inspect the offline image mapping, check:

- `docker/env/backend/offline-images.env`

After editing `.env` or `offline-images.env`, rerun the same offline command. Offline reruns still require both tar bundles to remain available in the release root or `images/`.

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
docker compose logs db redis scan-workspace-init db-bootstrap backend frontend --tail=100
curl -fsS http://localhost:3000/api/v1/openapi.json >/dev/null
curl -fsS http://localhost:3000/nexus/ >/dev/null
curl -fsS http://localhost:3000/nexus-item-detail/ >/dev/null
curl -i "http://localhost:3000/api/v1/projects/?skip=0&limit=1&include_metrics=true"
curl -i "http://localhost:3000/api/v1/projects/dashboard-snapshot?top_n=10&range_days=14"
```

For the project-list probe or dashboard probe, `200`, `401`, or `403` all mean the proxy path is still alive. `/nexus/` and `/nexus-item-detail/` returning `200` only prove the entry HTML is reachable; you still need the referenced JS/CSS assets to load successfully. `502`, `503`, or `504` mean the release frontend can no longer reach the backend through the bundled proxy contract.

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
For cross-version upgrades, back up `postgres_data` and `backend_uploads` first; do not treat `down -v` as a routine upgrade step.
For routine refresh / upgrade flows, rerun `bash ./scripts/online-up.sh` or `bash ./scripts/offline-up.sh`; plain `docker compose up -d` / `down` remain low-level Compose operations and do not perform the release refresh pre-pull or prevalidation-and-cleanup contract.

See [`scripts/README-COMPOSE.md`](scripts/README-COMPOSE.md) for more Docker Compose commands.
