# VulHunter 部署指南

本目录是 VulHunter 的 generated release tree 运行包，不是源码仓库运行目录。请只在当前 release 根目录执行下面的命令；不要把源码仓库里的 local-build、hybrid overlay、`use-offline-env` 一类命令直接套到这里。

当前 release branch 只表示“最新一份 generated release tree 下载通道”，不是历史 snapshot 列表。若你要离线部署某个 snapshot，请确保当前 release tree 与两份离线 tar 包来自同一个 snapshot。

当前默认 release backend 镜像固定来自 Docker `runtime-plain` target。离线部署不依赖 `runtime-release` 或其他选择性源码加固 target；`runtime-cython` 仅作为额外可选的 hardened 变体存在。

这是一次数据库兼容策略收紧的 breaking change：旧 `postgres_data` 不再保证可被新版本直接启动或自动前滚。升级前请备份旧数据库卷与 `backend_uploads`，新版本默认只接受空库初始化或与当前版本匹配的数据库快照。

`online-up.sh` 与 `offline-up.sh` 现在执行的是“刷新当前 release stack”，不是“仅启动一次”。默认固定 Compose project name 为 `VULHUNTER_RELEASE_PROJECT_NAME=vulhunter-release`；脚本只处理这个 release stack 的资源，并且会在在线拉取或离线 bundle 预校验完成后，停止并删除当前 release stack 的容器与对应镜像，但绝不会删除任何 Docker volume。

## 1. 部署前准备

- 宿主机支持：`Ubuntu 22.04 LTS`、`Ubuntu 24.04 LTS`、`Windows 10 WSL2 + Ubuntu 22.04 LTS`、`Windows 11 WSL2 + Ubuntu 22.04 LTS`
- 离线部署需要：`docker`、`zstd`
- `Bash/WSL` 路径额外需要：`python3`
- 浏览器建议：`Safari`、`Chrome`、`Edge`

## 2. 配置

先创建运行配置：

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

至少确认以下配置：

- `LLM_API_KEY`
- `LLM_PROVIDER`
- `LLM_MODEL`

如果你直接执行离线脚本而 `.env` 不存在，脚本会自动复制一份模板；但你仍然需要确认以上三个字段。

如果你使用 cloud 模型接口，部署完成后仍然需要网络访问对应 API。离线部署只负责让运行镜像走本地，不会让云端模型变成本地模型。

## 3. 在线部署

刷新当前 release stack：

```bash
bash ./scripts/online-up.sh
```

这里刷新的默认 backend 也是 `runtime-plain` 产物，不会再依赖 release 专用 `.so`/选择性 Cython 组装链。脚本会先拉取当前 release 所需镜像，再清理当前 `VULHUNTER_RELEASE_PROJECT_NAME=vulhunter-release` release stack 的容器与镜像，然后重新启动；本地 `3000` 端口真正可访问后才会输出中英双语提示。在线重跑会重新拉取镜像，但不会删除 volumes。

如需走低阶命令，也可以直接执行：

```bash
docker compose up -d
```

但这种方式只是低阶 `docker compose up -d`：不会执行 refresh 前的拉取与清理，也不保证出现统一的终端 ready 提示。

查看状态：

```bash
docker compose ps
```

`http://localhost:3000/` 只代表前端静态首页可访问，不代表 dashboard API 代理和 `nexus-*` 静态 bundle 已经可用。上线验收仍然必须检查同源 `/api/v1/...`、`/nexus/`、`/nexus-item-detail/` 以及它们引用的静态资源。
若首页无法打开，也可能是 backend 因数据库契约不兼容而拒绝启动，进而阻塞 frontend 的 `depends_on backend: service_healthy`。

## 4. 离线部署

先准备两份与你当前 Docker server 架构匹配、且与当前 release tree 来自同一个 snapshot 的离线镜像包，并放到 release 根目录或 `images/`。用户侧仍然只需要这两份 tar 包：

- `vulhunter-services-images-<arch>.tar.zst`
- `vulhunter-scanner-images-<arch>.tar.zst`

### Bash / WSL

在 `WSL` 或 Linux `Bash` 中运行：

```bash
bash ./scripts/offline-up.sh
```

如需直接附着启动日志：

```bash
bash ./scripts/offline-up.sh --attach-logs
```

当前离线路径只支持 `WSL` 或 Linux `Bash`。不再提供 `Windows PowerShell` 兼容层。

离线脚本会自动：

