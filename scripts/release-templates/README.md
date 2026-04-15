# VulHunter 部署指南

本目录是 VulHunter 的 generated release tree 运行包，不是源码仓库运行目录。请只在当前 release 根目录执行下面的命令；不要把源码仓库里的 local-build、hybrid overlay、`use-offline-env` 一类命令直接套到这里。

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

启动：

```bash
docker compose up -d
```

查看状态：

```bash
docker compose ps
```

`http://localhost:3000/` 只代表前端静态首页可访问，不代表 dashboard API 代理已经可用。上线验收仍然必须检查同源 `/api/v1/...`。

## 4. 离线部署

先准备两份与你当前 Docker server 架构匹配的离线镜像包，并放到 release 根目录或 `images/`：

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
- 导入 `services` 与 `scanner` 两份离线镜像包
- 启动 `docker compose up -d`
- 等待 backend `/health`、frontend `/`、以及 proxied `http://127.0.0.1/api/v1/openapi.json` 全部成功后才报告 ready
- 默认模式不附着日志；传 `--attach-logs` 后，会在 backend 健康后切到前台 `docker compose up`

如果你需要手工检查离线镜像映射，查看：

- `docker/env/backend/offline-images.env`

修改 `.env` 或 `offline-images.env` 后，继续重跑同一个离线命令。

## 5. 部署后访问

- 前端：`http://localhost:3000`
- 后端 API：`http://localhost:8000`
- OpenAPI 文档：`http://localhost:8000/docs`
- `nexus-web`：`http://localhost:${VULHUNTER_FRONTEND_PORT:-3000}/nexus/`
- `nexus-itemDetail`：`http://localhost:${VULHUNTER_FRONTEND_PORT:-3000}/nexus-item-detail/`

主站静态文件和 `nexus-*` 静态页面都已随 release 包附带，并由前端服务直接提供。

## 6. 部署后验收

至少执行下面三步，不要只看首页是否打开：

```bash
docker compose ps
docker compose logs backend frontend --tail=100
curl -fsS http://localhost:3000/api/v1/openapi.json >/dev/null
```

可选再补一条 dashboard 代理链路检查：

```bash
curl -i "http://localhost:3000/api/v1/projects/dashboard-snapshot?top_n=10&range_days=14"
```

这条 dashboard 探针返回 `200` / `401` / `403` 都说明代理链路仍在工作；如果是 `502` / `503` / `504`，说明前端到 backend 的 release 代理链路仍然异常。

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

更多 Docker Compose 命令见 [`scripts/README-COMPOSE.md`](scripts/README-COMPOSE.md)。
