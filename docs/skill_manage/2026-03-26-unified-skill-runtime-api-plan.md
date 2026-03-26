# Unified Skill Runtime API 开发拆解

## 文档定位

- 类型：Implementation plan
- 日期：2026-03-26
- 主题：将当前可用 skill 与 skill 调用流程接口化，替代“模型直接读 skill 文件”的模式
- 目标读者：后续负责落地后端 runtime、skills API、prompt 注入和工具门禁的开发者

## 摘要

本次改造把当前 skill 获取与使用方式统一收敛为 API 驱动协议，覆盖三类能力：

1. `scan-core` 工具型 skill
2. registry mirror 的 workflow skill
3. 按 `agent_key` 聚合后的 effective prompt skill

运行时从“模型自行读文件决定该用什么 skill”切换为“宿主先给 catalog 摘要，模型显式选择 skill，宿主再加载对应 detail 文档”。整体目标是强化 skill 指向性、减少 prompt 膨胀、统一 skill 真相源，并把 skill 加载状态变成显式 runtime 状态。

本拆解在原计划基础上补齐四个缺口：

- 把当前仓库中并不存在的 `AgentRuntimeSession` 最小实现纳入本轮前置。
- 把 `skill_selection` 协议明确挂到统一解析点，而不是留给各 agent 自行判断。
- 把 prompt skill 从“任务启动时一次性字符串拼接”切到真正的 runtime effective skill。
- 把 scan-core 硬门禁的触发位置、豁免范围、错误语义写成确定规则。

## 已锁定决策

- 本轮先补最小可用 `AgentRuntimeSession`，不把它作为外部已完成前提。
- workflow skill 继续以 `backend/scripts/build_skill_registry.py` 产出的 manifest/mirror 为 canonical source。
- scan-core 工具硬门禁同轮严格上线，不做先告警后拦截的灰度模式。
- v1 仍然严格单选 skill，不支持一次选择多个 skill。
- 无 active source 的 `prompt-<agent_key>@effective` 仍保留在 catalog 中，但 `runtime_ready=false`。
- `docs/agent-tools` 本轮不进入 unified catalog 的 canonical source，只保留 debug / 文档参考价值。

## 目标与边界

### 目标

- 让模型只能通过接口获得可用 skill 概览，而不是直接读 skill 文件。
- 让模型在需要 skill 时先显式选择一个 skill，再获取该 skill 的使用文档。
- 统一 `/skills/catalog`、`/skills/{id}`、`/config.skillAvailability`、runtime prompt 注入、prompt skill 投影之间的口径。
- 引入真正的 runtime session 技能加载状态，记录 `loaded_skill_ids`、active skill 和 detail 缓存。
- 对 scan-core 工具建立硬门禁：未先完成 skill 选择与 detail 加载时，不允许直接调用工具。

### 非目标

- 不新增第二套 runtime 专用 skill API，继续复用现有 `/skills/*`。
- 不在本轮做多选 skill 协议。
- 不在本轮完成 Phase 1 全量 session 重构、history compaction、checkpoint/recovery。
- 不在本轮把 `docs/agent-tools` 全量改造成可执行 skill。
- 不在本轮重写 `build_skill_registry.py` 的镜像生成流程，只复用其输出。

## 当前现状

当前仓库里与本次改造直接相关的事实如下：

- `/skills/catalog` 与 `/skills/{id}` 当前只服务 `scan-core`，实现位于 `backend/app/api/v1/endpoints/skills.py`。
- `scan-core` 元数据来自 `backend/app/services/agent/skills/scan_core.py`。
- workflow skill 已可通过 `backend/scripts/build_skill_registry.py` 生成 mirror、manifest、aliases 和 `SKILLS.md`，但 runtime 尚未真正消费。
- prompt skill 当前仍是按 `agent_key` 自动拼接到任务配置里，而不是作为一个可被选择的 runtime skill。
- 当前 runtime prompt 里仍会带入 `skills.md` 与 `shared.md` 的摘要内容。
- `AgentRuntimeSession` / `RuntimeSessionState` 在仓库中仍未落地，现阶段只有 phase 文档契约，没有实现代码。
- `BaseAgent.execute_tool(...)` 当前没有 skill load guard，scan-core 工具只要在 registry 里就能被调用。
- 共享 ReAct 解析器位于 `backend/app/services/agent/agents/react_parser.py`，当前只解析 `Thought / Action / Action Input / Final Answer`，尚不理解 `skill_selection`。

