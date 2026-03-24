# Dataflow Analysis Tool Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复现有 `dataflow_analysis` 与 `controlflow_analysis_light` 的高频调用失败问题，并以并行迁移方式新增基于 Joern 的 `joern_dataflow_analysis` 工具，为后续统一数据流分析能力打基础。

**Architecture:** 第一阶段不删除旧工具，先把镜像依赖、输入契约、错误语义和文档说明对齐，让 agent 对旧工具的调用稳定下来。第二阶段新增独立的 `joern_dataflow_analysis`，先在 backend、agent 和外部工具面中并行暴露，不立即替换旧工具。第三阶段只做漏洞规则研究清单，不在本轮里引入规则持久化或产品化展示。

**Tech Stack:** FastAPI、Pydantic、Docker 多阶段构建、Python agent tool runtime、tree-sitter、code2flow、Joern CLI、pytest、uv

---

## 1. 背景与问题定义

当前仓库中与数据流/控制流分析直接相关的实现分散在以下位置：

- [`backend/app/services/agent/tools/code_analysis_tool.py`](/home/xyf/AuditTool/backend/app/services/agent/tools/code_analysis_tool.py)
- [`backend/app/services/agent/tools/control_flow_tool.py`](/home/xyf/AuditTool/backend/app/services/agent/tools/control_flow_tool.py)
- [`backend/app/services/agent/flow/pipeline.py`](/home/xyf/AuditTool/backend/app/services/agent/flow/pipeline.py)
- [`backend/app/services/agent/flow/lightweight/callgraph_code2flow.py`](/home/xyf/AuditTool/backend/app/services/agent/flow/lightweight/callgraph_code2flow.py)
- [`backend/app/api/v1/endpoints/agent_tasks_execution.py`](/home/xyf/AuditTool/backend/app/api/v1/endpoints/agent_tasks_execution.py)
- [`backend/app/api/v1/endpoints/agent_test.py`](/home/xyf/AuditTool/backend/app/api/v1/endpoints/agent_test.py)

当前主要问题有四类：

1. `controlflow_analysis_light` 依赖 `code2flow`，但现有 backend 镜像没有把它作为正式依赖显式交付，导致运行时表现更接近 best-effort 而不是稳定工具。
2. `dataflow_analysis` 和 `controlflow_analysis_light` 的推荐输入模型不一致，文档、schema、prompt、agent 输入修复逻辑之间存在字段漂移，容易让模型反复试错。
3. 工具成功执行、定位失败、运行时依赖缺失、无可达路径这几类状态没有完全稳定分层，agent 很容易把“分析结果为否”误判成“工具执行失败”。
4. 仓库还没有一个基于 Joern 的正式工具入口，无法以并行迁移方式逐步替代当前的多套轻量实现。

本计划的目标不是一次性删旧重做，而是先修稳，再并行接入，再研究规则来源。

## 2. 范围与非目标

### 2.1 本次范围

- 修复并保留现有 `dataflow_analysis`
- 修复并保留现有 `controlflow_analysis_light`
- 在 backend 镜像中显式安装 `code2flow`
- 在 backend 镜像中显式安装 Joern CLI
- 新增 `joern_dataflow_analysis`
- 让新工具在 backend、agent、外部工具可见面中可调用
- 补齐工具文档、共享目录、prompt 示例、测试夹具
- 输出后续规则研究清单的执行方向

### 2.2 非目标

- 本轮不删除 `controlflow_analysis_light`
- 本轮不把 `dataflow_analysis` 直接改成 Joern 内核
- 本轮不做全项目级的 Joern 图数据库服务化
- 本轮不实现规则持久化、抓取任务、数据库表或前端规则展示
- 本轮不改动验证工作流的总体阶段结构

## 3. 目标状态

完成本计划后，运行时应满足以下状态：

- backend 容器内可直接执行 `code2flow` 与 `joern`
- `dataflow_analysis` 与 `controlflow_analysis_light` 对 agent 来说有一致、清晰、稳定的调用方式
- 旧工具对缺参、定位失败、依赖缺失、无路径结果这几类场景都有稳定返回
- 新增 `joern_dataflow_analysis` 可在 backend 调试、agent 工具注入和外部工具列表中被调用
- Joern 第一版可完成“单文件内 source 到 sink 是否可达”的判断
- 文档、schema、tool registry、skill availability、prompt 示例相互一致

