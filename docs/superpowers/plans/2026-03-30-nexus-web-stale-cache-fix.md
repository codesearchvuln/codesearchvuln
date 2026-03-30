# nexus-web Nginx 启动失败修复计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 nexus-web 容器因 nginx 配置错误（`worker_processes directive is not allowed here in /etc/nginx/conf.d/default.conf:1`）无法启动的问题。

**Architecture:** 根因是 Docker 镜像缓存陈旧——缓存镜像由旧版 9 行 Dockerfile 构建，该版本将完整 nginx 主配置（含主上下文指令 `worker_processes`）错误地复制到 `conf.d/default.conf`；而 nginx 默认会将 `conf.d/*.conf` 包含在 `http {}` 块内，主上下文指令出现在此处即报错。当前 HEAD 中的 `docker/nexus-web.Dockerfile`（122 行多阶段版本）已正确将 nginx.conf 复制到 `/etc/nginx/nginx.conf` 并删除旧的 `conf.d/default.conf`，只需清除缓存、强制重建即可。

**Tech Stack:** Docker BuildKit, nginx 1.27-alpine, pnpm 10.x, Node.js 20-alpine

---

## 根因分析

| 项目 | 内容 |
|------|------|
| 报错位置 | `/etc/nginx/conf.d/default.conf:1` |
| 报错内容 | `"worker_processes" directive is not allowed here` |
| 根本原因 | `conf.d/default.conf` 包含 `worker_processes auto;`（主上下文指令），但 nginx 标准配置将 `conf.d/` 包含在 `http {}` 块内，该指令只能出现在 main 上下文 |
| 触发原因 | 旧版（9 行）Dockerfile 中 `COPY ./nginx.conf /etc/nginx/conf.d/default.conf`（目标路径错误） |
| 为何缓存未失效 | `docker compose up --build` 发现本地镜像 digest 已存在，输出 `Built 0.0s`，直接使用了缓存镜像 |
| 当前 HEAD 状态 | `docker/nexus-web.Dockerfile`（122 行）已正确：`COPY nginx.conf /etc/nginx/nginx.conf` + `rm -f /etc/nginx/conf.d/default.conf` |

---

## 受影响文件

| 文件 | 操作 |
|------|------|
| `docker/nexus-web.Dockerfile` | 无需修改（HEAD 已正确）|
| nexus-web Docker 镜像缓存 | 需要清除并重建 |

---

## Task 1: 清除陈旧缓存并强制重建 nexus-web

**Files:**
- 无代码修改，仅操作 Docker 缓存

- [ ] **Step 1: 确认当前 Dockerfile 状态正确**

```bash
# 确认 HEAD 版本为多阶段构建（122 行）
git show HEAD:docker/nexus-web.Dockerfile | wc -l

# 确认关键行正确：nginx.conf 复制到 /etc/nginx/nginx.conf
git show HEAD:docker/nexus-web.Dockerfile | grep -n "COPY nginx.conf\|conf.d/default.conf"
```

预期输出：
```
122
116:    rm -f /etc/nginx/conf.d/default.conf; \
119:COPY nginx.conf /etc/nginx/nginx.conf
```
（行号可能有 ±1 偏差，关键是路径正确）

- [ ] **Step 2: 停止当前运行的 nexus-web 容器**

```bash
docker compose stop nexus-web
docker compose rm -f nexus-web
```

预期：容器停止并移除，无报错。

- [ ] **Step 3: 清除 nexus-web 镜像缓存并强制重建**

```bash
# 仅清除 nexus-web 相关缓存层
docker compose build --no-cache nexus-web 2>&1 | tee /tmp/nexus-web-rebuild.log
```

预期：
- 看到 deps 阶段 pnpm fetch + install（hoisted 模式，较快）
- 看到 build 阶段 `pnpm build`（vite 构建，~1-2 分钟）
- 看到 runtime 阶段 COPY nginx.conf 到 `/etc/nginx/nginx.conf`
- 最终 `Successfully built` 字样

- [ ] **Step 4: 启动并验证 nexus-web 健康**

```bash
docker compose up -d nexus-web
sleep 20

# 检查容器状态
docker compose ps nexus-web

# 检查日志（不应有 emerg 错误）
docker compose logs nexus-web --tail 30
```

预期：
- 容器状态为 `healthy` 或 `running`（nginx 无 `[emerg]` 错误）
- 日志中有 `Configuration complete; ready for start up`
- **不再有** `"worker_processes" directive is not allowed here` 错误

- [ ] **Step 5: 验证服务可访问**

```bash
# 验证 HTTP 响应
curl -s -o /dev/null -w "%{http_code}" http://localhost:5174/
```

预期：`200`（或 `304`）

---

## Task 2: 防止同类缓存问题再次发生（可选）

当 Dockerfile 发生重要变更（如修复路径错误）时，可在 CI/CD 或 README 中记录需要 `--no-cache` 重建的情况。

- [ ] **Step 1: 在 docker-compose.yml 添加 cache_from 注释（可选）**

在 `nexus-web` service 的 build 块下添加注释，提醒开发者在 nginx 配置变更后清缓存：

```yaml
  nexus-web:
    build:
      context: ./nexus-web
      dockerfile: ../docker/nexus-web.Dockerfile
      # 若 nginx.conf 路径/内容发生变更，需 --no-cache 重建：
      # docker compose build --no-cache nexus-web
```

---

## 快速修复命令（TL;DR）

```bash
docker compose build --no-cache nexus-web && docker compose up -d nexus-web
docker compose logs nexus-web --tail 20
```
