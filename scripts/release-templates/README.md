# VulHunter 部署指南

本目录用于部署 VulHunter 服务，包含启动所需的 Docker Compose 配置、环境变量模板、前端静态文件以及辅助脚本。按照本文档完成配置后，即可直接启动 Web 界面、后端服务、数据库、Redis 和默认扫描运行组件。

## 1. 快速开始

首次启动前，请先复制环境变量模板：

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

然后至少补齐以下配置：

- `LLM_API_KEY`
- `LLM_PROVIDER`
- `LLM_MODEL`

如需数据库、Redis、鉴权或其他业务配置，请继续编辑 `docker/env/backend/.env`。

完成配置后，执行：

```bash
docker compose up -d
```

## 2. 首次配置说明

`docker/env/backend/.env` 是 VulHunter 的主要运行配置文件。常见需要确认的项目包括：

- LLM 提供方与模型
- 访问密钥与 API 地址
- 数据库连接参数
- Redis 连接参数
- 扫描相关开关与镜像覆盖项

如果你暂时只想完成最小可用部署，通常只需要先填写 `LLM_API_KEY`、`LLM_PROVIDER` 和 `LLM_MODEL`。

## 3. 在线部署（默认）

```bash
docker compose up -d
```

默认情况下，VulHunter 会拉取所需的运行镜像并启动全部服务。主界面的静态文件和默认 nginx 配置已经随包提供；`STATIC_FRONTEND_IMAGE` 用于承载这些静态文件。数据库、Redis、`nexus-web` 和 `nexus-itemDetail` 也会按当前目录中的配置一并启动。代码执行镜像统一为 `SANDBOX_RUNNER_IMAGE`，不再提供旧的独立沙箱镜像覆盖项。

## 4. 离线部署（可选）

先下载与你机器架构匹配的两份离线镜像包：

- `vulhunter-services-images-<arch>.tar.zst`
- `vulhunter-scanner-images-<arch>.tar.zst`

把它们放到 release 根目录或 `images/` 目录，然后执行：

```bash
cp docker/env/backend/offline-images.env.example docker/env/backend/offline-images.env
./scripts/load-images.sh
./scripts/use-offline-env.sh docker compose up -d
```

离线模式会先同时导入 `services` 与 `scanner` 两个镜像包，再切换到本地 `vulhunter-local/*` 镜像标签运行，从而避免在线拉取。前端静态文件与 `nexus-*` 继续使用当前目录中自带的静态资源与本地静态加载路径，不包含在离线镜像包内。

## 5. 运行与维护

查看日志：

```bash
docker compose logs -f
```

停止服务：

```bash
docker compose down
```

如需连同数据库卷一起清理：

```bash
docker compose down -v
```

更新 `.env` 或 `offline-images.env` 后，再执行 `docker compose up -d` 使变更生效。

## 6. 常用配置项

如需覆盖默认运行镜像或接入已有环境，可根据实际需要在 `docker/env/backend/.env` 中调整：

- `BACKEND_IMAGE`
- `POSTGRES_IMAGE`
- `REDIS_IMAGE`
- `ADMINER_IMAGE`
- `SCAN_WORKSPACE_INIT_IMAGE`
- `STATIC_FRONTEND_IMAGE`
- `SCANNER_*_IMAGE`
- `FLOW_PARSER_RUNNER_IMAGE`
- `SANDBOX_RUNNER_IMAGE`

其中 `STATIC_FRONTEND_IMAGE` 只负责提供 Web 界面的 nginx 基底镜像；实际静态文件已包含在当前目录中。

## 7. 访问入口

- 前端：`http://localhost:3000`
- 后端 API：`http://localhost:8000`
- OpenAPI 文档：`http://localhost:8000/docs`
- `nexus-web`：`http://localhost:5174`
- `nexus-itemDetail`：`http://localhost:5175`

更多 Docker Compose 相关操作见 [`scripts/README-COMPOSE.md`](scripts/README-COMPOSE.md)。
