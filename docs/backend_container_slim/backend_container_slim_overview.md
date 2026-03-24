# Backend Container Slim Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `backend` 从“API + 本地扫描执行器 + 重型运行时集合”收敛为“API 编排层 + 少量本地运行时”，第一阶段先拆出 `YASA` runner，并为后续 `opengrep` 缓存迁移和其他扫描器 runner 化建立统一基础设施。

**Architecture:** backend 继续负责任务创建、状态流转、结果解析和数据库落库；runner 容器负责读取共享工作目录中的输入、执行单一扫描器并写出结果。第一波仅迁移最重的 `YASA`，`opengrep` 保持现状但提前把工作目录和执行抽象统一，避免二次返工。

**Tech Stack:** FastAPI, SQLAlchemy AsyncSession, Docker Engine API, Docker Compose, multi-stage Dockerfile, Python 3.11, uv, pytest

---

## Context And Constraints

- 当前本地基线：
  - `vulhunter/backend-dev:latest` 约 `3.19GB`
  - `/opt/backend-venv` 约 `839M`
  - `/opt/yasa` 约 `747M`
  - backend 镜像内 `opengrep` 预热缓存约 `208M`
- 已确认的产品/实施约束：
  - 采用分阶段改造，不做一次性全量拆分
  - runner 采用“按任务临时拉起容器”，不做常驻 sidecar
  - 第一波只拆 `YASA`
  - `opengrep` 预热缓存必须保留，但后续迁移到 runner 镜像，不继续长期留在 backend
  - backend 中所有依赖 Python 环境的工具统一安装到 `/opt/backend-venv`，不再额外走系统 `pip`
  - 所有 backend 内扫描任务、bootstrap 扫描和 `code2flow` 运行时探测/执行都必须显式使用 `/opt/backend-venv/bin/*`
  - 最终 backend 镜像中移除系统 `pip` 与全局 `site-packages` 残留，避免扫描链路意外回退到系统 Python 包
  - Python 验证命令统一使用 `uv run`
- 当前关键代码路径：
  - 静态扫描 API：`backend/app/api/v1/endpoints/static_tasks_*.py`
  - 静态扫描公共逻辑：`backend/app/api/v1/endpoints/static_tasks_shared.py`
  - Agent bootstrap：`backend/app/services/agent/bootstrap/*.py`
  - Agent 外部工具：`backend/app/services/agent/tools/external_tools.py`
  - Docker 构建：`backend/Dockerfile`
  - 运行编排：`docker-compose.yml`, `docker-compose.full.yml`
  - 发布流程：`.github/workflows/docker-publish.yml`

## File Structure

### New Files

- Create: `backend/app/services/scanner_runner.py`
  - 统一封装一次性 runner 容器的启动、停止、结果定位、错误格式化
- Create: `backend/tests/test_scanner_runner.py`
  - 覆盖 runner 启动参数、共享工作目录、容器中断语义
- Create: `backend/tests/test_yasa_runner_integration.py`
  - 覆盖 `YASA` 静态扫描 API 和 bootstrap 切换后的 runner 路径
- Create: `backend/docker/yasa-runner.Dockerfile`
  - `YASA` 专用 runner 镜像，只保留运行时产物

### Modified Files

- Modify: `backend/app/core/config.py`
  - 增加 `SCAN_WORKSPACE_ROOT`、`SCANNER_YASA_IMAGE`、后续预留 `SCANNER_OPENGREP_IMAGE`
- Modify: `backend/app/api/v1/endpoints/static_tasks_shared.py`
  - 将项目解压目录、临时规则/报告目录切换到共享工作目录，并引入 runner/container 级任务取消跟踪
- Modify: `backend/app/api/v1/endpoints/static_tasks.py`
  - 绑定新的 runner 执行能力，保持已有 API 路由不变
- Modify: `backend/app/api/v1/endpoints/static_tasks_yasa.py`
  - 将本地 `subprocess` 执行切换为 runner 容器执行
- Modify: `backend/app/services/yasa_runtime.py`
  - 调整为适配 runner 输出与共享路径，不再假设 backend 本地有 `/opt/yasa`
- Modify: `backend/app/services/agent/bootstrap/yasa.py`
  - 将 bootstrap 的 `YASA` 执行切换到 runner 容器
