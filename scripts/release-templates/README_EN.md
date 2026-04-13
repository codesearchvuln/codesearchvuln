# VulHunter User Guide

This release branch is intended for end users. Configure the environment and start the stack with:

```bash
cp docker/env/backend/env.example docker/env/backend/.env
docker compose up -d
```

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

## 2. Start and Stop

Start in the background:

```bash
docker compose up -d
```

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

## 3. Service Endpoints

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- OpenAPI docs: `http://localhost:8000/docs`
- `nexus-web`: `http://localhost:5174`
- `nexus-itemDetail`: `http://localhost:5175`

## 4. Common Adjustments

- If a port is already in use, update the relevant `ports` entry in `docker-compose.yml`
- To override runtime images, set `BACKEND_IMAGE`, `FRONTEND_IMAGE`, `SANDBOX_IMAGE`, `SCANNER_*_IMAGE`, `FLOW_PARSER_RUNNER_IMAGE`, or `SANDBOX_RUNNER_IMAGE` in `.env`
- After changing configuration, run `docker compose up -d` again to apply it

See [`scripts/README-COMPOSE.md`](scripts/README-COMPOSE.md) for compose-specific details.