## 总体设计

### 核心思路

统一 skill runtime 采用两步式协议：

1. 宿主调用 `/skills/catalog`，仅向模型注入 summary-only skill digest。
2. 模型输出一个结构化 `skill_selection`，只包含一个 `skill_id`。
3. 宿主调用 `/skills/{skill_id}` 获取标准化 detail 文档。
4. 宿主把 detail 注入上下文，并记录该 skill 已加载。
5. 模型随后才能使用该 skill 对应的流程文档或工具能力。

这套协议在整个任务中可按需多轮重复触发，不是只在会话开头执行一次。

### 单选协议

v1 固定为单选 skill，不允许一次选择多个 skill。

模型输出格式固定为：

```xml
<skill_selection>
{"skill_id":"search_code"}
</skill_selection>
```

宿主只接受 `skill_id`，不依赖自然语言技能名解析。

如果同一回复中同时出现以下任一组合，宿主一律视为协议错误，不执行工具也不接受最终答案：

- `skill_selection` + `Action`
- `skill_selection` + `Final Answer`
- 多个 `skill_selection`

## Skill 分类与统一 ID 规则

统一 catalog 中固定三类 skill：

### 1. tool skill

- 来源：`scan-core`
- `kind=tool`
- 使用现有 bare `skill_id`
- 示例：`search_code`、`dataflow_analysis`

### 2. workflow skill

- 来源：registry manifest + mirrored skill dir
- `kind=workflow`
- 使用 namespaced `skill_id`
- 示例：`using-superpowers@agents`

### 3. prompt skill

- 来源：builtin prompt skill + 用户 custom prompt skill 的 effective projection
- `kind=prompt`
- 不按每条配置单独暴露，而是按 `agent_key` 暴露 effective 视图
- 固定 `skill_id` 形式：`prompt-<agent_key>@effective`
- 示例：`prompt-analysis@effective`

## 数据源与优先级

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

## Runtime Session 设计

### 设计结论

本次不能继续假设 `AgentRuntimeSession` 已存在。后续实现者必须先补一个最小 session 能力，再接 unified skill runtime。

### 最小实现范围

新增模块目录：

- `backend/app/services/agent/runtime/session.py`
- `backend/app/services/agent/runtime/state.py`

本轮只实现 skill runtime 必需字段，不承接 Phase 1 全量职责。

### RuntimeSessionState 最少字段

- `session_id`
- `skill_load_policy`
- `loaded_skill_ids`
- `active_skill_ids`
- `loaded_skill_docs`
- `active_prompt_skill_docs_by_agent`

建议默认值：

- `skill_load_policy="progressive"`
- `loaded_skill_ids=[]`
- `active_skill_ids=[]`
- `loaded_skill_docs={}`
- `active_prompt_skill_docs_by_agent={}`

### 最小方法集

至少提供以下稳定接口：

- `is_skill_loaded(skill_id: str) -> bool`
- `get_loaded_skill_doc(skill_id: str) -> dict | None`
- `mark_skill_loaded(skill_id: str, detail: dict) -> None`
- `activate_prompt_skill(agent_key: str, detail: dict) -> None`
- `get_active_prompt_skill_for_agent(agent_key: str) -> dict | None`

### 生命周期

1. 任务启动时创建一个 host session。
2. orchestrator 与后续本任务内 agent 共用同一 session。
3. session 在本轮只承担“任务 run 级别的 skill 真相源”，不按 agent 拆分多份副本。
4. 如果后续需要 checkpoint/recovery，再在 Phase 4 基础上扩展，而不是本轮先做临时 task-level dict。

