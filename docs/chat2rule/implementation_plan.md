# Chat2Rule 实现规划（简化版）

## 1. 目标

先不要把 Chat2Rule 做成一整套独立系统，首版只做一个最短闭环：

- 在 `ProjectCodeBrowser` 页面增加一个按钮，例如“对话生成规则”
- 用户点击按钮后，弹出一个对话窗口
- 用户基于当前选中的代码片段，用对话的方式让 AI 生成规则
- 首版只支持 `Opengrep`
- AI 返回规则草案后，后端立即做一次校验
- 用户确认后，再保存为正式的 `OpengrepRule`

一句话概括：

> 先做“按钮 + 弹窗 + 对话生成 Opengrep 规则”的 MVP，不单独开新页面，也不提前做 CodeQL。

## 2. MVP 范围

### 要做

- `ProjectCodeBrowser` 增加入口按钮
- 支持从当前代码浏览上下文带入选中的代码片段
- 弹窗内支持多轮对话
- 每轮返回：
  - AI 回复
  - `Opengrep` 规则草案
  - 规则校验结果
- 用户可以一键保存为正式 `OpengrepRule`

### 先不做

- 不做独立的 Chat2Rule 页面
- 不做复杂的会话管理页面
- 不做 CodeQL
- 不做流式 SSE
- 不做规则版本对比
- 不做 smoke scan
- 不做跨项目历史复用

## 3. 交互流程

首版推荐交互如下：

1. 用户在 `ProjectCodeBrowser` 中查看代码
2. 用户选中一段代码，或者直接基于当前文件上下文发起
3. 点击“对话生成规则”按钮
4. 弹出 Chat2Rule 窗口
5. 窗口中展示：
   - 当前选中的代码片段
   - 对话输入框
   - AI 生成的 `Opengrep` 规则草案
   - 校验结果
6. 用户继续追问，例如：
   - “缩小匹配范围”
   - “只针对 Python”
   - “避免误报这个 helper 函数”
7. AI 返回更新后的规则
8. 用户点击“保存为 Opengrep 规则”

## 4. 前端方案

### 4.1 入口

入口放在：

- `frontend/src/pages/ProjectCodeBrowser.tsx`

建议增加一个按钮：

- `对话生成规则`

如果当前没有选中代码，也可以允许点击，但要提示用户：

- 可以先选中代码再生成规则
- 或者直接基于当前文件内容进行对话

### 4.2 弹窗布局

弹窗不需要太复杂，建议直接做成三块：

- 上方：当前项目 / 文件 / 选中片段摘要
- 中间左侧：聊天区
- 中间右侧：规则草案 + 校验结果

如果想再简单一点，也可以做成上下结构：

- 上半部分：聊天区
- 下半部分：规则 YAML + 校验结果

### 4.3 前端状态

首版只需要维护最少状态：

- 当前项目 ID
- 当前文件路径
- 当前选中代码片段
- 对话消息列表
- 最新规则草案
- 最新校验结果
- 保存状态

首版不必为了这个功能单独引入复杂 store，组件内状态或简单 hooks 就够了。

## 5. 后端方案

### 5.1 总体原则

后端也先做轻量化，不要一开始就设计复杂的 session / artifact / version 表。

首版建议：

- 先提供一个专门的 `Opengrep` 对话生成接口
- 前端把当前消息历史和代码片段一起传给后端
- 后端调用 LLM 生成规则
- 后端复用现有 `Opengrep` 校验能力
- 用户保存时，再写入正式 `OpengrepRule`

也就是说：

- 对话过程可以先不持久化
- 最终产物才持久化到规则库

这样实现成本最低，也最符合这次“先简单一点”的目标。

### 5.2 推荐接口

建议新增轻量接口：

1. `POST /api/v1/projects/{project_id}/chat2rule/opengrep/chat`
   - 输入：
     - 当前代码片段
     - 当前对话消息
   - 输出：
     - assistant_message
     - rule_text
     - explanation
     - validation_result

