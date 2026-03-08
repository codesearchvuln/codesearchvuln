# Skill: search_code

## 目标
- 快速定位证据行，作为 `read_file` 锚点来源。
- 为 `controlflow_analysis_light` 提供 `file_path:line` 级输入。

## MCP 路由关键事实
- 2026-03-08 的日志显示：`search_code` 走 `code_index/search_code_advanced` 时，普通关键字调用会报 `pattern Field required`。
- 当前公共 `action_input` 仍然使用 `keyword`；不要直接发明 `pattern` 字段。
- 在现有 router 行为下，**优先设置 `is_regex=true`**，这样 `keyword` 会被同步到 MCP 所需的 `pattern`，命中更稳定。

## 输入契约
- 必填: `keyword`。
- 可选: `directory`, `file_pattern`, `is_regex`, `max_results`。
- 当任务运行在 MCP 路由下时，默认采用：`keyword` + `is_regex=true` + 窄范围约束。

## 推荐调用链
1. `search_code` 获取 `file:line`。
2. `read_file` 做窗口化验证。
3. `controlflow_analysis_light` 使用 `file_path:line` 或显式 `line_start`。
4. 必要时补 `locate_enclosing_function`。

## 精确工作流
1. 关键词优先级：函数名/常量名 > 漏洞 sink > 泛词。
2. MCP 精确模式：优先把 `keyword` 写成**简单正则**，并显式带 `is_regex=true`。
3. 强约束范围：总是尽量携带 `directory` + `file_pattern`。
4. 命中后立即提取首个可信 `file_path:line`，用于后续 `read_file`/`controlflow_analysis_light`。
5. 若无命中，先缩小范围重试一次；连续失败则切换策略，不做参数重复调用。

## 正则写法约束
- 优先使用简单字面量或简单 alternation：`pickle|subprocess|fromstring\(`。
- 需要标点时，只转义必要字符：`fromstring\(`、`params\["object"\]`。
- 避免复杂 PCRE：`.*`, `.+`, 回溯密集分组、前后查找、反向引用。
- 若返回 `Potentially unsafe regex pattern`，不要重复同一模式；应拆成多个更简单的 token 或改用 `list_files -> read_file` 重新定位。

## 禁止用法
- 不要在无有效输入时重复调用。
- 不要跳过定位步骤直接下结论。
- 不要在 MCP 路由下默认使用 `keyword` 纯文本模式并省略 `is_regex`。
- 不要把同一个失败的 unsafe regex 原样重试。

## 最小示例
```json
{
  "tool": "search_code",
  "action_input": {
    "keyword": "TM64_ASCTIME_FORMAT",
    "directory": "src",
    "file_pattern": "time64*",
    "is_regex": true,
    "max_results": 8
  }
}
```

## 精确示例
```json
{
  "tool": "search_code",
  "action_input": {
    "keyword": "pickle|params\\[\"object\"\\]|fromstring\\(|subprocess",
    "directory": ".",
    "file_pattern": "dsvw.py",
    "is_regex": true,
    "max_results": 12
  }
}
```

## 失败恢复
- `pattern Field required`：说明这次调用仍落在旧的 keyword-only 形态；下次改为 `is_regex=true` 并保持 `keyword` 简单可执行。
- `Potentially unsafe regex pattern`：拆分为多个简单 token 重搜，或退回 `list_files -> read_file` 重建锚点。
- 先核对输入参数与路径范围。
- 必要时回到 `search_code -> read_file` 重新建立证据链。
