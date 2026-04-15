# VulHunter 部署指南

本目录是 VulHunter 的 image-only release 运行包，包含 `docker-compose.yml`、环境模板、前端静态资源、`nexus-*` 静态页面和离线辅助脚本。它不包含 `backend` / `frontend` 源码，也不支持在 release 包内本地重建前后端。

## 1. 支持范围与前提

- 支持的宿主机环境：`Ubuntu 22.04 LTS`、`Ubuntu 24.04 LTS`、`Windows 10`、`Windows 11`、`Windows 10 WSL2 + Ubuntu 22.04 LTS`、`Windows 11 WSL2 + Ubuntu 22.04 LTS`
- `Windows 10/11` 宿主机需要使用 `Docker Desktop` 并启用 Linux containers
- 离线路径需要宿主机预装：`docker`、`zstd`；`Bash/WSL` 路径额外需要 `python3`
- 浏览器支持：`Safari`、`Chrome`、`Edge`
- 推荐配置：`8 核 CPU`、`16 GB 内存`

离线仅表示运行镜像会先导入本地并切换到本地标签，不表示云端模型 API 也会离线。如果你的 `LLM_PROVIDER` / `LLM_MODEL` 仍然依赖 cloud API，运行时仍然需要网络连通性。

## 2. 首次配置

推荐先在 release 根目录执行：

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

至少确认这些配置：

- `LLM_API_KEY`
- `LLM_PROVIDER`
- `LLM_MODEL`

如果你直接执行离线单入口脚本，而 `docker/env/backend/.env` 不存在，脚本会自动从 `docker/env/backend/env.example` 复制一份并继续执行；但这不代表配置已经可用于生产，请至少确认上面三个字段。

## 3. 在线启动

```bash
docker compose up -d
```

在线启动会直接使用发布的运行镜像。主前端通过 `STATIC_FRONTEND_IMAGE` 提供 nginx 基底镜像，再挂载当前目录中的静态文件；`nexus-web` 与 `nexus-itemDetail` 也通过本地静态资源提供页面：

- `http://localhost:3000/`
- `http://localhost:3000/nexus/`
- `http://localhost:3000/nexus-item-detail/`

## 4. 离线启动

先准备与你当前 Docker server 架构匹配的两份离线镜像包，并放到 release 根目录或 `images/` 目录：

- `vulhunter-services-images-<arch>.tar.zst`
- `vulhunter-scanner-images-<arch>.tar.zst`

Choose exactly one shell path.

### Bash / WSL

在 `WSL` 或 Linux `Bash` 中运行：

```bash
bash ./scripts/offline-up.sh
```

### Windows PowerShell

在 `Windows 10/11` 原生 `PowerShell` 中运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\offline-up.ps1
```

不要混用 Bash 和 PowerShell 命令。不要手工修改脚本执行位，不要手工放宽 `/var/run/docker.sock` 权限，也不要把首次启动写成先 `docker compose down`。

离线单入口脚本会自动完成以下动作：

- 缺少 `docker/env/backend/.env` 时，从 `env.example` 自动复制
- 缺少 `docker/env/backend/offline-images.env` 时，从 `offline-images.env.example` 自动复制
- 检查 `docker`、`docker compose`、镜像 manifest 和离线镜像包
- 导入 `services` 与 `scanner` 两份离线镜像包
- 切换到 `vulhunter-local/*` 镜像标签
- 自动启动 `docker compose up -d`

`offline-images.env` 自动复制后通常可以直接继续运行；只有你需要自定义离线镜像覆盖时，才需要手工编辑它。

## 5. Offline Means / Does Not Mean

- Offline means：运行镜像会先导入本地，并使用 `offline-images.env` 中的本地标签
- Offline does not mean：cloud LLM provider / API 也会变成本地
- 前端静态资源与 `nexus-*` 页面已经随 release 附带，不依赖 `offline-images.env` 覆盖前端镜像变量
- 离线脚本不会修改你的 Docker daemon 配置，也不会自动放宽 Docker socket 权限

## 6. 重试、重启与维护

以下场景都继续使用同一个单入口命令：

- 首次离线启动失败后重试
- 修改 `docker/env/backend/.env` 之后重启
- 修改 `docker/env/backend/offline-images.env` 之后重启

推荐重试方式：

```bash
bash ./scripts/offline-up.sh
```

或在 `Windows PowerShell` 中：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\offline-up.ps1
```

查看日志：

```bash
docker compose logs -f
```

停止服务：

```bash
docker compose down
```

如需删除持久化数据卷：

```bash
docker compose down -v
```

`docker compose down -v` 会删除 `postgres_data`、`backend_uploads`、`backend_runtime_data`、`scan_workspace`、`redis_data` 等持久化数据，请仅在明确需要清理数据时使用。

## 7. 常用配置项

如需覆盖默认运行镜像或接入已有环境，可在 `docker/env/backend/.env` 中调整：

- `BACKEND_IMAGE`
- `POSTGRES_IMAGE`
- `REDIS_IMAGE`
- `ADMINER_IMAGE`
- `SCAN_WORKSPACE_INIT_IMAGE`
- `STATIC_FRONTEND_IMAGE`
- `SCANNER_*_IMAGE`
- `FLOW_PARSER_RUNNER_IMAGE`
- `SANDBOX_RUNNER_IMAGE`

其中 `STATIC_FRONTEND_IMAGE` 只负责 Web 界面 nginx 基底镜像；实际 static assets 已随当前 release 包提供。

## 8. 访问入口

- 前端：`http://localhost:3000`
- 后端 API：`http://localhost:8000`
- OpenAPI 文档：`http://localhost:8000/docs`
- `nexus-web`：`http://localhost:${VULHUNTER_FRONTEND_PORT:-3000}/nexus/`
- `nexus-itemDetail`：`http://localhost:${VULHUNTER_FRONTEND_PORT:-3000}/nexus-item-detail/`

更多 Docker Compose 运维说明见 [`scripts/README-COMPOSE.md`](scripts/README-COMPOSE.md)。
