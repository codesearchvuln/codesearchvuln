# 清理已退役工具运行时与嵌入检索残留方案

## 目标

- 基于当前仓库现状，清理所有已退役的 `mcp*`、`MCP_*`、`rag*`、Embedding 命名、运行时分支、兼容字段与界面文案。
- 保留当前真实使用的能力：本地工具执行、skill catalog、flow 分析、Docker sandbox、写入范围守卫、Markdown memory 同步。
- 将仍需保留的运行时目录、工具说明同步和写入约束统一改为中性命名。
- 本文只依据仓库内已确认内容编写；仓库外部署是否仍依赖旧变量或旧目录，不作为默认前提，而作为发布前检查项处理。

## 已确认的仓库现状

### 部署与运行时

- `backend/Dockerfile`、`docker-compose.yml`、`docker-compose.full.yml` 仍创建或挂载 `/app/data/mcp`，并显式注入 `MCP_*` 与 `XDG_CONFIG_HOME=/app/data/mcp/xdg-config`。
- `backend/.env`、`backend/env.example`、`backend/app/core/config.py` 仍保留 `MCP_*`、`XDG_CONFIG_HOME`、Embedding / RAG 配置。
- `backend/docker-entrypoint.sh`、`backend/scripts/install_codex_skills.sh`、`backend/scripts/build_skill_registry.py` 仍使用当前挂载在 `/app/data/mcp` 的持久化目录；卷改名是有状态变更，不是纯文本替换。
- `docker/sandbox/Dockerfile` 仍安装 `@modelcontextprotocol/*`、`@tobilu/qmd`，并使用 `/workspace/.VulHunter/mcp/*` 与 `QMD_DATA_DIR`。

### 后端代码

- `backend/app/api/v1/endpoints/agent_tasks_execution.py` 与 `backend/app/api/v1/endpoints/agent_tasks_mcp.py` 仍构建 runtime 对象、执行 gate / probe、同步 `MCP_TOOL_PLAYBOOK.md`，并在步骤名、日志、shared memory source / title 中保留旧命名。
- `backend/app/services/agent/agents/base.py` 仍包含 strict routing、proxy fallback、`mcp_*` metadata、旧错误分类与审计标题拼装逻辑。
- `backend/app/services/agent/mcp/*` 仍存在；写入范围守卫仍混在该包内，而不是中性运行时模块。
- `backend/app/api/v1/endpoints/config.py` 仍通过 `_sanitize_mcp_config()` 返回 `preferMcp`、`skillAvailability`、`deprecatedConfigs` 等结构，并对 `otherConfig.mcpConfig` 做 strip。
- `backend/pyproject.toml` 仍包含 `fastmcp`。
- `backend/app/api/v1/api.py` 与 `backend/app/api/v1/endpoints/embedding_config.py` 仍暴露 `/embedding/*`。
- `backend/app/services/rag/*` 仍在仓库内；其中 `splitter.py` 提供的 tree-sitter 能力仍被 `backend/app/services/flow_parser_runtime.py`、`backend/app/services/agent/flow/lightweight/ast_index.py`、`backend/app/services/agent/flow/lightweight/function_locator.py` 使用，不能直接整包删除。
- `backend/app/services/agent/tools/rag_tool.py`、`backend/app/services/agent/knowledge/rag_knowledge.py`、`backend/app/services/agent/config.py` 中的 `rag_enabled` / `rag_top_k` 仍为残留支线。
- `backend/app/models/agent_task.py`、`backend/scripts/create_agent_demo_data.py` 仍保留 `RAG_QUERY`、`RAG_RESULT`、`rag_search`、`rag_index` 命名。

### 前端与测试

