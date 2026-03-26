# Unified Skill Runtime API 开发拆解

## 文档定位

- 类型：Implementation plan
- 日期：2026-03-26
- 主题：将当前可用 skill 与 skill 调用流程接口化，替代“模型直接读 skill 文件”的模式
- 目标读者：后续负责落地后端 runtime、skills API、prompt 注入、前端兼容、部署发布的开发者

## 摘要

本次改造把当前 skill 获取与使用方式统一收敛为 API 驱动协议，覆盖三类能力：

1. `scan-core` 工具型 skill
2. registry mirror 的 workflow skill
3. 按 `agent_key` 聚合后的 effective prompt skill

运行时从“模型自行读文件决定该用什么 skill”切换为“宿主先给 catalog 摘要，模型显式选择 skill，宿主再加载对应 detail 文档”。整体目标是强化 skill 指向性、减少 prompt 膨胀、统一 skill 真相源，并把 skill 加载状态变成显式 runtime 状态。

本版拆解额外完成三件事：

- 把前端、后端、部署运维三条线的隐藏前提全部改成显式契约。
- 把“兼容旧接口/旧前端/旧部署”改成可验证的 rollout gate，而不是口头承诺。
- 对原计划中仍然依赖“默认已存在能力”的部分，统一改成先实现、先定义、先约束。

## 已锁定决策

- 本轮先补最小可用 runtime session 能力，不把它作为外部已完成前提。
- v1 继续复用 `/skills/*`，但只允许单选 skill，不支持一次选择多个 skill。
- workflow skill 继续以 registry manifest + mirrored skill dir 作为 canonical source。
- prompt-effective 只能在 DB ready 后按用户/任务实时计算，不能在启动前预构建。
- scan-core 工具硬门禁同轮严格上线，不做先告警后拦截。
- `/config.skillAvailability` 为避免破坏旧客户端，保留旧字段语义；新增 `unifiedSkillAvailability` 作为统一新视图。
- 当前默认开发 compose 不是 unified workflow runtime 的验收环境。
- 生产/发布环境禁止“启动时从 GitHub `main` 安装 skill”作为正式方案。

## 支持范围矩阵

### 部署模式

| 模式 | workflow registry 默认状态 | prompt-effective 默认状态 | 是否可作为本计划验收环境 |
| --- | --- | --- | --- |
| `docker-compose.yml` 开发态 | 默认关闭，仅 `scan-core only` | 支持，按 DB/用户实时计算 | 否 |
| `docker-compose.full.yml` 全量本地构建 | 仅在提供预生成 registry 或显式 source roots 时支持 | 支持，按 DB/用户实时计算 | 有条件可用 |
| release artifact / 正式部署 | 必须使用预生成 registry | 支持，按 DB/用户实时计算 | 是 |

### 结论

- 默认开发 compose 仅作为 scan-core / prompt CRUD / agent 行为开发环境，不作为 workflow skill runtime 验收环境。
- 正式验收环境必须满足：
  - 存在有效 registry manifest、aliases、mirrored skills
  - `CODEX_SKILLS_AUTO_INSTALL=false`
  - `SKILL_REGISTRY_AUTO_SYNC_ON_STARTUP=false`
  - DB ready 后可按用户解析 prompt-effective

## 目标与边界

### 目标

- 让模型只能通过接口获得可用 skill 概览，而不是直接读 skill 文件。
- 让模型在需要 skill 时先显式选择一个 skill，再获取该 skill 的使用文档。
- 统一 `/skills/catalog`、`/skills/{id}`、`/config` 中 unified skill 视图、runtime prompt 注入、prompt skill 投影之间的口径。
- 引入显式 runtime session 技能加载状态，记录已加载 skill、active workflow/prompt state 和 detail cache。
- 对 scan-core 工具建立硬门禁：未先完成 skill 选择与 detail 加载时，不允许直接调用工具。
- 在不破坏现有前端和 scan-core 详情页/测试页的前提下完成增量迁移。

### 非目标

- 不在本轮完成 Phase 1 全量 session/history 重构。
- 不在本轮完成 checkpoint/recovery。
- 不在本轮做多选 skill 协议。
- 不在本轮把 `docs/agent-tools` 变成 canonical source。
- 不在本轮重写 `build_skill_registry.py` 镜像生成流程，只复用其输出。
- 不在本轮删除旧 prompt skill CRUD、builtin toggle、旧 scan-core 详情页测试能力。

