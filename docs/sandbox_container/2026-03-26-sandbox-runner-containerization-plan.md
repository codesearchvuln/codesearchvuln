# Sandbox Runner Containerization Implementation Plan

> **For agentic workers:** Prefer implementing this plan in phases. Phase 1 is the only in-scope implementation plan in this document. Do not start by introducing a brand new `sandbox-runner` image, compose service, or publish workflow.

**Goal:** 将 `run_code`、`sandbox_exec`、`verify_vulnerability` 以及现有 `SandboxManager` 兼容调用路径，从“各工具直接依赖内联 Docker 细节”的实现，迁移为统一的 sandbox runner 抽象；本轮优先复用现有 `SANDBOX_IMAGE` 运行时，不强制拆分独立 `sandbox-runner` 镜像。

**Architecture:** 新增 `SandboxRunSpec`、`SandboxRunResult`、`run_sandbox_container(...)` 和 `SandboxRunnerClient`，由 client 负责 workspace、profile、镜像选择和结果整形。`SandboxManager` 保留公开方法和生命周期语义，但内部改为委托给新 client，作为兼容门面继续服务现有调用者。

**Tech Stack:** Python, Docker SDK, FastAPI backend, existing runner patterns, pytest, uv

---

## Why This Plan Was Adjusted

原始版本把“新增独立 `sandbox-runner` 镜像 + compose 预热服务 + workflow 发布链路”作为默认路径，但仓库现状并不支持将这一步当作低风险重构：

- `SandboxManager` 的调用面比文档最初假设更广，不止 `run_code`、`sandbox_exec`、`verify_vulnerability` 在使用。
- 现有 scanner runner 的 compose / workflow 交付链路已经成熟，但 sandbox 与 scanner 的职责不同，不能机械照搬。
- `docker/sandbox/Dockerfile` 目前承载大量真实运行能力，直接拆出新镜像会放大迁移成本和兼容风险。
- 原文中的若干测试命令与仓库实际 `uv` / `pytest` 调用方式不一致，按原文执行会直接失败。

因此，本计划改为两阶段：

- **Phase 1（本轮实施）**：抽象 runner 契约，统一执行路径，保持兼容。
- **Phase 2（后续可选）**：在 Phase 1 稳定后，再评估是否拆分独立 `sandbox-runner` 镜像和交付链路。

---

## Scope For Phase 1

### In Scope

- 新增 sandbox runner 抽象层和高层 client
- 将核心公开工具迁移到新抽象：
  - `run_code`
  - `sandbox_exec`
  - `verify_vulnerability`
- 将 `SandboxManager` 改造成兼容 facade，继续覆盖其他现存调用者
- 新增/更新针对 runner 契约、client、兼容层和核心工具的测试
- 增加可选配置 `SANDBOX_RUNNER_IMAGE`，但默认仍可回退到 `SANDBOX_IMAGE`

### Out Of Scope

- 不新增 `backend/docker/sandbox-runner.Dockerfile`
- 不新增 compose `sandbox-runner` 预热服务
- 不修改 `.github/workflows/docker-publish.yml` 发布新的 sandbox runner 镜像
- 不要求将所有历史/遗留沙箱工具都迁移成直接依赖 `SandboxRunnerClient`
- 不改变公开工具名、args schema、metadata/evidence 协议

---

## File Structure

### New Files

- `backend/app/services/sandbox_runner.py`
  - 定义底层 runner spec/result，同步封装容器启动、日志留存、元数据写入与清理
- `backend/app/services/sandbox_runner_client.py`
  - 提供高层 client，负责 workspace 准备、profile 到 spec 的映射、镜像选择和结果回传
- `backend/tests/test_sandbox_runner.py`
  - `run_sandbox_container(...)` 的底层契约测试
- `backend/tests/test_sandbox_runner_client.py`
  - `SandboxRunnerClient` 的 workspace、profile、image fallback、结果解析测试

### Modified Files

- `backend/app/core/config.py`
  - 新增 `SANDBOX_RUNNER_IMAGE`，并对 `SANDBOX_IMAGE` 保留 fallback 兼容
- `backend/app/services/agent/tools/sandbox_tool.py`
  - `SandboxManager` 退化为兼容门面，`SandboxTool` / `VulnerabilityVerifyTool` 走新 client 路径