- `frontend/src/pages/intelligent-scan/mcpCatalog.ts` 是未被使用的死文件；仓库检索未发现任何引用。
- `AgentAudit` 仍在日志状态、导出与原始事件详情层暴露旧命名：
  - `frontend/src/pages/AgentAudit/TaskDetailPage.tsx` 仍根据 `metadata.mcp_*` 生成 `MCP:` 与 `MCP 路由：`。
  - `frontend/src/pages/AgentAudit/TaskDetailPage.tsx` 仍把 `mcp_runtime_error` 和包含 `mcp|adapter|command_not_found` 的原因归类为 `mcp`，并把该分类写入恢复提示日志。
  - `frontend/src/pages/AgentAudit/toolEvidence.ts` 在缺少 `command_chain` 时会把 `mcp_adapter` 拼进 fallback command chain；该值会出现在日志详情弹层。
  - `frontend/src/pages/AgentAudit/components/AuditDetailDialog.tsx` 与导出逻辑会原样显示或导出事件的 `title`、`content`、`detail`，因此不会自动抹掉这些旧字段。
  - `frontend/src/pages/AgentAudit/components/LogEntry.tsx` 主列表默认会做摘要化显示，不直接展示 `MCP`；`frontend/tests/agentAuditLogEntry.test.tsx` 已验证这一点。
- `frontend/src/components/agent/AgentModeSelector.tsx` 仍展示“跨文件关联 + RAG”与“使用 RAG 技术进行代码语义检索”；该文案当前出现在 `ProjectDetail -> CreateScanTaskDialog -> AgentModeSelector` 的建任务弹窗链路，不在任务管理页默认建任务流中。
- `frontend/src/components/agent/EmbeddingConfig.tsx` 与 `frontend/src/components/system/SystemConfig.tsx` 仍保留 embedding 配置分支；当前唯一 live 路由 `/scan-config/intelligent-engine` 固定传入 `visibleSections=["llm"]`，因此前端没有 live 路由直接渲染 `EmbeddingConfig`，但仓库中的默认分支与 `/embedding/*` 接口依赖仍在。
- 当前 external-tools 的列表、详情和测试全链路均走 `/api/v1/skills/*` 的 `scan-core` 静态 catalog/detail/test 接口，而不是 `mcpCatalog.ts` 或 backend mirror registry。

### 文档与生成物

- `backend/docs/agent-tools/MCP_TOOL_PLAYBOOK.md` 与 `backend/scripts/generate_runtime_tool_docs.py` 仍生成旧命名，并保留 `rag_query` 示例或误用说明。
- `docs/agentic_scan_core/workflow_overview.md`、`docs/architecture.md`、`scripts/README-COMPOSE.md` 仍使用旧叙事或引用不存在的部署路径。

## 目标状态

- Backend runtime 目录统一为 `/app/data/runtime/xdg-*`；sandbox runtime 目录统一为 `/workspace/.VulHunter/runtime/xdg-*`。
- 写入约束改为中性配置名：
  - `AGENT_WRITE_SCOPE_HARD_LIMIT`
  - `AGENT_WRITE_SCOPE_DEFAULT_MAX_FILES`
  - `AGENT_WRITE_SCOPE_REQUIRE_EVIDENCE_BINDING`
  - `AGENT_WRITE_SCOPE_FORBID_PROJECT_WIDE_WRITES`
- 仅保留对历史 `otherConfig.mcpConfig` 的单向兼容清洗：
  - 读取用户配置时 strip
  - 写入用户配置时忽略
  - 不再返回 `preferMcp`、`skillAvailability`、`deprecatedConfigs`、`mcpConfig`
- 不再暴露任何 Embedding、vector retrieval、`rag_*` 用户界面、接口、工具或 demo data 命名。
- 审计日志与 shared memory 只描述工具调用事实，不展示 transport、adapter 或已退役运行时命名。
- 保留且继续工作的能力仅包括：本地工具执行、skill catalog、flow parser / tree-sitter 解析、Docker sandbox、写入范围守卫、Markdown memory 同步。

## 实施变更

### 1. 部署与持久化目录

- 修改 `backend/Dockerfile`
  - 删除 `/app/data/mcp` 与 `xdg-*` 创建逻辑。
  - 改为只创建 `/app/data/runtime/xdg-data`、`/app/data/runtime/xdg-cache`、`/app/data/runtime/xdg-config`。
  - 删除 runtime 阶段对 `scripts/install_codex_skills.sh` 与 `scripts/build_skill_registry.py` 的复制。
