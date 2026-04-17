# AuditTool Public Source Branch

This `sourcecode` branch is generated automatically from `main`. It is meant for publishing source code plus the full local-build path, without internal CI, planning artifacts, or release-packaging helpers.

## Quick Start

1. Prepare the backend environment file:

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

2. Detect the Docker / Podman socket automatically:

```bash
bash scripts/setup-env.sh
```

3. Start the stack with the only supported full local-build entrypoint:

```bash
docker compose -f docker-compose.yml -f docker-compose.full.yml up --build
```

You can also use the shortened `Makefile` commands:

```bash
make setup
make up-full
```

## Included

- `backend/`, `frontend/`, `docker/`, `data/`
- `nexus-web/`, `nexus-itemDetail/`
- the base `docker-compose.yml` plus the full local-build overlay `docker-compose.full.yml`
- `scripts/setup-env.sh`

## Removed

- `.github/`
- `docs/`
- `deploy/`
- the hybrid overlay and default-entrypoint helpers
- release, offline, fallback, and security helper scripts

## Contract

- The `sourcecode` branch is generated output and should not be maintained by hand.
- Change the generation logic on `main` whenever the public source tree needs to change.