- Modify: `backend/Dockerfile`
  - 将 `YASA` 从 backend 镜像中移除，并进一步区分 build artifact / runtime artifact
- Modify: `docker-compose.yml`
  - 增加 `SCANNER_YASA_IMAGE` 环境透传与共享扫描工作目录挂载
- Modify: `docker-compose.full.yml`
  - 对齐 full build 本地构建与共享目录设置
- Modify: `.github/workflows/docker-publish.yml`
  - 增加 `YASA` runner 镜像构建与发布

### Existing Tests To Extend

- Test: `backend/tests/test_static_tasks_shared.py`
- Test: `backend/tests/test_yasa_implementation.py`
- Test: `backend/tests/test_yasa_runtime.py`
- Test: `backend/tests/test_yasa_opengrep_static_tasks.py`
- Test: `backend/tests/test_agent_opengrep_bootstrap.py`
- Test: `backend/tests/test_docker_compose_dev_flow.py`

## Implementation Strategy

- Phase 1 只做 `YASA` runner 化和 backend 本体瘦身，不改变外部 API。
- Phase 2 预埋 `opengrep` runner 能力，但不在第一波切换流量。
- 所有 scanner runner 统一遵循以下契约：
  - backend 在共享工作目录创建输入目录和输出目录
  - runner 仅消费这些目录
  - backend 在 DB 中保存 task 状态，runner 不接数据库
  - 中断动作通过 container id 而不是本地 PID 完成
- 所有新增/修改测试均使用 `uv run pytest ...`

## Task 1: 建立共享扫描工作目录与容器级取消语义

**Files:**
- Create: `backend/app/services/scanner_runner.py`
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/api/v1/endpoints/static_tasks_shared.py`
- Test: `backend/tests/test_static_tasks_shared.py`
- Test: `backend/tests/test_scanner_runner.py`

- [ ] **Step 1: 为配置增加共享工作目录与 runner 镜像配置**

在 `backend/app/core/config.py` 中增加：

```python
SCAN_WORKSPACE_ROOT: str = "/tmp/vulhunter/scans"
SCANNER_YASA_IMAGE: str = "vulhunter/yasa-runner:latest"
SCANNER_OPENGREP_IMAGE: str = "vulhunter/opengrep-runner:latest"
```

- [ ] **Step 2: 为静态扫描引入统一工作目录工具函数**

在 `backend/app/api/v1/endpoints/static_tasks_shared.py` 中新增或收敛：

```python
def ensure_scan_workspace(task_id: str) -> Path: ...
def ensure_scan_input_dir(task_id: str) -> Path: ...
def ensure_scan_output_dir(task_id: str) -> Path: ...
def cleanup_scan_workspace(task_id: str) -> None: ...
```

要求：
- 路径位于 `settings.SCAN_WORKSPACE_ROOT`
- 不再把临时目录散落在 backend 容器匿名 `/tmp`
- 可被 runner 容器通过 bind mount 读取

- [ ] **Step 3: 将项目 ZIP 解压逻辑切换到共享工作目录**

把 `_get_project_root()` 内的：

```python
temp_dir = tempfile.mkdtemp(prefix=f"VulHunter_{project_id}_")
```

改为基于共享目录创建稳定路径，例如：

```python
temp_dir = str(ensure_scan_workspace(project_id) / "project")
```

要求：
- 保持现有“自动剔除 test-like 目录”逻辑
- 保持现有单子目录展开语义

- [ ] **Step 4: 将取消跟踪从本地 PID 扩展为容器 ID**

在 `backend/app/api/v1/endpoints/static_tasks_shared.py` 中为扫描任务维护：

```python
_static_running_scan_containers: Dict[str, str] = {}
```

并增加：

```python
def _register_scan_container(...): ...
def _pop_scan_container(...): ...
def _stop_scan_container(...): ...
```

要求：
- 保留现有 `subprocess` 取消路径，避免回归
- 新 runner 路径优先 stop/remove 容器

- [ ] **Step 5: 为 runner 抽象编写最小测试**

在 `backend/tests/test_scanner_runner.py` 中至少覆盖：

```python
def test_ensure_scan_workspace_under_configured_root(): ...
def test_scan_container_registry_tracks_container_id(): ...
def test_stop_scan_container_handles_missing_container_gracefully(): ...
```

- [ ] **Step 6: 运行测试验证共享目录与取消逻辑**

Run:

```bash
cd /home/xyf/AuditTool/backend
uv run pytest tests/test_static_tasks_shared.py tests/test_scanner_runner.py -v
```

Expected:
- 新测试全部通过
- 现有 `static_tasks_shared` 相关测试不回归

- [ ] **Step 7: Commit**

```bash
git add backend/app/core/config.py \
  backend/app/api/v1/endpoints/static_tasks_shared.py \
  backend/app/services/scanner_runner.py \
  backend/tests/test_static_tasks_shared.py \
  backend/tests/test_scanner_runner.py