## 公共接口设计

### 统一类型

新增统一内部类型：

- `UnifiedSkillCatalogEntry`
- `UnifiedSkillDetail`
- `RuntimeSkillAvailability`
- `LoadedSkillDoc`

### UnifiedSkillCatalogEntry 固定字段

- `skill_id`
- `name`
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

tool skill 额外保留现有 test metadata，用于兼容现有详情页测试入口。

### GET /skills/catalog

保留现有查询参数语义：

- `q`
- `namespace`
- `limit`
- `offset`

返回结构扩展为：

```json
{
  "enabled": true,
  "total": 0,
  "limit": 20,
  "offset": 0,
  "items": [
    {
      "skill_id": "using-superpowers@agents",
      "name": "using-superpowers",
      "kind": "workflow",
      "namespace": "agents",
      "source": "registry_manifest",
      "summary": "会话开始时检查并选择适用 skill 的流程技能。",
      "selection_label": "using-superpowers",
      "entrypoint": "skills/using-superpowers@agents/SKILL.md",
      "runtime_ready": true,
      "reason": "ready",
      "load_mode": "summary_only",
      "deferred_tools": [],
      "aliases": ["using-superpowers"],
      "has_scripts": true,
      "has_bin": false,
      "has_assets": false
    }
  ]
}
```

新增字段定义：

- `kind`: `tool | workflow | prompt`
- `source`: `scan_core | registry_manifest | prompt_effective`
- `selection_label`: 给模型看的选择标签，宿主最终仍以 `skill_id` 为准
- `runtime_ready`: 当前运行环境是否允许加载该 skill
- `reason`: runtime readiness 的稳定原因
- `load_mode`: catalog 阶段固定为 `summary_only`
- `deferred_tools`: 该 skill detail 加载后才解锁的工具集合

兼容要求：

- 旧字段保留
- 旧客户端忽略新增字段时不应崩溃
- catalog 默认不返回正文

### GET /skills/{skill_id}

detail 返回标准化 usage 文档，不再以原始 `workflow_content` 为主协议。

建议结构：

```json
{
  "enabled": true,
  "skill_id": "prompt-analysis@effective",
  "name": "analysis prompt skill",
  "kind": "prompt",
  "namespace": "prompt-effective",
  "source": "prompt_effective",
  "summary": "分析阶段的有效提示技能视图。",
  "entrypoint": "prompt-effective/analysis",
  "runtime_ready": true,
  "reason": "ready",
  "load_mode": "detail_loaded",
  "when_to_use": [
    "分析阶段需要额外行为约束时"
  ],
  "how_to_apply": [
    "将该提示技能注入 analysis agent 的 runtime preamble",
    "仅在 analysis 阶段生效"
  ],
  "constraints": [
    "只适用于 analysis agent"
  ],
  "deferred_tools": [],
  "resources": [],
  "prompt_sources": [
    {
      "source_type": "builtin",
      "label": "analysis builtin",
      "active": true
    }
  ],
  "effective_content": "围绕单风险点做证据闭环……",
  "raw_content": null
}
```

detail 固定标准字段：

- `kind`
- `source`
- `runtime_ready`
- `reason`
- `load_mode`
- `when_to_use`
- `how_to_apply`
- `constraints`
- `deferred_tools`
- `resources`

按类型补充字段：

- workflow skill：`resource_refs`、`raw_content`
- prompt skill：`agent_key`、`prompt_sources`、`effective_content`
- tool skill：`input_constraints`、`usage_examples`、现有 test metadata

兼容要求：

- 旧的 `workflow_content` / `workflow_error` 字段保留兼容
- `include_workflow=true` 时：
  - workflow skill 填充 `raw_content` 和 `workflow_content`
  - prompt / tool skill 保持 `raw_content=null`、`workflow_content=null`

### /config.skillAvailability

