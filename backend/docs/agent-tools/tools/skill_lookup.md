# Tool: `skill_lookup`

## Tool Purpose
在统一 Skill 仓库中检索可用工作流，支持关键词搜索与按 `skill_id` 精确查询。

## Goal
帮助 Agent 在执行任务前快速定位可复用的 skill workflow，减少重复探索。

## Task List
- 按关键词检索可用技能与简介。
- 按 `skill_id` 获取技能详情。
- 可选读取 `SKILL.md` 工作流片段用于快速执行。

## Inputs
- `query` (string, optional): 关键词检索词。
- `skill_id` (string, optional): 精确技能标识（如 `using-superpowers@agents`）。
- `namespace` (string, optional): 命名空间过滤。
- `limit` (integer, optional): 返回条数（1-50）。
- `offset` (integer, optional): 分页偏移。
- `include_workflow` (boolean, optional): 是否返回 workflow 片段。

### Example Input
```json
{
  "query": "using-superpowers",
  "namespace": "agents",
  "limit": 5,
  "offset": 0
}
```

## Outputs
- `mode` (string): `catalog` 或 `detail`。
- `enabled` (bool): skill registry 是否启用。
- `total` (integer): 命中总数（catalog）。
- `items` (array): 技能摘要列表（catalog）。
- `skill` (object): 技能详情（detail）。
- `workflow_preview` (string): SKILL.md 工作流片段（detail + include_workflow=true）。
- `error` (string|null): 失败时错误信息。

## Typical Triggers
- 需要先查询当前可用 workflow，再决定调用哪个工具链。
- 需要确认某个 `skill_id` 是否存在及其执行说明。
- 需要读取技能工作流的核心步骤。

## Pitfalls And Forbidden Use
- 不要在无筛选条件时反复请求大分页。
- 不要把 workflow 片段当作完整规范，必要时应读取完整 `SKILL.md`。
- 不要忽略 namespace 导致同名 skill 误选。
