# Search Code Skill Precision Design

**背景**

- 2026-03-08 的任务日志显示，公共工具 `search_code` 经过 MCP 路由到 `code_index/search_code_advanced` 时，普通关键字调用多次报错：`pattern Field required`。
- 同一批日志也显示：当 `search_code` 使用 `is_regex=true` 时，调用可以成功返回结果，说明当前路由层会在正则模式下补齐 MCP 所需的 `pattern` 字段。

**设计目标**

- 不改运行时代码，先通过内部 tool skill 和维护文档降低误调用概率。
- 让 Agent 在调用 `search_code` 时默认采用更稳定的 MCP 精确模式：`keyword` + `is_regex=true` + 窄范围约束。
- 把这条经验固化到统一维护入口，避免 `search_code` 的旧契约说明继续误导后续任务。

**方案**

1. 更新 `backend/docs/agent-tools/skills/search_code.skill.md`，把它作为 `search_code` 的权威调用技能。
2. 更新 `backend/docs/agent-tools/MCP_TOOL_PLAYBOOK.md`，明确：公开 `action_input` 继续使用 `keyword`，但 MCP 路由下应优先设置 `is_regex=true`，由 router 同步生成 `pattern`。
3. 更新 `backend/docs/agent-tools/tools/search_code.md`，保证工具说明与 skill 一致。
4. 更新 `backend/docs/agent-tools/SKILLS_INDEX.md`，把 `search_code` 标注为重点维护项，作为 skill 维护列表入口。

**非目标**

- 本次不修复 `backend/app/services/agent/mcp/router.py` 的运行时参数映射。
- 本次不新增独立的 `search-code-mcp-precision` skill，避免与现有 `search_code` tool skill 重叠。

**预期结果**

- Agent memory 中同步的 `search_code` skill 将优先引导 regex-first、scope-first 的调用方式。
- 后续 `search_code` 调用更容易命中 MCP 所需参数形态，并在出现 unsafe regex 时有明确降级策略。