## 4. 文件与职责映射

以下文件是本计划的主要改动面，实施时应优先围绕这些位置收敛，不要把逻辑散落到无关目录。

### 4.1 Docker 与运行时依赖

- 修改 [`backend/Dockerfile`](/home/xyf/AuditTool/backend/Dockerfile)
  - 安装 `code2flow`
  - 安装 Joern CLI
  - 复用现有多镜像源下载、缓存与超时控制模式

### 4.2 旧工具修复

- 修改 [`backend/app/services/agent/tools/code_analysis_tool.py`](/home/xyf/AuditTool/backend/app/services/agent/tools/code_analysis_tool.py)
  - 统一 `dataflow_analysis` 推荐输入契约
  - 稳定错误语义与 metadata 输出
- 修改 [`backend/app/services/agent/tools/control_flow_tool.py`](/home/xyf/AuditTool/backend/app/services/agent/tools/control_flow_tool.py)
  - 统一 `controlflow_analysis_light` 推荐输入契约
  - 保留增强字段，但不再让其影响基础调用成功率
- 视需要修改 [`backend/app/services/agent/flow/lightweight/callgraph_code2flow.py`](/home/xyf/AuditTool/backend/app/services/agent/flow/lightweight/callgraph_code2flow.py)
  - 将 `code2flow` 缺失从“镜像未交付”转为“异常情况”
  - 优化诊断信息

### 4.3 新增 Joern 工具

- 新增 `backend/app/services/agent/tools/joern_dataflow_tool.py`
  - Joern CLI 调用封装
  - 查询生成
  - 输出解析
- 修改 [`backend/app/services/agent/tools/__init__.py`](/home/xyf/AuditTool/backend/app/services/agent/tools/__init__.py)
  - 导出新工具
- 修改 [`backend/app/api/v1/endpoints/agent_tasks_execution.py`](/home/xyf/AuditTool/backend/app/api/v1/endpoints/agent_tasks_execution.py)
  - 注册新工具到 analysis/report 或调试面
- 修改 [`backend/app/api/v1/endpoints/agent_test.py`](/home/xyf/AuditTool/backend/app/api/v1/endpoints/agent_test.py)
  - 测试/调试入口补齐新工具注入
- 修改 [`backend/app/services/agent/mcp/router.py`](/home/xyf/AuditTool/backend/app/services/agent/mcp/router.py)
  - 增加新工具本地路由
- 修改 [`backend/app/services/agent/skills/scan_core.py`](/home/xyf/AuditTool/backend/app/services/agent/skills/scan_core.py)
  - 对外暴露新工具的技能可见性

### 4.4 文档与提示词同步

- 修改 [`backend/docs/agent-tools/tools/dataflow_analysis.md`](/home/xyf/AuditTool/backend/docs/agent-tools/tools/dataflow_analysis.md)
- 修改 [`backend/docs/agent-tools/tools/controlflow_analysis_light.md`](/home/xyf/AuditTool/backend/docs/agent-tools/tools/controlflow_analysis_light.md)
- 新增 `backend/docs/agent-tools/tools/joern_dataflow_analysis.md`
- 修改 [`backend/docs/agent-tools/INDEX.md`](/home/xyf/AuditTool/backend/docs/agent-tools/INDEX.md)
- 修改 [`backend/docs/agent-tools/TOOL_SHARED_CATALOG.md`](/home/xyf/AuditTool/backend/docs/agent-tools/TOOL_SHARED_CATALOG.md)
- 修改 [`backend/app/services/agent/prompts/system_prompts.py`](/home/xyf/AuditTool/backend/app/services/agent/prompts/system_prompts.py)
  - 统一模型看到的用法说明

### 4.5 测试

- 修改 [`backend/tests/agent/test_tools.py`](/home/xyf/AuditTool/backend/tests/agent/test_tools.py)
  - 覆盖旧工具契约对齐与新工具行为