从 scan-core 单源切到 unified availability。

返回至少覆盖：

- tool skill
- workflow skill
- prompt-effective skill

每个 skill availability 至少包含：

- `enabled`
- `startup_ready`
- `runtime_ready`
- `reason`
- `source`
- `kind`

`skillAvailability` 的 key 直接使用 canonical `skill_id`。

## Prompt Skill 投影设计

### 设计结论

prompt skill 不再由 `use_prompt_skills` 决定是否存在，而是默认进入统一 skill 协议。

### 有效视图规则

每个 `agent_key` 暴露一个 effective prompt skill：

- `prompt-recon@effective`
- `prompt-business_logic_recon@effective`
- `prompt-analysis@effective`
- `prompt-business_logic_analysis@effective`
- `prompt-verification@effective`

每个 effective prompt skill 的内容由以下来源合成：

1. builtin template
2. global custom prompt skill
3. agent-specific custom prompt skill

detail 里必须明确显示来源列表与最终合成结果。

### 空来源行为

当某个 effective prompt skill 没有任何 active source 时：

- `/skills/catalog` 仍返回该 skill
- `runtime_ready=false`
- `reason="no_active_prompt_sources"`
- `/skills/{id}` 仍可查询，但 `effective_content=""`
- 该 skill 不可被激活到 agent runtime preamble

### 旧开关处理

`AgentTaskCreate.use_prompt_skills` 视为废弃兼容字段，不再作为 prompt skill availability 门禁。

迁移后语义：

- prompt skill 默认属于 unified skill catalog
- builtin toggle 仅影响 effective content 是否包含 builtin source
- custom rows 是否生效取决于 `is_active`
- 任务启动时不再把 `prompt_skills` 作为大段字符串塞进各 agent 初始消息

## skill_selection 协议接入点

### 统一解析位置

`skill_selection` 必须在共享 ReAct 解析器 `backend/app/services/agent/agents/react_parser.py` 中统一解析，不允许每个 agent 自己再补一套正则。

### 解析规则

在现有 `ParsedReactResponse` 上增加：

- `selected_skill_id: str | None`

解析优先级固定为：

1. 若命中 `<skill_selection>...</skill_selection>`，先解析 selection
2. 若 selection 与 `Action` / `Final Answer` 同时存在，返回协议错误标志
3. 若无 selection，再走现有 `Action` / `Final Answer` 解析逻辑

### 各 agent loop 的统一行为

所有调用 `parse_react_response()` 的 agent loop 都必须先处理 `selected_skill_id`，再决定是否处理 `action` 或 `final`。

处理流程固定为：

1. 若 `selected_skill_id` 存在，宿主加载 detail
2. 若加载成功，更新 session，并把“skill 已加载”的 observation 追加进对话
3. 若加载失败，返回结构化 observation，要求模型重新选择
4. 本回合结束，不继续执行工具

这样做的目标是避免“模型在同一轮里既选 skill 又直接用工具”绕过门禁。

## 硬门禁设计

### 门禁目标

scan-core 工具必须先被 skill detail 解锁，才能执行。

### 门禁位置

硬门禁挂在 `BaseAgent.execute_tool(...)`。

执行顺序固定为：

1. 对 `tool_name` 做现有 alias / virtual tool 归一化
2. 得到 canonical `resolved_tool_name`
3. 判断该工具是否属于 scan-core canonical skill
4. 若属于，则读取当前 `AgentRuntimeSession`
5. 若目标 tool skill 不在 `loaded_skill_ids` 中，则拒绝执行
6. 返回结构化错误，要求先通过 catalog/detail 完成 skill 选择与加载

### 豁免范围

以下工具不受此门禁影响：

- queue / dispatch / save 等非 scan-core 内部工具
- workflow 调度相关工具
- 报告写入工具

判定依据只能是“该工具是否属于 scan-core canonical skill”，不能用“是不是在 `self.tools` 里”这种宽松逻辑。

### 错误语义

