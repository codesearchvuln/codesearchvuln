# Docker Compose 运维说明

本文档只覆盖 generated release tree 中的 `docker-compose.yml` 运行合同，不覆盖源码仓库里的本地构建 overlay。

## 支持边界

- 当前 release tree 是 image-only 运行包
- 不附带 `backend` / `frontend` 源码
- 不支持在当前目录内本地重建前后端
- 支持宿主机：`Ubuntu 22.04 LTS`、`Ubuntu 24.04 LTS`、`Windows 10`、`Windows 11`、`Windows 10 WSL2 + Ubuntu 22.04 LTS`、`Windows 11 WSL2 + Ubuntu 22.04 LTS`
- `Windows 10/11` 宿主机需要使用 `Docker Desktop` 并启用 Linux containers
- 离线路径依赖：`docker`、`zstd`，`Bash/WSL` 额外依赖 `python3`

Choose exactly one shell path。

## 在线启动

```bash
cp docker/env/backend/env.example docker/env/backend/.env
docker compose up -d
```

`docker/env/backend/.env` 至少需要确认：

- `LLM_API_KEY`
- `LLM_PROVIDER`
- `LLM_MODEL`

## 离线启动

先准备两份离线镜像包，并放到 release 根目录或 `images/`：

- `vulhunter-services-images-<arch>.tar.zst`
- `vulhunter-scanner-images-<arch>.tar.zst`

### Bash / WSL

```bash
bash ./scripts/offline-up.sh
```

### Windows PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\offline-up.ps1
```

不要混用 Bash 和 PowerShell。不要手工修改脚本执行位。不要手工放宽 `/var/run/docker.sock` 权限。不要把首次离线启动写成 `docker compose down` 后再 `up`。

离线单入口会自动：

- 自动复制缺失的 `docker/env/backend/.env`
- 自动复制缺失的 `docker/env/backend/offline-images.env`
- 校验 manifest 与离线包
- 导入两份离线镜像包
- 切换到 `vulhunter-local/*` 标签
- 启动 `docker compose up -d`

修改 `.env` 或 `offline-images.env` 后，仍然重跑同一个 `offline-up` 命令，而不是回到旧的手工多步流程。

## Offline Means / Does Not Mean

- Offline means：运行镜像会预先导入并切换到本地标签
- Offline does not mean：云端 LLM / API 自动变成本地
- 前端 static assets 与 `nexus-*` 页面已经随 release tree 附带
- 离线路径不会通过 `offline-images.env` 覆盖前端运行镜像变量

## 查看状态与维护

默认访问地址：

- 前端：`http://localhost:3000/`
- `nexus-web`：`http://localhost:3000/nexus/`
- `nexus-itemDetail`：`http://localhost:3000/nexus-item-detail/`

查看状态：

```bash
docker compose ps
```

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

`docker compose down -v` 会删除 `postgres_data`、`backend_uploads`、`backend_runtime_data`、`scan_workspace`、`redis_data` 等持久化数据，只应在明确需要清理数据时使用。

## 常用配置文件

- `docker/env/backend/.env`
  保存业务配置、密钥、数据库和 Redis 参数，以及镜像覆盖项
- `docker/env/backend/offline-images.env`
  保存离线启动时使用的本地镜像标签

常见镜像覆盖项：

- `BACKEND_IMAGE`
- `POSTGRES_IMAGE`
- `REDIS_IMAGE`
- `ADMINER_IMAGE`
- `SCAN_WORKSPACE_INIT_IMAGE`
- `STATIC_FRONTEND_IMAGE`
- `SCANNER_*_IMAGE`
- `FLOW_PARSER_RUNNER_IMAGE`
- `SANDBOX_RUNNER_IMAGE`

其中 `STATIC_FRONTEND_IMAGE` 只负责承载当前 release tree 自带的静态文件。
