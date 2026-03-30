# Docker 构建解耦与 nexus-web 预构建镜像优化计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 解决 `docker compose up --build` 首次构建时 nexus-web pnpm fetch 超时/失败的问题，将 nexus-web 改为拉取预构建镜像而非本地构建；同时解耦前后端容器构建，使代码改动不再触发全量重建。

**Architecture:** 三步走策略：(1) nexus-web 上游仓库新增 GitHub Actions release workflow，自动构建 Docker 镜像并推送到 GHCR + 发布静态产物 tarball；(2) 主仓库 compose 将 nexus-web 从 `build:` 改为 `image:` 拉取预构建镜像，保留 full.yml 本地构建覆盖层作为开发回退；(3) 优化 compose 服务依赖和构建 profile，实现前后端独立构建。

**Tech Stack:** Docker Compose, GitHub Actions, nginx 1.27-alpine, GHCR (ghcr.io), pnpm, Vite

---

## 现状问题分析

| 问题 | 根因 | 影响 |
|------|------|------|
| nexus-web 构建超时 | pnpm fetch 从 npmjs.org 拉取依赖超时（exit 143），中国网络环境下镜像源不稳定 | 首次 `docker compose up --build` 必定失败 |
| 前后端构建耦合 | `docker compose up --build` 无选择性地重建所有 services | 改一行后端代码也会触发 frontend + nexus-web 重建 |
| nexus-web 依赖庞大 | package.json 含 kuzu-wasm、langchain、mermaid 等重度依赖，dist 产物 74MB | 每次构建耗时长，网络不稳定时几乎无法成功 |
| 缺少 nexus-web CI/CD | 上游仓库 `happytraveller-alone/nexus-web` 无 GitHub Actions | 无自动构建、无预构建镜像可用 |

---

## 文件变更总览

| 文件 | 操作 | 说明 |
|------|------|------|
| `nexus-web/src/.github/workflows/release.yml` | **新建** | nexus-web 上游仓库的 release workflow |
| `docker-compose.yml` | **修改** | nexus-web 从 build 改为 image，新增 profiles |
| `docker-compose.full.yml` | **修改** | 新增 nexus-web 本地构建覆盖层 |
| `docker/nexus-web.Dockerfile` | **无变更** | 保持现状，仅供 full.yml 本地构建使用 |
| `.github/workflows/docker-publish.yml` | **修改** | 新增 nexus-web 镜像构建选项 |
| `scripts/compose-up-with-fallback.sh` | **修改** | 适配新的 compose 结构 |
| `CLAUDE.md` | **修改** | 更新开发命令文档 |

---

## Task 1: 为 nexus-web 上游仓库创建 GitHub Actions Release Workflow

**Files:**
- Create: `nexus-web/src/.github/workflows/release.yml`

### 背景

nexus-web 上游仓库 (`happytraveller-alone/nexus-web`) 目前没有任何 CI/CD。我们需要在其中创建一个 workflow，在 push tag 或手动触发时：
1. 构建 Vite 产物
2. 构建 Docker 镜像（nginx + 静态产物）并推送到 GHCR
3. 将 dist tarball 作为 Release artifact 发布

- [ ] **Step 1: 创建 workflow 目录结构**

```bash
mkdir -p nexus-web/src/.github/workflows
```

- [ ] **Step 2: 编写 release workflow**