git commit -m "refactor: add shared scanner workspace and runner lifecycle"
```

## Task 2: 实现通用一次性 scanner runner 抽象

**Files:**
- Modify: `backend/app/services/scanner_runner.py`
- Test: `backend/tests/test_scanner_runner.py`

- [ ] **Step 1: 写 runner 输入/输出数据结构**

在 `backend/app/services/scanner_runner.py` 中定义：

```python
@dataclass
class ScannerRunSpec:
    scanner_type: str
    image: str
    workspace_dir: str
    command: list[str]
    timeout_seconds: int
    env: dict[str, str]

@dataclass
class ScannerRunResult:
    success: bool
    container_id: str | None
    exit_code: int
    stdout_path: str | None
    stderr_path: str | None
    error: str | None
```

- [ ] **Step 2: 实现启动一次性容器的执行入口**

增加：

```python
async def run_scanner_container(spec: ScannerRunSpec) -> ScannerRunResult: ...
async def stop_scanner_container(container_id: str) -> None: ...
```

要求：
- 使用 Docker SDK 或统一封装
- bind mount `workspace_dir` 到容器内 `/scan`
- stdout/stderr 定向到 `workspace_dir/logs`
- 超时后返回统一错误结果

- [ ] **Step 3: 将容器 ID 注册到共享取消表**

`run_scanner_container()` 在容器创建成功后，必须把 `container_id` 暴露给调用侧，以便后续中断接口复用。

- [ ] **Step 4: 为 runner 执行编写单元测试**

新增测试至少覆盖：

```python
def test_scanner_run_spec_defaults_are_explicit(): ...
def test_runner_result_exposes_container_and_log_paths(): ...
def test_runner_timeout_returns_failed_result(monkeypatch): ...
```

- [ ] **Step 5: 运行测试**

Run:

```bash
cd /home/xyf/AuditTool/backend
uv run pytest tests/test_scanner_runner.py -v
```

Expected:
- 所有 runner 抽象测试通过

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/scanner_runner.py backend/tests/test_scanner_runner.py
git commit -m "feat: add generic scanner runner abstraction"
```

## Task 3: 新建 YASA runner 镜像并裁剪运行时产物

**Files:**
- Create: `backend/docker/yasa-runner.Dockerfile`
- Modify: `backend/Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.full.yml`
- Modify: `.github/workflows/docker-publish.yml`
- Test: `backend/tests/test_docker_compose_dev_flow.py`

- [ ] **Step 1: 新建专用 YASA runner Dockerfile**

在 `backend/docker/yasa-runner.Dockerfile` 中拆成至少两个阶段：

```dockerfile
FROM ... AS yasa-builder
# 编译 yasa-engine / uast 产物

FROM ... AS yasa-runner
# 仅复制运行时产物
```

最终镜像只保留：
- `yasa-engine.real`
- wrapper 脚本
- `resource`
- `deps/uast4go`
- `deps/uast4py`
- 必要共享库

明确不保留：
- `node_modules`
- `src`
- `docs`
- `test`
- Go/Node 构建工具链

- [ ] **Step 2: 在 backend Dockerfile 中删除 YASA 运行时拷贝**

移除 backend `dev-runtime` 和 `runtime` 中的：

```dockerfile
COPY --from=scanner-tools-base /opt/yasa /opt/yasa
```

并同步删除仅为 backend 本体保留 `YASA` 的软链初始化逻辑。

- [ ] **Step 3: 保持 backend 其余扫描器现状不变**

