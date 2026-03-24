# YASA Runner Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `YASA` 从 backend 容器内本地执行切换为一次性 runner 容器执行，并同步完成共享扫描工作目录、容器级取消语义、本地 full build 和发布链路改造。

**Architecture:** backend 继续负责任务创建、项目解压、runner 编排、SARIF 解析和数据库落库；`scanner_runner` 负责一次性容器生命周期；`yasa-runner` 镜像承载 `YASA` 运行时并通过 `/scan` 共享目录与 backend 交换输入输出。改造保持现有 API 路由和任务模型不变，不提供本地 fallback。

**Tech Stack:** FastAPI, SQLAlchemy AsyncSession, Docker SDK for Python, Docker Compose, GitHub Actions, Python 3.11, uv, pytest

---

### Task 1: Shared Workspace And Runner Lifecycle Foundation

**Files:**
- Create: `backend/app/services/scanner_runner.py`
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/api/v1/endpoints/static_tasks_shared.py`
- Test: `backend/tests/test_static_tasks_shared.py`
- Test: `backend/tests/test_scanner_runner.py`

- [ ] **Step 1: Write the failing tests for shared scan workspace helpers**

Add tests that expect:

```python
def test_ensure_scan_workspace_under_configured_root(...): ...
def test_ensure_scan_project_and_output_dirs_are_stable(...): ...
def test_cleanup_scan_workspace_removes_task_tree(...): ...
```

- [ ] **Step 2: Run the shared workspace tests to verify they fail**

Run:

```bash
cd /home/xyf/AuditTool/backend
uv run pytest tests/test_static_tasks_shared.py -v
```

Expected:
- FAIL because workspace helpers do not exist yet

- [ ] **Step 3: Write the failing tests for runner lifecycle and container registry**

Add tests that expect:

```python
def test_scan_container_registry_tracks_container_id(...): ...
def test_run_scanner_container_passes_mounts_env_and_command(...): ...
def test_stop_scan_container_handles_missing_container_gracefully(...): ...
```

- [ ] **Step 4: Run the runner tests to verify they fail**

Run:

```bash
cd /home/xyf/AuditTool/backend
uv run pytest tests/test_scanner_runner.py -v
```

Expected:
- FAIL because `scanner_runner.py` and container helpers do not exist yet

- [ ] **Step 5: Implement shared workspace settings and helpers**

In `backend/app/core/config.py` add:

```python
SCAN_WORKSPACE_ROOT: str = "/tmp/vulhunter/scans"
SCANNER_YASA_IMAGE: str = "vulhunter/yasa-runner:latest"
SCANNER_OPENGREP_IMAGE: str = "vulhunter/opengrep-runner:latest"
```

In `backend/app/api/v1/endpoints/static_tasks_shared.py` add:

```python
def ensure_scan_workspace(scan_type: str, task_id: str) -> Path: ...
def ensure_scan_project_dir(scan_type: str, task_id: str) -> Path: ...
def ensure_scan_output_dir(scan_type: str, task_id: str) -> Path: ...
def ensure_scan_logs_dir(scan_type: str, task_id: str) -> Path: ...
def ensure_scan_meta_dir(scan_type: str, task_id: str) -> Path: ...
def cleanup_scan_workspace(scan_type: str, task_id: str) -> None: ...
```

Also add container registry helpers:

```python
def _register_scan_container(scan_type: str, task_id: str, container_id: str) -> None: ...
def _pop_scan_container(scan_type: str, task_id: str) -> Optional[str]: ...
async def _stop_scan_container(scan_type: str, task_id: str) -> bool: ...
```

- [ ] **Step 6: Implement generic scanner runner abstraction**

Create `backend/app/services/scanner_runner.py` with:

```python
@dataclass
class ScannerRunSpec: ...

@dataclass
class ScannerRunResult: ...

