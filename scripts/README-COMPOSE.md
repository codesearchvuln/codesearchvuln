# Release Compose Guide

这里说明的是 generated release tree 的运行时 compose 合同。若你是在源码仓库根目录直接执行 `docker compose up`，那是另一份 compose 合同：主 frontend 仍使用 `FRONTEND_IMAGE`，默认指向 `vulhunter-frontend`，并可继续叠加 `docker-compose.hybrid.yml`。当前文档不覆盖那条路径。

generated release tree 只暴露一份运行时 compose 合同：`docker-compose.yml`。它不会附带本地 build overlay、Dockerfile，也不支持在 release tree 内本地重建 `backend` / `frontend`。

## 环境引导

先复制后端环境模板：

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

至少配置：
`LLM_API_KEY`、`LLM_PROVIDER`、`LLM_MODEL`

## 命令说明

### `docker compose up -d`

- 默认使用已发布且 digest 固定的 `backend`、scanner runner 和 `sandbox-runner` 镜像
- 主 frontend 不是 `vulhunter-frontend` 运行镜像，而是 `STATIC_FRONTEND_IMAGE` 提供的 nginx 基底镜像，加上 `./deploy/runtime/frontend/site` 与 `./deploy/runtime/frontend/nginx/default.conf` 挂载内容
- `db` 与 `redis` 仍由当前 compose 文件拉起
- `nexus-web` 与 `nexus-itemDetail` 仅从随包附带的静态产物组装本地 nginx 容器

### 离线模式

```bash
cp docker/env/backend/offline-images.env.example docker/env/backend/offline-images.env
./scripts/load-images.sh
./scripts/use-offline-env.sh docker compose up -d
```

- `load-images.sh` 会加载 `vulhunter-images-<arch>.tar.zst`
- `use-offline-env.sh` 会切换到本地 `vulhunter-local/*` 镜像标签
- 离线模式不会改变 compose 结构，只改变镜像来源；代码执行统一走本地 `sandbox-runner` 标签，主 frontend 仍按 `STATIC_FRONTEND_IMAGE + deploy/runtime/frontend/*` 运行，不会切回 `FRONTEND_IMAGE`

## 访问地址

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- OpenAPI: `http://localhost:8000/docs`
- `nexus-web`: `http://localhost:5174`
- `nexus-itemDetail`: `http://localhost:5175`
