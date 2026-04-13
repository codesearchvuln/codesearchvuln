# Release Compose Guide

This release snapshot supports exactly two compose entrypoints.

## Default Release Path

```bash
docker compose up
```

- `backend`, runner images, and sandbox use published cloud images.
- `frontend` is served from the bundled local `dist/**` assets and `nginx.conf`; the release snapshot no longer ships frontend source.
- `nexus-web` and `nexus-itemDetail` still build locally from the bundled static runtime assets.
- `db` and `redis` use the standard public images referenced by `docker-compose.yml`.

## Hybrid Local-Build Path

```bash
docker compose -f docker-compose.yml -f docker-compose.hybrid.yml up --build
```

- Only `backend` is built locally.
- `frontend` keeps using the same bundled local `dist/**` assets and does not rebuild frontend source.
- `nexus-web` and `nexus-itemDetail` continue to use the base compose local-build exception.
- All runner, sandbox, and helper services continue to use cloud images.

## Bundled Runtime Assets

- `frontend` is served from the bundled `dist/**` files on port `3000`
- `nexus-web` is served from the bundled `dist/**` files on port `5174`
- `nexus-itemDetail` is served from the bundled `dist/**` files on port `5175`
- The slim release flow does not restore legacy release artifact packaging or deploy overlays

## Backend Environment Bootstrap

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

Fill in at least:

- `LLM_API_KEY`
- `LLM_PROVIDER`
- `LLM_MODEL`
