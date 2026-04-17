# Recon 阶段 SubAgent 化重构规划

## 1. 背景

当前常规 Recon 已具备 `recon_count` 并发配置，但主调度仍未完全收口到 Host 工具调用模型：

- `AuditWorkflowEngine._run_recon_phase()` 只调度一次 `recon` 子 Agent，直到 Recon 队列非空或达到兜底重试上限。
- `ReconAgent` 同时承担了项目建模、重点目录识别、候选风险搜索、上下文确认、风险点入队、coverage 汇总等全部职责。
- Analysis / Verification 已经具备独立 worker + 并发数可配置的执行模型，但 Recon 阶段还没有类似的 fan-out / fan-in 机制。
- 用户工作流已支持 `recon_count`，但当前实现中 Recon fan-out 仍存在 Engine 直接驱动路径。

这导致几个问题：

1. Recon 的职责边界过大，提示词和会话状态都比较重。
2. 项目级广度扫描完全串行，难以利用已有的异步 worker runtime 能力。
3. Recon 的“项目建模”与“模块侦查”混在一起，后续如果要做模块级进度、失败重试、覆盖率统计，会越来越难维护。
4. 现有 legacy `SubAgentExecutor` / `CreateSubAgentTool` 存在，但它偏自由派发，不适合直接作为 Workflow Recon 主链路的正式运行时边界。

## 2. 重构目标

本轮重构目标是把常规 Recon 拆成“Host 建模 + Tool 驱动 SubAgent 侦查”的两层模型：

- `ReconAgent` 只负责项目建模与模块规划，不再承担所有模块的具体侦查细节。
- 新增 `ReconSubAgent`（命名可再定），每个 SubAgent 只负责一个模块/子域的侦查。
- Recon SubAgent 由 `ReconAgent` 通过工具按需调用，可异步并发，且并发数与 Analysis / Verification 一样由用户手动配置。
- `ReconAgent` 在单次 Workflow Run 内固定只启动 1 个 Host 实例；并发只作用于其派发的 `ReconSubAgent` 数量。
- 保持 Workflow 主阶段顺序不变，仍然是 `Recon -> Analysis -> Verification -> Report`。
- 保持 Recon 队列作为 Analysis 的唯一权威输入源，不改变下游队列驱动语义。

## 3. 非目标

本轮不做以下事情：

- 不把 Recon 拆成独立服务或独立进程。
- 不重写顶层 `WorkflowOrchestratorAgent` 的阶段推进逻辑。
- 不把 BusinessLogicRecon 一起并入本次重构；本次先只收口常规 Recon。
- 不直接启用 legacy `create_sub_agent` 工具作为 Recon 主执行路径。
- 不顺带改造 Analysis / Verification 的协议，只在必要时抽取可复用的 worker 组件。

## 4. 当前代码锚点

### 4.1 Recon 与 Workflow 主链路

- `backend/app/services/agent/agents/recon.py`
- `backend/app/services/agent/workflow/engine.py`
- `backend/app/services/agent/workflow/workflow_orchestrator.py`
- `backend/app/api/v1/endpoints/agent_tasks_execution.py`

### 4.2 并发 worker 与并发配置

- `backend/app/services/agent/workflow/parallel_executor.py`
- `backend/app/services/agent/workflow/models.py`
- `backend/app/services/agent/workflow/user_runtime_config.py`
- `backend/app/services/agent/workflow/config.yml`
- `backend/app/api/v1/endpoints/config.py`
- `frontend/src/pages/ScanConfigIntelligentEngine.tsx`

### 4.3 可参考但不建议直接复用为主链路的 SubAgent 入口

- `backend/app/services/agent/core/executor.py`
- `backend/app/services/agent/tools/agent_tools.py`
- `docs/deer-flow-runtime-phases/phase3-isolated-subagent-runtime.md`

结论：

- Workflow 正式主链路已经有“受控并发 worker”模式，应该沿这个方向扩展 Recon。
- legacy `SubAgentExecutor` 更适合作为兼容层，不适合直接成为 Recon 正式调度内核。