- 自动复制缺失的 `docker/env/backend/.env`
- 自动复制缺失的 `docker/env/backend/offline-images.env`
- 读取 release tree 内置的 `release-snapshot-lock.json`
- 在清理当前 release stack 之前，先校验 `services` / `scanner` 两份 tar 包的文件名与 SHA256，确认它们和当前 release tree 属于同一个 snapshot
- 导入 `services` 与 `scanner` 两份离线镜像包
- 只停止并删除当前 `VULHUNTER_RELEASE_PROJECT_NAME=vulhunter-release` release stack 的容器与对应镜像，不会删除 volumes，也不会清理其他 Compose project
- 分阶段重新执行 `docker compose up -d` 恢复 release stack
- 等待 backend 容器 healthcheck 通过，再从宿主机检查 frontend `/`、proxied `http://127.0.0.1/api/v1/openapi.json`、proxied `http://127.0.0.1/api/v1/projects/?skip=0&limit=1&include_metrics=true`、proxied `http://127.0.0.1/api/v1/projects/dashboard-snapshot?top_n=10&range_days=14`、`http://127.0.0.1/nexus/`、`http://127.0.0.1/nexus-item-detail/`，以及这两个入口实际引用的首个 JS/CSS 静态资源全部通过后才报告 ready
- 前端探针不再依赖 frontend 镜像内置 `sh` / `wget`
- 默认模式不附着日志；传 `--attach-logs` 后，会在 backend 健康后切到前台 `docker compose up`

如果启动日志出现 `DB_SCHEMA_EMPTY`、`DB_SCHEMA_MISMATCH` 或 `DB_SCHEMA_UNSUPPORTED_STATE`，不要继续尝试原地修旧库。请新建 `postgres_data` 卷重新初始化，或恢复与当前版本匹配的数据库快照。

如果你需要手工检查离线镜像映射，查看：

- `docker/env/backend/offline-images.env`

修改 `.env` 或 `offline-images.env` 后，继续重跑同一个离线命令。离线重跑前，两份 tar bundle 也必须仍然保留在 release 根目录或 `images/`。

## 5. 部署后访问

- 前端：`http://localhost:3000`
- 后端 API：`http://localhost:8000`
- OpenAPI 文档：`http://localhost:8000/docs`
- `nexus-web`：`http://localhost:${VULHUNTER_FRONTEND_PORT:-3000}/nexus/`
- `nexus-itemDetail`：`http://localhost:${VULHUNTER_FRONTEND_PORT:-3000}/nexus-item-detail/`

主站静态文件和 `nexus-*` 静态页面都已随 release 包附带，并由前端服务直接提供。

## 6. 部署后验收

至少执行下面四步，不要只看首页是否打开：

```bash
docker compose ps
docker compose logs db redis scan-workspace-init db-bootstrap backend frontend --tail=100
curl -fsS http://localhost:3000/api/v1/openapi.json >/dev/null
curl -fsS http://localhost:3000/nexus/ >/dev/null
curl -fsS http://localhost:3000/nexus-item-detail/ >/dev/null
curl -i "http://localhost:3000/api/v1/projects/?skip=0&limit=1&include_metrics=true"
curl -i "http://localhost:3000/api/v1/projects/dashboard-snapshot?top_n=10&range_days=14"
```

项目列表探针或 dashboard 探针返回 `200` / `401` / `403` 都说明代理链路仍在工作；`/nexus/` 与 `/nexus-item-detail/` 返回 `200` 只说明入口 HTML 可访问，还要继续检查它们实际引用的 JS/CSS 是否能正常返回。如果是 `502` / `503` / `504`，说明前端到 backend 的 release 代理链路仍然异常。

## 7. 常用维护命令

查看日志：

```bash
docker compose logs -f
```

停止服务：

```bash
docker compose down
```

删除服务和数据卷：

```bash
docker compose down -v
```

`docker compose down -v` 会删除持久化数据，请仅在明确需要清理数据时使用。
如需跨版本升级，请优先备份 `postgres_data` 与 `backend_uploads`，不要把 `down -v` 当成普通升级步骤。
日常 refresh / upgrade 请重跑 `bash ./scripts/online-up.sh` 或 `bash ./scripts/offline-up.sh`；单独执行 `docker compose up -d` / `down` 只是低阶 Compose 操作，不会执行 release refresh 合同里的预拉取或预校验、容器与镜像清理步骤。

更多 Docker Compose 命令见 [`scripts/README-COMPOSE.md`](scripts/README-COMPOSE.md)。
