# VulHunter Release Deployment Guide

This directory only documents the release-package deployment path. Every operation here is based on the local `docker-compose.yml` and `scripts/offline-up.sh`. Do not reuse `docker-compose.full.yml`, `docker-compose.hybrid.yml`, or source-repo local-build commands in this tree.
The generated release tree supports offline deployment only, does not support online deployment, and uses the fixed Compose project name `VULHUNTER_RELEASE_PROJECT_NAME=vulhunter-release`.

## Deployment Preparation

1. Copy the runtime environment file:

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

2. Review at least these variables:
   `LLM_API_KEY`, `LLM_PROVIDER`, `LLM_MODEL`

3. If you are preparing an offline deployment, also copy the offline image mapping template:

```bash
cp docker/env/backend/offline-images.env.example docker/env/backend/offline-images.env
```

If `.env` or `offline-images.env` is missing, the offline script will auto-create it from the template. You should still review the settings before a real deployment.
If you use a cloud model provider, runtime network access to that API is still required; offline deployment only makes the runtime images local.

## Supported Environments

- Hosts: `Ubuntu 22.04 LTS`, `Ubuntu 24.04 LTS`, `Windows 10 WSL2 + Ubuntu 22.04 LTS`, `Windows 11 WSL2 + Ubuntu 22.04 LTS`
- Required components: `docker`, `docker compose`
- Offline deployment also requires: `zstd`, `python3`
- Offline bundle filenames are fixed as `vulhunter-services-images-<arch>.tar.zst` and `vulhunter-scanner-images-<arch>.tar.zst`
- Both offline bundles must come from the same snapshot as the current release tree and must be placed in the release root or `images/`

## Deployment Commands

### Offline Deployment

```bash
bash ./scripts/offline-up.sh
```

If you want startup logs attached in the terminal:

```bash
bash ./scripts/offline-up.sh --attach-logs
```

The offline entrypoint validates the bundle filename and SHA256 first, then imports the local images and refreshes the same release stack.

## Common Maintenance Commands

```bash
docker compose ps
docker compose logs -f
bash ./scripts/offline-up.sh
docker compose down
docker compose down -v
```

`docker compose down -v` removes persistent volumes and should only be used when you intentionally want to wipe runtime data. For routine refresh or upgrade work, rerun `offline-up.sh` instead of treating plain `docker compose down` / `down -v` as the full maintenance flow.
