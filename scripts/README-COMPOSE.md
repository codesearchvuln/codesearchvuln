# Docker Compose 命令说明

本文档只说明 generated release tree 里的 Compose 命令，不覆盖源码仓库根目录的 `docker compose up` / `docker-compose.hybrid.yml` 合同。

release branch 只提供最新一份 generated release tree 的下载通道，不是历史 snapshot 列表。离线部署时，请保证 release tree 与两份离线 tar 包来自同一个 snapshot。

当前默认 release backend 镜像固定来自 Docker `runtime-plain` target。离线部署与 release tree 验收都不依赖 `runtime-release` 或其他选择性源码加固 target；如需额外发布 `runtime-cython`，它仅作为可选 hardened 变体存在。
generated release tree 现在只支持离线部署，不支持在线部署，也不再提供 `online-up.sh`。

这是一次数据库兼容策略收紧的 breaking change：旧 `postgres_data` 不再保证能被新版本直接启动或自动前滚。升级前请备份旧数据库卷与 `backend_uploads`；新版本默认只接受空库 bootstrap 或与当前版本匹配的数据库快照。

release refresh 脚本默认固定 Compose project name 为 `VULHUNTER_RELEASE_PROJECT_NAME=vulhunter-release`。它们只清理当前 release stack 的容器与对应镜像，不会删除任何 Docker volume，也不会影响其他 Compose project。

支持宿主机：`Ubuntu 22.04 LTS`、`Ubuntu 24.04 LTS`、`Windows 10 WSL2 + Ubuntu 22.04 LTS`、`Windows 11 WSL2 + Ubuntu 22.04 LTS`。

## 1. 启动前

先准备配置文件：

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

至少确认：

- `LLM_API_KEY`
- `LLM_PROVIDER`
- `LLM_MODEL`

Choose exactly one shell path。

## 2. 离线启动

先把下面两份与你当前 release tree 属于同一个 snapshot、且匹配当前 Docker server 架构的离线镜像包放到 release 根目录或 `images/`。用户侧仍然只需要这两份 tar 包：

- `vulhunter-services-images-<arch>.tar.zst`
- `vulhunter-scanner-images-<arch>.tar.zst`

### Bash / WSL

```bash
bash ./scripts/offline-up.sh
```

如需前台附着启动日志：

```bash
bash ./scripts/offline-up.sh --attach-logs
```

离线脚本会自动复制缺失的 `.env` / `offline-images.env`，并先依据 release tree 自带的 `release-snapshot-lock.json` 校验两份 tar 包的文件名与 SHA256；只有确认 bundle 与当前 snapshot 匹配后，才会导入离线镜像包，再停止并删除当前 `VULHUNTER_RELEASE_PROJECT_NAME=vulhunter-release` release stack 的容器与对应镜像，然后分阶段恢复服务。
脚本会继续等待 backend 容器 healthcheck 通过，再从宿主机检查 frontend `/`、proxied `http://127.0.0.1/api/v1/openapi.json`、proxied `http://127.0.0.1/api/v1/projects/?skip=0&limit=1&include_metrics=true`、proxied `http://127.0.0.1/api/v1/projects/dashboard-snapshot?top_n=10&range_days=14`、`http://127.0.0.1/nexus/`、`http://127.0.0.1/nexus-item-detail/`，以及这两个入口实际引用的首个 JS/CSS 静态资源成功后才报告 ready。
前端探针不再依赖 frontend 镜像内置 `sh` / `wget`。
当前 release tree 不再提供 `Windows PowerShell` 兼容层。
默认模式不附着日志；传 `--attach-logs` 后，会在 backend 健康后切到前台 `docker compose up`。
离线重跑前，两份 tar bundle 必须仍然保留在 release 根目录或 `images/`。

如果日志出现 `DB_SCHEMA_EMPTY`、`DB_SCHEMA_MISMATCH` 或 `DB_SCHEMA_UNSUPPORTED_STATE`，不要继续原地修旧库。请新建 `postgres_data` 卷重新初始化，或恢复与当前版本匹配的数据库快照。

如果你使用 cloud 模型接口，运行时仍然需要访问对应 API。离线部署只表示运行镜像来自本地。

## 3. 查看状态

```bash
docker compose ps
```

```bash
docker compose logs -f
```

默认访问地址：

- 前端：`http://localhost:3000/`
- `nexus-web`：`http://localhost:3000/nexus/`
- `nexus-itemDetail`：`http://localhost:3000/nexus-item-detail/`

主站静态文件与 `nexus-*` 页面已经随 release tree 附带。

## 4. 验收代理链路

```bash
docker compose ps
docker compose logs db redis scan-workspace-init db-bootstrap backend frontend --tail=100
curl -fsS http://localhost:3000/api/v1/openapi.json >/dev/null
curl -fsS http://localhost:3000/nexus/ >/dev/null
curl -fsS http://localhost:3000/nexus-item-detail/ >/dev/null
curl -i "http://localhost:3000/api/v1/projects/?skip=0&limit=1&include_metrics=true"
curl -i "http://localhost:3000/api/v1/projects/dashboard-snapshot?top_n=10&range_days=14"
```

项目列表或 `dashboard-snapshot` 返回 `200` / `401` / `403` 都说明代理链路正常；`/nexus/` 与 `/nexus-item-detail/` 返回 `200` 只说明入口 HTML 可访问，还要继续确认它们引用的 JS/CSS 可以正常返回；`502` / `503` / `504` 说明 release frontend 到 backend 的代理链路仍异常。

## 5. 停止与清理

停止服务：

```bash
docker compose down
```

删除服务和数据卷：

```bash
docker compose down -v
```

`docker compose down -v` 会删除持久化数据，请谨慎使用。
如需跨版本升级，请先整体备份 `postgres_data` 与 `backend_uploads`，不要把 `down -v` 当成常规升级步骤。

## 6. 修改配置后重启

- 离线路径：修改 `.env` 或 `offline-images.env` 后，重新执行同一个 `offline-up` 命令；离线重跑前确认两份 tar bundle 仍在
