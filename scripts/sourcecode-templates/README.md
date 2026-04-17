# AuditTool Public Source Branch

这个 `sourcecode` 分支由 `main` 自动生成，用于公开源码与本地 full 构建，不承载内部 CI、规划文档或发布打包流程。

## 快速开始

1. 准备后端环境文件：

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

2. 自动探测 Docker / Podman socket：

```bash
bash scripts/setup-env.sh
```

3. 使用唯一保留的 full 本地构建入口启动：

```bash
docker compose -f docker-compose.yml -f docker-compose.full.yml up --build
```

也可以使用 `Makefile` 快捷命令：

```bash
make setup
make up-full
```

## 保留内容

- `backend/`、`frontend/`、`docker/`、`data/`
- `nexus-web/`、`nexus-itemDetail/`
- `docker-compose.yml` 基座与 `docker-compose.full.yml` 全量本地构建覆盖层
- `scripts/setup-env.sh`

## 已移除内容

- `.github/`
- `docs/`
- `deploy/`
- hybrid 覆盖层与默认入口脚本
- release / offline / fallback / security 等内部脚本

## 约定

- `sourcecode` 分支是生成产物，不接受直接维护。
- 如需调整公开源码内容，请修改 `main` 上的生成逻辑。