- 修改 `docker-compose.yml` 与 `docker-compose.full.yml`
  - 将 `mcp_data:/app/data/mcp` 改为 `backend_runtime_data:/app/data/runtime`。
  - 删除显式 `MCP_ENABLED`、`MCP_REQUIRE_ALL_READY_ON_STARTUP`、`CODEX_SKILLS_AUTO_INSTALL`、`SKILL_REGISTRY_AUTO_SYNC_ON_STARTUP`、`XDG_CONFIG_HOME` 注入。
  - 底部卷定义同步改名。
- 修改 `backend/.env` 与 `backend/env.example`
  - 删除 `MCP_*`、`XDG_CONFIG_HOME=/app/data/mcp/xdg-config`、Embedding / RAG 段落与相关注释。
  - 将仍需保留的写入范围配置迁移到中性命名。
- 修改 `backend/app/core/config.py`
  - 删除 `MCP_*`、`XDG_CONFIG_HOME`、`EMBEDDING_*`、`RAG_*` 配置。
  - 新增中性写入范围配置字段。
- 修改 `docker/sandbox/Dockerfile`
  - 删除 `@modelcontextprotocol/server-memory`、`@modelcontextprotocol/server-sequential-thinking`、`@tobilu/qmd` 安装与 `command -v qmd` 检查。
  - 删除 `/workspace/.VulHunter/mcp/*`、`/workspace/.VulHunter/qmd`、`QMD_DATA_DIR`。
  - 删除与 `.VulHunter/mcp/xdg-*` 绑定的 `XDG_DATA_HOME`、`XDG_CACHE_HOME`、`XDG_CONFIG_HOME`；当前仓库内没有其他文件引用这些 sandbox 路径。
- 删除 `backend/scripts/install_codex_skills.sh` 与 `backend/scripts/build_skill_registry.py`。
- 修改 `backend/docker-entrypoint.sh`
  - 删除 skills 自动安装与 registry 构建逻辑。
- 对 volume 改名单独写明一次性操作
  - 在切换卷名前，先审计并导出旧 `mcp_data` 中仍需保留的文件。
  - 导出完成后删除旧 `mcp_data` 运行卷，并切换到 `backend_runtime_data`。

### 2. 后端执行链路去旧运行时命名

- 将 `backend/app/services/agent/mcp/write_scope.py` 提取到 `backend/app/services/agent/write_scope.py`。
- 将 `backend/app/api/v1/endpoints/agent_tasks_mcp.py` 改为 `backend/app/api/v1/endpoints/agent_tasks_tool_runtime.py`。
  - 仅保留写入范围守卫构建、工具文档同步与必要的路径规范化逻辑。
  - 删除 gate、probe、bootstrap helper 与相关命名。
- 修改 `backend/app/api/v1/endpoints/agent_tasks.py`
  - 删除对 `agent_tasks_mcp` 的 facade re-export，改为新的中性 helper 模块。
- 修改 `backend/app/api/v1/endpoints/agent_tasks_execution.py`
  - 删除 `_build_task_mcp_runtime`、`_bootstrap_task_mcp_runtime`、`_probe_required_mcp_runtime` 调用与相关步骤文案。
  - 不再向 agent / orchestrator 调用 `set_mcp_runtime(...)`。
  - 改为直接构建 `TaskWriteScopeGuard` 并向 agent / orchestrator 调用 `set_write_scope_guard(...)`。
- 修改 `backend/app/services/agent/agents/base.py`
  - 删除 strict runtime routing、proxy fallback、`mcp_*` metadata、旧错误分类与标题 / 内容格式化。
  - 保留本地工具执行、写入范围校验、普通 fallback、工具事件与缓存逻辑。
- 修改 `backend/app/services/agent/agents/verification.py`
  - 删除 `_mcp_attempt`、`mcp_symbol_index` 等函数定位标记，改为中性函数定位命名。
- 删除无实际价值的旧运行时壳层模块
  - `app/services/agent/mcp/runtime.py`
  - `app/services/agent/mcp/router.py`
  - `app/services/agent/mcp/catalog.py`
  - `app/services/agent/mcp/protocol_verify.py`
  - `app/services/agent/mcp/probe_specs.py`
  - `app/services/agent/mcp/virtual_tools.py`
  - `app/services/agent/mcp/__init__.py`
