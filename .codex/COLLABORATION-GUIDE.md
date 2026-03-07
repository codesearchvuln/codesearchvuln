# Claude Code + Codex MCP 协作开发指南

## 架构概述

```
┌─────────────────┐         ┌──────────────────┐
│  Claude Code    │         │   Codex MCP      │
│  (规划/设计)     │ ──────> │   (执行/实现)     │
│                 │  MCP    │                  │
│  - 需求分析      │ Protocol│  - 代码生成       │
│  - 架构设计      │         │  - 测试执行       │
│  - 代码审查      │ <────── │  - 文件操作       │
└─────────────────┘         └──────────────────┘
```

## 配置文件

### 1. MCP 服务器配置 (.mcp.json)
```json
{
  "mcpServers": {
    "codex": {
      "command": "codex",
      "args": ["mcp-server"],
      "description": "Codex MCP server for AI-assisted development"
    }
  }
}
```

### 2. Claude Code 配置 (.claude/settings.local.json)
```json
{
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": ["codex"]
}
```

## 工作流程

### 阶段 1: Claude Code 规划
1. 分析需求和现有代码架构
2. 设计解决方案和 API 接口
3. 生成详细的实现规划
4. 创建测试用例规范

### 阶段 2: Codex MCP 执行
1. 接收 Claude Code 的规划文档
2. 生成具体的代码实现
3. 创建测试文件
4. 执行测试验证

### 阶段 3: Claude Code 审查
1. 审查 Codex 生成的代码
2. 检查是否符合项目规范
3. 提供改进建议
4. 迭代优化

## 使用示例

### 场景：添加日期工具函数

**Step 1: Claude Code 创建规划**
```bash
# 规划文档已创建在 .codex/test-plan.md
```

**Step 2: 通过 MCP 调用 Codex**
```bash
# 在 Claude Code 中，MCP 工具会自动可用
# 可以直接请求 Codex 执行规划：
"请使用 Codex MCP 执行 .codex/test-plan.md 中的实现计划"
```

**Step 3: Codex 执行并返回结果**
- 创建 `backend/app/utils/date_utils.py`
- 创建 `backend/tests/test_date_utils.py`
- 运行测试验证

**Step 4: Claude Code 审查**
- 检查代码质量
- 验证测试覆盖率
- 确认符合项目规范

## MCP 工具能力

Codex MCP 服务器提供的主要能力：

1. **代码生成**
   - 根据规范生成代码
   - 支持多种编程语言
   - 遵循项目代码风格

2. **文件操作**
   - 创建新文件
   - 修改现有文件
   - 管理文件结构

3. **测试执行**
   - 运行单元测试
   - 生成测试报告
   - 验证代码正确性

4. **代码审查**
   - 静态分析
   - 风格检查
   - 最佳实践建议

## 优势

### Claude Code 的优势
- 深入理解项目架构
- 全局视角的设计决策
- 复杂问题的分析能力
- 代码审查和质量把控

### Codex MCP 的优势
- 快速代码生成
- 精确的语法处理
- 自动化测试执行
- 批量文件操作

### 协作优势
- **分工明确**: 规划与执行分离
- **效率提升**: 并行处理多个任务
- **质量保证**: 双重审查机制
- **迭代优化**: 快速反馈循环

## 最佳实践

1. **规划先行**
   - Claude Code 先完成详细设计
   - 明确接口和数据结构
   - 定义测试用例

2. **清晰沟通**
   - 使用结构化的规划文档
   - 明确指定文件路径和函数签名
   - 提供完整的上下文信息

3. **增量开发**
   - 将大任务拆分为小步骤
   - 每步完成后验证
   - 逐步迭代优化

4. **持续审查**
   - 及时审查 Codex 的输出
   - 提供具体的改进建议
   - 确保代码质量

## 故障排查

### MCP 服务器未连接
```bash
# 检查 Codex 是否安装
which codex

# 测试 MCP 服务器
codex mcp-server --help

# 检查配置文件
cat .mcp.json
```

### 工具调用失败
```bash
# 查看 Claude Code 日志
# 检查权限配置
# 验证 Codex 配置文件
cat ~/.codex/config.toml
```

## 下一步

1. 重启 Claude Code 以加载 MCP 配置
2. 验证 Codex MCP 工具是否可用
3. 执行测试规划验证集成
4. 根据实际使用情况调整配置
