# AuditTool 源码部署指南

本目录只描述源码交付形态下的部署方式。唯一支持的启动合同是 `docker-compose.yml` + `docker-compose.full.yml` 的全量本地构建，不要把 release 运行包里的在线 / 离线刷新脚本套用到这里。

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

也可以直接使用快捷命令：

```bash
make setup
```

## 支持环境

- `docker compose`
- `podman compose`
- `make` 会自动在 `docker compose`、`podman compose`、`docker-compose` 之间选择当前机器可用的实现
- 所有直接 compose 命令都必须同时带上 `-f docker-compose.yml -f docker-compose.full.yml`

## 部署命令

推荐直接使用全量本地构建入口：

```bash
docker compose -f docker-compose.yml -f docker-compose.full.yml up --build
```

如果当前宿主机使用 Podman：

```bash
podman compose -f docker-compose.yml -f docker-compose.full.yml up --build
```

如果你更习惯统一入口：

```bash
make up-full
```

## 常用维护指令

```bash
make ps
make logs
make down
```

不使用 `Makefile` 时，请继续保留同一组 compose 文件：

```bash
docker compose -f docker-compose.yml -f docker-compose.full.yml ps
docker compose -f docker-compose.yml -f docker-compose.full.yml logs -f
docker compose -f docker-compose.yml -f docker-compose.full.yml down
```