## 当前现状

当前仓库里与本次改造直接相关的事实如下：

- `/skills/catalog` 与 `/skills/{id}` 当前只服务 `scan-core`，实现位于 `backend/app/api/v1/endpoints/skills.py`。
- `scan-core` 元数据来自 `backend/app/services/agent/skills/scan_core.py`。
- workflow skill 已可通过 `backend/scripts/build_skill_registry.py` 生成 mirror、manifest、aliases 和 `SKILLS.md`，但 runtime 尚未真正消费。
- 当前 runtime 镜像不包含 workflow skill source roots，且配置里没有显式 `SKILL_SOURCE_ROOTS` / `SKILL_REGISTRY_ROOT` 字段。
- prompt skill 当前仍是按 `agent_key` 自动拼接到任务配置里，而不是作为一个可被选择的 runtime skill。
- 当前 runtime prompt 里仍会带入 `skills.md` 与 `shared.md` 的摘要内容。
- `AgentRuntimeSession` / `RuntimeSessionState` 在仓库中仍未落地，只有 phase 文档契约，没有实现代码。
- `BaseAgent.execute_tool(...)` 当前没有 skill load guard。
- `ReportAgent` 仍有私有 `_execute_tool()` 路径，不能被 `BaseAgent.execute_tool()` 自动覆盖。
- 共享 ReAct 解析器 `react_parser.py` 当前只解析 `Thought / Action / Action Input / Final Answer`。
- 前端 `SkillToolsPanel`、`ScanConfigExternalToolDetail`、`PromptSkillsPanel`、skill test 页面仍依赖旧的 scan-core 字段形状和本地静态 catalog。

## 总体设计

### 核心协议

统一 skill runtime 采用两步式协议：

1. 宿主调用 `/skills/catalog`，向模型注入 summary-only skill digest。
2. 模型输出结构化 `skill_selection`，只包含一个 `skill_id`。
3. 宿主调用 `/skills/{skill_id}` 获取标准化 detail 文档。
4. 宿主把 detail 注入上下文，并把该 skill 标记为已加载。
5. 模型随后才能使用该 skill 对应的流程文档或工具能力。

### 单选协议

模型输出格式固定为：

```xml
<skill_selection>
{"skill_id":"search_code"}
</skill_selection>
```

宿主只接受 `skill_id`，不依赖自然语言技能名解析。

若单轮回复中同时出现以下任一组合，宿主一律视为协议错误，不执行工具，也不接受最终答案：

- `skill_selection` + `Action`
- `skill_selection` + `Final Answer`
- 多个 `skill_selection`

## Skill 分类与统一 ID 规则

### 1. tool skill

- 来源：`scan-core`
- `kind=tool`
- 使用 bare `skill_id`
- 示例：`search_code`、`dataflow_analysis`

### 2. workflow skill

- 来源：registry manifest + mirrored skill dir
- `kind=workflow`
- 使用 namespaced `skill_id`
- 示例：`using-superpowers@agents`

### 3. prompt skill

- 来源：builtin prompt skill + custom prompt skill 的 effective projection
- `kind=prompt`
- 不按每条 DB row 暴露，而是按 `agent_key` 暴露 effective 视图
- 固定 `skill_id`：`prompt-<agent_key>@effective`
- 示例：`prompt-analysis@effective`

## 数据源与所有权

### 数据源优先级

统一 skill catalog 固定由三类数据源合并：

1. `scan_core`
2. `registry_manifest`
3. `prompt_effective`

优先级与规则如下：

1. `registry_manifest` 决定 workflow skill 的 canonical `skill_id`、`namespace`、`entrypoint`、`aliases`
2. `scan_core` 决定工具型 skill 的 canonical 元数据
3. `prompt_effective` 负责生成 prompt skill 的 effective 视图
4. `skills.md` 与 `shared.md` 只保留 memory/debug 价值，不再作为 canonical source
5. `docs/agent-tools` 本轮不参与 canonical 字段覆盖，不允许改写 `skill_id`、`namespace`、`entrypoint`

### build-time 与 runtime 分工