## 5. 目标架构

### 5.1 角色拆分

#### ReconHostAgent（保留现有 `ReconAgent` 名字）

职责：

- 建立项目地图。
- 识别模块边界。
- 生成模块级侦查计划。
- 派发 Recon SubAgent 任务。
- 汇总模块结果、做去重、更新 coverage、向 Recon 队列发布风险点。
- 决定是否需要补充兜底 Recon。

不再负责：

- 对每个模块逐文件地毯式深挖。
- 直接把所有候选点都在同一长会话里完成侦查。

#### ReconSubAgent（新增）

职责：

- 接收单个模块的 handoff。
- 只在模块作用域内做侦查。
- 输出结构化 `risk_points`、`coverage_summary`、`module_summary`、`evidence_refs`。
- 不负责全项目建模，不跨模块扩散扫描。

### 5.2 运行时分层

建议采用下面的执行模型：

1. `AuditWorkflowEngine` 进入 Recon 阶段。
2. `AuditWorkflowEngine` 只调度一次 `ReconAgent`（Host）。
3. `ReconAgent` 在会话内先建模，再按需调用 `run_recon_subagent` 工具。
4. `run_recon_subagent` 工具在受控并发下执行多个 `ReconSubAgent`，返回结构化模块结果给 Host。
5. Host 归并 `ReconModuleResult` 并发布到 `recon_queue`。
6. Recon 完成后，下游 Analysis 保持现有逻辑不变。

这里不建议直接把 Recon 硬塞进现有 `ParallelPhaseExecutor.run_parallel_analysis()` 风格循环，原因是：

- Analysis / Verification 是“队列消费型并行”。
- Recon 是“Host 决策 + 工具驱动 worker fan-out/fan-in 型并行”。
- 两者的调度对象和结果归并模型不同，强行共用一个大类会让 `ParallelPhaseExecutor` 继续膨胀。

建议将并发执行入口下沉到工具层：

- `run_recon_subagent`（工具）

工具内部可复用 `ReconModuleExecutor`，但它不再是 Workflow Engine 的主调度入口。

## 6. 核心数据结构建议

## 6.1 `ProjectReconModel`

```python
@dataclass
class ProjectReconModel:
    project_root: str
    languages: list[str]
    frameworks: list[str]
    entry_points: list[str]
    key_directories: list[str]
    module_descriptors: list[ReconModuleDescriptor]
    global_risk_themes: list[str]
    cross_cutting_paths: list[str]
```

作用：

- 作为 Host 阶段的结构化产物。
- 作为所有 Recon SubAgent 的公共上游上下文。

## 6.2 `ReconModuleDescriptor`

```python
@dataclass
class ReconModuleDescriptor:
    module_id: str
    name: str
    module_type: str  # api / auth / admin / payment / worker / frontend / storage / shared / cross_cutting
    paths: list[str]
    entrypoints: list[str]
    language_hints: list[str]
    framework_hints: list[str]
    risk_focus: list[str]
    priority: int
    estimated_size: int
```

最关键的是 `paths + risk_focus + priority`，这三项决定 SubAgent 的扫描边界和调度顺序。

## 6.3 `ReconModuleTask`

```python
@dataclass
class ReconModuleTask:
    task_id: str
    module: ReconModuleDescriptor
    project_model: ProjectReconModel
    attempt: int
    fallback_context: str | None = None
```

## 6.4 `ReconModuleResult`

```python
@dataclass
class ReconModuleResult:
    module_id: str
    success: bool
    risk_points: list[dict[str, Any]]
    files_read: list[str]
    files_discovered: list[str]
    directories_scanned: list[str]
    input_surfaces: list[str]
    trust_boundaries: list[str]
    target_files: list[str]
    summary: str
    error: str | None = None
```

## 7. 模块建模设计

### 7.1 Host 的第一阶段：项目建模

`ReconHostAgent` 先做以下事情：

1. 根目录 `list_files`。
2. 关键子目录 `list_files`。
3. 读取技术栈文件：`package.json`、`requirements.txt`、`pom.xml`、`go.mod`、`next.config.*`、`nest-cli.json` 等。
4. 基于目录和依赖推断模块边界。

