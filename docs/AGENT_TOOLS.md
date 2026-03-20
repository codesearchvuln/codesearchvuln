# Agent 工具清单（`agent_tasks.py`）

本文档整理了 `backend/app/api/v1/endpoints/agent_tasks.py` 中各 Agent 实际注入的工具。

- 工具构建入口：`_initialize_tools(...)`
- Agent 注入入口：创建 `ReconAgent / AnalysisAgent / ... / WorkflowOrchestratorAgent` 时传入 `tools=...`

## 1. 总览

| Agent | 工具来源键 | 说明 |
|---|---|---|
| `ReconAgent` | `tools["recon"]` | 侦察阶段：代码浏览 + 风险点入队 |
| `AnalysisAgent` | `tools["analysis"]` | 深入分析：扫描、模式匹配、数据流/控制流/鉴权分析 |
| `VerificationAgent` | `tools["verification"]` | 验证阶段：沙箱执行、漏洞验证、报告生成 |
| `ReportAgent` | `tools["report"]` | 报告阶段：读代码 + 提取函数 + 数据流补证据 |
| `BusinessLogicReconAgent` | `tools["business_logic_recon"]` | 业务逻辑侦察：风险点识别与入队 |
| `BusinessLogicAnalysisAgent` | `tools["business_logic_analysis"]` | 业务逻辑分析：基础阅读 + （可选）发现入队 |
| `WorkflowOrchestratorAgent` | `tools["orchestrator"]` | 编排层：读取代码 + 各类队列消费/状态管理 |

## 2. 共享基础工具（`base_tools`）

以下工具默认被多个 Agent 复用：

- `read_file`
- `list_files`
- `search_code`
- `locate_enclosing_function`
- `think`
- `reflect`

说明：以上由 `base_tools` 定义后通过字典展开注入各 Agent 工具集。

## 3. 各 Agent 详细工具

### 3.1 `ReconAgent`（`tools["recon"]`）

固定工具：

- `read_file`
- `list_files`
- `search_code`
- `locate_enclosing_function`
- `think`
- `reflect`

条件工具（仅当 `recon_queue_service and task_id`）：

- `push_risk_point_to_queue`
- `push_risk_points_to_queue`

用途：把 Recon 阶段识别到的风险点推入 Recon 风险队列。

### 3.2 `AnalysisAgent`（`tools["analysis"]`）

固定工具：

- `read_file`
- `list_files`
- `search_code`
- `locate_enclosing_function`
- `think`
- `reflect`
- `smart_scan`
- `quick_audit`
- `pattern_match`
- `extract_function`
- `dataflow_analysis`
- `controlflow_analysis_light`
- `logic_authz_analysis`

条件工具（仅当 `queue_service and task_id`）：

- `push_finding_to_queue`
- `is_finding_in_queue`

用途：将分析结果放入漏洞队列，供编排层后续消费。

### 3.3 `VerificationAgent`（`tools["verification"]`）

固定工具：

- `read_file`
- `list_files`
- `search_code`
- `locate_enclosing_function`
- `think`
- `reflect`
- `sandbox_exec`
- `verify_vulnerability`
- `run_code`
- `extract_function`
- `create_vulnerability_report`

条件工具（仅当 `task_id`）：

- `save_verification_result`

用途：把验证结果持久化。

### 3.4 `ReportAgent`（`tools["report"]`）

固定工具：

- `read_file`
- `list_files`
- `search_code`
- `extract_function`
- `dataflow_analysis`

条件工具（仅当 `task_id`）：

- `update_vulnerability_finding`

用途：在报告阶段回写/更新漏洞条目。

### 3.5 `BusinessLogicReconAgent`（`tools["business_logic_recon"]`）

固定工具：

- `read_file`
- `list_files`
- `search_code`
- `locate_enclosing_function`
- `think`
- `reflect`

条件工具（仅当 `bl_queue_service and task_id`）：

- `push_bl_risk_point_to_queue`
- `push_bl_risk_points_to_queue`
- `get_bl_risk_queue_status`
- `is_bl_risk_point_in_queue`

用途：业务逻辑风险点入队与去重检查。

### 3.6 `BusinessLogicAnalysisAgent`（`tools["business_logic_analysis"]`）

固定工具：

- `read_file`
- `list_files`
- `search_code`
- `locate_enclosing_function`
- `think`
- `reflect`

条件工具（仅当 `queue_service and task_id`）：

- `push_finding_to_queue`
- `is_finding_in_queue`

用途：业务逻辑分析产出的 finding 进入统一漏洞队列。

### 3.7 `WorkflowOrchestratorAgent`（`tools["orchestrator"]`）

固定工具：

- `read_file`
- `list_files`
- `search_code`
- `locate_enclosing_function`
- `think`
- `reflect`

条件工具（仅当 `queue_service and task_id`）：

- `get_queue_status`
- `dequeue_finding`

条件工具（仅当 `recon_queue_service and task_id`）：

- `get_recon_risk_queue_status`
- `dequeue_recon_risk_point`
- `peek_recon_risk_queue`
- `clear_recon_risk_queue`
- `is_recon_risk_point_in_queue`

条件工具（仅当 `bl_queue_service and task_id`）：

- `get_bl_risk_queue_status`
- `dequeue_bl_risk_point`
- `peek_bl_risk_queue`
- `clear_bl_risk_queue`
- `is_bl_risk_point_in_queue`

用途：作为总控层消费各队列，并驱动子 Agent 工作流。

## 4. 代码定位（便于追踪）

- `base_tools` 定义：`agent_tasks.py` 约 `4465` 行
- 各工具集定义：`agent_tasks.py` 约 `4478-4635` 行
- 子 Agent 注入：`agent_tasks.py` 约 `3029-3063` 行
- Orchestrator 注入：`agent_tasks.py` 约 `3091-3107` 行

## 5. 维护建议

- 新增工具时，优先在本文件同步更新对应 Agent 的“固定/条件工具”描述。
- 新增工具时，需要在MCP路由中注册。
- 建议保持“工具构建键名”和“Agent 注入键名”一致，降低维护成本。