- workflow registry：
  - 正式环境默认使用“预生成 registry”
  - 开发/管理环境才允许“启动期重新构建 registry”
- prompt-effective：
  - 只能在 DB ready 后按用户/任务实时计算
  - 不能写入启动前静态 registry

## 部署与发布契约

### 环境变量与路径

本计划落地时必须显式新增并使用以下配置：

- `SKILL_REGISTRY_ENABLED: bool`
- `SKILL_REGISTRY_ROOT: str`
- `SKILL_SOURCE_ROOTS: list[str]`
- `SKILL_REGISTRY_MODE: "prebuilt_only" | "startup_build"`
- `SKILL_REGISTRY_REQUIRED: bool`
- `CODEX_HOME: str`

固定运行时目录约束：

- registry root 默认：`/app/data/mcp/skill-registry`
- codex-home 默认：`/app/data/mcp/codex-home`
- runtime loader 只允许按 `registry_root + mirror_dir/entrypoint` 解析文件
- 禁止 runtime 依赖 `source_root` / `source_dir` / `source_skill_md`

### 正式环境默认策略

正式部署默认采用以下唯一策略：

1. workflow registry 作为预生成发布产物随版本发布
2. `SKILL_REGISTRY_MODE="prebuilt_only"`
3. `CODEX_SKILLS_AUTO_INSTALL=false`
4. `SKILL_REGISTRY_AUTO_SYNC_ON_STARTUP=false`
5. 如 registry 不存在或无效，readiness 失败，不进入“静默继续”

### 开发态默认策略

开发 compose 默认采用：

1. `SKILL_REGISTRY_REQUIRED=false`
2. 未提供 registry 时自动降级为 `scan-core only`
3. prompt-effective 仍按用户/任务实时计算
4. workflow runtime 不作为默认开发验收能力

### registry 发布与降级规则

发布新 registry 前必须校验：

- `source_roots` 非空
- 必需 namespace 存在
- skill 数量达到最小阈值
- `manifest.json`、`aliases.json`、mirrored `skills/` 完整

校验失败时必须：

- 保留旧 registry
- 不得覆盖为新的空 manifest
- 明确返回 reason code，而不是静默降级为“成功但无 skill”

稳定失败原因至少包括：

- `registry_manifest_missing`
- `registry_aliases_missing`
- `registry_mirror_missing`
- `registry_skill_md_missing`
- `alias_ambiguous`
- `registry_not_built`
- `registry_invalid`

### 升级 / 回滚 / 持久化卷策略

本计划默认把 `/app/data/mcp` 视为版本化持久化目录，必须补齐：

- registry schema/version 校验
- codex-home skill snapshot 版本戳
- 升级策略：保留卷直接复用、强制重建、自动迁移三者选一
- 回滚策略：是否清理 `skill-registry` 与 `codex-home/skills`

本轮默认选择：

- release 升级时执行 registry version 校验，不匹配则强制重建或回滚失败
- 回滚时必须清理新版本 registry，再恢复旧版本预生成 registry

## Runtime 状态模型

### 设计结论

不能把所有 loaded state 放到单一“任务级全局 session”里，否则会和当前并行 worker 模型冲突。

### 两层状态

#### 1. TaskHostSkillCache

任务级、只读缓存，供 orchestrator 和 worker 共享：

- `catalog_digest`
- `catalog_entries_by_id`
- `detail_cache_by_skill_id`

职责：

- 缓存 catalog / detail
- 不承载 loaded-state
- 可被 worker 复制为只读视图

#### 2. AgentOrWorkerSkillSession

agent / worker 级 runtime state：

- `session_id`
- `loaded_skill_ids`
- `active_workflow_skill_id`
- `active_prompt_skill_by_agent_key`
- `last_protocol_error`

职责：

- 记录当前 agent/worker 已加载的 skill
- 记录当前 agent 可见的 active prompt/workflow state
- 不和其他 worker 共享 loaded-state

### 显式删除的模糊状态

本轮删除原文中的 `active_skill_ids`，因为它没有明确是任务级、agent 级还是 worker 级。

替代字段固定为：

- `active_workflow_skill_id`
- `active_prompt_skill_by_agent_key`

### worker spawn 规则

