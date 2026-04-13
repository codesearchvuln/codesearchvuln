# Compose 使用说明

这个 release tree 只暴露一份运行时 compose 合同：`docker-compose.yml`。它不会附带本地 build overlay、Dockerfile 或可重新构建 `backend` / `frontend` 的源码。

## 在线启动

```bash
cp docker/env/backend/env.example docker/env/backend/.env
docker compose up -d
```

在线模式下：

- `backend`、`frontend`、sandbox 和 runner 使用发布流程预构建的 digest 固定镜像
- `db`、`redis` 由当前 compose 直接拉起
- `nexus-web` 与 `nexus-itemDetail` 仅从当前目录内的静态 bundle 组装本地 nginx 容器

## 离线启动

```bash
cp docker/env/backend/offline-images.env.example docker/env/backend/offline-images.env
./scripts/load-images.sh
./scripts/use-offline-env.sh docker compose up -d
```

离线镜像包文件名为 `vulhunter-images-<arch>.tar.zst`，请放在 release 根目录或 `images/` 目录。

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

## 主要配置项

请在 `docker/env/backend/.env` 中维护运行配置，至少包括：

- `LLM_API_KEY`
- `LLM_PROVIDER`
- `LLM_MODEL`

如果需要替换运行镜像，也可以在 `.env` 中设置：

- `BACKEND_IMAGE`
- `FRONTEND_IMAGE`
- `SANDBOX_IMAGE`
- `SCANNER_*_IMAGE`
- `FLOW_PARSER_RUNNER_IMAGE`
- `SANDBOX_RUNNER_IMAGE`

离线模式的镜像覆盖文件位于：

- `docker/env/backend/offline-images.env`

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