- 修改 [`backend/tests/test_agent_tool_registry.py`](/home/xyf/AuditTool/backend/tests/test_agent_tool_registry.py)
  - 校验新工具暴露面
- 修改 [`backend/tests/test_mcp_catalog.py`](/home/xyf/AuditTool/backend/tests/test_mcp_catalog.py)
  - 校验 skill availability
- 视需要新增 `backend/tests/agent/test_joern_dataflow_tool.py`
  - 聚焦 Joern 输入输出与解析

## 5. 工具契约设计

### 5.1 旧工具统一后的推荐输入

`dataflow_analysis` 与 `controlflow_analysis_light` 都应推荐使用以下主输入：

- `file_path`: 必填，项目内相对路径
- `line_start`: 必填，分析起始行
- `line_end`: 选填，默认等于 `line_start`
- `function_name`: 选填，补充定位信息
- `language`: 选填，仅在无法稳定推断时使用

### 5.2 旧工具兼容字段

`dataflow_analysis` 继续兼容以下字段，但不作为首选示例：

- `source_code`
- `sink_code`
- `variable_name`
- `source_hints`
- `sink_hints`
- `max_hops`

`controlflow_analysis_light` 继续兼容以下增强字段：

- `entry_points`
- `entry_points_hint`
- `vulnerability_type`
- `call_chain_hint`
- `control_conditions_hint`
- `severity`
- `confidence`

要求：

- 缺少增强字段不能影响基础调用成功
- 缺少定位字段必须返回明确错误
- 文档、schema、示例、测试都使用同一组首选字段名

### 5.3 新增 `joern_dataflow_analysis` 契约

第一版仅支持单文件 reachability 判断。

输入字段：

- `file_path`: 必填
- `source_line`: 必填
- `sink_line`: 必填
- `source_symbol`: 选填
- `sink_symbol`: 选填
- `language`: 选填
- `query_mode`: 选填，默认 `reachability`

输出字段：

- `reachable`: 布尔值
- `path_count`: 路径数量
- `paths`: 路径数组
- `summary`: 给 agent 直接消费的短摘要
- `engine`: 固定为 `joern`
- `diagnostics`: CLI 调用、解析状态、语言支持情况

### 5.4 统一错误语义

所有相关工具都遵循同一层次：

- `success=False`
  - 输入缺失
  - 文件不可读或定位非法
  - CLI 不可执行
  - 查询执行异常
- `success=True` 且结果为否
  - 没有可达路径
  - 没有足够证据构成正向流结论

这样 agent 可以明确区分“工具坏了”和“分析结论是否定”。

## 6. 分阶段实施计划

### 阶段一：修复旧工具并补齐依赖

目标：不删旧工具，先把 agent 高频调用失败问题压下去。

#### Task 1: 盘点并固定旧工具输入契约

**Files:**
- Modify: `backend/app/services/agent/tools/code_analysis_tool.py`
- Modify: `backend/app/services/agent/tools/control_flow_tool.py`
- Modify: `backend/app/services/agent/agents/base.py`
- Test: `backend/tests/agent/test_tools.py`

- [ ] 梳理 `dataflow_analysis` 与 `controlflow_analysis_light` 当前 schema、输入修复逻辑和 prompt 示例中的字段差异。
- [ ] 将两个工具的首选调用方式统一为 `file_path + line_start + line_end`。
- [ ] 保留兼容字段，但只在内部容错和旧调用兼容中使用。
- [ ] 为缺参、错误行号、文件不可读补充稳定错误文本。
- [ ] 更新测试，确保模型最常生成的定位参数可以直接成功调用。

#### Task 2: 将 `code2flow` 变成正式镜像依赖

**Files:**
- Modify: `backend/Dockerfile`
- Modify: `backend/app/services/agent/flow/lightweight/callgraph_code2flow.py`
- Test: `backend/tests/agent/test_tools.py`

- [ ] 参考 `opengrep`、`phpstan`、`YASA` 的安装方式，为 `code2flow` 增加显式安装与缓存逻辑。
- [ ] 优先选择镜像内可重复构建的安装方式，不依赖运行时自动拉取。
- [ ] 调整 `callgraph_code2flow.py` 的诊断逻辑，让“镜像已安装但执行失败”和“依赖完全不存在”可区分。
- [ ] 增加容器内验证步骤，确认 `code2flow` 可以直接执行。