2. `POST /api/v1/projects/{project_id}/chat2rule/opengrep/save`
   - 输入：
     - rule_text
     - title
     - description（可选）
   - 动作：
     - 再校验一次
     - 保存到 `OpengrepRule`

### 5.3 请求示例

```json
{
  "messages": [
    {
      "role": "user",
      "content": "请根据这段 Python 代码生成一个检测 subprocess shell 注入的 Opengrep 规则"
    }
  ],
  "selections": [
    {
      "file_path": "app/routes.py",
      "start_line": 42,
      "end_line": 66
    }
  ]
}
```

### 5.4 返回示例

```json
{
  "assistant_message": "我根据当前代码生成了一版 Opengrep 规则，重点检测用户输入进入 subprocess 并启用 shell=True 的场景。",
  "rule_text": "rules:\n  - id: python-subprocess-shell-injection\n    ...",
  "explanation": "这条规则主要覆盖 subprocess 调用场景。",
  "validation_result": {
    "valid": true,
    "errors": []
  }
}
```

## 6. Opengrep 首版实现要点

首版先以 `Opengrep` 为唯一目标，引擎层不必抽象过度，但代码里保留一点扩展空间即可。

建议复用现有能力：

- `LLMService`
- `validate_generic_rule(...)`
- `OpengrepRule` 的保存逻辑

Prompt 也尽量简单，明确要求模型输出固定结构：

- assistant_message
- rule_title
- rule_text
- explanation

如果模型偶尔返回格式不稳定，首版可以先在服务端做一层容错解析，不需要为此设计复杂协议。

## 7. 数据设计建议

首版建议不新增复杂表。

### 7.1 先不新增

- 不新增 `chat2rule_sessions`
- 不新增 `chat2rule_messages`
- 不新增 `chat2rule_artifacts`

### 7.2 直接复用

- 正式保存时直接写入 `OpengrepRule`

### 7.3 后续再考虑

如果后面确认这个功能使用频率高，再补：

- 会话历史
- 草案版本
- 发布记录
- 多引擎抽象

## 8. 需要改动的文件

### 前端

- `frontend/src/pages/ProjectCodeBrowser.tsx`
  - 增加按钮
  - 打开弹窗
  - 传入当前选中的代码片段
- `frontend/src/shared/api/chat2rule.ts`
  - 增加 chat / save 接口
- 新增一个弹窗组件，例如：
  - `frontend/src/pages/chat2rule/Chat2RuleDialog.tsx`

### 后端

- 新增接口文件，例如：
  - `backend/app/api/v1/endpoints/projects_chat2rule.py`
- 新增轻量 service，例如：
  - `backend/app/services/chat2rule/service.py`
- 在 service 中复用：
  - `LLMService`
  - `validate_generic_rule(...)`
  - `OpengrepRule`

## 9. 实施步骤

### Phase 1：前端入口

- 在 `ProjectCodeBrowser` 增加“对话生成规则”按钮
- 完成弹窗 UI
- 能把选中的代码片段带进弹窗

### Phase 2：后端生成

- 增加 `opengrep/chat` 接口
- 接收消息和代码片段
- 调用 LLM 生成规则
- 返回规则草案和校验结果

### Phase 3：保存规则

- 增加 `opengrep/save` 接口
- 保存前再次校验
- 写入 `OpengrepRule`

### Phase 4：体验优化

- 优化错误提示
- 优化规则展示格式
- 处理无选中代码时的提示文案

## 10. 验收标准

做到下面几点，就可以认为首版完成：

- 用户能在 `ProjectCodeBrowser` 看到入口按钮
- 点击后能打开弹窗
- 能基于选中的代码发起对话
- AI 能返回一版 `Opengrep` 规则
- 后端会返回校验结果
- 用户可以把规则保存到 `OpengrepRule`

## 11. 后续扩展方向

等首版跑通之后，再考虑：

- 流式输出
- 会话持久化
- 规则草案历史版本
- 从历史规则做 few-shot
- 支持 `CodeQL`
- 支持从 finding 一键生成规则

当前不建议提前把这些内容做进 MVP。
