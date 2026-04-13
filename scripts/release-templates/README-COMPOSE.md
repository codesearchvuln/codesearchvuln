# Release Compose Guide

This release snapshot is a runtime-only distribution.
It does not ship backend source code or frontend source code.
The only supported compose entrypoint is:

```bash
docker compose up
```

- `frontend`, `backend`, runner images, and sandbox use published digest-pinned OCI images.
- `nexus-web` and `nexus-itemDetail` still build locally from the bundled static runtime assets.
- `db` and `redis` use the standard public images referenced by `docker-compose.yml`.
- Override runtime image references with `BACKEND_IMAGE`, `FRONTEND_IMAGE`, `SANDBOX_IMAGE`, `SCANNER_*_IMAGE`, `FLOW_PARSER_RUNNER_IMAGE`, and `SANDBOX_RUNNER_IMAGE` when needed.

## Nexus Runtime Assets

- `nexus-web` is served from the bundled `dist/**` files on port `5174`
- `nexus-itemDetail` is served from the bundled `dist/**` files on port `5175`
- The runtime-only release flow does not restore legacy release artifact packaging or deploy overlays

## Backend Environment Bootstrap

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

Fill in at least:

- `LLM_API_KEY`
- `LLM_PROVIDER`
- `LLM_MODEL`
