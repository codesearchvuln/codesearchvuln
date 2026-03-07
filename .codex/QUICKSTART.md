# Codex MCP 集成 - 快速参考

## 配置文件清单

✅ `.mcp.json` - MCP 服务器配置
✅ `.claude/settings.local.json` - Claude Code 配置（已启用 Codex MCP）
✅ `.codex/README.md` - 用户文档
✅ `.codex/INTEGRATION.md` - 技术集成文档
✅ `.codex/COLLABORATION-GUIDE.md` - 协作开发指南
✅ `.codex/test-plan.md` - 测试规划示例
✅ `.gitignore` - 已排除生成的文档和日志

## 重启 Claude Code

**重要**: 需要重启 Claude Code 才能加载 MCP 配置

```bash
# 退出当前会话
exit

# 重新启动 Claude Code
claude code
```

## 验证 MCP 集成

重启后，Codex MCP 工具应该自动可用。可以通过以下方式验证：

1. 查看可用的 MCP 工具列表
2. 尝试调用 Codex 工具
3. 检查 MCP 连接状态

## 测试命令

```bash
# 测试 Codex CLI
codex --version

# 测试 MCP 服务器
codex mcp-server --help

# 查看 Codex 配置
cat ~/.codex/config.toml
```

## 使用流程

1. **Claude Code 规划**: 分析需求，设计方案
2. **生成规划文档**: 创建详细的实现计划
3. **调用 Codex MCP**: 通过 MCP 工具执行规划
4. **审查结果**: Claude Code 审查生成的代码
5. **迭代优化**: 根据反馈持续改进

## 文档位置

- 用户指南: [.codex/README.md](.codex/README.md)
- 集成文档: [.codex/INTEGRATION.md](.codex/INTEGRATION.md)
- 协作指南: [.codex/COLLABORATION-GUIDE.md](.codex/COLLABORATION-GUIDE.md)
- 测试规划: [.codex/test-plan.md](.codex/test-plan.md)

## 下一步

重启 Claude Code 后，可以尝试执行测试规划来验证集成是否正常工作。
