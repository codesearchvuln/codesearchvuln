# Docker Compose 命令说明

本文档只说明 release 包里的常用 Compose 命令。

支持宿主机：`Ubuntu 22.04 LTS`、`Ubuntu 24.04 LTS`、`Windows 10/11`、`Windows 10 WSL2 + Ubuntu 22.04 LTS`、`Windows 11 WSL2 + Ubuntu 22.04 LTS`。

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

## 2. 在线启动

```bash
docker compose up -d
```

## 3. 离线启动

先把下面两份离线镜像包放到 release 根目录或 `images/`：

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

离线脚本会自动复制缺失的 `.env` / `offline-images.env`，导入离线镜像包，然后启动服务。

如果你使用 cloud 模型接口，运行时仍然需要访问对应 API。离线部署只表示运行镜像来自本地。

## 4. 查看状态

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

## 6. 修改配置后重启

- 在线路径：修改 `.env` 后重新执行 `docker compose up -d`
- 离线路径：修改 `.env` 或 `offline-images.env` 后，重新执行同一个 `offline-up` 命令
