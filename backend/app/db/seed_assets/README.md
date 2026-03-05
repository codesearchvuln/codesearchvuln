# Seed Assets

These archives are used by the backend during database initialization and are imported as default demo projects.

## Built-in offline seed sources

1. `backend/app/db/seed_assets`
   - `libplist-2.7.0.zip`
   - Imported by `ensure_default_libplist_project(...)`.
2. `backend/tests/resources`
   - All `*.zip` files in this directory are imported by `ensure_default_test_resource_projects(...)`.
   - Current archives:
     - `DSVW-master.zip`
     - `DVWA-master.zip`
     - `JavaSecLab-1.4.zip`
     - `WebGoat-main.zip`
     - `fastjson.zip`
     - `govwa-master.zip`

## Runtime behavior

- On backend startup, `app/db/init_db.py` ensures default projects exist for the demo user.
- If a project ZIP is not stored yet, it imports from local archive files.
- With Docker Compose defaults:
  - Postgres data is persisted in `postgres_data`.
  - ZIP files are persisted in `backend_uploads` (`/app/uploads/zip_files`).
- Result: after `docker compose up --build` first import, the projects can be reused across restarts/rebuilds.

## Update procedure

1. Add or update local ZIP archives in `backend/app/db/seed_assets` or `backend/tests/resources`.
2. For known test resources, update `DEFAULT_TEST_RESOURCE_PROJECT_METADATA` in `app/db/init_db.py` to customize project name/description.
3. Run backend seed tests:
   - `pytest backend/tests/test_init_db_libplist_seed.py`