### 7.2 模块划分原则

建议优先采用“目录边界 + 业务职能 + 技术入口”三层启发式，而不是只按目录名机械切分。

划分优先级建议：

1. 明确入口模块：`routes/`、`controllers/`、`api/`、`app/api/`、`resolver/`。
2. 业务高风险模块：`auth/`、`admin/`、`payment/`、`upload/`、`webhook/`、`callback/`。
3. 数据/存储模块：`models/`、`repository/`、`dao/`、`db/`、`persistence/`。
4. 跨切面模块：`middleware/`、`guards/`、`filters/`、`interceptors/`、`utils/security`。
5. 前端服务端混合模块：如 Next.js 的 `app/`、`pages/api/`、server action。

### 7.3 模块划分的约束

必须处理下面几个边界：

- 小项目：若无法识别出有效模块，降级成单模块 `root_module`。
- 超大项目：若模块数过多，先按一级域聚合，再在模块内部由 SubAgent 自行下钻。
- 重叠目录：允许一个 `cross_cutting` 模块承接共享中间件、公共鉴权、公共配置，避免每个模块都重复扫一遍。
- 目标文件模式：如果任务本身限制了 `target_files`，模块规划必须以此为上界。

## 8. Recon SubAgent 设计

### 8.1 新增 Agent 类型

建议新增独立 Agent 类，而不是让 Host `ReconAgent` 直接递归调用自己：

- `backend/app/services/agent/agents/recon_subagent.py`

原因：

1. Host prompt 和 worker prompt 的目标完全不同。
2. Host 关注建模与调度，worker 关注模块内侦查。
3. 递归复用同一个 `ReconAgent` 会导致状态字段（如 `_risk_points_pushed`、coverage 汇总、全局目标文件）语义混乱。

### 8.2 Prompt 设计

`ReconSubAgent` 的系统提示应该明确：

- 你只负责当前模块，不负责全项目建模。
- 只能在 `module.paths` 以及 Host 提供的关联入口范围内搜索。
- 输出结构化风险点和 coverage，不输出全项目总结。
- 对跨模块依赖只能记录，不可无限扩散；需要扩散时通过 `cross_module_hints` 交回 Host。

### 8.3 工具白名单建议

SubAgent 建议保留只读侦查工具：

- `list_files`
- `search_code`
- `get_code_window`
- `get_file_outline`
- `get_function_summary`
- `get_symbol_body`
- `locate_enclosing_function`

不建议给 Recon SubAgent 直接开放 legacy `create_sub_agent`，避免递归派生失控。

## 9. 结果归并与队列发布策略

这里建议采用“SubAgent 负责产出结构化结果，Host 负责正式入队”的模式。

### 9.1 推荐模式：Host 统一入队

流程：

1. SubAgent 返回 `risk_points`。
2. Host 统一做：
   - 跨模块去重
   - coverage 合并
   - 风险点补充全局上下文字段
   - 批量 `enqueue_batch` 到 `recon_queue`

优点：

- 保持 Recon 队列的正式写入口在 Host。
- 更符合当前文档里“worker 不拥有 queue 真相源”的方向。
- 更容易统计“哪个模块贡献了哪些风险点”。

### 9.2 兼容模式：SubAgent 直接入队

这个模式改动更小，但不建议作为最终方案。

问题：

- queue 写入分散到多个 worker，Host 很难做模块级精确统计。
- 后续想做 checkpoint / partial retry 时边界不清晰。

因此本规划建议采用 9.1。

## 10. 并发控制设计（单 Host + SubAgent 并发）

### 10.1 新增用户配置项（语义澄清）

现有配置只包含：

- `analysis_count`
- `verification_count`

需要扩展为：

- `recon_count`
- `analysis_count`
- `verification_count`

其中：