- worker 默认继承 task-level `TaskHostSkillCache`
- worker 不继承其他 worker 的 `loaded_skill_ids`
- worker 只允许继承自身启动时宿主明确下发的 active workflow / prompt state

## Runtime Session 最小实现

### 需要新增的最小模块

- `backend/app/services/agent/runtime/session.py`
- `backend/app/services/agent/runtime/state.py`
- `backend/app/services/agent/runtime/message_builder.py`

### 最小方法集

#### TaskHostSkillCache

- `get_catalog_entry(skill_id: str) -> dict | None`
- `get_cached_detail(skill_id: str) -> dict | None`
- `cache_detail(skill_id: str, detail: dict) -> None`

#### AgentOrWorkerSkillSession

- `is_skill_loaded(skill_id: str) -> bool`
- `mark_skill_loaded(skill_id: str, detail: dict) -> None`
- `get_active_workflow_skill_id() -> str | None`
- `set_active_workflow_skill(skill_id: str | None) -> None`
- `get_active_prompt_skill(agent_key: str) -> dict | None`
- `set_active_prompt_skill(agent_key: str, detail: dict | None) -> None`

## 统一 resolver / loader 契约

### 统一服务

新增：

- `backend/app/services/agent/skills/catalog.py`
- `backend/app/services/agent/skills/loader.py`
- `backend/app/services/agent/skills/registry_source.py`
- `backend/app/services/agent/skills/enforcement.py`

### 必须显式定义的接口

- `build_unified_catalog(*, db, user_id, namespace, q, limit, offset) -> UnifiedSkillCatalogResponse`
- `load_unified_skill_detail(*, db, user_id, skill_id, include_workflow) -> UnifiedSkillDetail`
- `load_registry_snapshot(settings) -> RegistrySnapshot`
- `build_prompt_effective_detail(*, db, user_id, agent_key) -> UnifiedSkillDetail`

### 失败语义

上述接口必须返回稳定 reason code，不能用自由文本代替 machine-readable 状态。

## 公共接口设计

### GET /skills/catalog

保留查询参数：

- `q`
- `namespace`
- `limit`
- `offset`

### Unified catalog 公共字段

- `skill_id`
- `name`
- `display_name`
- `kind`
- `namespace`
- `source`
- `summary`
- `selection_label`
- `entrypoint`
- `runtime_ready`
- `reason`
- `load_mode`
- `deferred_tools`
- `aliases`
- `has_scripts`
- `has_bin`
- `has_assets`

### scan-core 展示字段

为去掉前端本地静态 catalog 依赖，`namespace=scan-core` 的 catalog/detail 必须稳定返回：

- `display_type`
- `category`
- `goal`
- `task_list`
- `input_checklist`
- `example_input`
- `pitfalls`
- `sample_prompts`
- `phase_bindings`
- `mode_bindings`
- `evidence_view_support`
- `evidence_render_type`
- `legacy_visible`

结论：

- 本计划包含“从后端提供 scan-core 展示 metadata”
- 不允许实现后继续默认依赖前端本地 `SKILL_TOOLS_CATALOG`

### GET /skills/{skill_id}

detail 返回标准化 usage 文档，但必须保留旧客户端仍在消费的字段。

### detail 公共字段

- `skill_id`
- `name`
- `display_name`
- `kind`
- `namespace`
- `source`
- `summary`
- `entrypoint`
- `runtime_ready`
- `reason`
- `load_mode`
- `when_to_use`
- `how_to_apply`
- `constraints`
- `deferred_tools`
- `resources`

### 按类型补充字段

- workflow skill：
  - `resource_refs`
  - `raw_content`
- prompt skill：
  - `agent_key`
  - `prompt_sources`
  - `effective_content`
- tool skill：
  - `input_constraints`
  - `usage_examples`
  - 当前 test metadata
  - scan-core 展示字段

### 旧 detail 字段兼容矩阵

以下旧字段必须继续返回：

- `mirror_dir`
- `source_root`
- `source_dir`
- `source_skill_md`
- `files_count`
- `workflow_content`
- `workflow_truncated`
- `workflow_error`
- `test_supported`
- `test_mode`
- `test_reason`
- `default_test_project_name`
- `tool_test_preset`

默认值规则：

- workflow skill：
  - `workflow_content` 仅在 `include_workflow=true` 时返回
  - `test_supported=false`
  - `test_mode="disabled"`