Create `nexus-web/src/.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'
  workflow_dispatch:
    inputs:
      tag:
        description: '镜像标签 (例如: latest, v1.0.0)'
        required: true
        default: 'latest'
        type: string

env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository_owner }}/nexus-web

jobs:
  build-and-release:
    name: Build and Release
    runs-on: ubuntu-latest
    permissions:
      contents: write
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: '20'

      - name: Install pnpm
        uses: pnpm/action-setup@v5
        with:
          version: 10

      - name: Get pnpm store directory
        shell: bash
        run: echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

      - name: Setup pnpm cache
        uses: actions/cache@v5
        with:
          path: ${{ env.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm build

      - name: Determine version
        id: version
        run: |
          if [ "${{ github.event_name }}" == "workflow_dispatch" ]; then
            echo "TAG=${{ github.event.inputs.tag }}" >> $GITHUB_OUTPUT
          else
            echo "TAG=${GITHUB_REF#refs/tags/}" >> $GITHUB_OUTPUT
          fi

      - name: Package dist artifact
        run: tar -czf nexus-web-dist-${{ steps.version.outputs.TAG }}.tar.gz -C dist .

      - name: Login to GHCR
        uses: docker/login-action@v4
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Docker Buildx
        uses: docker/setup-buildx-action@v4

      - name: Setup QEMU
        uses: docker/setup-qemu-action@v4

      - name: Build and push Docker image
        uses: docker/build-push-action@v7
        with:
          context: .
          file: ./Dockerfile
          push: true
          platforms: linux/amd64,linux/arm64
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ steps.version.outputs.TAG }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          cache-from: type=gha,scope=nexus-web
          cache-to: type=gha,mode=max,scope=nexus-web

      - name: Create Release
        if: startsWith(github.ref, 'refs/tags/')
        uses: softprops/action-gh-release@v2
        with:
          files: nexus-web-dist-${{ steps.version.outputs.TAG }}.tar.gz
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 3: 确认 nexus-web 源码中已有可用的 Dockerfile**

nexus-web 源码 (`nexus-web/src/Dockerfile`) 已存在一个简化版 Dockerfile：

```dockerfile
# build
FROM node:20 AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm
RUN pnpm install
COPY . .
RUN pnpm build

# runtime
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx","-g","daemon off;"]
```

这个 Dockerfile 在 GitHub Actions 的网络环境下可以正常工作（无需中国镜像源），适合 CI 构建。但需要增加 COOP/COEP headers（kuzu-wasm 需要 SharedArrayBuffer）。

- [ ] **Step 4: 优化 nexus-web 源码中的 Dockerfile**

修改 `nexus-web/src/Dockerfile`，使其支持 COOP/COEP headers 和自定义端口：

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@10 --activate
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:1.27-alpine AS runtime
RUN set -eux; \
    rm -rf /usr/share/nginx/html/*; \
    rm -f /etc/nginx/conf.d/default.conf; \
    mkdir -p /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp; \
    chown -R nginx:nginx /usr/share/nginx/html /tmp /var/cache/nginx

COPY --from=builder --chown=nginx:nginx /app/dist/ /usr/share/nginx/html/

# 内联 nginx 配置，无需外部 nginx.conf
RUN printf '%s\n' \
    'worker_processes auto;' \
    'pid /tmp/nginx.pid;' \
    'events { worker_connections 1024; }' \
    'http {' \
    '    include /etc/nginx/mime.types;' \
    '    default_type application/octet-stream;' \
    '    access_log /dev/stdout;' \
    '    error_log /dev/stderr warn;' \
    '    sendfile on;' \
    '    tcp_nopush on;' \
    '    keepalive_timeout 65;' \
    '    server_tokens off;' \
    '    client_body_temp_path /tmp/client_temp;' \
    '    proxy_temp_path /tmp/proxy_temp;' \
    '    fastcgi_temp_path /tmp/fastcgi_temp;' \
    '    uwsgi_temp_path /tmp/uwsgi_temp;' \
    '    scgi_temp_path /tmp/scgi_temp;' \
    '    server {' \
    '        listen 5174;' \
    '        server_name _;' \
    '        root /usr/share/nginx/html;' \
    '        index index.html;' \
    '        add_header Cross-Origin-Opener-Policy "same-origin" always;' \
    '        add_header Cross-Origin-Embedder-Policy "require-corp" always;' \
    '        location / { try_files $uri $uri/ /index.html; }' \
    '    }' \
    '}' > /etc/nginx/nginx.conf

USER nginx
EXPOSE 5174
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 5: 将修改提交到 nexus-web 上游仓库**

```bash
cd nexus-web/src
git add .github/workflows/release.yml Dockerfile
git commit -m "ci: add GitHub Actions release workflow with Docker image publishing"
git push origin main
```

- [ ] **Step 6: 手动触发首次构建验证**

在 GitHub UI 上手动触发 `workflow_dispatch`，tag 填 `latest`。确认：
- 镜像成功推送到 `ghcr.io/happytraveller-alone/nexus-web:latest`
- 构建日志无报错

- [ ] **Step 7: 打 tag 触发正式 release**

```bash
cd nexus-web/src
git tag v1.0.0
git push origin v1.0.0
```

确认 GitHub Release 页面包含 `nexus-web-dist-v1.0.0.tar.gz`。

---

## Task 2: 主仓库 docker-compose.yml — nexus-web 从本地构建改为拉取预构建镜像

**Files:**
- Modify: `docker-compose.yml:235-242`

### 设计思路

将 nexus-web 从 `build:` 切换为 `image:`，直接拉取 GHCR 上的预构建镜像。这样：
- 首次 `docker compose up` 只需 pull 镜像（几十秒），无需本地 pnpm fetch
- 完全消除网络超时导致的构建失败
- nexus-web 版本通过 image tag 或 `.env` 控制

- [ ] **Step 1: 修改 docker-compose.yml 中 nexus-web 服务定义**

将当前：

```yaml
  nexus-web:
    build:
      context: ./nexus-web
      dockerfile: ../docker/nexus-web.Dockerfile
      args:
        - DOCKERHUB_LIBRARY_MIRROR=${DOCKERHUB_LIBRARY_MIRROR:-docker.m.daocloud.io/library}
    ports:
      - "5174:5174"
