# Codex API 配置指南

## 配置文件位置

```
~/.codex/config.toml
```

## 当前配置结构

你的配置文件已经有一个自定义 provider（yunyi），如果要添加新的 API 配置，可以按以下方式操作：

## 配置示例

### 1. 添加 OpenAI 兼容的 API

```toml
# 主配置
model_provider = "your_provider_name"  # 使用的 provider 名称
model = "your-model-name"              # 模型名称
model_reasoning_effort = "xhigh"       # 推理强度: low/medium/high/xhigh
model_context_window = 1000000         # 上下文窗口大小
model_auto_compact_token_limit = 900000 # 自动压缩阈值
service_tier = "fast"                  # 服务层级

# Provider 配置
[model_providers.your_provider_name]
name = "your_provider_name"
base_url = "https://api.example.com/v1"  # 你的 API base URL
wire_api = "responses"                    # API 协议类型
experimental_bearer_token = "your-api-key-here"  # 你的 API Key
requires_openai_auth = true              # 是否需要 OpenAI 认证格式

# 功能开关
[features]
fast_mode = true
enable_request_compression = true
```

### 2. 添加多个 Provider

你可以配置多个 provider 并在它们之间切换：

```toml
# 默认使用的 provider
model_provider = "yunyi"

# Provider 1: yunyi (已有)
[model_providers.yunyi]
name = "yunyi"
base_url = "http://127.0.0.1:15721/v1"
wire_api = "responses"
experimental_bearer_token = "17YDFCB5-RXCB-1JEZ-N0WG-X6N8S3REFXFX"
requires_openai_auth = true

# Provider 2: 例如 OpenAI
[model_providers.openai]
name = "openai"
base_url = "https://api.openai.com/v1"
wire_api = "responses"
experimental_bearer_token = "sk-your-openai-key"
requires_openai_auth = true

# Provider 3: 例如 Anthropic
[model_providers.anthropic]
name = "anthropic"
base_url = "https://api.anthropic.com"
wire_api = "anthropic"  # 注意：Anthropic 使用不同的协议
experimental_bearer_token = "sk-ant-your-key"
requires_openai_auth = false

# Provider 4: 自定义本地模型
[model_providers.local]
name = "local"
base_url = "http://localhost:11434/v1"  # 例如 Ollama
wire_api = "responses"
experimental_bearer_token = "not-needed"
requires_openai_auth = false
```

## 配置参数说明

### 主配置参数

| 参数 | 说明 | 示例值 |
|------|------|--------|
| `model_provider` | 使用的 provider 名称 | `"yunyi"`, `"openai"`, `"anthropic"` |
| `model` | 模型名称 | `"gpt-5.4"`, `"claude-sonnet-4-6"` |
| `model_reasoning_effort` | 推理强度 | `"low"`, `"medium"`, `"high"`, `"xhigh"` |
| `model_context_window` | 上下文窗口大小（tokens） | `1000000`, `200000` |
| `model_auto_compact_token_limit` | 自动压缩阈值 | `900000` |
| `service_tier` | 服务层级 | `"fast"`, `"standard"` |

### Provider 配置参数

| 参数 | 说明 | 示例值 |
|------|------|--------|
| `name` | Provider 名称（必须与配置节名称一致） | `"yunyi"` |
| `base_url` | API 基础 URL | `"https://api.example.com/v1"` |
| `wire_api` | API 协议类型 | `"responses"`, `"anthropic"` |
| `experimental_bearer_token` | API 密钥 | `"sk-..."` |
| `requires_openai_auth` | 是否使用 OpenAI 认证格式 | `true`, `false` |

## 如何修改配置

### 方法 1: 直接编辑配置文件

```bash
# 使用你喜欢的编辑器打开配置文件
vim ~/.codex/config.toml
# 或
code ~/.codex/config.toml
# 或
nano ~/.codex/config.toml
```

### 方法 2: 使用命令行覆盖

```bash
# 临时使用不同的模型
codex -c model="gpt-4" exec "你的提示"

# 临时使用不同的 provider
codex -c model_provider="openai" exec "你的提示"

# 组合多个配置
codex -c model_provider="openai" -c model="gpt-4" exec "你的提示"
```

## 常见 API 配置示例

### OpenAI

```toml
[model_providers.openai]
name = "openai"
base_url = "https://api.openai.com/v1"
wire_api = "responses"
experimental_bearer_token = "sk-proj-your-key-here"
requires_openai_auth = true
```

### Anthropic Claude

```toml
[model_providers.anthropic]
name = "anthropic"
base_url = "https://api.anthropic.com"
wire_api = "anthropic"
experimental_bearer_token = "sk-ant-api03-your-key-here"
requires_openai_auth = false
```

### Azure OpenAI

```toml
[model_providers.azure]
name = "azure"
base_url = "https://your-resource.openai.azure.com/openai/deployments/your-deployment"
wire_api = "responses"
experimental_bearer_token = "your-azure-key"
requires_openai_auth = true
```

### 本地 Ollama

```toml
[model_providers.ollama]
name = "ollama"
base_url = "http://localhost:11434/v1"
wire_api = "responses"
experimental_bearer_token = "not-needed"
requires_openai_auth = false
```

### 自定义 OpenAI 兼容 API

```toml
[model_providers.custom]
name = "custom"
base_url = "https://your-api.example.com/v1"
wire_api = "responses"
experimental_bearer_token = "your-api-key"
requires_openai_auth = true
```

## 切换 Provider

修改配置文件中的 `model_provider` 值：

```toml
# 使用 yunyi
model_provider = "yunyi"

# 切换到 openai
model_provider = "openai"

# 切换到 anthropic
model_provider = "anthropic"
```

保存后，Codex 会自动使用新的 provider。

## 验证配置

```bash
# 测试配置是否正确
codex exec "Hello, test"

# 查看当前配置
cat ~/.codex/config.toml

# 使用 debug 模式查看详细信息
codex --enable debug_mode exec "test"
```

## 注意事项

1. **API Key 安全**: 不要将包含真实 API Key 的配置文件提交到版本控制
2. **Base URL 格式**: 确保 URL 以 `/v1` 结尾（OpenAI 兼容 API）
3. **wire_api 类型**:
   - `"responses"` - OpenAI 兼容 API
   - `"anthropic"` - Anthropic 原生 API
4. **Token 限制**: 根据你的 API 提供商设置合适的 context window
5. **重启**: 修改配置后，正在运行的 Codex 会话需要重启才能生效

## 当前配置总结

你当前的配置使用：
- Provider: `yunyi`
- Base URL: `http://127.0.0.1:15721/v1`
- Model: `gpt-5.4`
- Context Window: 1M tokens

如果需要修改，直接编辑 `~/.codex/config.toml` 文件即可。
