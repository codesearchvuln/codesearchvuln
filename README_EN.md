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
- `offline-up.sh` now aggregates prerequisite detection for `docker`, `docker compose`, `zstd`, and `python3` before normal deployment work begins
- On supported Ubuntu / WSL Ubuntu hosts, missing prerequisites are auto-installed through Ubuntu apt mirrors with a domestic-first order (Aliyun, Tsinghua by default) and an official Ubuntu fallback
- Auto-install is limited to the supported Ubuntu / WSL Ubuntu hosts above; other distros only receive detection + manual remediation guidance and the script will not mutate host apt configuration
- Package installation success is not treated as deployment readiness: the script still verifies Docker daemon / socket / compose usability and will stop with explicit WSL / Docker guidance if readiness is still broken
- bundle filenames are fixed as `vulhunter-services-images-<arch>.tar.zst` and `vulhunter-scanner-images-<arch>.tar.zst`
- Both bundles must come from the same snapshot as the current release tree and must be placed in the release root or `images/`
- The release stack compose project name can be overridden with `VULHUNTER_RELEASE_PROJECT_NAME`; the default is `vulhunter-release`

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
If host prerequisite auto-install is triggered, that remediation + Docker readiness pass runs before bundle validation and image import.

## Common Maintenance Commands

```bash
docker compose ps
docker compose logs -f
bash ./scripts/offline-up.sh
docker compose down
docker compose down -v
```

`docker compose down -v` removes persistent volumes and should only be used when you intentionally want to wipe runtime data. For routine refresh or upgrade work, rerun `offline-up.sh` instead of treating plain `docker compose down` / `down -v` as the full maintenance flow.

## Real Ubuntu host smoke checklist

Run at least one validation round on a real `Ubuntu 22.04 / 24.04` host:

1. Temporarily remove one or more of `docker`, `docker compose`, `zstd`, or `python3`, and confirm `offline-up.sh` reports the missing prerequisites up front.
2. Confirm the script tries domestic Ubuntu apt mirrors first; then simulate mirror failure and confirm it falls back to the official Ubuntu mirrors.
3. Confirm the script still performs Docker readiness checks after package installation instead of treating package presence as success.
4. Repeat once on WSL Ubuntu and confirm the script stops with explicit guidance when Docker Desktop / socket integration is still missing.
5. Repeat once on an unsupported host (for example Debian) and confirm the script only prints manual remediation guidance and does not mutate host apt configuration.
6. Finish with one full offline deployment and confirm bundle validation, image import, backend/frontend readiness, and the `/nexus/` + `/nexus-item-detail/` probes all pass.