#### Task 3: 同步文档、prompt 与目录索引

**Files:**
- Modify: `backend/docs/agent-tools/tools/dataflow_analysis.md`
- Modify: `backend/docs/agent-tools/tools/controlflow_analysis_light.md`
- Modify: `backend/docs/agent-tools/INDEX.md`
- Modify: `backend/docs/agent-tools/TOOL_SHARED_CATALOG.md`
- Modify: `backend/app/services/agent/prompts/system_prompts.py`

- [ ] 将旧工具文档里的首选输入示例统一成定位优先模式。
- [ ] 明确哪些字段是必填、哪些字段是兼容/增强字段。
- [ ] 在 prompt 中避免继续鼓励模型混用旧字段名。
- [ ] 确保共享工具目录与单工具文档表述一致。

#### Task 4: 阶段一容器验收

**Files:**
- Modify: `backend/tests/agent/test_tools.py`
- Optional: `backend/tests/test_agent_tool_registry.py`

- [ ] 在 backend 容器内执行 `code2flow --help` 或等价探测命令。
- [ ] 使用真实工具调用验证 `dataflow_analysis` 成功场景。
- [ ] 使用真实工具调用验证 `controlflow_analysis_light` 成功场景。
- [ ] 验证缺参报错与“无路径但成功执行”的负样例。

### 阶段二：新增 `joern_dataflow_analysis`

目标：先并行接入 Joern，不抢旧默认入口。

#### Task 5: 为 backend 镜像引入 Joern CLI

**Files:**
- Modify: `backend/Dockerfile`

- [ ] 确定 Joern CLI 的下载产物格式与解压目录结构。
- [ ] 复用现有多代理地址、测速/回退、缓存复用逻辑。
- [ ] 覆盖 `amd64` 与 `arm64` 架构选择。
- [ ] 将最终可执行路径固定到镜像内稳定位置，并设置环境变量或 wrapper。
- [ ] 在构建阶段或运行时基础阶段加入最小可执行探测。

#### Task 6: 实现 Joern 工具封装

**Files:**
- Create: `backend/app/services/agent/tools/joern_dataflow_tool.py`
- Modify: `backend/app/services/agent/tools/__init__.py`
- Test: `backend/tests/agent/test_joern_dataflow_tool.py`

- [ ] 封装 Joern CLI 调用，输入为单文件、source_line、sink_line。
- [ ] 为第一版 reachability 查询生成固定查询模板。
- [ ] 解析 CLI 输出，统一转成 `reachable/path_count/paths/summary/diagnostics`。
- [ ] 为 Joern 不支持语言、路径为空、查询失败等场景补齐稳定返回。

#### Task 7: 将新工具注册到 backend 与 agent 可见面

**Files:**
- Modify: `backend/app/api/v1/endpoints/agent_tasks_execution.py`
- Modify: `backend/app/api/v1/endpoints/agent_test.py`
- Modify: `backend/app/services/agent/mcp/router.py`
- Modify: `backend/app/services/agent/skills/scan_core.py`
- Test: `backend/tests/test_agent_tool_registry.py`
- Test: `backend/tests/test_mcp_catalog.py`

- [ ] 将 `joern_dataflow_analysis` 注册到 analysis 工具集合。
- [ ] 视 report/debug 需要补充到相应工具集合。
- [ ] 增加路由映射、技能可见性、tool registry 断言。
- [ ] 确保新工具对 agent 可见，但不自动替换旧工具。

#### Task 8: 完成第二阶段文档同步

**Files:**
- Create: `backend/docs/agent-tools/tools/joern_dataflow_analysis.md`
- Modify: `backend/docs/agent-tools/INDEX.md`
- Modify: `backend/docs/agent-tools/TOOL_SHARED_CATALOG.md`
- Modify: `backend/app/services/agent/prompts/system_prompts.py`

- [ ] 新增 Joern 工具单独文档，明确第一版只支持单文件 reachability。
- [ ] 在目录索引和共享目录中加入新工具。
- [ ] 如需在 prompt 中提到它，强调它是并行新工具，不是旧工具的默认替代。