在第一波不要同时变更：
- `gitleaks`
- `opengrep`
- `phpstan`

避免把 YASA runner 化与其他扫描器回归绑定在一起。

- [ ] **Step 4: 调整 compose 与发布流程**

在 `docker-compose.yml` / `docker-compose.full.yml` 中增加：
- `SCANNER_YASA_IMAGE`
- `SCAN_WORKSPACE_ROOT` 挂载

在 `.github/workflows/docker-publish.yml` 中增加：
- `vulhunter-yasa-runner` 镜像构建与发布

- [ ] **Step 5: 验证镜像构建**

Run:

```bash
cd /home/xyf/AuditTool
docker build -f backend/docker/yasa-runner.Dockerfile -t vulhunter/yasa-runner:latest backend
docker compose build backend
```

Expected:
- YASA runner 可单独构建
- backend 镜像不再包含 `/opt/yasa`

- [ ] **Step 6: 验证 compose 回归**

Run:

```bash
cd /home/xyf/AuditTool/backend
uv run pytest tests/test_docker_compose_dev_flow.py -v
```

Expected:
- compose 开发流测试通过

- [ ] **Step 7: Commit**

```bash
git add backend/docker/yasa-runner.Dockerfile \
  backend/Dockerfile \
  docker-compose.yml \
  docker-compose.full.yml \
  .github/workflows/docker-publish.yml \
  backend/tests/test_docker_compose_dev_flow.py
git commit -m "build: add slim yasa runner image"
```

## Task 4: 将静态扫描 YASA API 切换到 runner 容器

**Files:**
- Modify: `backend/app/api/v1/endpoints/static_tasks_yasa.py`
- Modify: `backend/app/services/yasa_runtime.py`
- Modify: `backend/app/api/v1/endpoints/static_tasks.py`
- Test: `backend/tests/test_yasa_implementation.py`
- Test: `backend/tests/test_yasa_runtime.py`
- Test: `backend/tests/test_yasa_opengrep_static_tasks.py`

- [ ] **Step 1: 先写失败测试，覆盖 runner 路径**

新增/修改测试至少覆盖：

```python
async def test_yasa_scan_uses_runner_workspace_and_reads_sarif(...): ...
async def test_yasa_interrupt_stops_runner_container(...): ...
def test_build_yasa_scan_command_accepts_runner_paths(...): ...
```

- [ ] **Step 2: 将 `static_tasks_yasa.py` 的执行入口改为 runner**

把当前直接：

```python
process_result = await asyncio.to_thread(subprocess.run, cmd, ...)
```

改为：

```python
runner_result = await run_scanner_container(...)
```

要求：
- 输入源代码目录来自共享工作目录
- 输出目录固定在共享工作目录
- 仍然复用现有 `report.sarif` 解析逻辑

- [ ] **Step 3: 中断接口切换到容器级 stop**

确保：
- 任务中断时能够停止 runner 容器
- DB 状态仍然写入 `interrupted`
- 不破坏现有 task duration / error_message 语义

- [ ] **Step 4: 保留现有 API 响应结构**

不要修改：
- 请求 payload
- response model
- findings 序列化结构

- [ ] **Step 5: 运行 YASA 相关测试**

Run:

```bash
cd /home/xyf/AuditTool/backend
uv run pytest \
  tests/test_yasa_implementation.py \
  tests/test_yasa_runtime.py \
  tests/test_yasa_opengrep_static_tasks.py -v
```

Expected:
- 所有 YASA 相关测试通过

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/v1/endpoints/static_tasks_yasa.py \
  backend/app/services/yasa_runtime.py \
  backend/app/api/v1/endpoints/static_tasks.py \
  backend/tests/test_yasa_implementation.py \
  backend/tests/test_yasa_runtime.py \
  backend/tests/test_yasa_opengrep_static_tasks.py