- `recon_count` 表示**单个 `ReconHostAgent` 可同时运行的 `ReconSubAgent` 最大数量**。
- `recon_count` **不表示** `ReconAgent` 实例数。
- `ReconAgent` 实例数固定为 1（每个 task 的 Recon 阶段只允许一个 Host）。

对应修改点：

- `backend/app/services/agent/workflow/user_runtime_config.py`
- `backend/app/api/v1/endpoints/config.py`
- `frontend/src/pages/ScanConfigIntelligentEngine.tsx`
- `frontend/src/shared/api/database.ts`
- `backend/app/api/v1/endpoints/agent_tasks_execution.py`
- `backend/app/services/agent/workflow/config.yml`

### 10.2 `WorkflowConfig` 扩展

建议新增：

```python
class WorkflowConfig:
    enable_parallel_recon: bool = True
    recon_host_instances: int = 1  # 固定值，不开放用户配置
    recon_max_workers: int = 3
```

并增加：

```python
@property
def effective_recon_workers(self) -> int:
    if not self.enable_parallel_recon:
        return 1
    return max(1, self.recon_max_workers)

@property
def should_parallelize_recon(self) -> bool:
    return self.effective_recon_workers > 1
```

### 10.3 调度语义

Recon SubAgent 并发语义与 Analysis/Verification 对齐，但增加 Host 单实例约束：

1. 每个 Workflow task 的 Recon 阶段仅启动一个 `ReconHostAgent`（`recon_host_instances = 1`）。
2. Host 建模后按模块 fan-out，SubAgent 的有效并发为：
   `effective_workers = min(recon_count, module_count, system_safety_cap)`。
3. `recon_count = 1` 时，降级为串行模块侦查（仍是单 Host）。
4. `recon_count > 1` 时，启用并行模块侦查（仍是单 Host）。
5. 并发上限只限制模块 worker/SubAgent 数，不影响后续 Analysis/Verification 的 worker 数。

## 11. Workflow 侧改造建议

### 11.1 `AuditWorkflowEngine`

建议把 `_run_recon_phase()` 收敛为“单次调度 ReconHost”：

1. Engine 只调度一次 `recon` 子 Agent（Host）。
2. Host 在会话内按需调用 `run_recon_subagent` 工具。
3. Host 统一归并并入队，Engine 只负责阶段成功/失败与重试兜底。

`_run_recon_until_queue_ready()` 保持原有兜底框架，但重试语义改成：

- 第一次：Host 建模 + 工具化 SubAgent 侦查
- 若队列仍空：Host 扩大覆盖并再次按需调用工具

### 11.2 状态与步骤记录

`WorkflowStepRecord` 目前以 phase 粒度记录；重构后建议：

- 继续保留 `phase=RECON`
- `agent` 字段细分为：
  - `recon_host`
  - `recon_subagent_tool`（可选，按工具调用记录）
- `injected_context` 记录 `module_id / module_paths / priority`

这样不需要改 phase 枚举，也能在日志与前端事件层面展示模块级进度。

## 12. 执行器与工具设计建议

### 12.1 新增 `run_recon_subagent` 工具

建议落点：

- `backend/app/services/agent/tools/recon_subagent_tool.py`

核心职责：

- 接收 Host 传入的建模上下文或模块选择条件
- 在工具内受控并发执行 `ReconSubAgent`
- 收集 `ReconModuleResult`
- 归并为 Host 可消费的结构化结果（含 `risk_points` / `coverage_summary`）
- 处理取消和部分失败
- 把结果回传给 `ReconAgent`

接口示意：

```python
class RunReconSubAgentTool(AgentTool):
    async def _execute(
        self,
        action: Literal["plan", "run"] = "run",
        module_ids: list[str] | None = None,
        max_workers: int | None = None,
        max_modules: int | None = None,
        force_rerun: bool = False,
    ) -> ToolResult:
        ...
```

### 12.2 是否复用 `ParallelPhaseExecutor`

建议：

- 不直接把 Recon 模块 fan-out 混进 `ParallelPhaseExecutor` 主类。
- 可在工具内部复用 `ReconModuleExecutor` 的并发执行能力（worker clone / cancel callback / usage 汇总）。

