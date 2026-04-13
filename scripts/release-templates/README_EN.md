# VulHunter Release

This branch is an auto-generated latest slim-source release snapshot from `main`.
It supports exactly two startup commands:

```bash
docker compose up
```

```bash
docker compose -f docker-compose.yml -f docker-compose.hybrid.yml up --build
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

## Supported Modes

- `docker compose up`: `backend`, runner images, and sandbox use published cloud images; the main `frontend` plus `nexus-web` and `nexus-itemDetail` consume the bundled local runtime assets directly and no longer build or expose frontend source.
- `docker compose -f docker-compose.yml -f docker-compose.hybrid.yml up --build`: on top of the default path, only `backend` switches to a local build; the main `frontend` keeps using the same bundled `dist` mount, and `nexus-web` / `nexus-itemDetail` keep using the base compose local-build exception.

## Runtime Assets

- The release snapshot keeps `frontend/dist/**` and `frontend/nginx.conf`
- The release snapshot keeps `nexus-web/dist/**`, `nexus-web/nginx.conf`, `nexus-itemDetail/dist/**`, and `nexus-itemDetail/nginx.conf`
- The release snapshot no longer publishes frontend source and ships only bundled runtime assets for deployment
- The slim release flow does not restore the legacy release artifact or deploy script pipeline
- `frontend` listens on `http://localhost:3000` by default
- `nexus-web` listens on `http://localhost:5174` by default
- `nexus-itemDetail` listens on `http://localhost:5175` by default

## Endpoints

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- OpenAPI: `http://localhost:8000/docs`

See [`scripts/README-COMPOSE.md`](scripts/README-COMPOSE.md) for compose details.
