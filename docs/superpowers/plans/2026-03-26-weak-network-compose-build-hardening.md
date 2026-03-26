# Weak Network Compose Build Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the default `docker compose up --build` path more resilient on weak networks by unifying compose build args, reusing shared download helpers in backend/runner Dockerfiles, and aligning frontend install fallback behavior without changing runtime outputs.

**Architecture:** Keep the existing default compose entrypoint and startup gate intact, but move weak-network behavior into three layers: compose-level default build args, Dockerfile-level shared helper logic for apt/pip/archive downloads, and frontend/corepack install fallback alignment. Contract tests should lock the new env/build-arg surface before implementation, then focused Dockerfile/compose changes can satisfy those contracts.

**Tech Stack:** Docker Compose, Dockerfile multi-stage builds, POSIX shell helpers, pytest contract tests.

---

## Chunk 1: Contracts First

### Task 1: Capture the new compose weak-network surface

**Files:**
- Modify: `backend/tests/test_docker_compose_dev_flow.py`
- Test: `backend/tests/test_docker_compose_dev_flow.py`

- [ ] **Step 1: Write failing contract assertions for compose anchors/defaults**

```python
assert "x-backend-weak-network-build-args:" in compose_text
assert "BACKEND_PYPI_DOWNLOAD_TIMEOUT_SECONDS" in compose_text
assert "FRONTEND_NPM_REGISTRY_CANDIDATES" in compose_text
assert "FRONTEND_DOWNLOAD_RETRIES" in compose_text
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pytest backend/tests/test_docker_compose_dev_flow.py -k weak_network -q`
Expected: FAIL because the new compose args/anchors are not present yet.

- [ ] **Step 3: Extend existing compose contract coverage for default and full overlay files**

```python
assert "BACKEND_PYPI_INDEX_PRIMARY=${BACKEND_PYPI_INDEX_PRIMARY:-https://mirrors.aliyun.com/pypi/simple/}" in compose_text
assert "BUILD_WEAK_NETWORK=${BUILD_WEAK_NETWORK:-true}" in compose_text
```

- [ ] **Step 4: Re-run the focused test**

Run: `pytest backend/tests/test_docker_compose_dev_flow.py -k weak_network -q`
Expected: still FAIL, but with the desired missing-contract messages.

## Chunk 2: Backend / Runner Helper Contracts

### Task 2: Lock shared helper reuse and pinned-download expectations

**Files:**
- Modify: `backend/tests/test_docker_compose_dev_flow.py`
- Test: `backend/tests/test_docker_compose_dev_flow.py`

- [ ] **Step 1: Add failing assertions for helper reuse in backend and runner Dockerfiles**

```python
assert 'COPY docker/build-helpers/weak-network-common.sh /usr/local/bin/weak-network-common.sh' in backend_text
assert '. /usr/local/bin/weak-network-common.sh' in bandit_runner_text
assert 'BACKEND_PYPI_INDEX_FALLBACK=' in bandit_runner_text
```

- [ ] **Step 2: Add failing assertions for pinned tool downloads**

```python
assert "ARG PHPSTAN_VERSION=" in phpstan_runner_text
assert "releases/download/${PHPSTAN_VERSION}/phpstan.phar" in phpstan_runner_text
assert "releases/download/${YASA_UAST_VERSION}/" in backend_text
```

- [ ] **Step 3: Run the relevant test slice**

Run: `pytest backend/tests/test_docker_compose_dev_flow.py -k 'runner_dockerfiles or backend_runtime_python_tools' -q`
Expected: FAIL because helper sourcing and pinned URLs are not implemented yet.

## Chunk 3: Compose and Dockerfile Implementation