- prompt skill：
  - `workflow_content=null`
  - `test_supported=false`
  - `test_mode="disabled"`
- tool skill：
  - 保持 scan-core 当前兼容语义
  - 对不存在的 workflow 文件字段返回空字符串或 `null`

### /skills/{id}/test 与 /skills/{id}/tool-test

本轮明确约束：

- 仅 `kind=tool` 支持
- `kind=workflow` / `kind=prompt` 请求命中时返回 `409`
- 错误码固定为：
  - `unsupported_skill_kind`
  - `skill_not_runnable`
  - `skill_not_found`

`runtime_ready=false` 的 tool skill 不允许测试，返回 `409 skill_not_runnable`。

## /config 兼容策略

### 保留旧字段

保留原有：

- `skillAvailability`

旧字段继续保持 scan-core-only 兼容语义，避免破坏旧客户端和现有测试。

### 新增统一字段

新增：

- `unifiedSkillAvailability`

该字段使用 canonical `skill_id` 作为 key，覆盖：

- tool
- workflow
- prompt-effective

每个条目至少包含：

- `enabled`
- `startup_ready`
- `runtime_ready`
- `reason`
- `source`
- `kind`

### 结论

- 旧客户端继续读 `skillAvailability`
- 新 runtime / 新前端读 `unifiedSkillAvailability`
- 不允许本轮直接把旧字段 silent flip 为 unified keyspace

## Prompt-effective 设计

### 数据来源

每个 `agent_key` 暴露一个 effective prompt skill：

- `prompt-recon@effective`
- `prompt-business_logic_recon@effective`
- `prompt-analysis@effective`
- `prompt-business_logic_analysis@effective`
- `prompt-verification@effective`

合成顺序固定：

1. builtin template
2. global custom prompt skill
3. agent-specific custom prompt skill

### 解析前提

prompt-effective 必须通过 `db + user_id` 解析，不能被当作纯静态 registry source。

### 空来源行为

当某个 effective prompt skill 没有任何 active source 时：

- `/skills/catalog` 仍返回该 skill
- `runtime_ready=false`
- `reason="no_active_prompt_sources"`
- `/skills/{id}` 仍可查询，但 `effective_content=""`
- 不能被激活到 runtime preamble

### use_prompt_skills 兼容语义

`AgentTaskCreate.use_prompt_skills` 继续保留请求兼容，但语义固定为：

- v1：仅用于兼容旧任务 payload / 旧 UI
- 不再决定 prompt-effective 是否进入 unified catalog
- 在旧注入路径完全删除前，可作为 legacy prompt injection 开关
- 当旧注入路径删除后，该字段被忽略但继续接受

不得出现“有时控制 catalog，有时控制 prompt 注入”的混合语义。

## 统一 prompt 注入与 memory 迁移

### 结论

不能只在 `BaseAgent.stream_llm_call()` 前临时加 preamble，因为 `ReportAgent` 还有独立 LLM 路径，且多个 agent 仍在手工拼接 `skills.md` / `shared.md` / `Prompt Skill`。

### 新增统一入口

新增：

- `build_runtime_messages(agent_key, conversation_history, session_view, prompt_safe_memory) -> list[dict]`

该入口同时服务：

- `BaseAgent.stream_llm_call()`
- `ReportAgent._call_llm()`

### 必删旧路径

以下行为必须从 agent 初始消息中删除：

- `skills.md（规范摘要）` 整段拼接
- `shared.md（节选）` 工具目录大段拼接
- `## Prompt Skill（agent_key）` 手工拼接块

涉及文件至少包括：

- `recon.py`
- `analysis.py`
- `orchestrator.py`
- `verification.py`
- `business_logic_recon.py`
- `business_logic_analysis.py`
- `report.py`

### prompt-safe memory loader

必须新增 prompt-safe memory 读取路径，满足：

- 不再把 `skills.md` 头部当默认技能来源
- 不再把 `shared.md` 中 `tool_catalog_sync` 大段正文整段搬进 prompt
- `skills.md` / `shared.md` 继续保留给 debug、排障、历史回放

## skill_selection 解析与 turn 处理

### 统一解析位置

`skill_selection` 必须在共享 ReAct 解析器 `react_parser.py` 中统一解析。

