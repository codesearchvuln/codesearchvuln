# Phase 2：Skills Progressive Loading

## 目标与边界

### 目标

把当前 `scan_core + registry manifest + docs/agent-tools + skills.md snapshot + shared.md tool catalog excerpt` 的多源技能资产，收敛成统一的 skills runtime，使 agent 默认只看到 skill 摘要，在真正命中后才加载正文和补充资源。

### 范围

- `UnifiedSkillCatalog` 数据源合并协议。
- skill 摘要注入。
- skill 主文档按需加载。
- 引用资源按需展开。
- deferred tool schema exposure。
- `/skills/catalog` 与 `/skills/{id}` 接口扩展。
- `/config` 中 `skillAvailability` 的 unified 视图。
- `loaded_skill_ids` 的 session 跟踪。
- `skills.md` 与 `shared.md` 工具目录两条 prompt 注入链的统一收敛。

### 非目标

- 不在本阶段引入外部 marketplace。
- 不把 skill 正文存入数据库。
- 不重写 `build_skill_registry.py` 的镜像流程，只复用其输出。
- 不要求所有现有 `backend/docs/agent-tools` 内容都转成可执行 skill。

### 哪些模块语义不动

- `backend/scripts/build_skill_registry.py` 的镜像和 manifest 输出职责
- `MarkdownMemoryStore.write_skills_snapshot()` 的兼容快照职责
- tool contract / queue / workflow 领域逻辑

## 当前代码锚点

- `backend/app/services/agent/skills/scan_core.py`
  - 当前 scan-core skill catalog 是 `/skills` API 与 `/config.skillAvailability` 的事实来源。
- `backend/app/api/v1/endpoints/skills.py`
  - 当前 `/skills/catalog`、`/skills/{id}` 只暴露 scan-core 视图。
- `backend/app/api/v1/endpoints/config.py`
  - 当前 `_sanitize_mcp_config()` 直接调用 `build_scan_core_skill_availability([])`，没有 unified catalog 视图。
- `backend/scripts/build_skill_registry.py`
  - 当前会产出 `manifest.json`、`aliases.json`、`SKILLS.md` 和镜像 skill 目录，但 runtime 还未真正消费。
- `backend/docs/agent-tools/SKILLS_INDEX.md`
  - 当前是 docs 侧 skill/tool 索引资料。
- `backend/docs/agent-tools/TOOL_SHARED_CATALOG.md`
  - 当前通过 `_sync_tool_catalog_to_memory()` 被写入 `shared.md`。
- `backend/app/services/agent/memory/markdown_memory.py`
  - `load_bundle()` 会把 `skills.md` 头部与 `shared.md` 尾部一起带入 agent prompt。
- `backend/app/api/v1/endpoints/agent_tasks_execution.py`
- `backend/app/api/v1/endpoints/agent_tasks_mcp.py`
  - `_sync_tool_catalog_to_memory()` 当前会把 `TOOL_SHARED_CATALOG.md` 摘要追加到 `shared.md`。
- `backend/app/services/agent/agents/orchestrator.py`
- `backend/app/services/agent/agents/recon.py`
- `backend/app/services/agent/agents/analysis.py`
  - 当前会把 `markdown_memory["skills"]` 和 `markdown_memory["shared"]` 一起塞进初始 prompt。

## 现状与缺口

### 当前现状

- `scan_core.py` 提供静态 skill catalog，但只覆盖 scan-core 命名空间。
- `build_skill_registry.py` 可以产出 `manifest.json`、`aliases.json` 和镜像 skill 目录，但 runtime 未真正消费这些资产。
- `/skills/catalog`、`/skills/{id}` 当前只暴露 scan-core 视图。
- `/config` 里的 `skillAvailability` 仍然是 scan-core 单源结果。
- `skills.md` snapshot 会作为 prompt 记忆的一部分注入 agent。
- `TOOL_SHARED_CATALOG.md` 会通过 `_sync_tool_catalog_to_memory()` 追加到 `shared.md`，随后也进入 agent prompt。

### 核心缺口

- 多源 skill 没有统一 catalog 协议，API、config、runtime 和 memory 看到的技能集合不一致。
- 初始 prompt 不只重在 `skills.md`，还包含 `shared.md` 中的工具目录摘要；如果不同时收敛，两条链路都会继续膨胀 prompt。
- skill 正文、引用资源、tool schema 没有延迟加载机制。
- session 不记录哪些 skill 已经真正被载入，无法恢复或调试。
- registry manifest、scan-core 和 docs index 之间缺少稳定优先级与 alias 冲突规则。

## 目标状态

### `UnifiedSkillCatalog`

运行时统一 skill 视图由三类数据源合并：

1. **scan-core static catalog**
   - 来源：`backend/app/services/agent/skills/scan_core.py`
   - 角色：内置工具型 skill 的 canonical source
