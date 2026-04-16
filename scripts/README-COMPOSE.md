# Release Compose Guide

这里说明的是 generated release tree 的运行时 compose 合同。若你是在源码仓库根目录直接执行 `docker compose up`，那是另一份 compose 合同：主 frontend 仍使用 `FRONTEND_IMAGE`，默认指向 `vulhunter-frontend`，并可继续叠加 `docker-compose.hybrid.yml`。当前文档不覆盖那条路径。

release branch 只代表最新一份 generated release tree 的交付通道，不是历史 snapshot 索引。离线部署时，请保证你手里的 release tree 与两份离线 tar 包来自同一个 snapshot。

generated release tree 只暴露一份运行时 compose 合同：`docker-compose.yml`。它不会附带本地 build overlay、Dockerfile，也不支持在 release tree 内本地重建 `backend` / `frontend`。

当前默认 release backend 镜像固定来自 Docker `runtime-plain` target。离线部署与 release tree 验收都不依赖 `runtime-release` 或其他选择性源码加固 target；如需额外发布 `runtime-cython`，它仅作为可选 hardened 变体存在。

这是一次数据库兼容策略收紧的 breaking change：旧 `postgres_data` 不再保证能被新版本直接启动或自动前滚。升级前请备份旧数据库卷与 `backend_uploads`；新版本默认只接受空库 bootstrap 或与当前版本匹配的数据库快照。

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

### `docker compose up -d`

- 默认使用已发布且 digest 固定的运行镜像，包括 `backend`、`postgres`、`redis`、`scan-workspace-init`、scanner runners 与 `sandbox-runner`
- 默认 backend 运行镜像对应 `runtime-plain` target，不再依赖 release 专用选择性 Cython / `.so` 产物
- `db-bootstrap` 会在 backend 启动前显式执行数据库 bootstrap；backend 自身不再承担旧库自动升级职责
- 主 frontend 不是 `vulhunter-frontend` 运行镜像，而是 `STATIC_FRONTEND_IMAGE` 提供的 nginx 基底镜像，加上 `./deploy/runtime/frontend/site` 与 `./deploy/runtime/frontend/nginx/default.conf` 挂载内容
- `db` 与 `redis` 仍由当前 compose 文件拉起
- `nexus-web` 与 `nexus-itemDetail` 不再启动独立容器，而是作为本地静态页面挂载到主前端容器中
- release 合同下的 runner preflight 只会校验并拉取声明的运行镜像，不会回退到本地构建

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
- `offline-up.sh` 会先读取 release tree 自带的 `release-snapshot-lock.json`，在 `docker load` 之前校验两份 bundle 的文件名与 SHA256；通过后才会导入离线镜像包，加载 `offline-images.env`，切换到本地 `vulhunter-local/*` 镜像标签，然后等待 release stack 通过 readiness 检查
- 默认模式不显示附着日志；只有 `--attach-logs` 才会在 backend 健康后切到前台 `docker compose up`
- 离线模式不会改变 compose 结构，只改变镜像来源；代码执行统一走本地 `sandbox-runner` 标签，主 frontend 仍按 `STATIC_FRONTEND_IMAGE + deploy/runtime/frontend/*` 运行，不会切回 `FRONTEND_IMAGE`
- 如果日志出现 `DB_SCHEMA_EMPTY`、`DB_SCHEMA_MISMATCH` 或 `DB_SCHEMA_UNSUPPORTED_STATE`，说明旧数据库卷已不受此版本支持；请新建 `postgres_data` 卷或恢复与当前版本匹配的数据库快照

## 数据、端口与访问地址

- 默认暴露端口：`3000`、`8000`、`5432`、`6379`；`adminer` 仅在 `tools` profile 下通过 `8081` 暴露
- 运行数据保存在 Docker volumes：`postgres_data`、`backend_uploads`、`backend_runtime_data`、`scan_workspace`、`redis_data`
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
curl -i "http://localhost:3000/api/v1/projects/dashboard-snapshot?top_n=10&range_days=14"
```

不要只看 `/` 或 `:8000/health`。