async def run_scanner_container(spec: ScannerRunSpec) -> ScannerRunResult: ...
async def stop_scanner_container(container_id: str) -> bool: ...
```

Requirements:
- mount host workspace to container `/scan`
- support explicit command and environment
- write `stdout.log`, `stderr.log`, and `runner.json` under workspace
- return structured failure on timeout / Docker errors

- [ ] **Step 7: Run foundation tests and keep them green**

Run:

```bash
cd /home/xyf/AuditTool/backend
uv run pytest tests/test_static_tasks_shared.py tests/test_scanner_runner.py -v
```

Expected:
- PASS with new workspace + runner lifecycle behavior

### Task 2: Move YASA API And Bootstrap To Runner Execution

**Files:**
- Modify: `backend/app/services/yasa_runtime.py`
- Modify: `backend/app/api/v1/endpoints/static_tasks_yasa.py`
- Modify: `backend/app/services/agent/bootstrap/yasa.py`
- Test: `backend/tests/test_yasa_runtime.py`
- Test: `backend/tests/test_yasa_opengrep_static_tasks.py`
- Test: `backend/tests/test_yasa_runner_integration.py`

- [ ] **Step 1: Write the failing tests for runner-based YASA command building**

Add tests that expect runner-oriented paths such as:

```python
def test_build_yasa_scan_command_uses_runner_resource_dir(...): ...
def test_build_yasa_scan_command_targets_scan_output_report_dir(...): ...
```

- [ ] **Step 2: Run runtime tests to verify they fail**

Run:

```bash
cd /home/xyf/AuditTool/backend
uv run pytest tests/test_yasa_runtime.py -v
```

Expected:
- FAIL because command builder still assumes backend-local execution

- [ ] **Step 3: Write the failing tests for YASA API runner path**

Extend `backend/tests/test_yasa_opengrep_static_tasks.py` or add `backend/tests/test_yasa_runner_integration.py` with cases for:

```python
async def test_execute_yasa_scan_uses_scanner_runner_and_workspace(...): ...
async def test_execute_yasa_scan_marks_failed_when_runner_fails(...): ...
async def test_interrupt_yasa_task_stops_registered_container(...): ...
async def test_yasa_bootstrap_uses_scanner_runner(...): ...
```

- [ ] **Step 4: Run the YASA tests to verify they fail**

Run:

```bash
cd /home/xyf/AuditTool/backend
uv run pytest tests/test_yasa_opengrep_static_tasks.py tests/test_yasa_runtime.py tests/test_bandit_bootstrap_scanner.py -v
```

Expected:
- FAIL on the new YASA runner expectations

- [ ] **Step 5: Refactor YASA runtime helpers for container execution**

Update `backend/app/services/yasa_runtime.py` to expose runner-oriented helpers such as:

```python
YASA_RUNNER_BINARY = "/opt/yasa/bin/yasa"
YASA_RUNNER_RESOURCE_DIR = "/opt/yasa/resource"
def build_yasa_scan_command(...): ...
def build_yasa_rule_config_path(...): ...
```

- [ ] **Step 6: Switch `static_tasks_yasa.py` to runner execution**

Replace local `subprocess` path with:

```python
workspace = ensure_scan_workspace("yasa", task_id)
project_dir = ensure_scan_project_dir("yasa", task_id)
output_dir = ensure_scan_output_dir("yasa", task_id)
logs_dir = ensure_scan_logs_dir("yasa", task_id)
result = await run_scanner_container(...)
```

Requirements:
- use shared workspace instead of anonymous `tempfile` report dir
- register container id for interruption
- parse `/scan/output/report.sarif`
- runner failure marks task `failed`
- no `_resolve_yasa_binary()` fallback remains in backend execution path

- [ ] **Step 7: Switch bootstrap YASA scanner to runner execution**

Update `backend/app/services/agent/bootstrap/yasa.py` to reuse:
- shared workspace preparation
- runner execution
- shared SARIF parsing helper where practical

- [ ] **Step 8: Run YASA tests and keep them green**

Run:

```bash
cd /home/xyf/AuditTool/backend
uv run pytest tests/test_yasa_runtime.py tests/test_yasa_opengrep_static_tasks.py tests/test_main_recover_yasa.py -v
```

Expected:
- PASS with runner-based YASA behavior

### Task 3: Slim Backend Image And Add YASA Runner Image

**Files:**
- Modify: `backend/Dockerfile`
- Create: `backend/docker/yasa-runner.Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.full.yml`
- Modify: `.github/workflows/docker-publish.yml`
- Test: `backend/tests/test_docker_compose_dev_flow.py`

- [ ] **Step 1: Write the failing delivery-path tests**

Extend `backend/tests/test_docker_compose_dev_flow.py` to expect:

```python
def test_compose_exposes_scan_workspace_and_runner_image(): ...
def test_full_compose_builds_yasa_runner_image(): ...
def test_docker_publish_pushes_yasa_runner_image(): ...
def test_backend_runtime_no_longer_requires_local_yasa(): ...
```

- [ ] **Step 2: Run the delivery tests to verify they fail**

Run:

```bash
cd /home/xyf/AuditTool/backend
uv run pytest tests/test_docker_compose_dev_flow.py -v
```

Expected:
- FAIL because compose/workflow/backend image still assume backend-local YASA

- [ ] **Step 3: Remove backend-local YASA runtime assumptions**

In `backend/Dockerfile`:
- stop bundling backend runtime with required local YASA execution path
- keep Docker SDK and backend venv intact
- ensure backend image only needs shared workspace + docker socket

- [ ] **Step 4: Create the dedicated YASA runner image**

Add `backend/docker/yasa-runner.Dockerfile` that:
- installs YASA runtime and resources
- defaults to container-visible `/scan`
- is suitable for linux/amd64 and linux/arm64 builds

- [ ] **Step 5: Wire local compose and publish flow**

In `docker-compose.yml` and `docker-compose.full.yml`:
- add `SCAN_WORKSPACE_ROOT`
- add `SCANNER_YASA_IMAGE`
- mount `/tmp/vulhunter/scans`
- preserve `docker.sock` mount for backend
- add local build/image entry for `yasa-runner` in full compose

In `.github/workflows/docker-publish.yml`:
- add a `build_yasa_runner` input if needed
- build and push `ghcr.io/${{ github.repository_owner }}/vulhunter-yasa-runner:${{ github.event.inputs.tag }}`

- [ ] **Step 6: Run delivery tests and keep them green**

Run:

```bash
cd /home/xyf/AuditTool/backend
uv run pytest tests/test_docker_compose_dev_flow.py -v
```

Expected:
- PASS with runner-aware compose/workflow configuration

### Task 4: End-to-End Verification And Regression Sweep

**Files:**
- Modify: `backend/tests/test_yasa_runner_integration.py`
- Modify: `backend/tests/test_static_tasks_shared.py`
- Modify: `backend/tests/test_yasa_opengrep_static_tasks.py`

- [ ] **Step 1: Add focused regression tests for final acceptance criteria**

Ensure coverage for:

```python
async def test_runner_failure_does_not_fallback_to_local_yasa(...): ...
async def test_user_interrupt_prefers_container_stop(...): ...
def test_scan_workspace_cleanup_is_safe_for_missing_paths(...): ...
```

- [ ] **Step 2: Run the focused verification suite**

Run:

```bash
cd /home/xyf/AuditTool/backend
uv run pytest \
  tests/test_static_tasks_shared.py \
  tests/test_scanner_runner.py \
  tests/test_yasa_runtime.py \
  tests/test_yasa_opengrep_static_tasks.py \
  tests/test_main_recover_yasa.py \
  tests/test_docker_compose_dev_flow.py -v
```

Expected:
- PASS with no regressions in the targeted YASA runner Phase 1 area

- [ ] **Step 3: Run one broader backend safety sweep**

Run:

```bash
cd /home/xyf/AuditTool/backend
uv run pytest tests/test_bandit_bootstrap_scanner.py tests/test_code2flow_runtime.py tests/test_bandit_static_tasks.py -v
```

Expected:
- PASS to confirm the earlier backend venv changes still hold

