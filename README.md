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

generated release tree 现在只支持离线部署，不支持在线部署，也不再提供 `online-up.sh` 入口。

### 1. 离线部署

```bash
cp docker/env/backend/offline-images.env.example docker/env/backend/offline-images.env
bash ./Vulhunter-offline-bootstrap.sh --deploy
```

如需在终端里持续查看启动日志：

```bash
bash ./Vulhunter-offline-bootstrap.sh --deploy --attach-logs
```

用途：
预先加载离线镜像包后，通过 `Vulhunter-offline-bootstrap.sh` 统一负责 release root / archive 解析、部署启动、停服和清理；deploy 路径会进入内部 deploy worker，使用本地 `vulhunter-local/*` 标签刷新同一套运行栈，代码执行统一由本地 `sandbox-runner` 标签承接，主 frontend 仍按 `STATIC_FRONTEND_IMAGE` 与 `deploy/runtime/frontend/*` 运行。默认 `--cleanup` 不删除 volumes，只有 `--cleanup-all` 才会删除当前 release compose project 的 volumes。当前离线路径只保留 Bash/WSL 单入口，不再提供 Windows PowerShell 兼容层；离线重跑前，两份 tar bundle 也必须仍然存在。

如你下载的是尚未解压的 GitHub semantic release 源码包，也可以使用最终 semantic release 额外提供的独立引导脚本资产 `Vulhunter-offline-bootstrap.sh`。把它与 `release_code.zip` 或 `release_code.tar.gz`、以及两份离线镜像包放在同一目录后执行：

```bash
bash ./Vulhunter-offline-bootstrap.sh --deploy
```

该脚本现在是 release tree 的正式运维入口：`--deploy` 负责解压/解析并启动服务，`--stop` 负责停服，`--cleanup` 负责删除当前 release stack 的容器/镜像/网络但保留 volumes，`--cleanup-all` 负责进一步删除当前 release compose project 的 volumes。`bash ./scripts/offline-up.sh` 仅保留为 deploy-only 兼容 worker，不再作为公开入口。

## 明确不属于 release contract 的路径

- 在线部署，或任何依赖 `online-up.sh` 的启动方式
- 在 release tree 内重新构建 `backend` / `frontend` 镜像
- 依赖源码分发包或本地 build overlay 的发布方式
- 把源码仓库里的 `FRONTEND_IMAGE` / `vulhunter-frontend` 主 frontend 合同直接套用到 generated release tree
- 任何要求 release tree 携带后端、前端源码的交付模型

## 访问地址

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- OpenAPI: `http://localhost:8000/docs`
- `nexus-web`(独立容器)：`http://localhost:5174/`
- `nexus-itemDetail` 页面：`http://localhost:3000/nexus-item-detail/`

补充说明见 [`scripts/README-COMPOSE.md`](scripts/README-COMPOSE.md)。