- `backend/app/services/agent/tools/run_code.py`
  - 改为显式走新 client / 兼容门面，保持当前输出协议不变
- `backend/tests/test_run_code_tool.py`
  - 增加核心工具兼容断言
- `backend/tests/agent/test_tools.py`
  - 增加 `verify_vulnerability` 的元数据契约断言
- `backend/tests/simple_sandbox_test.py`
  - smoke test 改为验证新 runner 抽象是否可通过兼容层工作

### Existing Files To Reference

- `backend/app/services/scanner_runner.py`
- `backend/app/services/flow_parser_runner.py`
- `backend/tests/test_scanner_runner.py`
- `backend/tests/test_flow_parser_runner_client.py`

---

## Runtime Contract

### `SandboxRunSpec`

字段至少包含：

- `image`
- `command`
- `workspace_dir`
- `working_dir`
- `timeout_seconds`
- `env`
- `network_mode`
- `read_only`
- `user`
- `volumes`
- `tmpfs`
- `expected_exit_codes`

约束：

- 保持 sandbox 特有的运行时控制显式可见，不要把所有逻辑藏进 client。
- `cap_drop=["ALL"]` 和 `security_opt=["no-new-privileges:true"]` 为默认安全基线。
- 默认挂载的 scratch workspace 路径固定为 `/workspace`。
- 如需暴露项目源码，统一只读挂载到 `/project`。

### `SandboxRunResult`

返回值至少包含：

- `success`
- `exit_code`
- `stdout`
- `stderr`
- `error`
- `image`
- `image_candidates`
- `stdout_path`
- `stderr_path`
- `runner_meta_path`

约束：

- 不能只保留日志路径，必须继续向上提供工具层当前依赖的内存态 `stdout` / `stderr` / `error` 字段。
- 保留 `image` 和 `image_candidates`，避免破坏现有工具输出与测试。

### Workspace Layout

统一使用：

```text
<SCAN_WORKSPACE_ROOT>/sandbox-runner/<run_id>/
  input/
  output/
  logs/
    stdout.log
    stderr.log
  meta/
    runner.json
```

其中：

- `input/` 用于必要的 staged 输入
- `output/` 预留给后续扩展，不要求本轮每种调用都产生产物
- `logs/` 和 `meta/` 为底层 runner 统一维护

---

## Client And Profile Mapping

`SandboxRunnerClient` 负责集中维护 profile 到运行时参数的映射，避免每个工具自己拼 Docker 细节。

### Required Profiles

- `isolated_exec`
  - 供 `run_code` 和 `sandbox_exec` 使用
  - `network_mode=none`
- `network_verify`
  - 供 `execute_http_request` 和 `verify_vulnerability` 使用
  - `network_mode=bridge`
- `tool_workdir`
  - 供 `execute_tool_command` 使用
  - 将指定工作目录只读挂载到 `/workspace`

### Image Resolution

镜像选择顺序固定为：

1. `SANDBOX_RUNNER_IMAGE`
2. `SANDBOX_IMAGE`
3. 现有 legacy fallback candidates

要求：

- 继续保留当前 `SandboxManager` 的本地镜像优先和候选列表行为
- 不要把“必须存在新镜像”作为 `initialize()` 成功前提

---

## Compatibility Rules

`SandboxManager` 在 Phase 1 仍然是对外兼容入口，必须保留以下行为：

- `initialize()`：仍负责建立 Docker 可用性判断
- `is_available`：继续代表“Docker sandbox execution 可用”
- `get_diagnosis()`：继续返回面向调用者的可读诊断信息
- `execute_command(...)`
- `execute_tool_command(...)`
- `execute_http_request(...)`
- `verify_vulnerability(...)`

兼容要求：

- 公开方法名不变
- 返回字段不删减
- 现有任务入口继续可共享一个长生命周期 `SandboxManager` 实例
- 其他直接依赖 `SandboxManager` 的调用者不要求本轮改造，但不能被破坏

---

## Implementation Tasks

### Task 1: Define sandbox runner execution contracts

**Files:**

- Create: `backend/app/services/sandbox_runner.py`
- Create: `backend/tests/test_sandbox_runner.py`

- [ ] **Step 1: Write failing tests for runner spec/result and execution contract**

Add tests that verify:

- `SandboxRunSpec` captures the required fields
- `run_sandbox_container(...)` passes `network_mode`, `security_opt`, `cap_drop`, `tmpfs`, custom mounts, and working directory correctly
- `stdout.log`, `stderr.log`, and `meta/runner.json` are written under the workspace
- failure / nonzero exit paths retain logs and metadata

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
UV_CACHE_DIR=/tmp/uv-cache uv run --project backend python -m pytest \
  backend/tests/test_sandbox_runner.py -q
```

- [ ] **Step 3: Implement `SandboxRunSpec`, `SandboxRunResult`, and `run_sandbox_container(...)`**

Implementation requirements:

- Reference `scanner_runner.py`, but do not force sandbox execution into scanner-only assumptions
- Keep sandbox runtime controls explicit
- Preserve both retained-log paths and tool-friendly inline result fields

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
UV_CACHE_DIR=/tmp/uv-cache uv run --project backend python -m pytest \
  backend/tests/test_sandbox_runner.py -q
```

### Task 2: Add `SandboxRunnerClient`

**Files:**

- Create: `backend/app/services/sandbox_runner_client.py`
- Create: `backend/tests/test_sandbox_runner_client.py`

- [ ] **Step 1: Write failing tests for workspace/profile/image resolution**

Add tests that verify:

- workspaces are created under `SCAN_WORKSPACE_ROOT/sandbox-runner/<run_id>`
- `isolated_exec` maps to `network_mode=none`
- `network_verify` maps to `network_mode=bridge`
- `tool_workdir` mounts the requested directory to `/workspace`
- `SANDBOX_RUNNER_IMAGE` is preferred and `SANDBOX_IMAGE` remains fallback-compatible

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
UV_CACHE_DIR=/tmp/uv-cache uv run --project backend python -m pytest \
  backend/tests/test_sandbox_runner_client.py -q
```

- [ ] **Step 3: Implement `SandboxRunnerClient`**

Implementation requirements:

- Centralize profile mapping
- Centralize workspace layout creation
- Expose methods for:
  - generic command execution
  - tool workdir execution
  - HTTP request execution
  - vulnerability verification support
- Return a shape compatible with current `SandboxManager` callers

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
UV_CACHE_DIR=/tmp/uv-cache uv run --project backend python -m pytest \
  backend/tests/test_sandbox_runner_client.py -q
```

### Task 3: Rewire `SandboxManager` into a compatibility facade

**Files:**

- Modify: `backend/app/services/agent/tools/sandbox_tool.py`
- Update tests in: `backend/tests/test_run_code_tool.py`

- [ ] **Step 1: Add or tighten compatibility tests**

Add tests that verify:

- `SandboxManager.execute_command(...)` still returns `success`, `stdout`, `stderr`, `exit_code`, `error`, `image`, `image_candidates`
- `execute_http_request(...)` still performs networked execution semantics
- `verify_vulnerability(...)` still returns `is_vulnerable`, `evidence`, `response_status`, and `error`
- `execute_tool_command(...)` still supports read-only mounted workdir execution

- [ ] **Step 2: Run focused tests**

Run:

```bash
UV_CACHE_DIR=/tmp/uv-cache uv run --project backend python -m pytest \
  backend/tests/test_run_code_tool.py -q
```

- [ ] **Step 3: Replace direct Docker logic inside `SandboxManager`**

Implementation requirements:

- Keep public method names intact
- Move image selection and execution to `SandboxRunnerClient`
- Preserve `initialize()` / `is_available` semantics for current task bootstrapping code
- Keep legacy image fallback behavior visible in returned metadata

- [ ] **Step 4: Re-run focused tests**

Run:

```bash
UV_CACHE_DIR=/tmp/uv-cache uv run --project backend python -m pytest \
  backend/tests/test_run_code_tool.py -q
```

### Task 4: Migrate core verification tools to the new runner path

**Files:**

- Modify: `backend/app/services/agent/tools/run_code.py`
- Modify: `backend/app/services/agent/tools/sandbox_tool.py`
- Update tests in:
  - `backend/tests/test_run_code_tool.py`
  - `backend/tests/agent/test_tools.py`

- [ ] **Step 1: Add failing tests for profile-specific execution**

Add tests that verify:

- `run_code` uses the isolated execution profile
- `sandbox_exec` uses the isolated execution profile
- `verify_vulnerability` uses the network verification profile
- tool metadata remains unchanged for current frontend / agent consumers

