# VulHunter Release

This branch is an auto-generated runtime-only distribution snapshot from `main`.
It does not ship backend source code or frontend source code and does not support source-based rebuilds.
The only supported startup command is:

```bash
docker compose up
```

## Before You Start

Bootstrap the backend Docker env file before the first run:

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

Set at least:

- `LLM_API_KEY`
- `LLM_PROVIDER`
- `LLM_MODEL`

## Runtime Mode

- `backend`, `frontend`, runner images, and sandbox use published digest-pinned OCI images.
- `nexus-web` and `nexus-itemDetail` still build locally from the bundled static runtime assets.
- You can override the default runtime images with `BACKEND_IMAGE`, `FRONTEND_IMAGE`, `SANDBOX_IMAGE`, `SCANNER_*_IMAGE`, `FLOW_PARSER_RUNNER_IMAGE`, and `SANDBOX_RUNNER_IMAGE`.

## Nexus Runtime Assets

- The release snapshot keeps `nexus-web/dist/**`, `nexus-web/nginx.conf`, `nexus-itemDetail/dist/**`, and `nexus-itemDetail/nginx.conf`
- The runtime-only release flow does not restore the legacy release artifact or deploy script pipeline
- `nexus-web` listens on `http://localhost:5174` by default
- `nexus-itemDetail` listens on `http://localhost:5175` by default

## Endpoints

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- OpenAPI: `http://localhost:8000/docs`

See [`scripts/README-COMPOSE.md`](scripts/README-COMPOSE.md) for compose details.