2. **registry manifest**
   - 来源：`backend/scripts/build_skill_registry.py` 产出的 `manifest.json` / `aliases.json` / mirrored `SKILLS.md`
   - 角色：workflow skill 的 canonical source
3. **docs supplemental metadata**
   - 来源：`backend/docs/agent-tools/SKILLS_INDEX.md`、`TOOL_SHARED_CATALOG.md`
   - 角色：补充 summary、load hint、tool grouping、coverage 关系

### 数据源优先级与冲突规则

`UnifiedSkillCatalog` 合并顺序必须固定为：

1. **registry manifest 先确定 workflow skill 的 canonical `skill_id`、namespace、entrypoint、alias**
2. **scan-core 作为内置工具 skill 的 canonical source**
3. **docs supplemental metadata 只能补充展示字段，不能重写 canonical `skill_id` / `entrypoint` / namespace**
4. **`skills.md` 与 `shared.md` 工具目录摘要都不是 canonical source，只是 memory/debug surface**

冲突处理规则：

- mirrored workflow skill 继续沿用 registry manifest 生成的 namespaced `skill_id`，例如 `using-superpowers@agents`
- scan-core 内置 skill 保持当前 bare id，例如 `smart_scan`
- alias 冲突时返回 canonical `skill_id` 列表，不允许文档层偷偷覆盖 manifest / scan-core 的 canonical id
- docs index 中不存在但 manifest / scan-core 已存在的 skill，仍视为有效 skill；docs 只影响展示和 coverage，不影响 existence

### 默认 prompt 注入策略

agent 初始 prompt 只注入：

- `skill_id`
- `name`
- `namespace/source`
- `summary`
- `load_hint`
- `runtime_ready`

agent 命中 skill 后，runtime 才读取：

- `SKILL.md` 正文
- 需要的 `scripts/`、`assets/`、`references/` 元数据
- 对应 deferred tool schema

### `skills.md` 与 `shared.md` 的新定位

#### `skills.md`

- 保留为：
  - 调试快照
  - 运行时镜像摘要
  - memory 回放材料
- 不再作为：
  - 初始 prompt 的主技能来源
  - `/skills/catalog` 的事实来源
  - `/config.skillAvailability` 的事实来源

#### `shared.md` 中的工具目录摘要

- `TOOL_SHARED_CATALOG.md` 仍可继续同步到 `shared.md`，保留排障与历史回放价值。
- 但默认 prompt 注入不能再整段搬运 `tool_catalog_sync` 的正文。
- Phase 2 需要把 `shared.md` 中由 `tool_catalog_sync` 产生的内容降为 compact runtime summary，或在 prompt 构建时明确过滤掉大段工具目录正文。

如果只收敛 `skills.md`，却继续把 `shared.md` 中的 `TOOL_SHARED_CATALOG.md` 摘要整段注入 prompt，视为 Phase 2 未完成。

## 接口/类型定义

### `UnifiedSkillCatalogEntry`

建议字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `skill_id` | `str` | 唯一 skill 标识 |
| `name` | `str` | 展示名称 |
| `namespace` | `str` | `scan-core`、`agents`、`codex` 等 |
| `source` | `Literal["scan_core","registry_manifest","docs_index"]` | 主来源 |
| `summary` | `str` | 默认摘要 |
| `entrypoint` | `str` | skill 装载入口 |
| `runtime_ready` | `bool` | 当前运行环境是否可加载 |
| `load_mode` | `Literal["summary_only","workflow_body","resource_expanded"]` | 当前加载状态 |
| `has_workflow_body` | `bool` | 是否存在 `SKILL.md` 正文 |
| `deferred_tools` | `list[str]` | 仅在命中后暴露 schema 的工具集合 |
| `aliases` | `list[str]` | 别名 |
| `test_supported` | `bool` | 是否支持内置测试入口 |
| `load_hint` | `str` | 触发正文加载的简短提示 |

### `/skills/catalog` 响应扩展

新增字段：

- `source`
- `runtime_ready`
- `load_mode`
- `has_workflow_body`
- `deferred_tools`

要求：

- 旧字段保持兼容。
- 旧客户端忽略新字段时不受影响。
- 分页和查询参数语义不变。

### `/skills/{id}` 响应扩展

新增字段：

- `source`
- `runtime_ready`
- `load_mode`
- `has_workflow_body`
- `deferred_tools`
- `workflow_sources`
- `resource_refs`

### `/config.skillAvailability` 迁移要求

- 现有 `build_scan_core_skill_availability([])` 只能作为 scan-core 输入源 helper，不再作为最终 availability 视图。
- `/config` 响应中的 `skillAvailability` 必须切换为 unified catalog runtime availability：
  - 包含 scan-core skill
  - 包含 registry manifest 镜像 skill
  - 明确 `startup_ready` / `runtime_ready` / `source` / `reason`
