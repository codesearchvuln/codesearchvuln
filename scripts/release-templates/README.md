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

## 2. 部署支持范围与声明

- 当前 release 包仅面向宿主机部署，支持的宿主机环境为：
  `Ubuntu 22.04 LTS`、`Ubuntu 24.04 LTS`、`Windows 11`、`Windows 11 WSL2 + Ubuntu 22.04 LTS`
- `Windows 11` 宿主机场景需要使用 `Docker Desktop` 并启用 Linux containers。release 运行依赖 Docker Engine / Docker Compose，且 backend 容器必须能够访问 Docker Socket（默认 `/var/run/docker.sock`）以执行 runner preflight 和实际扫描任务；若你的 Docker Socket 路径或组 ID 与默认值不同，请自行设置 `DOCKER_SOCKET_PATH` 与 `DOCKER_SOCKET_GID`。若 Docker Desktop 的 Linux 容器模式、WSL 集成、Docker Socket 挂载或权限 / 组 ID 配置异常导致失败，不属于当前 release 的适配范围。
- 当前 release tree 由云端 GitHub Workflow 自动生成，属于 image-only 运行包，只包含运行时 `docker-compose.yml`、环境模板、静态资源和辅助脚本；不附带 `backend` / `frontend` 源码，不支持在 release 包内本地重建 `backend` / `frontend`，也不提供非 Docker、Kubernetes、源码直跑或其他衍生部署方式的适配。release 合同下的 runner preflight 只会校验并拉取声明的运行镜像，不会回退到本地构建。
- 文档中的辅助脚本均为 Bash 脚本；离线辅助脚本额外依赖 `docker`、`python3`、`zstd`。`Windows 11` 宿主机场景下，如需使用 `./scripts/load-images.sh`、`./scripts/use-offline-env.sh` 等脚本，请通过 WSL Bash 或其他兼容 Bash 的环境执行；若自行改写为 PowerShell / CMD 命令，相关问题需自行处理。
- 推荐运行配置为 `8 核 CPU`、`16 GB 内存`。低于该配置时，镜像拉取、runner 预检、扫描任务和 LLM 交互可能明显变慢甚至失败，因此不建议运行本系统。
- 浏览器支持范围为 `Safari`、`Chrome`、`Edge`。前端运行依赖 `EventSource/SSE`、`iframe`、`localStorage`、`clipboard` 等浏览器能力；为保证运行效果，建议禁用所有浏览器插件 / 扩展。因插件、内容拦截器、企业安全插件或其他不受支持浏览器导致的问题，不再进行相关适配。
- 联网为可选项，但在线部署默认需要联网拉取运行镜像；若调用云端 LLM API，也需要保证对应 API 可达。离线部署仅覆盖运行镜像导入，不会替代云端模型 API；如需离线启动，请使用与当前机器架构匹配的离线镜像包（`amd64` / `arm64`）。
- 默认会暴露 `3000`、`8000`、`5432`、`6379` 端口，以及 `tools` profile 下的 `8081` 端口。若宿主机端口冲突、防火墙策略、本机安全软件或企业网络策略导致访问失败，需由部署者自行处理。
- 运行数据会写入 Docker volumes（如 `postgres_data`、`backend_uploads`、`backend_runtime_data`、`scan_workspace`、`redis_data`）。清理容器或执行 `docker compose down -v` 会移除相关数据，备份、迁移和保留策略需由部署者自行负责。
- 除上述环境与路径外，其他宿主机、虚拟化方案、容器运行时、浏览器组合和代理 / 镜像源策略均未在当前 release 合同中验证。若在未声明环境中运行并出现问题，请自行排查处理，项目方不再追加相关测试环境适配。

## 3. 首次配置说明

`docker/env/backend/.env` 是 VulHunter 的主要运行配置文件。常见需要确认的项目包括：

- LLM 提供方与模型
- 访问密钥与 API 地址
- 数据库连接参数
- Redis 连接参数
- 扫描相关开关与镜像覆盖项

如果你暂时只想完成最小可用部署，通常只需要先填写 `LLM_API_KEY`、`LLM_PROVIDER` 和 `LLM_MODEL`。

## 4. 在线部署（默认）

```bash
docker compose up -d
```

默认情况下，VulHunter 会拉取所需的运行镜像并启动全部服务。主界面的静态文件和默认 nginx 配置已经随包提供；`STATIC_FRONTEND_IMAGE` 用于承载这些静态文件。数据库和 Redis 会按当前目录中的配置一并启动。`nexus-web` / `nexus-itemDetail` 不再以独立容器运行，而是作为本地静态页面挂载到主前端容器。代码执行镜像统一为 `SANDBOX_RUNNER_IMAGE`，不再提供旧的独立沙箱镜像覆盖项。

## 5. 离线部署（可选）

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

## 6. 运行与维护

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

## 7. 常用配置项

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

## 8. 访问入口

- 前端：`http://localhost:3000`
- 后端 API：`http://localhost:8000`
- OpenAPI 文档：`http://localhost:8000/docs`

更多 Docker Compose 相关操作见 [`scripts/README-COMPOSE.md`](scripts/README-COMPOSE.md)。
- `nexus-web`：`http://localhost:${VULHUNTER_FRONTEND_PORT:-3000}/nexus/`
- `nexus-itemDetail`：`http://localhost:${VULHUNTER_FRONTEND_PORT:-3000}/nexus-item-detail/`
