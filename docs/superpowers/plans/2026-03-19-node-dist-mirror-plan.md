# Node Dist Mirror Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (preferred) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the backend scanner-tools-base stage to fetch Node tarballs/SHASUMS via configurable mirrors instead of hard-coding `nodejs.org`.

**Architecture:** Extend `backend/Dockerfile` with new build ARGs and reuse the existing `download_with_fallback` helper so Node sources respect the same multi-URL fallback flow as OG/YASA. Keep cache paths and hash verification untouched to minimize risk.

**Tech Stack:** Docker multi-stage build, bash, existing helper scripts/functions inside `backend/Dockerfile`.

---

### Task 1: Introduce Node dist mirror arguments and wiring

**Files:**
- Modify: `backend/Dockerfile` (ARG definitions near other backend build args, typically around lines 14-40)
- Modify: `docker-compose.yml` (backend build args block)
- Modify: any CI/build scripts that already pass `BACKEND_*` args (e.g., `.github/workflows/*` or pipeline templates) — keep consistent with compose

- [ ] **Step 1: Locate ARG block**  
Open `backend/Dockerfile` and find the global ARG declarations (e.g., `ARG BACKEND_INSTALL_YASA=1`, `ARG YASA_VERSION=...`). This ensures new args inherit defaults for every stage.

- [ ] **Step 2: Add Node mirror ARGs**  
Insert:
```dockerfile
ARG NODE_DIST_PRIMARY=${NODE_DIST_PRIMARY:-https://registry.npmmirror.com/-/binary/node}
ARG NODE_DIST_FALLBACK=${NODE_DIST_FALLBACK:-https://nodejs.org/dist}
```
Keep formatting consistent (one ARG per line). These should appear before the stage definitions so `scanner-tools-base` can access them.

- [ ] **Step 3: Thread args into scanner-tools-base**  
Within the `FROM runtime-base AS scanner-tools-base` section, repeat the ARG declarations (Docker requires re-declaring per stage). Place them alongside existing `ARG OPENGREP_VERSION` / `ARG BACKEND_INSTALL_YASA` lines.

- [ ] **Step 4: Wire through docker-compose / CI**  
Edit `docker-compose.yml` → backend service → `build.args` list to include:
```
        - NODE_DIST_PRIMARY=${NODE_DIST_PRIMARY:-https://registry.npmmirror.com/-/binary/node}
        - NODE_DIST_FALLBACK=${NODE_DIST_FALLBACK:-https://nodejs.org/dist}
```
Mirror this change in any CI/bake definitions that currently pass other backend args so enterprise builds can override via environment. Document the env var names in the relevant pipeline README if needed.

- [ ] **Step 5: Save/format**  
Ensure there are no trailing spaces and that ARG order is logical (e.g., Node args grouped near other tool mirrors). Do not run formatters.

### Task 2: Update download block to use mirrors

**Files:**
- Modify: `backend/Dockerfile` (RUN block that downloads Node source, around lines 320–420)

- [ ] **Step 1: Define helper vars / reuse existing ones**  
Inside the large `RUN --mount=type=cache...` block, after determining `YASA_TARBALL` variables, capture the existing pkg-fetch variables for Node. In the current script `nodeRepo`/`tarName` equivalents are derived by pkg-fetch; mirror that by introducing:
```sh
NODE_VERSION="v18.5.0"
NODE_TAR="node-${NODE_VERSION}.tar.gz"
NODE_TARBALL="/var/cache/vulhunter-tools/${NODE_TAR}"
NODE_SHASUM="/var/cache/vulhunter-tools/${NODE_TAR}.sha256sum"
```
If the Dockerfile already defines a `NODE_TAR` variable earlier, reuse it instead of redefining (ensuring architecture suffixes are preserved).

- [ ] **Step 2: Apply download_with_fallback**  
Replace the direct `curl` steps that fetch `SHASUMS256.txt` and `node-<version>.tar.gz` with:
```sh
download_with_fallback \
  "${NODE_SHASUM}" \
  "${NODE_DIST_PRIMARY}/${NODE_VERSION}/SHASUMS256.txt" \
  "${NODE_DIST_FALLBACK}/${NODE_VERSION}/SHASUMS256.txt"

download_with_fallback \
  "${NODE_TARBALL}" \
  "${NODE_DIST_PRIMARY}/${NODE_VERSION}/${NODE_TAR}" \
  "${NODE_DIST_FALLBACK}/${NODE_VERSION}/${NODE_TAR}"
```
Ensure empty values are skipped by guarding each URL (existing helper already handles missing files).

- [ ] **Step 3: Preserve caching and hashing**  
Keep subsequent `tar -xzf`, `hash`, and cleanup logic unchanged. Confirm variable names align so later references (e.g., to `nodeArchivePath`) still work. If pkg-fetch expects files in a specific folder, copy from cache after downloading.

- [ ] **Step 4: Add logging context**  
Optionally echo which mirror is in use:
```sh
echo "NODE_DIST_PRIMARY=${NODE_DIST_PRIMARY:-<default>}"
```
just before downloads, matching style used for other tools.

- [ ] **Step 5: Validate Dockerfile syntax**  
Run `docker buildx bake --print` or simply `docker compose config` to ensure ARG interpolation doesn’t break YAML/Compose usage (no actual build yet).

### Task 3: Compose build verification

**Files:**
- None (commands only), but exercise touches entire build graph.

- [ ] **Step 1: Clean previous caches if necessary**  
`docker builder prune --filter until=24h --force` to avoid stale layers hiding issues (optional but recommended).

- [ ] **Step 2: Build backend image**  
Run:
```bash
cd /home/xyf/AuditTool
docker compose --progress plain build backend \
  --build-arg NODE_DIST_PRIMARY=https://registry.npmmirror.com/-/binary/node \
  --build-arg NODE_DIST_FALLBACK=https://nodejs.org/dist
```
Expect downloads to log the mirror URL before pkg phase.

- [ ] **Step 3: Simulate offline fallback**  
Temporarily block `nodejs.org` (e.g., add to `/etc/hosts`) and rerun build with only the mirror arg to confirm success.

- [ ] **Step 4: Custom mirror override test**  
Override the arguments to an internal mirror (e.g., `--build-arg NODE_DIST_PRIMARY=https://intranet/node`), run the build, and capture logs showing that URL plus cache hits in `/var/cache/vulhunter-tools`.

- [ ] **Step 5: Hash-mismatch recovery**  
After a successful download, intentionally corrupt `${NODE_TARBALL}` (e.g., `printf 0 >/var/cache/...` inside the builder container) and rerun the build to confirm the script deletes the bad cache and re-downloads, surfacing the “Hash mismatch” log path.

- [ ] **Step 6: Primary failure / fallback test**  
Force the primary URL to return 404 (set it to `https://invalid` or block via hosts) while keeping fallback reachable; rerun the build and verify `download_with_fallback` logs the failure then succeeds via fallback.

- [ ] **Step 7: Document results**  
Record key excerpts from the build output showing successful mirror download and `pkg` completion. Use these in PR/commit notes.

- [ ] **Step 8: Commit artifacts**  
After verifying, stage `backend/Dockerfile`, the spec, and this plan if newly added:
```bash
git add backend/Dockerfile docs/superpowers/specs/2026-03-19-node-dist-mirror-design.md docs/superpowers/plans/2026-03-19-node-dist-mirror-plan.md
git commit -m "feat: add Node dist mirror fallback for YASA build"
```