## 13. 结果模型与观测性

### 13.1 `orchestrator._agent_results`

建议新增/调整：

```python
_agent_results["recon"] = {
    "project_model": {...},
    "module_count": 8,
    "module_results": [...],
    "risk_points_pushed": 23,
    "coverage_summary": {...},
    "_run_success": True,
}
```

### 13.2 事件流

建议为前端与日志增加以下事件：

- `recon_modeling_started`
- `recon_modeling_completed`
- `recon_module_discovered`
- `recon_subagent_started`
- `recon_subagent_completed`
- `recon_subagent_failed`
- `recon_merge_completed`

这样后面前端如果要展示 Recon 内部进度，不需要再改后端主流程语义。

## 14. 具体改动清单

### 14.1 必改文件

- `backend/app/services/agent/agents/recon.py`
- `backend/app/services/agent/workflow/engine.py`
- `backend/app/services/agent/tools/recon_subagent_tool.py`
- `backend/app/services/agent/workflow/models.py`
- `backend/app/services/agent/workflow/user_runtime_config.py`
- `backend/app/services/agent/workflow/config.yml`
- `backend/app/api/v1/endpoints/config.py`
- `backend/app/api/v1/endpoints/agent_tasks_execution.py`
- `frontend/src/pages/ScanConfigIntelligentEngine.tsx`
- `frontend/src/shared/api/database.ts`

### 14.2 建议新增文件

- `backend/app/services/agent/agents/recon_subagent.py`
- `backend/app/services/agent/tools/recon_subagent_tool.py`
- `backend/app/services/agent/workflow/recon_models.py`
- `backend/tests/test_recon_executor.py`
- `backend/tests/test_recon_module_modeling.py`

## 15. 分阶段实施顺序

### Phase A：配置与契约先行

目标：先把运行时契约补齐，不碰大逻辑。

1. 增加 `recon_count` 配置读写链路。
2. 扩展 `WorkflowConfig`。
3. 扩展 `agent_tasks_execution._build_workflow_config_from_user_config()`。
4. 前端设置页增加 Recon SubAgent 并发输入项（文案避免误解为多 ReconAgent）。

验收标准：

- 用户可以看到并保存 `recon_count`。
- 任务启动时 `WorkflowConfig.recon_max_workers` 生效。

### Phase B：建模与模块描述落地

目标：把 Host 的“项目建模”和“模块规划”独立出来。

1. 从 `ReconAgent` 提取项目建模逻辑。
2. 定义 `ProjectReconModel` 和 `ReconModuleDescriptor`。
3. 增加单模块降级策略。

验收标准：

- 不执行 SubAgent 时，也能输出稳定的模块列表。
- 小项目与 target_files 模式都能给出正确模块规划。

### Phase C：Recon SubAgent 与工具化执行落地

目标：让模块级侦查由 Host 按需触发并发运行。

1. 新增 `ReconSubAgent`。
2. 新增 `run_recon_subagent` 工具（内部可复用执行器）。
3. Host 通过工具按需触发模块任务并收集结果。
4. Host 统一发布到 Recon 队列。

验收标准：

- `recon_count > 1` 时，多模块可并发完成。
- 取消、异常、部分失败可控。
- Recon 队列结果与串行模式语义一致。

### Phase D：补充可观测性与重试策略

目标：提升工程可维护性。

1. 增加模块级事件与日志。
2. 增加模块级 `WorkflowStepRecord`。
3. 调整 `_run_recon_until_queue_ready()` 的 retry 策略，使其基于“模块结果为空/覆盖不足”而不是纯空队列。

## 16. 测试计划

### 16.1 单元测试

1. `test_recon_user_runtime_config_supports_recon_count`
   - 验证 `recon_count`（SubAgent 并发上限）的默认值、范围校验、保存与加载。
2. `test_build_workflow_config_from_user_config_includes_recon_count`
   - 验证任务启动时 `recon_max_workers` 生效，且不影响 Host 单实例约束。
3. `test_workflow_config_recon_host_instances_is_fixed_one`
   - 验证 `recon_host_instances` 固定为 1，不受用户配置影响。
