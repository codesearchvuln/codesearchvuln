# Deployment Guide
## Deployment Preparation

1. Copy the runtime environment file:

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

2. Review at least these variables:
   `LLM_API_KEY`, `LLM_PROVIDER`, `LLM_MODEL`

3. If you are preparing an deployment, also copy the image mapping template:

```bash
cp docker/env/backend/offline-images.env.example docker/env/backend/offline-images.env
```

If `.env` or `offline-images.env` is missing, the script will auto-create it from the template. You should still review the settings before a real deployment.
If you use a cloud model provider, runtime network access to that API is still required; deployment only makes the runtime images local.

## Supported Environments

- Hosts: `Ubuntu 22.04 LTS`, `Ubuntu 24.04 LTS`, `Windows 10 WSL2 + Ubuntu 22.04 LTS`, `Windows 11 WSL2 + Ubuntu 22.04 LTS`
- Required components: `docker`, `docker compose`
- deployment also requires: `zstd`, `python3`
- bundle filenames are fixed as `vulhunter-services-images-<arch>.tar.zst` and `vulhunter-scanner-images-<arch>.tar.zst`
- Both bundles must come from the same snapshot as the current release tree and must be placed in the release root or `images/`

## Deployment Commands

### Deployment

```bash
bash ./scripts/offline-up.sh
```

If you want startup logs attached in the terminal:

```bash
bash ./scripts/offline-up.sh --attach-logs
```

The entrypoint validates the bundle filename and SHA256 first, then imports the local images and refreshes the same release stack.

## Common Maintenance Commands

```bash
docker compose ps
docker compose logs -f
bash ./scripts/offline-up.sh
docker compose down
docker compose down -v
```

`docker compose down -v` removes persistent volumes and should only be used when you intentionally want to wipe runtime data. For routine refresh or upgrade work, rerun `offline-up.sh` instead of treating plain `docker compose down` / `down -v` as the full maintenance flow.