- [ ] **Step 2: Run focused tests**

Run:

```bash
UV_CACHE_DIR=/tmp/uv-cache uv run --project backend python -m pytest \
  backend/tests/test_run_code_tool.py \
  backend/tests/agent/test_tools.py -q
```

- [ ] **Step 3: Rewire tool construction and execution**

Implementation requirements:

- `RunCodeTool` stops depending on inline Docker orchestration details
- `SandboxTool` and `VulnerabilityVerifyTool` delegate through the new client/facade
- tool names, args schema, prompt contracts, and metadata layout remain unchanged

- [ ] **Step 4: Re-run focused tests**

Run:

```bash
UV_CACHE_DIR=/tmp/uv-cache uv run --project backend python -m pytest \
  backend/tests/test_run_code_tool.py \
  backend/tests/agent/test_tools.py -q
```

### Task 5: Validate compatibility and public surface stability

**Files:**

- Review / update only as needed:
  - `backend/tests/test_agent_tool_registry.py`
  - `backend/tests/test_agent_prompt_contracts.py`
  - `backend/tests/test_legacy_cleanup.py`
  - `backend/tests/simple_sandbox_test.py`

- [ ] **Step 1: Confirm public tool surface stays stable**

Verify:

- public core tools remain `run_code`, `sandbox_exec`, `verify_vulnerability`
- removed tools stay absent
- prompt contracts still reference the same verification tools

- [ ] **Step 2: Run targeted validation**

Run:

```bash
UV_CACHE_DIR=/tmp/uv-cache uv run --project backend python -m pytest \
  backend/tests/test_agent_tool_registry.py \
  backend/tests/test_agent_prompt_contracts.py \
  backend/tests/test_legacy_cleanup.py -q
```

- [ ] **Step 3: Run opt-in Docker smoke test if environment allows**

Run:

```bash
RUN_SANDBOX_TESTS=1 UV_CACHE_DIR=/tmp/uv-cache uv run --project backend python -m pytest \
  backend/tests/simple_sandbox_test.py -q
```

Record whether Docker was available and whether the smoke test was skipped.

### Task 6: End-to-end regression pass

- [ ] **Step 1: Run the main impacted suites**

Run:

```bash
UV_CACHE_DIR=/tmp/uv-cache uv run --project backend python -m pytest \
  backend/tests/test_sandbox_runner.py \
  backend/tests/test_sandbox_runner_client.py \
  backend/tests/test_scanner_runner.py \
  backend/tests/test_flow_parser_runner_client.py \
  backend/tests/test_run_code_tool.py \
  backend/tests/agent/test_tools.py \
  backend/tests/test_agent_tool_registry.py \
  backend/tests/test_agent_prompt_contracts.py \
  backend/tests/test_legacy_cleanup.py -q
```

- [ ] **Step 2: Summarize environment assumptions**

Document in the implementation summary:

- whether Docker was available
- whether `UV_CACHE_DIR` had to be overridden
- whether smoke tests were skipped

---

## Phase 2 (Optional, Only After Phase 1 Stabilizes)

下列事项明确延后，不属于本轮默认实施内容：

- 抽离专用 `backend/docker/sandbox-runner.Dockerfile`
- 为 compose 增加 `sandbox-runner` 一次性预热服务
- 为 workflow 增加 sandbox runner 镜像构建和发布
- 从 `docker/sandbox/Dockerfile` 中进一步裁剪运行时能力

只有当满足以下前提时，才进入 Phase 2：

- Phase 1 的 runner 抽象已经稳定
- `SandboxManager` 兼容调用没有新增回归
- 已能明确证明独立镜像能带来可观收益，例如镜像体积、构建时间、职责隔离或安全边界收敛

---

## Notes And Constraints

- 使用 `uv run --project backend python -m pytest ...` 作为基准测试命令
- 如默认 `uv` 缓存目录不可写，可显式设置 `UV_CACHE_DIR=/tmp/uv-cache`
- 保持当前语义分离：
  - `run_code` / `sandbox_exec` 默认无网络
  - `verify_vulnerability` 允许网络访问
- 保持验证工具协议稳定，不修改前端和 agent 消费侧的字段约定
- 本轮兼容策略是“核心工具 + 兼容层”，不是“只保三把工具，不管其他调用者”
