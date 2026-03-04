# Skill: search_code

## 目标
- 快速定位证据行，作为 `read_file` 锚点来源。
- 为 `controlflow_analysis_light` 提供 `file_path:line` 级输入。

## 输入契约
- 必填: `keyword`。
- 可选: `directory`, `file_pattern`, `is_regex`, `max_results`。

## 推荐调用链
1. `search_code` 获取 `file:line`。
2. `read_file` 做窗口化验证。
3. `controlflow_analysis_light` 使用 `file_path:line` 或显式 `line_start`。
4. 必要时补 `locate_enclosing_function`。

## 精确工作流
1. 关键词优先级：函数名/常量名 > 漏洞 sink > 泛词。
2. 强约束范围：总是尽量携带 `directory` + `file_pattern`。
3. 命中后立即提取首个可信 `file_path:line`，用于后续 `read_file`/`controlflow_analysis_light`。
4. 若无命中，先缩小范围重试一次；连续失败则切换策略，不做参数重复调用。

## 禁止用法
- 不要在无有效输入时重复调用。
- 不要跳过定位步骤直接下结论。

## 最小示例
```json
{
  "tool": "search_code",
  "action_input": {
    "keyword": "TM64_ASCTIME_FORMAT",
    "directory": "src",
    "file_pattern": "time64*",
    "max_results": 8
  }
}
```

## 失败恢复
- 先核对输入参数与路径范围。
- 必要时回到 `search_code -> read_file` 重新建立证据链。
