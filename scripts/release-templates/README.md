# VulHunter Release

该分支是由 `main` 自动生成的最新运行时分发快照（runtime-only distribution）。
release 不包含 backend 源码和 frontend 源码，也不支持源码级构建。
唯一受支持的启动方式是：

```bash
docker compose up
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

## 运行方式说明

- `backend`、`frontend`、runner、sandbox 都使用已打包并固定到 digest 的镜像引用。
- `nexus-web` 与 `nexus-itemDetail` 因静态产物随 release 一起分发，仍在本地构建极简 Nginx 镜像。
- 如需替换默认镜像，可通过 `BACKEND_IMAGE`、`FRONTEND_IMAGE`、`SANDBOX_IMAGE` 以及对应的 `SCANNER_*_IMAGE` / `FLOW_PARSER_RUNNER_IMAGE` / `SANDBOX_RUNNER_IMAGE` 环境变量覆盖。

## Nexus 静态产物说明

- release 快照保留 `nexus-web/dist/**`、`nexus-web/nginx.conf`、`nexus-itemDetail/dist/**`、`nexus-itemDetail/nginx.conf`
- runtime-only release 不恢复旧的 release artifact / deploy 脚本体系
- `nexus-web` 默认监听 `http://localhost:5174`
- `nexus-itemDetail` 默认监听 `http://localhost:5175`

## 访问地址

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- OpenAPI: `http://localhost:8000/docs`

更多启动细节见 [`scripts/README-COMPOSE.md`](scripts/README-COMPOSE.md)。