`ParsedReactResponse` 新增：

- `selected_skill_id: str | None`
- `protocol_error_code: str | None`
- `protocol_error_detail: str | None`

### 接入范围

所有直接或间接调用 `parse_react_response()` 的路径都必须迁移，至少覆盖：

- orchestrator
- recon
- analysis
- verification
- report
- business_logic_recon
- business_logic_analysis
- business_logic_scan
- skill_test

若无法逐个迁移，则必须引入统一 BaseAgent turn-handler 收敛。

## 工具门禁与统一 enforcement contract

### 设计结论

不能再写成“把硬门禁挂在 `BaseAgent.execute_tool()` 就全覆盖”，因为 `ReportAgent` 有私有工具路径，复合工具也可能二次调度。

### 新增统一守卫

新增：

- `SkillEnforcementGuard.check_tool_access(resolved_tool_name, caller, session_view) -> GuardDecision`

必须接入的调用点：

- `BaseAgent.execute_tool()`
- `ReportAgent._execute_tool()`
- 所有复合工具内部二次调度点

### scan-core 硬门禁

执行顺序固定为：

1. 先做 alias / virtual tool 归一化
2. 得到 canonical `resolved_tool_name`
3. 若其属于 scan-core canonical skill，则进入 guard
4. 若当前 agent/worker session 未加载该 skill，则拒绝执行

稳定错误元信息至少包含：

- `error_code="skill_not_loaded"`
- `required_skill_id=<canonical skill id>`
- `caller=<agent or internal>`

### 复合工具规则

对 `verify_reachability` 这类复合工具，必须明确二选一：

1. 作为 host/internal-only tool，对模型不可见，内部调用可带 `caller=internal_host` 豁免
2. 作为可见 tool，对其内部依赖的 scan-core skill 做前置校验

本轮默认采用方案 1：host/internal-only，不纳入 unified skill catalog。

## 前端兼容与展示迁移

### 兼容目标

本轮不仅要保证 API 不崩，还要消除“前端自己适配”前提。

### 必须覆盖的前端消费面

- `SkillToolsPanel`
- `externalToolsViewModel`
- `ScanConfigExternalToolDetail`
- `PromptSkillsPanel`
- skill test 页面
- 创建任务相关对话框中 `use_prompt_skills` 请求兼容

### 明确要求

- 对 `namespace=scan-core`，后端必须直接提供前端展示 metadata
- prompt-effective catalog/detail 必须返回：
  - `agent_key`
  - `display_name`
- 前端不得通过解析 `prompt-analysis@effective` 自行猜测 agent 归属

## 迁移顺序

### Phase A：先切断旧 prompt 主路径

1. 新增 `build_runtime_messages(...)`
2. 新增 prompt-safe memory loader
3. 删除各 agent 初始消息里的 `skills.md/shared.md/prompt_skills` 手工拼接

### Phase B：补 runtime state 与统一 guard

4. 实现 `TaskHostSkillCache`
5. 实现 `AgentOrWorkerSkillSession`
6. 实现 `SkillEnforcementGuard`
7. 把 `BaseAgent.execute_tool()`、`ReportAgent._execute_tool()`、复合工具链路接到统一 guard

### Phase C：补 unified data sources

8. 实现 registry loader
9. 实现 prompt-effective resolver
10. 实现 unified catalog / detail loader

### Phase D：补解析协议

11. 扩展 `react_parser.py`
12. 迁移所有 parser 调用面
13. 落 `skill_selection -> detail load -> session update -> next turn` 闭环

### Phase E：对外开放增量接口

14. `/skills/catalog` 增量返回 unified 字段与 scan-core 展示字段
15. `/skills/{id}` 返回统一 detail + 旧字段兼容矩阵
16. `/config` 新增 `unifiedSkillAvailability`，保留旧 `skillAvailability`

### Phase F：前端 rollout gate

17. 前端从后端 metadata 驱动 scan-core 列表/详情页
18. 前端接入 prompt-effective 的 `display_name/agent_key`
19. 完成前端迁移后，才允许把 workflow / prompt skill 纳入默认 UI 展示面

## 禁止的半成品