### Task 3: Unify compose weak-network build args

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.full.yml`
- Test: `backend/tests/test_docker_compose_dev_flow.py`

- [ ] **Step 1: Add top-level compose anchors for backend/frontend/sandbox weak-network build args**
- [ ] **Step 2: Switch affected `build.args` blocks to merged mappings with shared defaults**
- [ ] **Step 3: Ensure default compose and full overlay expose the same primary/fallback/candidates/timeout/retry env names**
- [ ] **Step 4: Run compose contract tests**

Run: `pytest backend/tests/test_docker_compose_dev_flow.py -k compose -q`
Expected: PASS for updated compose assertions.

### Task 4: Add shared backend weak-network helper and adopt it in Dockerfiles

**Files:**
- Create: `backend/docker/build-helpers/weak-network-common.sh`
- Modify: `backend/Dockerfile`
- Modify: `backend/docker/bandit-runner.Dockerfile`
- Modify: `backend/docker/flow-parser-runner.Dockerfile`
- Modify: `backend/docker/gitleaks-runner.Dockerfile`
- Modify: `backend/docker/phpstan-runner.Dockerfile`
- Modify: `backend/docker/pmd-runner.Dockerfile`
- Modify: `backend/docker/opengrep-runner.Dockerfile`
- Test: `backend/tests/test_docker_compose_dev_flow.py`

- [ ] **Step 1: Implement helper functions for candidate ordering, logging, apt config, and archive download retries**
- [ ] **Step 2: Source the helper in backend and runner Dockerfiles**
- [ ] **Step 3: Convert `bandit` and `flow-parser` to shared pip candidate/retry handling**
- [ ] **Step 4: Convert archive-download runners to shared URL candidate handling with cache reuse**
- [ ] **Step 5: Replace obvious `latest` download URLs with explicit version args where practical**
- [ ] **Step 6: Run focused Dockerfile contract tests**

Run: `pytest backend/tests/test_docker_compose_dev_flow.py -k 'runner_dockerfiles or backend_runtime_python_tools' -q`
Expected: PASS.

### Task 5: Align frontend install fallback behavior

**Files:**
- Modify: `frontend/Dockerfile`
- Test: `backend/tests/test_docker_compose_dev_flow.py`

- [ ] **Step 1: Add primary/fallback/candidate/timeout/retry args for corepack + pnpm fetch/install**
- [ ] **Step 2: Make `corepack prepare pnpm` use ranked registry candidates with finite retries**
- [ ] **Step 3: Keep `pnpm fetch -> offline/prefer-offline install` behavior, only tuning concurrency/timeouts/retries under weak-network mode**
- [ ] **Step 4: Run frontend-related contract tests**

Run: `pytest backend/tests/test_docker_compose_dev_flow.py -k frontend -q`
Expected: PASS.

## Chunk 4: Docs and Verification

### Task 6: Document the default weak-network behavior

**Files:**
- Modify: `README.md`
- Modify: `README_EN.md`
- Modify: `backend/README.md`
- Modify: `scripts/README-COMPOSE.md`

- [ ] **Step 1: Document the default `docker compose up --build` behavior and override env names**
- [ ] **Step 2: Explain cache reuse expectations after a failed first build**
- [ ] **Step 3: Mention that sandbox/tool profiles stay out of the default startup path**

### Task 7: Verify end-to-end contracts and compose rendering

**Files:**
- Test: `backend/tests/test_docker_compose_dev_flow.py`
- Test: `docker-compose.yml`
- Test: `docker-compose.full.yml`

- [ ] **Step 1: Run the full focused pytest module**

Run: `pytest backend/tests/test_docker_compose_dev_flow.py -q`
Expected: PASS.

- [ ] **Step 2: Validate default compose rendering**

Run: `docker compose config >/tmp/vulhunter-compose-default.yml`
Expected: command exits 0 and outputs a fully rendered compose file.

- [ ] **Step 3: Validate full overlay rendering**

Run: `docker compose -f docker-compose.yml -f docker-compose.full.yml config >/tmp/vulhunter-compose-full.yml`
Expected: command exits 0 and outputs a fully rendered compose file.

- [ ] **Step 4: Summarize any remaining gaps**

Run: `git diff --stat`
Expected: changed files match the intended scope only.
