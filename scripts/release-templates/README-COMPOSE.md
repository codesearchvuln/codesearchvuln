# Docker Compose 运维说明

本文档介绍当前安装目录中 `docker-compose.yml` 的常见使用方式，以及 VulHunter 在线运行、离线运行和日常维护时需要关注的配置项。

## 运行前提与支持边界

- 当前 release 合同仅面向宿主机部署，支持的宿主机环境为：`Ubuntu 22.04 LTS`、`Ubuntu 24.04 LTS`、`Windows 10`、`Windows 11`、`Windows 10 WSL2 + Ubuntu 22.04 LTS`、`Windows 11 WSL2 + Ubuntu 22.04 LTS`
- `Windows 10/11` 宿主机场景需要使用 `Docker Desktop` 并启用 Linux containers。backend 容器必须能够访问宿主机 Docker Socket（默认 `/var/run/docker.sock`）；若实际路径或组 ID 不同，请自行设置 `DOCKER_SOCKET_PATH` 与 `DOCKER_SOCKET_GID`
- 当前 release tree 是 image-only 运行包，不附带 `backend` / `frontend` 源码，不支持在当前目录内本地重建前后端，也不提供非 Docker、Kubernetes、源码直跑或其他衍生部署方式的适配
- release tree 同时提供 `load-images.sh` / `use-offline-env.sh` 与 `load-images.ps1` / `use-offline-env.ps1` 两套离线脚本；离线路径额外依赖 `docker`、`zstd`，其中 Bash 版还依赖 `python3`
- 推荐运行配置为 `8 核 CPU`、`16 GB 内存`。低于该配置时，镜像拉取、runner 预检、扫描任务和 LLM 交互可能明显变慢甚至失败
- 浏览器支持范围为 `Safari`、`Chrome`、`Edge`，建议禁用所有浏览器插件 / 扩展。由插件、内容拦截器或不受支持浏览器导致的问题不在适配范围内

## 在线启动

```bash
cp docker/env/backend/env.example docker/env/backend/.env
docker compose up -d
```

在线模式下：

- `backend`、`postgres`、`redis`、`scan-workspace-init`、scanner runner 和 `sandbox-runner` 使用发布流程预构建的 digest 固定镜像
- 主前端使用 `STATIC_FRONTEND_IMAGE` 提供的 nginx 基底镜像，并挂载当前目录中的 `deploy/runtime/frontend/site` 与 `deploy/runtime/frontend/nginx/default.conf`
- `db`、`redis` 由当前 compose 直接拉起
- `nexus-web` 与 `nexus-itemDetail` 现在由主前端容器直接挂载本地静态产物提供页面，不再单独启动容器
- runner preflight 只会校验并拉取声明的运行镜像，不会回退到本地构建

## 离线启动

```bash
cp docker/env/backend/offline-images.env.example docker/env/backend/offline-images.env
./scripts/load-images.sh
./scripts/use-offline-env.sh docker compose up -d
```

`Windows 10/11 原生 PowerShell` 可直接执行：

```powershell
Copy-Item docker/env/backend/offline-images.env.example docker/env/backend/offline-images.env
powershell -ExecutionPolicy Bypass -File .\scripts\load-images.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\use-offline-env.ps1 docker compose up -d
```

离线镜像包文件名为：

- `vulhunter-services-images-<arch>.tar.zst`
- `vulhunter-scanner-images-<arch>.tar.zst`

请把这两份文件都放在 release 根目录或 `images/` 目录。前端与 `nexus-*` 继续走当前目录内的静态资源加载路径，不包含在离线镜像包内。

- `load-images.sh` / `load-images.ps1` 会先导入两份离线镜像包；`use-offline-env.sh` / `use-offline-env.ps1` 会加载 `offline-images.env` 并执行后续命令
- 离线模式只切换镜像来源，不改变 compose 结构；如需成功启动，离线镜像包架构必须与当前机器匹配（`amd64` / `arm64`）

## 查看运行状态

查看服务状态：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f
```

重启单个服务：

```bash
docker compose restart backend
```

## 常用配置文件

- `docker/env/backend/.env`
  用于保存在线运行时的业务配置、密钥、连接参数和镜像覆盖项
- `docker/env/backend/offline-images.env`
  用于离线运行时切换到本地已导入镜像

在 `docker/env/backend/.env` 中，至少需要配置：

- `LLM_API_KEY`
- `LLM_PROVIDER`
- `LLM_MODEL`

如果需要替换运行镜像，也可以在 `.env` 中设置：

- `BACKEND_IMAGE`
- `POSTGRES_IMAGE`
- `REDIS_IMAGE`
- `ADMINER_IMAGE`
- `SCAN_WORKSPACE_INIT_IMAGE`
- `STATIC_FRONTEND_IMAGE`
- `SCANNER_*_IMAGE`
- `FLOW_PARSER_RUNNER_IMAGE`
- `SANDBOX_RUNNER_IMAGE`

其中 `STATIC_FRONTEND_IMAGE` 只用于替换承载静态文件的 nginx 基底镜像。

## 数据卷与默认端口

- 默认暴露端口：`3000`、`8000`、`5432`、`6379`；`adminer` 仅在 `tools` profile 下通过 `8081` 暴露
- 运行数据保存在 Docker volumes：`postgres_data`、`backend_uploads`、`backend_runtime_data`、`scan_workspace`、`redis_data`
- 如执行 `docker compose down -v`，上述持久化数据会被一并删除

## 默认访问地址

- 前端：`http://localhost:3000`
- 后端：`http://localhost:8000`
- OpenAPI：`http://localhost:8000/docs`
- `nexus-web`：`http://localhost:${VULHUNTER_FRONTEND_PORT:-3000}/nexus/`
- `nexus-itemDetail`：`http://localhost:${VULHUNTER_FRONTEND_PORT:-3000}/nexus-item-detail/`

## 常见操作

停止服务：

```bash
docker compose down
```

删除服务和数据卷：

```bash
docker compose down -v
```

配置变更后重新拉起：

```bash
docker compose up -d
```
