# VulHunter Release 部署指南

本目录只描述 release 运行包的部署方式。所有操作都以当前目录下的 `docker-compose.yml` 和 `scripts/offline-up.sh` 为准，不要把源码仓库里的 `docker-compose.full.yml`、`docker-compose.hybrid.yml` 或本地构建命令套用到这里。
generated release tree 现在只支持离线部署，不支持在线部署；固定 Compose project name 为 `VULHUNTER_RELEASE_PROJECT_NAME=vulhunter-release`。

## 部署准备

1. 复制运行时环境文件：

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

2. 至少确认以下变量：
   `LLM_API_KEY`、`LLM_PROVIDER`、`LLM_MODEL`

3. 如果要走离线部署，再复制离线镜像映射模板：

```bash
cp docker/env/backend/offline-images.env.example docker/env/backend/offline-images.env
```

如果缺少 `.env` 或 `offline-images.env`，离线脚本会按模板自动补齐，但正式部署前仍应手动检查上述配置。
如果你使用 cloud 模型接口，运行时仍然需要访问对应 API；离线部署只负责让运行镜像走本地。

## 支持环境

- 宿主机：`Ubuntu 22.04 LTS`、`Ubuntu 24.04 LTS`、`Windows 10 WSL2 + Ubuntu 22.04 LTS`、`Windows 11 WSL2 + Ubuntu 22.04 LTS`
- 必需组件：`docker`、`docker compose`
- 离线部署额外需要：`zstd`、`python3`
- 离线镜像包文件名固定为 `vulhunter-services-images-<arch>.tar.zst` 和 `vulhunter-scanner-images-<arch>.tar.zst`
- 两份离线镜像包必须与当前 release tree 使用同一个 snapshot，并放在 release 根目录或 `images/`

## 部署命令

### 离线部署

```bash
bash ./scripts/offline-up.sh
```

如需在终端持续查看启动日志：

```bash
bash ./scripts/offline-up.sh --attach-logs
```

离线入口会先校验 bundle 文件名和 SHA256，再导入本地镜像并刷新同一套 release stack。

## 常用维护指令

```bash
docker compose ps
docker compose logs -f
bash ./scripts/offline-up.sh
docker compose down
docker compose down -v
```

`docker compose down -v` 会删除持久化 volumes，只应在明确需要清空数据时使用。日常 refresh 或升级请优先重跑 `offline-up.sh`，不要只把 `docker compose down` / `down -v` 当成完整的发布维护流程。
