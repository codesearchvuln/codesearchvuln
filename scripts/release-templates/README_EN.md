# VulHunter Deployment Guide

This directory is the VulHunter release runtime package. Run the commands below from the release root.

## 1. Before You Start

- Supported hosts: `Ubuntu 22.04 LTS`, `Ubuntu 24.04 LTS`, `Windows 10`, `Windows 11`, `Windows 10 WSL2 + Ubuntu 22.04 LTS`, `Windows 11 WSL2 + Ubuntu 22.04 LTS`
- `Windows 10/11` must use `Docker Desktop` with Linux containers enabled
- Offline deployment requires: `docker`, `zstd`
- The `Bash/WSL` path also requires: `python3`
- Recommended browsers: `Safari`, `Chrome`, `Edge`

Choose exactly one shell path.

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

Check status:

```bash
docker compose ps
```

## 4. Offline Deployment

Download both offline bundles for your current Docker server architecture and place them in the release root or `images/`:

- `vulhunter-services-images-<arch>.tar.zst`
- `vulhunter-scanner-images-<arch>.tar.zst`

### Bash / WSL

Run in `WSL` or Linux `Bash`:

```bash
bash ./scripts/offline-up.sh
```

### Windows PowerShell

Run in native `Windows PowerShell`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\offline-up.ps1
```

Do not mix Bash and PowerShell commands. Do not manually change script execute permissions. Do not manually broaden Docker socket permissions.

The offline script will automatically:

- auto-copy missing `docker/env/backend/.env`
- auto-copy missing `docker/env/backend/offline-images.env`
- load the `services` and `scanner` offline bundles
- start `docker compose up -d`

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

## 6. Common Maintenance Commands

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
