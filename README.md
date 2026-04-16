# VulHunter Release Contract

<p align="center">
  <strong>简体中文</strong> | <a href="README_EN.md">English</a>
</p>

当前仓库里需要区分两份 compose 合同：

- 源码仓库 compose 合同：直接在仓库根目录执行 `docker compose up` 时生效；主 frontend 服务仍使用 `FRONTEND_IMAGE`，默认指向 `vulhunter-frontend` 运行镜像，源码仓库内也可继续叠加 `docker-compose.hybrid.yml`
- generated release tree compose 合同：发布流程生成的运行包只保留运行时 `docker-compose.yml`、环境模板和静态 bundle，不附带 `backend` / `frontend` 源码，也不提供本地 build overlay；这里的主 frontend 仍是 `STATIC_FRONTEND_IMAGE` 加 `deploy/runtime/frontend/site` 与 `deploy/runtime/frontend/nginx/default.conf`，不是 `vulhunter-frontend` 运行镜像

下面的启动步骤指 generated release tree。

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
bash ./scripts/online-up.sh
```

用途：
直接使用已发布且 digest 固定的 `backend`、scanner runner 与 `sandbox-runner` 镜像启动核心栈；主 frontend 由 `STATIC_FRONTEND_IMAGE` 承载随包静态文件与 nginx 配置。脚本会在本地 `3000` 端口真正可访问后输出中英双语提示。

如需走低阶命令，也可以直接执行：

```bash
docker compose up -d
```

但这种方式不保证出现统一的终端 ready 提示。

### 2. 离线部署（可选）

```bash
cp docker/env/backend/offline-images.env.example docker/env/backend/offline-images.env
bash ./scripts/offline-up.sh
```

如需在终端里持续查看启动日志：

```bash
bash ./scripts/offline-up.sh --attach-logs
```

用途：
预先加载离线镜像包后，改用本地 `vulhunter-local/*` 标签启动同一套运行栈；代码执行统一由本地 `sandbox-runner` 标签承接，主 frontend 仍按 `STATIC_FRONTEND_IMAGE` 与 `deploy/runtime/frontend/*` 运行。当前离线路径只保留 Bash/WSL 单入口，不再提供 Windows PowerShell 兼容层。默认模式不附着日志，传 `--attach-logs` 才会在 backend 健康后切到前台输出。

## 明确不属于 release contract 的路径

- 在 release tree 内重新构建 `backend` / `frontend` 镜像
- 依赖源码分发包或本地 build overlay 的发布方式
- 把源码仓库里的 `FRONTEND_IMAGE` / `vulhunter-frontend` 主 frontend 合同直接套用到 generated release tree
- 任何要求 release tree 携带后端、前端源码的交付模型

## 访问地址

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- OpenAPI: `http://localhost:8000/docs`
- `nexus-web` 页面：`http://localhost:3000/nexus/`
- `nexus-itemDetail` 页面：`http://localhost:3000/nexus-item-detail/`

补充说明见 [`scripts/README-COMPOSE.md`](scripts/README-COMPOSE.md)。