4. `test_recon_module_modeling_fallback_to_single_module`
   - 验证小项目回退单模块。
5. `test_recon_module_modeling_respects_target_files`
   - 验证 target_files 限制可以裁剪模块边界。
6. `test_recon_module_result_merge_deduplicates_risk_points`
   - 验证跨模块重复风险点会被去重。

### 16.2 执行器测试

1. `test_run_recon_subagent_tool_respects_max_workers`
2. `test_run_recon_subagent_tool_collects_partial_failures`
3. `test_run_recon_subagent_tool_handles_cancellation`
4. `test_run_recon_subagent_tool_serial_fallback_when_worker_count_is_one`

### 16.3 Workflow 集成测试

1. `test_workflow_engine_recon_agent_calls_run_recon_subagent_tool_and_populates_recon_queue`
2. `test_workflow_engine_parallel_recon_keeps_analysis_verification_unchanged`
3. `test_workflow_engine_recon_retry_when_all_modules_return_empty`

### 16.4 API / Frontend 测试

1. `GET /config/agent-workflow` 返回 `recon_count`
2. `PUT /config/agent-workflow` 可更新 `recon_count`
3. 前端配置页可展示、重置、保存 `Recon(SubAgent) / Analysis / Verification` 三项并发设置

## 17. 主要风险

### 风险 1：模块切分不稳定

问题：不同技术栈下，模块边界可能不稳定，导致 worker 粒度过粗或过细。

缓解：

- 先做保守切分。
- 小模块允许合并。
- 无法确定时降级成单模块。

### 风险 2：跨模块重复扫描导致重复风险点

问题：共享中间件、公共 DAO、公共 helper 可能被多个模块重复命中。

缓解：

- Host 层统一做风险点去重。
- 允许单独的 `cross_cutting` 模块承接共享基础设施代码。

### 风险 3：并发 Recon 带来 token/工具开销上升

问题：Recon 并发后，整体 LLM 与工具开销会上升。

缓解：

- 默认 `recon_count` 保守，例如 2 或 3。
- Host 先按优先级调度高价值模块。
- 允许用户手动下调并发。

### 风险 4：把 queue 写入分散到 worker 会弱化主链路边界

缓解：

- 采用 Host 统一入队，而不是 worker 直接入队。

## 18. 推荐默认实现决策

为了控制复杂度，建议本轮直接采用下面这组实现决策，不要在第一版里摇摆：

1. 保留 `ReconAgent` 作为 Host，不改名字。
2. 新增 `ReconSubAgent`，不要让 `ReconAgent` 递归调用自己。
3. 新增 `run_recon_subagent` 工具，Recon fan-out 由 Host 在会话内按需触发。
4. 新增 `recon_count`（仅表示 SubAgent 并发上限），并与用户现有的 Analysis / Verification 并发设置并列。
5. 采用“SubAgent 返回结果，Host 统一入队”的结果归并模式。
6. 本轮先不动 BusinessLogicRecon。

## 19. 实施后的预期收益

完成后，Recon 阶段会具备下面这些工程特性：

- 责任更清晰：建模与侦查分离。
- 性能更好：模块级异步并发。
- 可观测性更好：可以看到模块级进度与失败点。
- 扩展性更好：后续可为特定模块挂接专门 Recon 策略。
- 与当前 Workflow 架构更一致：Recon / Analysis / Verification 都具备显式的 worker 并发模型。

## 20. 建议的第一批落地顺序

如果下一步开始实现，建议严格按下面顺序推进：

1. 先补 `recon_count` 配置链路。
2. 再抽 `ProjectReconModel` / `ReconModuleDescriptor`。
3. 再新增 `ReconSubAgent`。
4. 再实现 `run_recon_subagent` 工具（可复用执行器）。
5. 最后把 `AuditWorkflowEngine` Recon 阶段切到“单次调度 ReconHost + 工具化 SubAgent”。

这样做的原因很简单：先把契约和配置打稳，再替换执行路径，回归成本最低。
