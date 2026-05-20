# 部署指南

> 本源码快照依据仓库许可证提供；单独的商业交付、商业支持或商业服务条款可能在许可证之外另行适用。

## 部署准备

1. 复制后端环境文件：

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

2. 至少确认以下变量：
   `LLM_API_KEY`、`LLM_PROVIDER`、`LLM_MODEL`

3. 生成根目录 `.env` 里的容器 socket 配置：

```bash
bash scripts/setup-env.sh
```

## 支持环境

- `docker compose`
- sourcecode 分支只保留全量 Docker Compose 部署路线：根目录 `docker-compose.yml`

## 部署命令

推荐使用源码分支脚本，它会先准备 `.env`，再执行全量本地构建与启动：

```bash
./start-local-services.sh
```

也可以直接使用单 Compose 文件：

```bash
docker compose up --build
```

## 常用维护指令

```bash
./stop-local-services.sh
docker compose ps
docker compose logs -f
docker compose down
```