- 旧字段结构尽量兼容，避免前端因为 availability 来源改变而崩溃。

### Session 跟踪字段

`RuntimeSessionState.loaded_skill_ids` 必须记录已经从 `summary_only` 升级到正文加载的 skill 集合，供 Phase 4 checkpoint 恢复使用。

## 本 phase 必改文件

- 新增 `backend/app/services/agent/skills/catalog.py`
  - 统一 catalog 合并、查询、详情装载
- 新增 `backend/app/services/agent/skills/loader.py`
  - 摘要注入与正文延迟加载
- 新增 `backend/app/services/agent/skills/deferred_tools.py`
  - skill 命中后的工具 schema 暴露
- 改造 `backend/app/api/v1/endpoints/skills.py`
  - 从 scan-core 单源查询切换为 unified catalog 查询
- 改造 `backend/app/api/v1/endpoints/config.py`
  - `skillAvailability` 改为 unified catalog availability
- 改造 `backend/app/services/agent/skills/scan_core.py`
  - 保持 scan-core 元数据源角色，但不再独占 catalog API
- 改造 `backend/app/services/agent/memory/markdown_memory.py`
  - 继续写 `skills.md` 快照，但不再作为默认 prompt 的主技能来源
- 改造 `backend/app/api/v1/endpoints/agent_tasks_execution.py`
- 改造 `backend/app/api/v1/endpoints/agent_tasks_mcp.py`
  - `tool_catalog_sync` 继续保留，但默认 prompt 注入必须收敛其正文
- 改造 `backend/app/services/agent/agents/*`
  - skill 注入路径统一经 runtime session / skills loader

## 兼容桥接

- `skills.md` 快照继续存在，便于历史任务排查与 memory 回放。
- `TOOL_SHARED_CATALOG.md -> shared.md` 的同步可以继续保留，但从 prompt 注入主路径降级为 debug/history surface。
- `/skills` API 旧字段不删，只增加 unified metadata 字段。
- `/config.skillAvailability` 返回结构尽量保持兼容，避免前端一次性大改。

## 迁移顺序

1. 先定义 `UnifiedSkillCatalogEntry`、三类数据源合并优先级和 alias 冲突规则。
2. 接入 registry manifest + aliases，并让 `/skills/catalog` 返回 unified 视图。
3. 接入 `backend/docs/agent-tools` 作为 supplemental metadata。
4. 把 `/config.skillAvailability` 切到 unified catalog availability。
5. 实现 `summary_only -> workflow_body -> resource_expanded` 的加载状态机。
6. 把 agent 初始 prompt 从 `skills.md + shared.md heavy excerpts` 切换为 summary-only 注入。
7. 最后补 deferred tool schema exposure 和 `loaded_skill_ids` 跟踪。

## 测试入口

### 新增测试

- `test_unified_skill_catalog_merges_scan_core_and_registry_manifest`
- `test_unified_skill_catalog_applies_docs_metadata_without_overwriting_canonical_ids`
- `test_skill_summary_only_prompt_injection`
- `test_skill_body_loads_only_after_match`
- `test_deferred_tool_schema_exposure_is_stable`
- `test_runtime_session_tracks_loaded_skill_ids`
- `test_config_skill_availability_uses_unified_catalog`
- `test_prompt_injection_does_not_replay_full_tool_catalog_sync_excerpt`

### 复用现有测试资产

- `backend/tests/test_skill_registry_builder.py`
  - 验证 registry manifest / aliases 仍是可信输入源。
- `backend/tests/test_skill_registry_api.py`
  - 守住 `/skills` API 的兼容性，并扩展到 unified catalog 视图。
- `backend/tests/test_tool_catalog_memory_sync.py`
  - 验证 `TOOL_SHARED_CATALOG.md` 仍能写入 memory 快照，但不再承担默认 prompt 主来源。
- `backend/tests/test_runtime_tool_docs_coverage.py`
  - 验证 `backend/docs/agent-tools` 索引与 catalog 仍保持覆盖关系。

## 禁止的半成品

- API 已切 unified catalog，但 agent 仍然整段注入 `skills.md`。
- 只收敛了 `skills.md`，却继续把 `shared.md` 中 `tool_catalog_sync` 的正文整段塞进 prompt。
- `/skills/catalog` 改成 unified catalog，但 `/config.skillAvailability` 仍然是 scan-core 单源。
- skill 命中后会加载正文，但 session 不记录 `loaded_skill_ids`。
- registry manifest 和 scan-core 分别走两套冲突处理规则。
- docs supplemental metadata 可以覆盖 manifest / scan-core 的 canonical `skill_id` 或 `entrypoint`。
- `SKILLS.md` 快照、`shared.md` 工具目录摘要、`/skills` API、`/config.skillAvailability` 四套目录继续各说各话。
