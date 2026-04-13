# VulHunter Release

该分支是由 `main` 自动生成的最新 slim-source 发布快照，只支持以下两种启动方式：

```bash
docker compose up
```

```bash
docker compose -f docker-compose.yml -f docker-compose.hybrid.yml up --build
```

## 启动前准备

首次启动前先准备 backend Docker 环境文件：

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

至少配置以下变量：

- `LLM_API_KEY`
- `LLM_PROVIDER`
- `LLM_MODEL`

## 两种启动方式的区别

- `docker compose up`：`backend`、runner、sandbox 继续使用云端镜像；主 `frontend` 与 `nexus-web`、`nexus-itemDetail` 直接消费 release 自带的本地静态产物，不再构建或暴露 frontend 源码。
- `docker compose -f docker-compose.yml -f docker-compose.hybrid.yml up --build`：在默认链路基础上，仅把 `backend` 切到本地构建；主 `frontend` 仍使用同一套本地 `dist` 挂载，`nexus-web` 与 `nexus-itemDetail` 仍沿用基础 compose 的本地构建例外。

## 静态产物说明

- release 快照保留 `frontend/dist/**`、`frontend/nginx.conf`
- release 快照保留 `nexus-web/dist/**`、`nexus-web/nginx.conf`、`nexus-itemDetail/dist/**`、`nexus-itemDetail/nginx.conf`
- release 快照不再公开 frontend 源码，只保留部署所需的 bundled runtime assets
- slim release 不恢复旧的 release artifact / deploy 脚本体系
- 主 `frontend` 默认监听 `http://localhost:3000`
- `nexus-web` 默认监听 `http://localhost:5174`
- `nexus-itemDetail` 默认监听 `http://localhost:5175`

## 访问地址

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- OpenAPI: `http://localhost:8000/docs`

更多启动细节见 [`scripts/README-COMPOSE.md`](scripts/README-COMPOSE.md)。
