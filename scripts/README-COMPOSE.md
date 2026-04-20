# Release Compose Guide

这里说明的是 generated release tree 的运行时 compose 合同。若你是在源码仓库根目录直接执行 `docker compose up`，那是另一份 compose 合同：主 frontend 仍使用 `FRONTEND_IMAGE`，默认指向 `vulhunter-frontend`，并可继续叠加 `docker-compose.hybrid.yml`。当前文档不覆盖那条路径。

release branch 只代表最新一份 generated release tree 的交付通道，不是历史 snapshot 索引。离线部署时，请保证你手里的 release tree 与两份离线 tar 包来自同一个 snapshot。

generated release tree 只暴露一份运行时 compose 合同：`docker-compose.yml`。它不会附带本地 build overlay、Dockerfile，也不支持在 release tree 内本地重建 `backend` / `frontend`。
generated release tree 现在只支持离线部署，不支持在线部署，也不再提供 `online-up.sh`。

当前默认 release backend 镜像固定来自 Docker `runtime-plain` target。离线部署与 release tree 验收都不依赖 `runtime-release` 或其他额外 backend target。

这是一次数据库兼容策略收紧的 breaking change：旧 `postgres_data` 不再保证能被新版本直接启动或自动前滚。升级前请备份旧数据库卷与 `backend_uploads`；新版本默认只接受空库 bootstrap 或与当前版本匹配的数据库快照。

release refresh 脚本默认固定 Compose project name 为 `VULHUNTER_RELEASE_PROJECT_NAME=vulhunter-release`。它们只清理当前 release stack 的容器与对应镜像，不会删除任何 Docker volume，也不会影响其他 Compose project。

## 运行前提与支持边界

- 当前 release 合同仅面向宿主机部署，支持的宿主机环境为：`Ubuntu 22.04 LTS`、`Ubuntu 24.04 LTS`、`Windows 10 WSL2 + Ubuntu 22.04 LTS`、`Windows 11 WSL2 + Ubuntu 22.04 LTS`
- backend 容器必须能够访问宿主机 Docker Socket（默认 `/var/run/docker.sock`）；若实际路径或组 ID 不同，请自行设置 `DOCKER_SOCKET_PATH` 与 `DOCKER_SOCKET_GID`
- release tree 是 GitHub Workflow 生成的 image-only 运行包，不支持非 Docker、Kubernetes、源码直跑或其他衍生部署方式
- generated release tree 的离线路径只提供 `offline-up.sh` 单入口；离线路径额外依赖 `docker`、`zstd`，其中 Bash/WSL 路径还依赖 `python3`
- 推荐运行配置为 `8 核 CPU`、`16 GB 内存`。低于该配置时，镜像拉取、runner 预检、扫描任务和 LLM 交互可能明显变慢甚至失败
- 浏览器支持范围为 `Safari`、`Chrome`、`Edge`，建议禁用所有浏览器插件 / 扩展。由插件、内容拦截器或不受支持浏览器导致的问题不在适配范围内

## 环境引导

先复制后端环境模板：

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

至少配置：
`LLM_API_KEY`、`LLM_PROVIDER`、`LLM_MODEL`

## 命令说明

### 离线模式

```bash
cp docker/env/backend/offline-images.env.example docker/env/backend/offline-images.env
bash ./scripts/offline-up.sh
```

如需直接附着启动日志：

```bash
bash ./scripts/offline-up.sh --attach-logs
```

离线镜像包文件名固定为：

- `vulhunter-services-images-<arch>.tar.zst`
- `vulhunter-scanner-images-<arch>.tar.zst`
- 用户侧仍然只需要这两份 tar 包；两份文件都需要放在 release 根目录或 `images/` 目录，且必须与当前机器架构匹配（`amd64` / `arm64`），并与当前 release tree 来自同一个 snapshot
- `offline-up.sh` 的合同也是“刷新当前 release stack”；它会先读取 release tree 自带的 `release-snapshot-lock.json`，在清理前校验两份 bundle 的文件名与 SHA256；通过后才会导入离线镜像包，加载 `offline-images.env`，切换到本地 `vulhunter-local/*` 镜像标签
- 之后脚本只会停止并删除当前 `VULHUNTER_RELEASE_PROJECT_NAME=vulhunter-release` release stack 的容器与对应镜像，绝不删除 volumes，也不会清理其他 Compose project
- 默认模式不显示附着日志；只有 `--attach-logs` 才会在 backend 健康后切到前台 `docker compose up`
- 离线重跑前，两份 tar 包仍然必须保留在 release 根目录或 `images/`
- 离线模式不会改变 compose 结构，只改变镜像来源；代码执行统一走本地 `sandbox-runner` 标签，主 frontend 仍按 `STATIC_FRONTEND_IMAGE + deploy/runtime/frontend/*` 运行，不会切回 `FRONTEND_IMAGE`
- 如果日志出现 `DB_SCHEMA_EMPTY`、`DB_SCHEMA_MISMATCH` 或 `DB_SCHEMA_UNSUPPORTED_STATE`，说明旧数据库卷已不受此版本支持；请新建 `postgres_data` 卷或恢复与当前版本匹配的数据库快照

## 数据、端口与访问地址

- 默认暴露端口：`3000`、`8000`、`5432`、`6379`；`adminer` 仅在 `tools` profile 下通过 `8081` 暴露
- 运行数据保存在 Docker volumes：`postgres_data`、`backend_uploads`、`backend_runtime_data`、`scan_workspace`、`redis_data`
- `offline-up.sh` 不会删除这些 volumes；只有你手工执行 `docker compose down -v` 时才会删除它们
- 如执行 `docker compose down -v`，上述持久化数据会被一并删除
- 跨版本升级前必须先备份 `postgres_data` 与 `backend_uploads`；不要把 `down -v` 当成普通升级流程

默认访问地址：

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- OpenAPI: `http://localhost:8000/docs`
- `nexus-web`: `http://localhost:3000/nexus/`
- `nexus-itemDetail`: `http://localhost:3000/nexus-item-detail/`

验收时至少补做：

```bash
curl -fsS http://localhost:3000/api/v1/openapi.json >/dev/null
curl -fsS http://localhost:3000/nexus/ >/dev/null
curl -fsS http://localhost:3000/nexus-item-detail/ >/dev/null
curl -i "http://localhost:3000/api/v1/projects/?skip=0&limit=1&include_metrics=true"
curl -i "http://localhost:3000/api/v1/projects/dashboard-snapshot?top_n=10&range_days=14"
```

`/nexus/` 与 `/nexus-item-detail/` 返回 `200` 只说明入口 HTML 可访问，还要继续确认它们引用的 JS/CSS 静态资源也能正常返回。不要只看 `/` 或 `:8000/health`。
