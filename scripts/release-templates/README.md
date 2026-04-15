# VulHunter 部署指南

本目录是 VulHunter 的 release 运行包。请在 release 根目录执行下面的命令。

## 1. 部署前准备

- 宿主机支持：`Ubuntu 22.04 LTS`、`Ubuntu 24.04 LTS`、`Windows 10`、`Windows 11`、`Windows 10 WSL2 + Ubuntu 22.04 LTS`、`Windows 11 WSL2 + Ubuntu 22.04 LTS`
- `Windows 10/11` 需要使用 `Docker Desktop` 并启用 Linux containers
- 离线部署需要：`docker`、`zstd`
- `Bash/WSL` 路径额外需要：`python3`
- 浏览器建议：`Safari`、`Chrome`、`Edge`

Choose exactly one shell path。

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

## 4. 离线部署

先准备两份与你当前 Docker server 架构匹配的离线镜像包，并放到 release 根目录或 `images/`：

- `vulhunter-services-images-<arch>.tar.zst`
- `vulhunter-scanner-images-<arch>.tar.zst`

### Bash / WSL

在 `WSL` 或 Linux `Bash` 中运行：

```bash
bash ./scripts/offline-up.sh
```

### Windows PowerShell

在原生 `Windows PowerShell` 中运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\offline-up.ps1
```

不要混用 Bash 和 PowerShell 命令。不要手工修改脚本执行位。不要手工放宽 Docker Socket 权限。

离线脚本会自动：

- 自动复制缺失的 `docker/env/backend/.env`
- 自动复制缺失的 `docker/env/backend/offline-images.env`
- 导入 `services` 与 `scanner` 两份离线镜像包
- 启动 `docker compose up -d`

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

## 6. 常用维护命令

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