git commit -m "refactor: run static yasa scans via runner container"
```

## Task 5: 将 Agent Bootstrap 的 YASA 扫描切换到 runner

**Files:**
- Modify: `backend/app/services/agent/bootstrap/yasa.py`
- Modify: `backend/app/api/v1/endpoints/agent_tasks_bootstrap.py`
- Test: `backend/tests/test_agent_opengrep_bootstrap.py`

- [ ] **Step 1: 写失败测试，覆盖 bootstrap YASA runner 路径**

至少覆盖：

```python
async def test_agent_bootstrap_yasa_uses_runner_container(...): ...
async def test_agent_bootstrap_yasa_handles_missing_runner_result(...): ...
```

- [ ] **Step 2: 将 bootstrap `YASA` 执行切换到共享 runner**

要求：
- 不再直接依赖 backend 本体安装 `yasa`
- 与静态扫描 API 共用 runner 抽象
- 保持现有 findings 标准化和 metadata 结构

- [ ] **Step 3: 保持 bootstrap 失败回退语义**

必须保留：
- `YASA_ENABLED=false` 时跳过
- runner 执行失败时能输出可诊断错误
- 不影响 `opengrep/bandit/gitleaks/phpstan` bootstrap 路径

- [ ] **Step 4: 运行 bootstrap 相关测试**

Run:

```bash
cd /home/xyf/AuditTool/backend
uv run pytest tests/test_agent_opengrep_bootstrap.py -v
```

Expected:
- bootstrap 相关测试通过

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/agent/bootstrap/yasa.py \
  backend/app/api/v1/endpoints/agent_tasks_bootstrap.py \
  backend/tests/test_agent_opengrep_bootstrap.py
git commit -m "refactor: route bootstrap yasa scans through runner"
```

## Task 6: 收紧 backend Dockerfile，只保留运行时产物

**Files:**
- Modify: `backend/Dockerfile`
- Test: `backend/tests/test_docker_compose_dev_flow.py`

- [ ] **Step 1: 拆清 dev-runtime 与 runtime 的职责**

要求：
- `dev-runtime` 只保留开发容器真正需要的运行时
- `runtime` 只保留生产容器需要的运行时
- 不要让 dev/runtime 共用过重的 prod 基础层

- [ ] **Step 2: 把“编译用依赖”留在 builder 阶段**

确保以下内容不进入最终 backend 运行镜像：
- 构建用编译工具链
- 仅用于 `YASA` 的构建依赖
- 不再需要的源码中间产物

- [ ] **Step 3: 审查 `RUN ... --version` 预热副作用**

要求：
- 保留必要校验
- 不把大缓存无意烘进 backend
- `opengrep` 缓存例外，第一阶段允许保留

- [ ] **Step 3.5: 收敛 backend Python 工具安装入口**

要求：
- `bandit`、`code2flow`、`safety`、`pip-audit` 等 Python 工具统一通过 `pyproject.toml` + `uv sync` 进入 `/opt/backend-venv`
- builder、dev-runtime 与 runtime 都直接创建或复制 `/opt/backend-venv`，不再先落到 `/app/.venv` 再搬运，避免 console script shebang 指回旧路径
- 开发容器中的 `backend_venv` 卷直接挂载到 `/opt/backend-venv`，`uv sync --active` 也只更新这一套环境
- 删除 backend runtime 阶段额外的系统 `pip install ...`
- 避免形成 `/opt/backend-venv` 与系统 site-packages 并存的双轨来源
- 清理最终镜像中的系统 `pip` 与全局 `site-packages`，只保留 `/opt/backend-venv` 作为 Python 工具运行时

- [ ] **Step 4: 重新构建并记录体积**

Run:

```bash
cd /home/xyf/AuditTool
docker compose build backend
docker images --format '{{.Repository}}:{{.Tag}}\t{{.Size}}' | grep '^vulhunter/backend-dev'
```

Expected:
- backend 新体积显著低于 `3.19GB`
- 第一阶段目标：接近或进入 `<= 2.3GB`

- [ ] **Step 5: Commit**

```bash
git add backend/Dockerfile backend/tests/test_docker_compose_dev_flow.py
git commit -m "build: slim backend runtime artifacts"
```

## Task 7: 为 Opengrep runner 化做前置铺垫，但不切换执行流

**Files:**
- Modify: `backend/app/api/v1/endpoints/static_tasks_opengrep.py`
- Modify: `backend/app/api/v1/endpoints/static_tasks_opengrep_rules.py`
- Modify: `backend/app/services/agent/bootstrap/opengrep.py`
- Test: `backend/tests/test_static_tasks_opengrep_parse.py`
- Test: `backend/tests/test_static_tasks_split_contract.py`

