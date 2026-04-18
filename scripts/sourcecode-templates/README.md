# 部署指南
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
- 所有直接 compose 命令都必须同时带上 `-f docker-compose.yml -f docker-compose.full.yml`

## 部署命令

推荐直接使用全量本地构建入口：

```bash
docker compose -f docker-compose.yml -f docker-compose.full.yml up --build
```

## 常用维护指令

```bash
docker compose -f docker-compose.yml -f docker-compose.full.yml ps
docker compose -f docker-compose.yml -f docker-compose.full.yml logs -f
docker compose -f docker-compose.yml -f docker-compose.full.yml down
```
