# Deployment Guide
## Deployment Preparation

1. Copy the runtime environment file:

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

2. Review at least these variables:
   `LLM_API_KEY`, `LLM_PROVIDER`, `LLM_MODEL`

3. If you are preparing a deployment, also copy the image mapping template:

```bash
cp docker/env/backend/offline-images.env.example docker/env/backend/offline-images.env
```

If `.env` or `offline-images.env` is missing, the script will auto-create it from the template. You should still review the settings before a real deployment.
If you use a cloud model provider, runtime network access to that API is still required; deployment only makes the runtime images local.

## Supported Environments

- Hosts: `Ubuntu 22.04 LTS`, `Ubuntu 24.04 LTS`, `Windows 10 WSL2 + Ubuntu 22.04 LTS`, `Windows 11 WSL2 + Ubuntu 22.04 LTS`
- Required components: `docker`, `docker compose`
- deployment also requires: `zstd`, `python3`
- `Vulhunter-offline-bootstrap.sh --deploy` now delegates into the internal deploy worker that aggregates prerequisite detection for `docker`, `docker compose`, `zstd`, and `python3`
- On supported Ubuntu / WSL Ubuntu hosts, missing prerequisites are auto-installed through Ubuntu apt mirrors with a domestic-first order (Aliyun, Tsinghua by default) and an official Ubuntu fallback
- Auto-install is limited to the supported Ubuntu / WSL Ubuntu hosts above; other distros only receive detection + manual remediation guidance and the script will not mutate host apt configuration
- Package installation success is not treated as deployment readiness: the script still verifies Docker daemon / socket / compose usability and will stop with explicit WSL / Docker guidance if readiness is still broken
- bundle filenames are fixed as `vulhunter-services-images-<arch>.tar.zst` and `vulhunter-scanner-images-<arch>.tar.zst`
- Both bundles must come from the same snapshot as the current release tree and must be placed in the release root or `images/`
- The release stack compose project name can be overridden with `VULHUNTER_RELEASE_PROJECT_NAME`; the default is `vulhunter-release`

## Deployment Commands

### Deployment

```bash
bash ./Vulhunter-offline-bootstrap.sh --deploy
```

If you want startup logs attached in the terminal:

```bash
bash ./Vulhunter-offline-bootstrap.sh --deploy --attach-logs
```

The public entrypoint resolves the release root/archive first, then delegates into the internal deploy worker that validates the bundle filename and SHA256, imports the local images, and refreshes the same release stack.
If host prerequisite auto-install is triggered, that remediation + Docker readiness pass runs before bundle validation and image import.

## Common Maintenance Commands

```bash
docker compose ps
docker compose logs -f
bash ./Vulhunter-offline-bootstrap.sh --stop
bash ./Vulhunter-offline-bootstrap.sh --cleanup
bash ./Vulhunter-offline-bootstrap.sh --cleanup-all
docker compose down
docker compose down -v
```

`docker compose down -v` removes persistent volumes and should only be used when you intentionally want to wipe runtime data. For routine refresh / stop / cleanup work, use `Vulhunter-offline-bootstrap.sh --deploy|--stop|--cleanup|--cleanup-all` instead of treating plain `docker compose down` / `down -v` as the full maintenance flow.