- [ ] **Step 1: 将 opengrep 输入/输出都收敛到共享工作目录**

要求：
- 合并规则 YAML、校验文件、结果文件都使用共享工作目录
- 不依赖匿名本地临时目录

- [ ] **Step 2: 抽离 opengrep 专属 runner 参数构造函数**

新增纯函数级构造逻辑，例如：

```python
def build_opengrep_runner_spec(...): ...
```

第一阶段不要真正切换执行路径，只把参数和目录约定提前统一。

- [ ] **Step 3: 保留预热缓存策略注释与实现占位**

明确记录：
- backend 当前仍持有 `opengrep` 预热缓存
- 第二阶段切 runner 时，缓存迁移到 runner 镜像

- [ ] **Step 4: 运行 opengrep 解析与契约测试**

Run:

```bash
cd /home/xyf/AuditTool/backend
uv run pytest tests/test_static_tasks_opengrep_parse.py tests/test_static_tasks_split_contract.py -v
```

Expected:
- 解析与契约测试通过

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/endpoints/static_tasks_opengrep.py \
  backend/app/api/v1/endpoints/static_tasks_opengrep_rules.py \
  backend/app/services/agent/bootstrap/opengrep.py \
  backend/tests/test_static_tasks_opengrep_parse.py \
  backend/tests/test_static_tasks_split_contract.py
git commit -m "refactor: prepare opengrep paths for runner migration"
```

## Task 8: 端到端验证与交付说明

**Files:**
- Modify: `docs/backend_container_slim/backend_container_slim_overview.md`
- Test: `backend/tests/test_docker_compose_dev_flow.py`
- Test: `backend/tests/test_yasa_implementation.py`
- Test: `backend/tests/test_agent_opengrep_bootstrap.py`

- [ ] **Step 1: 执行阶段性回归测试**

Run:

```bash
cd /home/xyf/AuditTool/backend
uv run pytest \
  tests/test_static_tasks_shared.py \
  tests/test_scanner_runner.py \
  tests/test_yasa_implementation.py \
  tests/test_yasa_runtime.py \
  tests/test_yasa_opengrep_static_tasks.py \
  tests/test_agent_opengrep_bootstrap.py \
  tests/test_docker_compose_dev_flow.py -v
```

Expected:
- Phase 1/2 相关测试全部通过

- [ ] **Step 2: 记录镜像体积与目录占用对比**

Run:

```bash
cd /home/xyf/AuditTool
docker images --format '{{.Repository}}:{{.Tag}}\t{{.Size}}' | grep '^vulhunter/'
docker run --rm --entrypoint sh vulhunter/backend-dev:latest -lc 'du -sh /opt/* /root/.cache/* 2>/dev/null | sort -h'
```

Expected:
- backend 不再含 `/opt/yasa`
- 新体积与基线对比清晰可追踪

- [ ] **Step 3: 回填文档中的实际结果**

将以下内容补回本文档：
- Phase 1 完成后的 backend 镜像体积
- YASA runner 镜像体积
- 已完成/未完成的扫描器迁移状态
- `opengrep` 缓存仍保留在 backend 或已迁移的准确状态

- [ ] **Step 4: Commit**

```bash
git add docs/backend_container_slim/backend_container_slim_overview.md
git commit -m "docs: finalize backend container slim execution plan"
```

## Acceptance Criteria

- backend 对外静态扫描 API 不变
- 第一波 `YASA` 完全通过 runner 容器执行
- backend 镜像不再包含 `/opt/yasa`
- 共享扫描工作目录可被 backend 与 runner 容器共同访问
- 任务中断支持停止 runner 容器
- `opengrep` 预热缓存策略被保留并记录清楚
- backend dev 镜像相较 `3.19GB` 基线显著下降

## Defaults Chosen

- `YASA` 是第一波唯一切换到 runner 的扫描器
- `opengrep` 第一波只做路径和抽象铺垫，不改执行主路径
- runner 镜像通过 Docker Engine 按任务临时拉起
- 共享工作目录默认使用 `/tmp/vulhunter/scans`
- 所有 Python 验证命令统一使用 `uv run`
