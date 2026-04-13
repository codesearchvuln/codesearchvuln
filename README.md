# VulHunter Release Contract

<p align="center">
  <strong>简体中文</strong> | <a href="README_EN.md">English</a>
</p>

正式 release 采用 image-only runtime tree。生成后的 release tree 只保留运行时 compose 文件、环境模板和静态 bundle，不附带 `backend` / `frontend` 源码，也不提供本地 build overlay。

## 启动前准备

1. 复制后端环境文件：

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

2. 至少填写这些配置：
   `LLM_API_KEY`、`LLM_PROVIDER`、`LLM_MODEL`

3. 确保本机已安装 Docker Compose，并且 Docker daemon 可访问。

## 受支持的启动方式

### 1. 在线部署（默认）

```bash
docker compose up -d
```

用途：
直接使用已发布且 digest 固定的 `backend`、`frontend`、runner 和 sandbox 镜像启动核心栈。

### 2. 离线部署（可选）

```bash
cp docker/env/backend/offline-images.env.example docker/env/backend/offline-images.env
./scripts/load-images.sh
./scripts/use-offline-env.sh docker compose up -d
```

用途：
预先加载离线镜像包后，改用本地 `vulhunter-local/*` 标签启动同一套运行栈。

## 明确不属于 release contract 的路径

- 在 release tree 内重新构建 `backend` / `frontend` 镜像
- 依赖源码分发包或本地 build overlay 的发布方式
- 任何要求 release tree 携带后端、前端源码的交付模型

## 访问地址

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- OpenAPI: `http://localhost:8000/docs`
- `nexus-web`: `http://localhost:5174`
- `nexus-itemDetail`: `http://localhost:5175`

补充说明见 [`scripts/README-COMPOSE.md`](scripts/README-COMPOSE.md)。