- 删除 `backend/pyproject.toml` 中的 `fastmcp`，并同步 lock 文件。

### 3. 配置接口与历史兼容清理

- 修改 `backend/app/api/v1/endpoints/config.py`
  - 删除 `_sanitize_mcp_config()` 与相关返回结构。
  - 保留对历史 `otherConfig.mcpConfig` 的 strip 行为。
  - 将写入范围默认值与清洗逻辑迁移到中性命名。
- 删除 `backend/app/api/v1/endpoints/embedding_config.py`。
- 修改 `backend/app/api/v1/api.py`
  - 删除 `/embedding/*` router 注册。
- 清理 `backend/app/models/agent_task.py` 中的 `RAG_QUERY` / `RAG_RESULT` 事件类型，并同步更新 `backend/app/db/schema_snapshots/baseline_5b0f3c9a6d7e.py` 与 `backend/scripts/create_agent_demo_data.py`。

### 4. 嵌入检索与知识库残留清理

- 从 `backend/app/services/rag/splitter.py` 中提取仍被 flow / function locator 使用的通用 tree-sitter 解析能力到中性模块。
- 修改以下调用方，使其不再从 `app.services.rag` 导入通用解析能力
  - `backend/app/services/flow_parser_runtime.py`
  - `backend/app/services/agent/flow/lightweight/ast_index.py`
  - `backend/app/services/agent/flow/lightweight/function_locator.py`
- 在提取完成后删除纯 Embedding / vector retrieval 模块
  - `backend/app/services/rag/embeddings.py`
  - `backend/app/services/rag/indexer.py`
  - `backend/app/services/rag/retriever.py`
  - `backend/app/services/rag/__init__.py`
- 删除未接入当前主链路的 RAG 残留
  - `backend/app/services/agent/tools/rag_tool.py`
  - `backend/app/services/agent/knowledge/rag_knowledge.py`
  - `backend/app/services/agent/config.py` 中的 `rag_enabled` / `rag_top_k`
  - `backend/app/services/agent/knowledge/tools.py` 中的向量检索依赖
- 修改 `backend/scripts/create_agent_demo_data.py`
  - 删除 `rag_index`、`rag_search`、`RAG_QUERY`、`RAG_RESULT` 演示数据。
- 修改 `backend/scripts/generate_runtime_tool_docs.py`
  - 删除 `rag_query` 等已退役工具名与相关文案。

### 5. 前端界面与审计文案清理

- 删除 `frontend/src/pages/intelligent-scan/mcpCatalog.ts`。
- 修改 `frontend/src/pages/AgentAudit/TaskDetailPage.tsx`
  - 删除 `MCP:` 与 `MCP 路由：` 标题和内容生成。
  - 不再从 `metadata.mcp_*` 组装用户可见文案。
- 修改 `frontend/src/pages/AgentAudit/types.ts`
  - 将 `TerminalFailureClass` 中的 `'mcp'` 改为 `'runtime'`。
- 修改 `frontend/src/pages/AgentAudit/TaskDetailPage.tsx`
  - 将 `classifyTerminalFailure()` 中返回的 `"mcp"` 分支改为 `"runtime"`。
- 修改 `frontend/src/pages/AgentAudit/toolEvidence.ts`
  - fallback 命令链不再拼接 `mcp_adapter`。
- 修改 `frontend/src/components/agent/AgentModeSelector.tsx`
  - 删除 RAG 相关卖点与说明文案。
- 删除 `frontend/src/components/agent/EmbeddingConfig.tsx`。
- 修改 `frontend/src/components/system/SystemConfig.tsx`
  - 删除 `embedding` section、页签与组件引用。
- 修改 `frontend/src/pages/ScanConfigIntelligentEngine.tsx`
  - 删除已注释掉的 `EmbeddingConfig` 残留与“搜索增强模块”相关旧说明。
- 更新相关前端 fixture 与快照，避免继续使用 `MCP: ...` 或 RAG 文案。

### 6. 文档、生成物与命名清理

