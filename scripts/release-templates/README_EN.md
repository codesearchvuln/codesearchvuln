# VulHunter User Guide

This release tree is an image-only runtime package for end users. It ships only the runtime compose contract, environment templates, and static bundles. It does not include `backend` / `frontend` source trees and does not support rebuilding those images inside the release tree.

## 1. Initial Configuration

Copy the backend environment template before the first run:

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

Set at least:

- `LLM_API_KEY`
- `LLM_PROVIDER`
- `LLM_MODEL`

If your deployment needs database, Redis, auth, or other runtime settings, edit `docker/env/backend/.env` accordingly.

## 2. Online Deployment (Default)

```bash
docker compose up -d
```

This pulls digest-pinned runtime images for `backend`, `frontend`, sandbox, and runners. The release tree still provides the compose definition for `db`, `redis`, and the two bundled nexus static sites.

## 3. Offline Deployment (Optional)

Download the matching `vulhunter-images-<arch>.tar.zst` bundle for your machine and place it in the release root or the `images/` directory, then run:

```bash
cp docker/env/backend/offline-images.env.example docker/env/backend/offline-images.env
./scripts/load-images.sh
./scripts/use-offline-env.sh docker compose up -d
```

Offline mode switches runtime images to local `vulhunter-local/*` tags after the preload step.

## 4. Run and Maintain

Follow logs:

```bash
docker compose logs -f
```

Stop the stack:

```bash
docker compose down
```

Stop and remove volumes:

```bash
docker compose down -v
```

After changing `.env` or `offline-images.env`, rerun `docker compose up -d` to apply the update.

## 5. Release Contract

- The formal release tree exposes only one compose entrypoint: `docker-compose.yml`
- `backend`, `frontend`, and runner images are prebuilt by the release pipeline and pinned by digest
- `nexus-web` and `nexus-itemDetail` are assembled locally only from the bundled static assets
- local-build overlays, Dockerfiles, and source distribution tarballs are outside this release contract

## 6. Service Endpoints

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- OpenAPI docs: `http://localhost:8000/docs`
- `nexus-web`: `http://localhost:5174`
- `nexus-itemDetail`: `http://localhost:5175`

See [`scripts/README-COMPOSE.md`](scripts/README-COMPOSE.md) for compose-specific details.
