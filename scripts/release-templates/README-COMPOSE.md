# Docker Compose 运维说明

本文档介绍当前安装目录中 `docker-compose.yml` 的常见使用方式，以及 VulHunter 在线运行、离线运行和日常维护时需要关注的配置项。

## 在线启动

```bash
cp docker/env/backend/env.example docker/env/backend/.env
docker compose up -d
```

在线模式下：

- `backend`、scanner runner 和 `sandbox-runner` 使用发布流程预构建的 digest 固定镜像
- 主前端使用 `STATIC_FRONTEND_IMAGE` 提供的 nginx 基底镜像，并挂载当前目录中的 `deploy/runtime/frontend/site` 与 `deploy/runtime/frontend/nginx/default.conf`
- `db`、`redis` 由当前 compose 直接拉起
- `nexus-web` 与 `nexus-itemDetail` 仅从当前目录内的静态 bundle 组装本地 nginx 容器

## 离线启动

```bash
cp docker/env/backend/offline-images.env.example docker/env/backend/offline-images.env
./scripts/load-images.sh
./scripts/use-offline-env.sh docker compose up -d
```

离线镜像包文件名为：

- `vulhunter-services-images-<arch>.tar.zst`
- `vulhunter-scanner-images-<arch>.tar.zst`

请把这两份文件都放在 release 根目录或 `images/` 目录。前端与 `nexus-*` 继续走当前目录内的静态资源加载路径，不包含在离线镜像包内。

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

## 默认访问地址

- 前端：`http://localhost:3000`
- 后端：`http://localhost:8000`
- OpenAPI：`http://localhost:8000/docs`
- `nexus-web`：`http://localhost:5174`
- `nexus-itemDetail`：`http://localhost:5175`

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