- 将 `backend/docs/agent-tools/MCP_TOOL_PLAYBOOK.md` 重命名为 `TOOL_PLAYBOOK.md`。
- 修改 `backend/scripts/generate_runtime_tool_docs.py`
  - 输出文件名改为 `TOOL_PLAYBOOK.md`。
  - 标题、矩阵列名、说明文字全部改为中性工具文档命名。
  - 删除 `rag_query` 等已退役示例。
- 修改 `backend/scripts/validate_runtime_tool_docs.py`
  - 校验目标文件名同步改为 `TOOL_PLAYBOOK.md`。
- 修改 `backend/app/api/v1/endpoints/agent_tasks_execution.py` 与新的 tool runtime helper
  - `_load_mcp_tool_playbook`、`_sync_mcp_tool_playbook_to_memory`、`mcp_tool_playbook_sync` 改为中性命名。
  - shared memory source、title、summary 与日志全部去旧命名。
- 修改 `scripts/README-COMPOSE.md`
  - 移除旧环境变量描述。
  - 修正不存在的 `deploy/compose/docker-compose.prod*.yml` 引用。
- 修改 `docs/agentic_scan_core/workflow_overview.md`
  - 将“初始化 MCP 运行时并做 required MCP 门禁检查”改为中性的“初始化工具运行时或写入范围守卫”。
- 修改 `docs/architecture.md`
  - 删除“可选 RAG”表述。

## 测试与回归验证

### 本轮已执行验证

- 2026-03-26 已执行并通过：
  - `uv run --project . pytest -s tests/test_config_mcp_backend_owned.py::test_update_my_config_strips_frontend_mcp_payload_and_does_not_return_mcp_config`
  - `uv run --project . pytest -s tests/test_config_mcp_backend_owned.py::test_get_my_config_strips_legacy_mcp_config_from_response`
  - `uv run --project . pytest -s tests/test_skill_registry_api.py::test_skill_catalog_endpoint_returns_scan_core_items`
  - `uv run --project . pytest -s tests/test_runtime_tool_docs_coverage.py::test_runtime_tool_docs_coverage`
  - `uv run --project . pytest -s tests/test_agent_prompt_contracts.py::test_shared_tool_usage_prompt_only_mentions_core_scan_tools`
  - `uv run --project . pytest -s tests/test_agent_tool_input_repair.py::test_execute_tool_blocks_virtual_alias_when_virtual_routing_disabled`
  - `pnpm test:node -- tests/agentAuditLogEntry.test.tsx tests/agentAuditToolEvidenceDialog.test.tsx tests/scanConfigExternalToolsLayout.test.tsx tests/scanConfigExternalToolDetail.test.tsx tests/scanConfigIntelligentEngineSkillSection.test.tsx`
- 这些通过项已经确认以下事实：
  - `/config` 仍只对历史 `otherConfig.mcpConfig` 做 strip，前端 payload 中的旧字段不会被持久化或回传。
  - `/skills/catalog` 当前直接返回 `scan-core` 静态目录，不依赖 mirror skill registry。
  - runtime tool docs 当前仍完整存在，后续改名 `TOOL_PLAYBOOK.md` 时需要同步更新校验脚本。
  - prompt 合同与工具输入修复仍明确把 `rag_query` 视为退役或虚拟工具名。
  - 前端 `LogEntry` 组件当前会对展示文本做去 `MCP` 处理，但导出日志、原始事件详情、失败分类与 fallback command chain 仍保留旧命名，因此计划中的前端清理范围成立。

### 需要同步修改或删除的测试

- `backend/tests/test_docker_compose_dev_flow.py`
- `backend/tests/test_mcp_catalog.py`
- `backend/tests/test_mcp_tool_routing.py`
- `backend/tests/test_agent_task_mcp_bootstrap.py`
- `backend/tests/test_mcp_write_scope_guard.py`
- `backend/tests/test_mcp_all_agents_write_policy.py`
- `backend/tests/test_mcp_router_codebadger_cpg_query.py`
- `backend/tests/test_agent_tasks_module_layout.py`
- `backend/tests/test_agent_task_project_root_normalization.py`
- `backend/tests/test_tool_skills_memory_sync.py`
- `backend/tests/test_runtime_tool_docs_coverage.py`
- `backend/tests/test_agent_scan_mode_coverage_diagnostics.py`
- `backend/tests/test_agent_tool_retry_guard.py`
- `backend/tests/test_verification_function_locator_fallback.py`
- `backend/tests/test_startup_interrupted_recovery.py`
- `backend/tests/test_startup_schema_migration.py`
- `backend/tests/test_remote_repository_scan_removal.py`
- `backend/tests/test_legacy_cleanup.py`
- `frontend/tests/agentAuditLogEntry.test.tsx`

