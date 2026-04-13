# VulHunter 使用说明

这是面向最终用户的 VulHunter 运行包，支持在线部署和离线部署两种方式。

## 1. 在线部署（默认）

```bash
cp docker/env/backend/env.example docker/env/backend/.env
docker compose up -d
```

## 2. 离线部署（可选）

先下载与你机器架构匹配的离线镜像包 `vulhunter-images-<arch>.tar.zst`，放到 release 根目录或 `images/` 目录，然后执行：

```bash
cp docker/env/backend/offline-images.env.example docker/env/backend/offline-images.env
./scripts/load-images.sh
./scripts/use-offline-env.sh docker compose up -d
```

离线模式会使用本地 `vulhunter-local/*` 镜像标签，不再依赖在线拉取运行镜像。

## 3. 启动前配置

首次启动前，先复制环境变量模板：

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

至少补齐以下配置：

- `LLM_API_KEY`
- `LLM_PROVIDER`
- `LLM_MODEL`

如需数据库、Redis、鉴权或其他业务配置，请继续编辑 `docker/env/backend/.env`。

## 4. 启动服务

后台启动：

```bash
docker compose up -d
```

前台查看日志：

```bash
docker compose logs -f
```

停止服务：

```bash
docker compose down
```

如需连同数据库卷一起清理：

```bash
docker compose down -v
```

## 5. 访问入口

- 前端：`http://localhost:3000`
- 后端 API：`http://localhost:8000`
- OpenAPI 文档：`http://localhost:8000/docs`
- `nexus-web`：`http://localhost:5174`
- `nexus-itemDetail`：`http://localhost:5175`

## 6. 常用调整

- 如果端口冲突，直接修改 `docker-compose.yml` 中对应服务的 `ports`
- 如果需要替换默认运行镜像，可在 `.env` 中设置 `BACKEND_IMAGE`、`FRONTEND_IMAGE`、`SANDBOX_IMAGE`、`SCANNER_*_IMAGE`、`FLOW_PARSER_RUNNER_IMAGE`、`SANDBOX_RUNNER_IMAGE`
- 如果使用离线部署，修改 `docker/env/backend/offline-images.env` 后重新执行 `./scripts/use-offline-env.sh docker compose up -d`
- 更新配置后执行 `docker compose up -d` 使变更生效

更多 compose 使用说明见 [`scripts/README-COMPOSE.md`](scripts/README-COMPOSE.md)。