以下情况一律要求重选：

- `skill_id` 不存在
- skill 不属于当前 catalog
- `runtime_ready=false`
- detail 加载失败
- 模型未走 selection 协议直接尝试调用 scan-core 工具

未加载就调用工具时，稳定错误元信息至少包含：

- `error_code="skill_not_loaded"`
- `required_skill_id=<canonical skill id>`
- `load_policy="progressive"`

workflow 与 prompt skill 不依赖 `execute_tool` 直接执行，但同样必须遵守“先选 skill，再注入 detail”的宿主协议。

## Prompt 与 Memory 迁移

### 默认 prompt 路径

默认 prompt 不再整段依赖：

- `skills.md` 头部
- `shared.md` 中工具目录大段摘要
- 旧 `prompt_skills` 自动拼接结果

默认主路径改为：

1. summary-only catalog 注入
2. detail 按需加载
3. active prompt skill runtime preamble

### 代码要求

必须新增一个 prompt-safe memory 读取路径，供运行时 prompt 注入使用，满足：

- 不再把 `skills.md` 头部当默认技能来源
- 不再把 `shared.md` 中 `tool_catalog_sync` 大段正文整段搬进 prompt
- `skills.md` / `shared.md` 仍可保留给 debug、排障、历史回放

`MarkdownMemoryStore.load_bundle()` 可以继续保留原行为，但 agent prompt 不能再直接使用它的重摘要输出作为主 skill 来源。

### prompt skill 生效方式

prompt-effective skill 生效方式固定为 runtime prefix / preamble，而不是回退到任务启动时一次性字符串拼接。

实现要求：

- 在 `BaseAgent.stream_llm_call()` 前增加一个统一的 runtime preamble 注入点
- preamble 从 session 读取当前 agent 对应的 active prompt skill detail
- 若没有 active prompt skill，则不注入

## 代码改造范围

### 需要新增的核心服务

- unified skill catalog service
- skill detail loader
- runtime session / session state（最小版）
- skill enforcement guard

### 重点改造文件

- `backend/app/api/v1/endpoints/skills.py`
- `backend/app/api/v1/endpoints/config.py`
- `backend/app/services/agent/skills/scan_core.py`
- `backend/app/services/agent/skills/prompt_skills.py`
- `backend/app/api/v1/endpoints/agent_tasks_execution.py`
- `backend/app/services/agent/agents/base.py`
- `backend/app/services/agent/agents/react_parser.py`
- `backend/app/services/agent/memory/markdown_memory.py`

### 建议新增文件

- `backend/app/services/agent/skills/catalog.py`
- `backend/app/services/agent/skills/loader.py`
- `backend/app/services/agent/runtime/session.py`
- `backend/app/services/agent/runtime/state.py`

### 行为改造重点

- `/skills/*` 从 scan-core 单源切到 unified source
- prompt skill 从“自动拼接配置”切到“effective skill detail 投影 + runtime preamble”
- runtime 从“直接带入 memory 摘要”切到“session + progressive loading”
- 工具执行从“只要在 registry 里就能跑”切到“必须先解锁”

## 迁移顺序

1. 先补最小 `AgentRuntimeSession` 与 `RuntimeSessionState`。
2. 再实现 unified catalog / detail loader，先打通 scan-core + registry_manifest + prompt_effective 合并。
3. 改造 `/skills/catalog` 与 `/skills/{id}`，让接口先返回统一视图。
4. 改造 `/config.skillAvailability`，切到 unified availability。
5. 扩展 `react_parser.py`，统一支持 `skill_selection`。
6. 让 orchestrator、recon、analysis、verification、report、business logic agents 全部接入“先处理 selection，再处理 action/final”的回合逻辑。
7. 在 `BaseAgent.execute_tool(...)` 挂 scan-core 硬门禁。
8. 最后迁移 prompt/memory 注入，移除 `skills.md + shared.md + prompt_skills` 的默认重路径。

## 禁止的半成品