#### Task 9: 第二阶段容器验收

**Files:**
- Test: `backend/tests/agent/test_joern_dataflow_tool.py`
- Test: `backend/tests/test_agent_tool_registry.py`

- [ ] 在 backend 容器内确认 `joern` 可执行。
- [ ] 跑一条真实 Joern 工具调用，验证结构化结果可返回。
- [ ] 跑至少一个“函数入参到赋值”场景。
- [ ] 跑至少一个“函数入参到函数调用参数位”场景。
- [ ] 确认新工具能从 agent 或调试入口被调用。

### 阶段三：规则研究清单

目标：为后续基于 Joern 的 source/sink 规则体系做输入，不立即产品化。

#### Task 10: 输出规则来源与格式分类

**Files:**
- Create: `docs/dataflow_analysis_tool/joern_rule_research.md`

- [ ] 调研 GitHub 公开仓库中的漏洞规则来源。
- [ ] 按规则格式、字段丰富度、是否适合 source/sink 模板化分类。
- [ ] 区分“可直接转为 Joern reachability 输入”的规则与“仍需人工建模”的规则。
- [ ] 不在本阶段引入数据库或前端展示。

## 7. 测试与验证矩阵

### 7.1 单元测试

- `dataflow_analysis`：
  - 统一定位字段输入
  - 缺参错误
  - 文件读取模式
  - 无 LLM 或超时时的稳定返回
- `controlflow_analysis_light`：
  - `file_path:line` 兼容
  - 标准 `line_start/line_end` 输入
  - 缺少定位信息的明确报错
  - `code2flow` 相关诊断信息
- `joern_dataflow_analysis`：
  - source/sink 行号校验
  - CLI 调用失败
  - 路径解析
  - reachable 与非 reachable 两种结果

### 7.2 集成测试

- backend 工具注册是否包含新工具
- agent skill availability 是否包含新工具
- tool docs index 是否覆盖新工具
- 旧工具文档与 schema 是否使用统一字段

### 7.3 容器实测

必须优先做容器内验证，而不是只停留在 pytest：

- backend 镜像内 `code2flow` 可执行
- backend 镜像内 `joern` 可执行
- 旧两个工具可在容器环境中被真实调用
- 新 Joern 工具可在容器环境中被真实调用

## 8. 风险与控制措施

### 风险 1：Joern CLI 体积大、下载慢、不同架构产物不同

控制：

- 使用多代理候选与缓存
- 和现有工具下载逻辑共用模式
- 显式区分架构

### 风险 2：旧工具契约调整后可能影响已有隐式调用

控制：

- 保留兼容字段
- 只改变“推荐用法”和错误语义，不强行移除旧参数
- 先用测试覆盖老路径再重构

### 风险 3：agent prompt 仍然生成旧字段名

控制：

- 同步修改 prompt 示例
- 同步修改工具文档
- 保留输入修复逻辑作为兜底

### 风险 4：Joern 第一版能力范围过大导致难以落地

控制：

- 严格限制为单文件 reachability
- 只先支持两个函数内场景
- 复杂跨函数、跨文件、跨过程分析留到后续阶段

## 9. 验收标准

以下条件全部满足，才算本计划的前两阶段完成：

1. backend 容器中 `code2flow` 与 `joern` 均可执行。
2. `dataflow_analysis` 与 `controlflow_analysis_light` 的推荐输入统一为定位优先模式。
3. 旧两个工具对缺参、定位失败、无路径结果、运行时依赖异常都有稳定语义。
4. `joern_dataflow_analysis` 已完成 backend 注册，并在 agent/外部工具可见面中可调用。
5. Joern 第一版至少完成两个函数内场景的真实验证。
6. 工具文档、索引、共享目录、skill availability、tool registry 与实际实现一致。

## 10. 实施默认值

- 迁移模式默认采用并行迁移
- Joern v1 默认只做单文件分析
- 旧工具默认继续保留并对外暴露
- 旧工具的首选输入统一为 `file_path + line_start + line_end`
- 容器实测优先于只跑单元测试
- 第三阶段只做研究，不做产品化
