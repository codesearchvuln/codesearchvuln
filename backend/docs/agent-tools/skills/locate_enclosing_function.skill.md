# Skill: locate_enclosing_function

## 目标
- 通过本地轻量函数定位能力，将命中行绑定到所属函数，补齐函数级证据。

## 输入契约
- 至少提供其一: `file_path` 或 `path`。
- 行号优先级: `line_start` > `line` > `file_path:line` / `path:line`。
- 支持: `file_path:line` / `path:line` 的嵌入式写法。

## 输出契约
- 稳定字段: `file_path`, `line_start`, `enclosing_function`, `symbols`, `resolution_method`, `resolution_engine`, `diagnostics`。
- `enclosing_function` 提供首选函数与范围；`symbols` 提供兼容下游消费的函数列表。
- `diagnostics` 供下游推理与降级判断使用，不应直接当作面向用户的错误文案。

## 推荐调用链
1. `search_code` 找到命中行。
2. `locate_enclosing_function` 获取函数名与范围。
3. `read_file` 或 `extract_function` 深入验证。

## 使用建议
- 只在已有 `file_path:line` 时调用，避免无锚点定位。
- 解析顺序为: Python tree-sitter 优先，失败时再走轻量 regex 回退。
- 定位不到函数时，直接回退 `read_file`，不要反复盲试。

## 最小示例
```json
{"tool":"locate_enclosing_function","note":"请按项目实际参数替换"}
```