- API 已切 unified catalog，但 agent 仍然整段注入 `skills.md`。
- 只收敛了 `skills.md`，却继续把 `shared.md` 中 `tool_catalog_sync` 的正文整段塞进 prompt。
- `/skills/catalog` 改成 unified catalog，但 `/config.skillAvailability` 仍然是 scan-core 单源。
- skill 命中后会加载正文，但 session 不记录 `loaded_skill_ids`。
- `skill_selection` 解析逻辑散落在多个 agent，各自维护不同的协议细节。
- scan-core 工具门禁只拦一部分 agent，其他 agent 仍可绕过。
- prompt skill 仍然主要依赖 `use_prompt_skills` 在任务创建阶段一次性拼接。
- `docs/agent-tools` 可以覆盖 manifest / scan-core 的 canonical `skill_id` 或 `entrypoint`。

## 测试计划

### 接口测试

- `/skills/catalog` 同时返回 tool、workflow、prompt 三类 skill
- `/skills/{id}` 能返回标准化 detail
- legacy 字段仍存在
- `/config.skillAvailability` 已切到 unified 结果

### prompt skill 测试

- builtin 全开时，五个 effective prompt skill 都可见
- builtin 部分关闭时，对应 effective detail 正确降级
- 仅 global custom 时，所有 agent 的 effective detail 都包含 global custom
- 仅 agent-specific custom 时，只影响对应 `agent_key`
- builtin + global + agent-specific 并存时，detail 的合成顺序与来源列表正确
- 无 active source 时，catalog 仍可见但 `runtime_ready=false`

### runtime/session 测试

- 任务启动后创建 runtime session
- 默认 `skill_load_policy="progressive"`
- 初始 `loaded_skill_ids` 为空
- 成功选择并加载 skill 后，session 状态更新正确
- 重复选择同一 skill 走缓存
- 非法 skill 选择返回结构化错误

### 协议解析测试

- `react_parser.py` 能正确解析单个 `skill_selection`
- `skill_selection` 与 `Action` 同时出现时返回协议错误
- `skill_selection` 与 `Final Answer` 同时出现时返回协议错误
- 多个 `skill_selection` 时返回协议错误

### 硬门禁测试

- 未先加载 detail 时，`execute_tool("search_code", ...)` 被拒绝
- 已加载 `search_code` detail 后，再调用工具可以通过
- 未解锁的 scan-core 工具不能被直接调用
- queue/save/dispatch 等非 scan-core 工具不被误拦截
- workflow / prompt skill 在未选择前不会被自动注入

### prompt/memory 迁移测试

- 默认 prompt 不再依赖 `skills.md` 和 `shared.md` 大段正文
- `skills.md` 快照仍可写入
- `shared.md` 仍可保留 debug 内容
- prompt contract 改为断言存在 `skill_selection` 协议和“先选 skill 再调用”的约束

## 验收标准

- 模型无法再依靠直接读 skill 文件完成 skill 发现。
- 宿主能够通过 `/skills/catalog -> skill_selection -> /skills/{id}` 完成完整 skill 选择与加载闭环。
- 三类 skill 在 unified catalog 中口径一致。
- runtime 能记录已加载 skill 状态。
- 未先加载 detail 的 scan-core 工具无法执行。
- prompt skill 不再依赖 `use_prompt_skills` 的启动时拼接路径。
- 旧 UI 与旧字段兼容不被破坏。

## 默认假设

- v1 严格单选，不支持多选。
- 宿主只接受结构化 `skill_selection`。
- prompt skill 按 `agent_key` 暴露 effective 视图，不暴露每条 DB row。
- `use_prompt_skills` 不再控制 prompt skill 是否进入统一协议。
- 本轮真实引入 session 状态对象，但只做最小 skill runtime 版本。
- workflow skill 的 canonical source 继续是 `build_skill_registry.py` 产出的 manifest/mirror；与 `docs/delete_mcp/delete_mcp_plan.md` 冲突的部分不在本轮采纳。