- API 已切 unified，但 agent 仍然整段注入 `skills.md`。
- 只收敛了 `skills.md`，却继续把 `shared.md` 中 `tool_catalog_sync` 的正文整段塞进 prompt。
- `/config.skillAvailability` 被 silent flip 为 unified keyspace。
- `loaded_skill_ids` 仍作为任务级全局状态在并行 worker 间共享。
- 门禁只挂在 `BaseAgent.execute_tool()`，遗漏 `ReportAgent` 和复合工具。
- 只有主线 agent 接入了 `skill_selection`，`business_logic_scan` / `skill_test` 仍走旧解析。
- prompt-effective 被当作启动期静态 registry 产物。
- scan-core 展示字段仍依赖前端本地静态 catalog。
- 旧测试页仍默认 workflow/prompt skill 可调用 `/test` / `/tool-test`。

## 测试计划

### 接口测试

- `/skills/catalog` 同时返回 tool、workflow、prompt 三类 skill
- `namespace=scan-core` 时返回 scan-core 展示字段
- `/skills/{id}` 返回统一 detail 与完整旧字段兼容矩阵
- `/config.skillAvailability` 保持旧语义
- `/config.unifiedSkillAvailability` 返回统一新视图

### prompt-effective 测试

- builtin 全开时，五个 effective prompt skill 都可见
- builtin 部分关闭时，对应 effective detail 正确降级
- 仅 global custom 时，所有 agent 的 effective detail 都包含 global custom
- 仅 agent-specific custom 时，只影响对应 `agent_key`
- 无 active source 时，catalog 仍可见但 `runtime_ready=false`
- user-scoped 查询不会串用户数据

### runtime / session / worker 测试

- 任务启动后创建 `TaskHostSkillCache`
- worker 继承只读 catalog/detail cache，不继承其他 worker 的 `loaded_skill_ids`
- `loaded_skill_ids` 只在 agent/worker 级有效
- 重复选择同一 skill 走 host detail cache

### parser / protocol 测试

- `react_parser.py` 能解析单个 `skill_selection`
- `skill_selection` + `Action` 返回协议错误
- `skill_selection` + `Final Answer` 返回协议错误
- 所有 parser 调用面行为一致

### enforcement 测试

- 未加载 detail 时，scan-core 工具被拒绝
- 已加载 detail 后，scan-core 工具可执行
- `ReportAgent` 私有工具路径也受 guard 控制
- 复合工具不会绕过 guard
- 非 scan-core 内部工具不被误拦截

### 前端兼容测试

- `SkillToolsPanel` 不再依赖本地静态 catalog 才能正确展示 scan-core
- `ScanConfigExternalToolDetail` 可消费 unified detail + 旧字段兼容 shape
- `PromptSkillsPanel` 可消费 prompt-effective `display_name/agent_key`
- 任务创建请求继续允许发送 `use_prompt_skills`

### 部署 / 发布测试

- 预生成 registry 缺失时，正式环境 readiness 失败
- 开发 compose 缺失 registry 时，系统降级为 `scan-core only`
- 空 source roots 不会覆盖掉旧 registry
- 升级 / 回滚时 registry version 校验生效
- 生产环境禁用从 `main` 自动安装 skill

## 验收标准

- 模型无法再依靠直接读 skill 文件完成 skill 发现。
- 宿主能够通过 `/skills/catalog -> skill_selection -> /skills/{id}` 完成完整 skill 选择与加载闭环。
- scan-core 门禁覆盖 `BaseAgent`、`ReportAgent` 和复合工具。
- worker 间不共享 loaded-state。
- prompt-effective 只在 DB ready 后按用户实时计算。
- scan-core 页面不再依赖前端本地静态 catalog 才能正确展示。
- 旧 `skillAvailability`、scan-core detail 页、skill test 页不被破坏。
- 正式发布环境不依赖启动时联网拉取 `main` 分支 skill。

## 默认假设

本文件只保留以下显式默认值，不再依赖隐含前提：

- 正式环境默认使用预生成 workflow registry，而不是启动时构建。
- 默认开发 compose 不作为 unified workflow runtime 验收环境。
- `use_prompt_skills` 仅保留请求兼容，不再控制 prompt-effective 是否进入 unified catalog。
- `unifiedSkillAvailability` 是本轮新增字段，旧 `skillAvailability` 保持兼容。
- host 只共享 catalog/detail cache，不共享 loaded-state。
