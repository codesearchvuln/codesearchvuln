# VulHunter 使用说明

这是面向最终用户的 VulHunter image-only 运行包。该 release tree 只包含运行时 compose 文件、环境模板和静态 bundle，不附带 `backend` / `frontend` 源码，也不支持在 release tree 内本地重建这些镜像。

## 1. 启动前配置

首次启动前，先复制环境变量模板：

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

至少补齐以下配置：

- `LLM_API_KEY`
- `LLM_PROVIDER`
- `LLM_MODEL`

如需数据库、Redis、鉴权或其他业务配置，请继续编辑 `docker/env/backend/.env`。

## 2. 在线部署（默认）

```bash
docker compose up -d
```

默认会拉取 digest 固定的 `backend`、`frontend`、sandbox 和各类 runner 运行镜像；`db`、`redis` 以及两个 nexus 静态站点由当前 release tree 提供运行配置。

## 3. 离线部署（可选）

先下载与你机器架构匹配的离线镜像包 `vulhunter-images-<arch>.tar.zst`，放到 release 根目录或 `images/` 目录，然后执行：

```bash
cp docker/env/backend/offline-images.env.example docker/env/backend/offline-images.env
./scripts/load-images.sh
./scripts/use-offline-env.sh docker compose up -d
```

离线模式会切换到本地 `vulhunter-local/*` 镜像标签，不再依赖在线拉取运行镜像。

## 4. 运行与维护

查看日志：

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

更新 `.env` 或 `offline-images.env` 后，再执行 `docker compose up -d` 使变更生效。

## 5. 发布合同说明

- 正式 release tree 只支持 `docker-compose.yml` 这一份 compose 入口
- `backend` / `frontend` / runner 镜像由发布流程预构建并固定到 digest
- `nexus-web` 与 `nexus-itemDetail` 仅从随包附带的静态产物组装本地 nginx 容器
- 本地 build overlay、Dockerfile 和源码分发包不属于此 release contract

## 6. 访问入口

- 前端：`http://localhost:3000`
- 后端 API：`http://localhost:8000`
- OpenAPI 文档：`http://localhost:8000/docs`
- `nexus-web`：`http://localhost:5174`
- `nexus-itemDetail`：`http://localhost:5175`

更多 compose 使用说明见 [`scripts/README-COMPOSE.md`](scripts/README-COMPOSE.md)。