### 需要保留并继续通过的聚焦断言

- `backend/tests/test_config_mcp_backend_owned.py::test_update_my_config_strips_frontend_mcp_payload_and_does_not_return_mcp_config`
- `backend/tests/test_config_mcp_backend_owned.py::test_get_my_config_strips_legacy_mcp_config_from_response`
- `backend/tests/test_skill_registry_api.py::test_skill_catalog_endpoint_returns_scan_core_items`
- `backend/tests/test_runtime_tool_docs_coverage.py::test_runtime_tool_docs_coverage`
- `backend/tests/test_agent_prompt_contracts.py::test_shared_tool_usage_prompt_only_mentions_core_scan_tools`
- `backend/tests/test_agent_tool_input_repair.py::test_execute_tool_blocks_virtual_alias_when_virtual_routing_disabled`
- `frontend/tests/agentAuditLogEntry.test.tsx`

### 当前已知的基线失败

- 2026-03-26 聚合执行时，以下失败已存在，但不能直接作为本方案是否正确的判断依据：
  - `tests/test_agent_tool_registry.py::test_smart_audit_tool_registry_contains_only_core_scan_surface`
  - `tests/test_agent_prompt_contracts.py::test_verification_prompt_requires_flow_fields_and_report_preconditions`
  - `tests/test_agent_tool_input_repair.py` 中多个 `read_file` / single-scope 相关失败
  - `tests/test_docker_compose_dev_flow.py::test_nexus_web_dockerfile_persists_runtime_pnpm`
- 这些失败涉及工具面收敛、验证提示词、`read_file` 行为与 `nexus-web` Dockerfile 断言，不应被误写成 “MCP/RAG 清理导致的新问题”。

### 建议执行的验证命令

统一按仓库约定使用 `uv run --project . pytest -s`：

```bash
uv run --project . pytest -s tests/test_config_mcp_backend_owned.py::test_update_my_config_strips_frontend_mcp_payload_and_does_not_return_mcp_config
uv run --project . pytest -s tests/test_config_mcp_backend_owned.py::test_get_my_config_strips_legacy_mcp_config_from_response
uv run --project . pytest -s tests/test_skill_registry_api.py::test_skill_catalog_endpoint_returns_scan_core_items
uv run --project . pytest -s tests/test_runtime_tool_docs_coverage.py::test_runtime_tool_docs_coverage
uv run --project . pytest -s tests/test_agent_prompt_contracts.py::test_shared_tool_usage_prompt_only_mentions_core_scan_tools
uv run --project . pytest -s tests/test_agent_tool_input_repair.py::test_execute_tool_blocks_virtual_alias_when_virtual_routing_disabled
```

并补充一个新的聚焦验证：

- 验证 agent task 执行时仍会注入 write-scope guard，但不再构建任何旧 runtime 对象。
- 验证 `/config` 仅保留历史 `otherConfig.mcpConfig` 的 strip 行为，不再返回旧兼容字段。
- 验证前端 AgentAudit 页面与导出日志不再出现 `MCP:`、`MCP 路由：`、RAG 文案。

## 发布前检查项

- 确认仓库外部部署、脚本或 CI 不再依赖 `MCP_*`、`XDG_CONFIG_HOME=/app/data/mcp/xdg-config`、`/embedding/*`、`QMD_DATA_DIR`、`qmd` 命令。
- 确认旧 `mcp_data` 卷已完成审计与导出，切换后不再保留 `mcp_data` 作为运行卷。
- 确认外部消费方不会继续解析旧审计标题、旧 shared memory source 名称或 `metadata.mcp_*` 字段。
- 确认用户已有 `otherConfig.embedding_config` 或类似历史数据在本轮按静默忽略处理，不再迁移回写。
