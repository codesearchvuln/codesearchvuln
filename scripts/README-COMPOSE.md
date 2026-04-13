# Release Compose Guide

正式 release tree 只暴露一份运行时 compose 合同：`docker-compose.yml`。它不会附带本地 build overlay、Dockerfile，也不支持在 release tree 内本地重建 `backend` / `frontend`。

## 环境引导

先复制后端环境模板：

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

至少配置：
`LLM_API_KEY`、`LLM_PROVIDER`、`LLM_MODEL`

## 命令说明

### `docker compose up -d`

- 默认使用已发布且 digest 固定的 `backend`、`frontend`、runner 和 sandbox 镜像
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
- 离线模式不会改变 compose 结构，只改变镜像来源

## 访问地址

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- OpenAPI: `http://localhost:8000/docs`
- `nexus-web`: `http://localhost:5174`
- `nexus-itemDetail`: `http://localhost:5175`