```

改为：

```yaml
  nexus-web:
    image: ${NEXUS_WEB_IMAGE:-ghcr.io/happytraveller-alone/nexus-web:latest}
    restart: unless-stopped
    ports:
      - "${VULHUNTER_NEXUS_WEB_PORT:-5174}:5174"
    networks:
      - vulhunter-network
```

- [ ] **Step 2: 验证 pull 镜像可用**

```bash
docker compose pull nexus-web
docker compose up -d nexus-web
docker compose logs nexus-web --tail 10
curl -s -o /dev/null -w "%{http_code}" http://localhost:5174/
```

预期：`200`

---

## Task 3: docker-compose.full.yml — 保留 nexus-web 本地构建作为回退

**Files:**
- Modify: `docker-compose.full.yml`（在文件末尾新增 nexus-web 覆盖层）

### 设计思路

`docker-compose.full.yml` 是"全量本地构建覆盖层"，对于需要修改 nexus-web 源码的开发者，可以通过 `-f docker-compose.full.yml` 覆盖回本地构建模式。

- [ ] **Step 1: 在 docker-compose.full.yml 添加 nexus-web 覆盖**

在 `frontend:` service 块之后，添加：

```yaml
  nexus-web:
    image: vulhunter/nexus-web-local:latest
    build: !override
      context: ./nexus-web
      dockerfile: ../docker/nexus-web.Dockerfile
      args:
        - DOCKERHUB_LIBRARY_MIRROR=${DOCKERHUB_LIBRARY_MIRROR:-docker.m.daocloud.io/library}
        - NEXUS_WEB_NPM_REGISTRY=${NEXUS_WEB_NPM_REGISTRY:-https://registry.npmmirror.com}
        - NEXUS_WEB_NPM_REGISTRY_FALLBACK=${NEXUS_WEB_NPM_REGISTRY_FALLBACK:-https://registry.npmjs.org}
        - NEXUS_WEB_PNPM_VERSION=${NEXUS_WEB_PNPM_VERSION:-10.32.1}
    ports: !override
      - "${VULHUNTER_NEXUS_WEB_PORT:-5174}:5174"
    networks:
      - vulhunter-network
```

- [ ] **Step 2: 验证 full.yml 本地构建仍可工作**

```bash
docker compose -f docker-compose.yml -f docker-compose.full.yml build nexus-web
```

预期：本地构建流程正常启动（即使可能因网络失败，但构建流程本身不报语法错误）。

---

## Task 4: 解耦前后端构建 — 添加 profiles 和独立构建命令

**Files:**
- Modify: `docker-compose.yml`（backend, frontend 服务添加 profiles 注释）
- Modify: `CLAUDE.md`（更新开发命令文档）

### 设计思路

当前 `docker compose up --build` 会重建所有服务。问题在于用户修改了后端代码后，frontend 和 nexus-web 也会被重建。解决方案：

1. **推荐日常开发流程**：单独 build 变更的服务
2. **在文档中明确独立构建命令**
3. **利用 Docker Compose 的 `--no-deps` 避免级联重建**

注意：Docker Compose profiles 不适用于此场景（profiles 控制的是启动而非构建），真正的解耦是通过**操作习惯**和**文档引导**实现的。

- [ ] **Step 1: 更新 CLAUDE.md 中的开发命令**

将当前的 Full Stack (Docker) 部分替换为：

```markdown
### Full Stack (Docker — recommended)

\`\`\`bash
# 启动所有服务（nexus-web 使用预构建镜像，无需本地构建）
docker compose up --build

# 独立构建/重建单个服务（推荐日常开发使用，避免全量重建）
docker compose build backend              # 仅重建后端
docker compose build frontend             # 仅重建前端
docker compose up -d --no-deps backend    # 仅重启后端（不触发依赖服务重建）
docker compose up -d --no-deps frontend   # 仅重启前端

# 全量本地构建（包括 nexus-web 本地编译，适用于 nexus-web 源码修改）
docker compose -f docker-compose.yml -f docker-compose.full.yml up --build

# 构建 sandbox 镜像
docker compose --profile build up sandbox

# nexus-web 独立操作
docker compose pull nexus-web              # 拉取最新预构建镜像
docker compose up -d --no-deps nexus-web  # 重启 nexus-web
\`\`\`

Services: frontend `http://localhost:3000`, backend `http://localhost:8000`, nexus-web `http://localhost:5174`, OpenAPI `http://localhost:8000/docs`
```

- [ ] **Step 2: 验证独立构建工作正常**

```bash
# 只构建 backend，不触发 frontend 和 nexus-web
docker compose build backend
echo "Exit: $?"
```

预期：仅后端镜像被重建，前端和 nexus-web 不受影响。

---

## Task 5: 将 nexus-web 镜像加入主仓库 docker-publish.yml workflow

**Files:**
- Modify: `.github/workflows/docker-publish.yml`

### 设计思路

虽然 nexus-web 上游仓库自行发布镜像，但主仓库的 `docker-publish.yml` 也应能构建 nexus-web（用于主仓库 fork 了 nexus-web 源码的场景，或定制构建需求）。

- [ ] **Step 1: 在 workflow_dispatch inputs 中新增 nexus-web 选项**

在 `build_sandbox` input 之后添加：

```yaml
      build_nexus_web:
        description: '构建 nexus-web 镜像'
        required: false
        type: boolean
        default: false
```

注意 `default: false`——因为默认应从上游拉取，仅在需要定制构建时启用。

- [ ] **Step 2: 在 jobs 中新增 nexus-web 构建步骤**

在 sandbox 构建步骤之后添加：

```yaml
      - name: 构建并推送 nexus-web Docker 镜像
        if: ${{ github.event.inputs.build_nexus_web == 'true' }}
        uses: docker/build-push-action@v7
        with:
          context: ./nexus-web/src
          file: ./nexus-web/src/Dockerfile
          push: true
          platforms: linux/amd64,linux/arm64
          tags: |
            ghcr.io/${{ github.repository_owner }}/nexus-web:${{ github.event.inputs.tag }}
          cache-from: type=gha,scope=nexus-web
          cache-to: type=gha,mode=max,scope=nexus-web
```

- [ ] **Step 3: 在输出信息中添加 nexus-web**

在 `输出镜像信息` step 中添加：

```bash
          if [ "${{ github.event.inputs.build_nexus_web }}" == "true" ]; then
            echo "- \`ghcr.io/${{ github.repository_owner }}/nexus-web:${{ github.event.inputs.tag }}\`" >> $GITHUB_STEP_SUMMARY
          fi
```

---

## Task 6: 清理和验证

**Files:**
- 无新建文件

- [ ] **Step 1: 清除所有旧的 nexus-web 本地镜像**

```bash
docker images | grep nexus-web | awk '{print $3}' | xargs -r docker rmi -f
```

- [ ] **Step 2: 完整的端到端验证 — 默认模式（预构建镜像）**

```bash
# 模拟首次部署
docker compose down -v
docker compose pull nexus-web
docker compose up --build -d

# 等待服务就绪
sleep 30

# 验证所有服务
curl -s -o /dev/null -w "backend: %{http_code}\n" http://localhost:8000/health
curl -s -o /dev/null -w "frontend: %{http_code}\n" http://localhost:3000/
curl -s -o /dev/null -w "nexus-web: %{http_code}\n" http://localhost:5174/
```

预期：三个服务均返回 `200`。

- [ ] **Step 3: 完整的端到端验证 — 全量本地构建模式**

```bash
docker compose -f docker-compose.yml -f docker-compose.full.yml build nexus-web
```

预期：本地构建流程正常（可能因网络环境失败，但 compose 语法和 Dockerfile 无误）。

- [ ] **Step 4: 验证独立服务构建不影响其他服务**

```bash
# 修改一个后端文件
touch backend/app/__init__.py

# 仅重建后端
docker compose build backend 2>&1 | tail -5

# 确认 frontend 和 nexus-web 未被重建
docker compose images
```

预期：只有 backend 镜像的 CREATED 时间是最新的。

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml docker-compose.full.yml .github/workflows/docker-publish.yml CLAUDE.md
git commit -m "refactor: decouple Docker builds — nexus-web uses pre-built image, independent service builds

- nexus-web: switch from local build to pre-built GHCR image (ghcr.io/happytraveller-alone/nexus-web)
- docker-compose.full.yml: retain local build override for nexus-web development
- docker-publish.yml: add optional nexus-web build target
- CLAUDE.md: document independent build commands for daily development"
```

---

## 附录 A: 架构变更对比

### Before（当前）

```
docker compose up --build
  ├── db           (pull postgres:15-alpine)
  ├── redis        (pull redis:7-alpine)
  ├── backend      (local build, 619-line Dockerfile, ~5-10 min)
  ├── frontend     (local build, pnpm fetch + vite, ~3-5 min)
  └── nexus-web    (local build, pnpm fetch FAILS — exit 143)
                   ^^^^^^^^^^^^ BLOCKING ISSUE
```

### After（优化后）

```
docker compose up --build
  ├── db           (pull postgres:15-alpine)
  ├── redis        (pull redis:7-alpine)
  ├── backend      (local build, ~5-10 min, 独立可控)
  ├── frontend     (local build, ~3-5 min, 独立可控)
  └── nexus-web    (pull ghcr.io/happytraveller-alone/nexus-web:latest, ~30s)
                   ^^^^^^^^^^^^ NO LOCAL BUILD NEEDED

docker compose build backend   ← 只重建后端
docker compose build frontend  ← 只重建前端
docker compose pull nexus-web  ← 只更新 nexus-web
```

### 全量本地构建（开发 nexus-web 时）

```
docker compose -f docker-compose.yml -f docker-compose.full.yml build nexus-web
```

---

## 附录 B: 环境变量新增

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `NEXUS_WEB_IMAGE` | `ghcr.io/happytraveller-alone/nexus-web:latest` | nexus-web Docker 镜像地址 |
| `VULHUNTER_NEXUS_WEB_PORT` | `5174` | nexus-web 宿主机端口映射 |
| `NEXUS_WEB_NPM_REGISTRY` | `https://registry.npmmirror.com` | (仅 full.yml) nexus-web npm 镜像 |
| `NEXUS_WEB_NPM_REGISTRY_FALLBACK` | `https://registry.npmjs.org` | (仅 full.yml) nexus-web npm 回退 |
| `NEXUS_WEB_PNPM_VERSION` | `10.32.1` | (仅 full.yml) pnpm 版本 |

---

## 附录 C: 回滚方案

如果预构建镜像方案出现问题（如 GHCR 不可达），可临时切换回本地构建：

```bash
# 方法 1: 使用 full.yml 覆盖层
docker compose -f docker-compose.yml -f docker-compose.full.yml up --build

# 方法 2: 直接用本地 dist 目录（nexus-web/dist/ 已有 74MB 预构建产物）
# 挂载 dist 到 nginx 容器
docker run -d --name nexus-web -p 5174:80 \
  -v $(pwd)/nexus-web/dist:/usr/share/nginx/html:ro \
  nginx:alpine
```
