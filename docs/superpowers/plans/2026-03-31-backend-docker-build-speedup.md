# Backend Docker 构建加速实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将后端 Docker 镜像构建时间从 40 分钟以上压缩至 8-12 分钟（首次构建），以及通过 ccache 实现增量构建近乎零等待；同时将 YASA 从 backend 镜像中完全剥离（YASA 已由独立 runner 镜像容器提供服务）。

**Architecture:** 四层优化策略：(1) Dockerfile 层——从 backend 移除 `scanner-tools-base` YASA 阶段（~15-20 分钟直接节省）；(2) Dockerfile 层——并行 C 编译 + ccache；(3) CI 层——registry cache 持久化；(4) CI 层——原生 ARM64 runner 消除 QEMU 模拟开销。

**Tech Stack:** Docker BuildKit, Cython 3.x, ccache, setuptools parallel build_ext, GitHub Actions ubuntu-24.04-arm runners, ghcr.io registry cache

---

## 根因分析

| 瓶颈 | 当前耗时 | 根因 | 解决方向 |
|------|---------|------|---------|
| **`scanner-tools-base` YASA 阶段** | ~15-20 分钟 | `YASA_BUILD_FROM_SOURCE=1` 强制 npm ci + npx tsc + npx pkg，在 `docker-compose.full.yml`/`hybrid.yml` 的 build-args 下被触发构建 | **Task 3**：整体删除此阶段 |
| Cython C 编译（289 个 .py 文件） | ~20-25 分钟 | `build_ext` 缺 `--parallel`，gcc 串行编译每个 .c 文件 | **Task 1+2** |
| arm64 QEMU 模拟 | ~3-5x 倍速损失 | CI 用 QEMU 模拟 arm64，Cython 编译极慢 | **Task 5** |
| GHA cache 失效 | 全量重建 | `type=gha` 10GB 上限易被驱逐，中间层不持久化 | **Task 4** |

> **注意**：`setup.py:90` 的 `nthreads=os.cpu_count()` 仅并行 Cython 转译阶段（.py→.c），C 编译阶段（gcc）仍为串行。

---

## 文件变更清单

| 文件 | 操作 | 说明 | Task |
|------|------|------|------|
| `docker/backend.Dockerfile:69-73` | 修改 | builder 阶段 apt install 添加 ccache | T1 |
| `docker/backend.Dockerfile:591-608` | 修改 | cython-compiler 阶段添加 ccache mount + `CC=ccache gcc` + `--parallel` | T2 |
| `docker/backend.Dockerfile:14-17` | **删除** | 移除 YASA ARGs（BACKEND_INSTALL_YASA、YASA_VERSION、YASA_UAST_VERSION、YASA_BUILD_FROM_SOURCE） | T3 |
| `docker/backend.Dockerfile:223-232` | **删除** | 移除 runtime-base 中的 YASA ENV vars + launcher COPY（6 ENV + 3 COPY） | T3 |
| `docker/backend.Dockerfile:292-557` | **删除** | 移除整个 `scanner-tools-base` 阶段（约 266 行） | T3 |
| `docker/backend.Dockerfile:695` | **删除** | 移除 runtime 阶段中的 `yasa-engine-overrides` COPY | T3 |
| `docker-compose.full.yml:29-30` | **删除** | 移除 backend build-args 中的 YASA_BUILD 参数 | T3 |
| `docker-compose.hybrid.yml:31-32` | **删除** | 移除 backend build-args 中的 YASA_BUILD 参数 | T3 |
| `docker-compose.full.yml:69` | **删除** | 移除 backend env 中的 `BACKEND_INSTALL_YASA`（构建产物标志，运行时无意义） | T3 |
| `docker-compose.hybrid.yml:79` | **删除** | 同上 | T3 |
| `docker-compose.yml:82` | **删除** | 同上 | T3 |
| `.github/workflows/docker-publish.yml:163-176` | 修改 | 后端构建改为 registry cache | T4 |
| `.github/workflows/docker-publish.yml:82-85` | 修改 | 拆分后端为独立 matrix job（原生 ARM64） | T5 |

---

## Task 1: builder 阶段安装 ccache

**文件：**
- 修改：`docker/backend.Dockerfile:69-73`（builder 阶段 apt-get install）

**为什么：** `cython-compiler` 继承自 `builder`，ccache 必须在 builder 阶段安装才能被子阶段继承使用。

- [ ] **Step 1: 定位 builder 阶段的 apt-get install 指令**

  打开 [docker/backend.Dockerfile](docker/backend.Dockerfile#L67-L74)，找到第 69-73 行：
  ```dockerfile
    install_builder_packages() { \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    gcc \
    libc6-dev \
    libpq-dev \
    libffi-dev; \
    }; \
  ```

- [ ] **Step 2: 添加 ccache 包**

  将 `gcc \` 改为 `gcc \` + `ccache \`（按字母顺序排在 gcc 之后）：

  **old_string:**
  ```
      DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      gcc \
      libc6-dev \
  ```

  **new_string:**
  ```
      DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ccache \
      gcc \
      libc6-dev \
  ```

  使用 Edit 工具修改 `docker/backend.Dockerfile:69`。

- [ ] **Step 3: 本地验证 builder 阶段可以构建（可选）**

  仅构建 builder 阶段以确认 ccache 安装：
  ```bash
  docker buildx build \
    --target builder \
    --build-arg DOCKERHUB_LIBRARY_MIRROR=docker.m.daocloud.io/library \
    -f docker/backend.Dockerfile . \
    --progress=plain 2>&1 | grep -E "(ccache|Step|RUN)"
  ```
  预期：看到 `ccache` 被成功安装。

- [ ] **Step 4: commit**
  ```bash
  git add docker/backend.Dockerfile
  git commit -m "build(backend): install ccache in builder stage for cython speedup"
  ```

---

## Task 2: cython-compiler 阶段启用并行 C 编译 + ccache

**文件：**
- 修改：`docker/backend.Dockerfile:591-608`（cython-compiler 阶段的两个 RUN 指令）

**为什么：**
- `--parallel $(nproc)` 让 setuptools 并行调用 gcc，4 vCPU 机器上 289 个 .c 文件从 ~22 分钟降至 ~6 分钟
- `CC="ccache gcc"` + BuildKit cache mount 让重复构建时（源码未变）几乎瞬间完成（cache hit）
- `ccache` 的 cache key 基于源文件内容 hash，源码不变时 gcc 调用被跳过

- [ ] **Step 1: 定位 cython-compiler RUN 指令**

  打开 [docker/backend.Dockerfile](docker/backend.Dockerfile#L591-L608)，找到两个 RUN 块：

  **RUN 1（安装 Cython，行 591-594）：** 保持不变（uv pip install）
  
  **RUN 2（执行编译，行 601-608）：**
  ```dockerfile
  RUN set -eux; \
      cd /build; \
      /opt/backend-venv/bin/python cython_build/setup.py build_ext \
          --build-lib /build/compiled \
          --build-temp /build/tmp; \
      SO_COUNT=$(find /build/compiled -name "*.so" | wc -l); \
      echo "[Cython] 编译完成，.so 文件数: ${SO_COUNT}"; \
      test "${SO_COUNT}" -gt 50
  ```

- [ ] **Step 2: 修改 RUN 2，添加 ccache cache mount + 并行编译**

  将 RUN 2 替换为（使用 Edit 工具）：
  
  **old_string（完整内容）：**
  ```dockerfile
  # 执行编译，产物写入 /build/compiled/
  RUN set -eux; \
      cd /build; \
      /opt/backend-venv/bin/python cython_build/setup.py build_ext \
          --build-lib /build/compiled \
          --build-temp /build/tmp; \
      SO_COUNT=$(find /build/compiled -name "*.so" | wc -l); \
      echo "[Cython] 编译完成，.so 文件数: ${SO_COUNT}"; \
      test "${SO_COUNT}" -gt 50
  ```

  **new_string：**
  ```dockerfile
  # 执行编译，产物写入 /build/compiled/
  # --parallel $(nproc): 并行 gcc 编译所有 .c 文件（4vCPU→ ~6 分钟，原串行 ~22 分钟）
  # CC=ccache gcc: 跨构建缓存编译产物（源码不变时 hit 率 ~100%，近乎瞬间完成）
  RUN --mount=type=cache,id=vulhunter-cython-ccache,target=/root/.ccache,sharing=shared \
      set -eux; \
      export CC="ccache gcc" CXX="ccache g++"; \
      export CCACHE_DIR=/root/.ccache; \
      export CCACHE_MAXSIZE=2G; \
      NPROC=$(nproc); \
      echo "[Cython] 并行编译（nproc=${NPROC}），ccache dir=${CCACHE_DIR}"; \
      cd /build; \
      /opt/backend-venv/bin/python cython_build/setup.py build_ext \
          --build-lib /build/compiled \
          --build-temp /build/tmp \
          --parallel "${NPROC}"; \
      SO_COUNT=$(find /build/compiled -name "*.so" | wc -l); \
      echo "[Cython] 编译完成，.so 文件数: ${SO_COUNT}"; \
      ccache --show-stats; \
      test "${SO_COUNT}" -gt 50
  ```

  **关键说明：**
  - `sharing=shared`：允许多个构建步骤共享 ccache 目录（ccache 内部已有文件锁保护并发安全），若用 `sharing=locked` 则多架构并行构建（Task 5）会相互等待
  - `--parallel "${NPROC}"`：setuptools build_ext 的并行选项（setuptools >= 68 已支持，Dockerfile 中 `uv pip install "setuptools>=68"` 已满足此要求）
  - `ccache --show-stats`：构建日志中显示 hit/miss 统计，便于诊断

- [ ] **Step 3: 验证编译命令语法（必须执行）**

  > ⚠️ **必须执行此步骤再 commit**：验证 `--parallel` 参数被当前环境的 setuptools 接受。

  在本地 Python 3.11 + setuptools >= 68 环境验证（或在 builder stage 容器内验证）：
  ```bash
  # 方案 A：本地有同版本 Python 时
  cd /home/xyf/AuditTool/backend
  python3 -c "from setuptools.command.build_ext import build_ext; print([o for o in build_ext.user_options if 'parallel' in str(o)])"
  # 预期输出：[('parallel=', 'j', 'number of parallel build jobs')]

  # 方案 B：通过 Docker 在 builder stage 内验证
  docker buildx build --target builder \
    --build-arg DOCKERHUB_LIBRARY_MIRROR=docker.m.daocloud.io/library \
    -f docker/backend.Dockerfile . \
    --load -t test-builder --progress=plain 2>&1 | tail -3
  docker run --rm test-builder /bin/sh -c \
    "/opt/backend-venv/bin/python -c \"from setuptools.command.build_ext import build_ext; print([o for o in build_ext.user_options if 'parallel' in str(o)])\""
  ```
  预期：输出中包含 `parallel`。若未出现，则将 `--parallel "${NPROC}"` 改为在 `setup.py` 中设置 `nthreads` 即可（Cython 已有此支持）。

- [ ] **Step 4: 构建 cython-compiler 阶段并检查时间**

  ```bash
  time docker buildx build \
    --target cython-compiler \
    --build-arg DOCKERHUB_LIBRARY_MIRROR=docker.m.daocloud.io/library \
    -f docker/backend.Dockerfile . \
    --progress=plain 2>&1 | tee /tmp/cython-build.log

  # 检查 ccache 统计
  grep -E "(ccache|parallel|nproc|SO_COUNT)" /tmp/cython-build.log
  ```
  预期：构建时间 < 8 分钟（首次，无 cache），第二次构建 < 1 分钟（ccache hit）。

- [ ] **Step 5: commit**
  ```bash
  git add docker/backend.Dockerfile
  git commit -m "perf(backend/cython): parallel C compilation + ccache

  - Add --parallel \$(nproc) to build_ext: 4vCPU runner: ~22min→~6min
  - Add ccache with BuildKit cache mount: subsequent builds near-instant
  - CC='ccache gcc' covers all gcc invocations from setuptools"
  ```

---

## Task 3: 将 YASA 从 backend 镜像中完全剥离

**文件：**
- 删除：`docker/backend.Dockerfile:14-17`（顶部 YASA ARGs）
- 删除：`docker/backend.Dockerfile:223-232`（runtime-base 中 YASA ENV + launcher COPY）
- 删除：`docker/backend.Dockerfile:292-557`（整个 `scanner-tools-base` 阶段，约 266 行）
- 删除：`docker/backend.Dockerfile:695`（runtime 阶段中 `yasa-engine-overrides` COPY）
- 修改：`docker-compose.full.yml:29-30`（移除 YASA build-args）
- 修改：`docker-compose.hybrid.yml:31-32`（移除 YASA build-args）
- 修改：`docker-compose.full.yml:69` + `docker-compose.hybrid.yml:79` + `docker-compose.yml:82`（移除 `BACKEND_INSTALL_YASA` 运行时 env）

**为什么：** YASA 服务已由独立的 `yasa-runner` 容器镜像提供，后端通过 Docker SDK 调用该镜像。`scanner-tools-base` 阶段（npm ci + npx tsc + npx pkg，约 15-20 分钟）已无存在必要；其 YASA ENV vars、launcher COPY 在 `runtime-base` 中也应随之清理。`BACKEND_INSTALL_YASA` 作为运行时 env 只是构建标志，不影响 Python 业务逻辑，可以删除。

> **保留项（不修改）：**
> - `SCANNER_YASA_IMAGE`、`YASA_ENABLED`、`YASA_TIMEOUT_SECONDS`、`YASA_VERSION`（运行时 env）：仍需用于控制 YASA runner 容器的调用行为
> - `docker/yasa-runner.Dockerfile`：YASA runner 的独立镜像构建，不在此 Task 范围内
> - `backend/app/services/` 中调用 YASA runner 的 Python 代码：通过 Docker SDK 调用，不依赖本地安装路径

---

### Step 1: 删除 backend.Dockerfile 顶部 YASA ARGs

打开 [docker/backend.Dockerfile](docker/backend.Dockerfile#L13-L18)，找到以下内容：

**old_string:**
```dockerfile
ARG BACKEND_INSTALL_CJK_FONTS=0
ARG BACKEND_INSTALL_YASA=1
ARG YASA_VERSION=v0.2.33
ARG YASA_UAST_VERSION=v0.2.8
ARG YASA_BUILD_FROM_SOURCE=1
ARG DOCKER_CLI_IMAGE=${DOCKERHUB_LIBRARY_MIRROR}/docker:cli
```

**new_string:**
```dockerfile
ARG BACKEND_INSTALL_CJK_FONTS=0
ARG DOCKER_CLI_IMAGE=${DOCKERHUB_LIBRARY_MIRROR}/docker:cli
```

- [ ] 使用 Edit 工具执行上述修改

---

### Step 2: 删除 runtime-base 阶段中的 YASA ENV vars 和 launcher COPY

打开 [docker/backend.Dockerfile](docker/backend.Dockerfile#L221-L233)，找到以下内容：

**old_string:**
```dockerfile
ENV YASA_HOME=/opt/yasa
ENV YASA_BIN_DIR=/opt/yasa/bin
ENV YASA_ENGINE_DIR=/opt/yasa/engine
ENV YASA_REAL_BIN=/opt/yasa/bin/yasa-engine.real
ENV YASA_ENGINE_WRAPPER_BIN=/opt/yasa/bin/yasa-engine
ENV YASA_WRAPPER_BIN=/opt/yasa/bin/yasa

COPY --chmod=755 backend/app/runtime/launchers/yasa_engine_launcher.py /tmp/yasa-launchers/yasa-engine
COPY --chmod=755 backend/app/runtime/launchers/yasa_launcher.py /tmp/yasa-launchers/yasa
COPY --chmod=755 backend/app/runtime/launchers/yasa_uast4py_launcher.py /tmp/yasa-launchers/uast4py
```

**new_string:** （全部删除，替换为空）

- [ ] 使用 Edit 工具删除以上内容（old_string 替换为空字符串 `""`）

---

### Step 3: 删除整个 scanner-tools-base 阶段

打开 [docker/backend.Dockerfile](docker/backend.Dockerfile#L292-L558)，找到以下阶段起始注释：

**old_string（用于定位的起始标记——整个阶段约 266 行）：**
```dockerfile
# ============================================
# 多阶段构建 - 扫描工具基础阶段
# ============================================
FROM runtime-base AS scanner-tools-base
```

该阶段在以下行结束（最后一条 RUN 命令的末尾）：
```dockerfile
  /usr/local/bin/yasa --version; \
  test -d /opt/yasa/resource
```

使用 Edit 工具，将从 `# ============================================\n# 多阶段构建 - 扫描工具基础阶段` 到 `test -d /opt/yasa/resource` 的完整内容（约 266 行）删除。

> **提示（分步删除策略）：** 如果 Edit 工具对超长 old_string 不稳定，可分两步：
> 1. 先删除 ARG 重声明 + 两个 RUN（安装 unzip 部分，约 30 行）
> 2. 再删除主 RUN（YASA 下载编译部分，约 215 行）

**检查点：** 删除后确认 `FROM runtime-base AS scanner-tools-base` 这行不再存在：
```bash
grep -n "scanner-tools-base\|YASA_ENGINE_DIR\|BACKEND_INSTALL_YASA" docker/backend.Dockerfile
```
预期：无任何输出（或只剩下 runtime 阶段中和 dev-runtime 无关的行）。

- [ ] 使用 Edit 工具删除整个 `scanner-tools-base` 阶段（含前置注释）

---

### Step 4: 删除 runtime 阶段中的 yasa-engine-overrides COPY

打开 [docker/backend.Dockerfile](docker/backend.Dockerfile#L693-L696)，找到：

**old_string:**
```dockerfile
COPY frontend/yasa-engine-overrides /opt/backend-build-context/frontend/yasa-engine-overrides
```

**new_string:** （删除此行）

> **说明：** `yasa-engine-overrides` 只用于 YASA 引擎源码编译时的 TypeScript 配置覆盖（在已删除的 `scanner-tools-base` 中使用）。YASA runner 镜像（`yasa-runner.Dockerfile`）自己会 COPY 此目录，无需 backend 携带。

- [ ] 使用 Edit 工具删除以上单行

---

### Step 5: 删除 docker-compose.full.yml 中的 YASA build-args

打开 [docker-compose.full.yml](docker-compose.full.yml)，找到 backend 服务的 build args 部分（约第 29-30 行）：

**old_string:**
```yaml
          - BACKEND_INSTALL_YASA=${BACKEND_INSTALL_YASA:-1}
          - YASA_VERSION=${YASA_VERSION:-v0.2.33}
```

**new_string:** （删除这两行）

同时，找到 backend 服务的 environment 部分（约第 69 行）：

**old_string:**
```yaml
      BACKEND_INSTALL_YASA: ${BACKEND_INSTALL_YASA:-1}
```

**new_string:** （删除此行）

- [ ] 使用 Edit 工具删除 build-args 中的两行
- [ ] 使用 Edit 工具删除 environment 中的 BACKEND_INSTALL_YASA 行

---

### Step 6: 删除 docker-compose.hybrid.yml 中的 YASA build-args

打开 [docker-compose.hybrid.yml](docker-compose.hybrid.yml)，找到 backend 服务的 build args 部分（约第 31-32 行）：

**old_string:**
```yaml
          - BACKEND_INSTALL_YASA=${BACKEND_INSTALL_YASA:-1}
          - YASA_VERSION=${YASA_VERSION:-v0.2.33}
```

**new_string:** （删除这两行）

同时，找到 backend 服务的 environment 部分（约第 79 行）：

**old_string:**
```yaml
      BACKEND_INSTALL_YASA: ${BACKEND_INSTALL_YASA:-1}
```

**new_string:** （删除此行）

- [ ] 使用 Edit 工具删除 build-args 中的两行
- [ ] 使用 Edit 工具删除 environment 中的 BACKEND_INSTALL_YASA 行

---

### Step 7: 删除 docker-compose.yml 中的 BACKEND_INSTALL_YASA 运行时 env

打开 [docker-compose.yml](docker-compose.yml)，找到 backend 服务 environment 中（约第 82 行）：

**old_string:**
```yaml
      BACKEND_INSTALL_YASA: ${BACKEND_INSTALL_YASA:-1}
```

**new_string:** （删除此行）

- [ ] 使用 Edit 工具删除此行

---

### Step 8: 验证构建正确性

- [ ] **验证 Dockerfile 语法**：
  ```bash
  docker buildx build --target runtime-base \
    --build-arg DOCKERHUB_LIBRARY_MIRROR=docker.m.daocloud.io/library \
    -f docker/backend.Dockerfile . \
    --progress=plain --no-cache 2>&1 | tail -10
  ```
  预期：`runtime-base` 阶段成功构建，无 `YASA_HOME`、`YASA_BIN_DIR` 等 ENV 定义。

- [ ] **确认 scanner-tools-base 已消失**：
  ```bash
  grep -c "scanner-tools-base" docker/backend.Dockerfile
  ```
  预期：输出 `0`。

- [ ] **commit**
  ```bash
  git add docker/backend.Dockerfile docker-compose.yml docker-compose.full.yml docker-compose.hybrid.yml
  git commit -m "refactor(backend): decouple YASA from backend image

  YASA service is now provided by yasa-runner container image.
  - Remove scanner-tools-base stage (~266 lines, ~15-20min build time)
  - Remove YASA ARGs, ENV vars, launcher COPYs from backend Dockerfile
  - Remove yasa-engine-overrides COPY from runtime build context
  - Remove BACKEND_INSTALL_YASA/YASA_VERSION build-args from compose files
  - Remove BACKEND_INSTALL_YASA from compose runtime environments"
  ```

---

## Task 4: CI 改用 registry cache 并添加后端 build-args

**文件：**
- 修改：`.github/workflows/docker-publish.yml:163-176`（后端构建步骤）

**为什么：**
- `type=gha`（GitHub Actions Cache）有 10GB 上限，所有 job 共享，极易被新构建驱逐——cache miss 后全量重建
- `type=registry` 将 BuildKit 层缓存直接存入 ghcr.io（`vulhunter-backend:buildcache`），无 10GB 限制，按镜像层去重存储，cache miss 概率极低
- `mode=max` 缓存所有中间阶段（包括 `cython-compiler`、`scanner-tools-base`），而不只是最终镜像层

- [ ] **Step 1: 定位后端构建步骤**

  打开 [.github/workflows/docker-publish.yml](../../../.github/workflows/docker-publish.yml#L163-L176)，找到：
  ```yaml
      - name: 构建并推送后端 Docker 镜像
        id: build-backend
        if: ${{ steps.image-tag.outputs.build_all == 'true' || github.event.inputs.build_backend == 'true' }}
        uses: docker/build-push-action@v7
        with:
          context: .
          file: ./docker/backend.Dockerfile
          push: true
          platforms: linux/amd64,linux/arm64
          tags: |
            ${{ env.GHCR_REGISTRY }}/${{ env.VULHUNTER_IMAGE_NAMESPACE }}/vulhunter-backend:${{ steps.image-tag.outputs.tag }}
            ${{ steps.image-tag.outputs.build_all == 'true' && format('{0}/{1}/vulhunter-backend:latest', env.GHCR_REGISTRY, env.VULHUNTER_IMAGE_NAMESPACE) || '' }}
          cache-from: type=gha,scope=backend
          cache-to: type=gha,mode=max,scope=backend
  ```

- [ ] **Step 2: 替换 cache 策略，添加 build-args**

  **old_string：**
  ```yaml
          cache-from: type=gha,scope=backend
          cache-to: type=gha,mode=max,scope=backend
  ```

  **new_string：**
  ```yaml
          build-args: |
            DOCKERHUB_LIBRARY_MIRROR=docker.m.daocloud.io/library
          cache-from: |
            type=registry,ref=${{ env.GHCR_REGISTRY }}/${{ env.VULHUNTER_IMAGE_NAMESPACE }}/vulhunter-backend:buildcache
            type=gha,scope=backend
          cache-to: type=registry,ref=${{ env.GHCR_REGISTRY }}/${{ env.VULHUNTER_IMAGE_NAMESPACE }}/vulhunter-backend:buildcache,mode=max
  ```

  **说明：**
  - `cache-from` 同时列出 registry 和 gha——首次构建时 registry cache 不存在，回退到 gha cache
  - `cache-to` 只写入 registry（避免重复写入占用 gha 配额）
  - `DOCKERHUB_LIBRARY_MIRROR` 确保在 CI 中使用国内镜像

- [ ] **Step 3: 确认 GHCR 有权限推送 buildcache tag**

  `vulhunter-backend:buildcache` 会作为一个新 tag 推送到 ghcr.io。检查工作流的 `packages: write` 权限已配置（[docker-publish.yml:89](../../../.github/workflows/docker-publish.yml#L89)）：
  ```yaml
    permissions:
      packages: write  # ← 此行必须存在
  ```
  该权限已存在，无需修改。

- [ ] **Step 4: 手动触发 CI 验证**

  推送测试 tag 或使用 workflow_dispatch 触发构建。观察日志中的 cache hit 情况：
  ```
  => importing cache manifest from ghcr.io/.../vulhunter-backend:buildcache
  ```
  第一次构建会 miss（正常），第二次构建应有大量 cache hit。

- [ ] **Step 5: commit**
  ```bash
  git add .github/workflows/docker-publish.yml
  git commit -m "ci(backend): switch to registry cache (mode=max) for persistent layer caching

  - type=registry replaces type=gha to avoid 10GB eviction
  - mode=max caches all intermediate stages (cython-compiler, scanner-tools-base)
  - Fallback to gha cache for first-time builds"
  ```

---

## Task 5（可选，高收益）: CI 分离多架构构建使用原生 ARM64 Runner

**文件：**
- 修改：`.github/workflows/docker-publish.yml`（大幅重构后端构建 job）

**为什么：** QEMU 模拟 arm64 使 Cython 编译慢 5-10 倍。GitHub 免费 ARM64 runner（`ubuntu-24.04-arm`）可原生编译 arm64，彻底消除 QEMU 开销。

**实现方式：** 将后端构建拆分为两个并行 matrix job，每个构建单个平台并推送带后缀的 tag，最后用 `docker buildx imagetools create` 合并多架构 manifest。

> **⚠️ 注意：** 此 Task 涉及较大 CI 重构，建议 Task 1-4 先验证收益后再实施。

- [ ] **Step 1: 在 `build-and-push` job 之前添加 `build-backend-matrix` job**

  在 `.github/workflows/docker-publish.yml` 的 `jobs:` 下添加新 job，位于 `build-and-push` 之前：

  ```yaml
  jobs:
    # ────────────────────────────────────────────────────────────────
    # 后端多架构并行构建（原生 amd64 + 原生 arm64，消除 QEMU 开销）
    # ────────────────────────────────────────────────────────────────
    build-backend-matrix:
      name: 构建后端镜像 (${{ matrix.platform }})
      if: ${{ github.event_name == 'push' || github.event.inputs.build_backend == 'true' }}
      runs-on: ${{ matrix.runner }}
      strategy:
        fail-fast: false
        matrix:
          include:
            - platform: linux/amd64
              runner: ubuntu-latest
              cache_suffix: amd64
            - platform: linux/arm64
              runner: ubuntu-24.04-arm
              cache_suffix: arm64
      permissions:
        contents: read
        packages: write
        id-token: write
      steps:
        - name: 检出代码
          uses: actions/checkout@v6

        - name: 确定镜像标签
          id: image-tag
          env:
            EVENT_NAME: ${{ github.event_name }}
            INPUT_TAG: ${{ github.event.inputs.tag }}
          run: |
            if [ "${EVENT_NAME}" == "push" ]; then
              echo "tag=${GITHUB_REF#refs/tags/}" >> $GITHUB_OUTPUT
            else
              echo "tag=${INPUT_TAG}" >> $GITHUB_OUTPUT
            fi

        - name: 登录到 GHCR
          uses: docker/login-action@v4
          with:
            registry: ${{ env.GHCR_REGISTRY }}
            username: ${{ github.actor }}
            password: ${{ secrets.GITHUB_TOKEN }}

        - name: 设置 Docker Buildx
          uses: docker/setup-buildx-action@v4

        - name: 构建并推送后端（${{ matrix.platform }}）
          id: build
          uses: docker/build-push-action@v7
          with:
            context: .
            file: ./docker/backend.Dockerfile
            push: true
            platforms: ${{ matrix.platform }}
            tags: ${{ env.GHCR_REGISTRY }}/${{ env.VULHUNTER_IMAGE_NAMESPACE }}/vulhunter-backend:${{ steps.image-tag.outputs.tag }}-${{ matrix.cache_suffix }}
            cache-from: type=registry,ref=${{ env.GHCR_REGISTRY }}/${{ env.VULHUNTER_IMAGE_NAMESPACE }}/vulhunter-backend:buildcache-${{ matrix.cache_suffix }}
            cache-to: type=registry,ref=${{ env.GHCR_REGISTRY }}/${{ env.VULHUNTER_IMAGE_NAMESPACE }}/vulhunter-backend:buildcache-${{ matrix.cache_suffix }},mode=max

    # ────────────────────────────────────────────────────────────────
    # 合并多架构 manifest
    # ────────────────────────────────────────────────────────────────
    merge-backend-manifest:
      name: 合并后端多架构 manifest
      needs: build-backend-matrix
      runs-on: ubuntu-latest
      permissions:
        packages: write
      steps:
        - name: 登录到 GHCR
          uses: docker/login-action@v4
          with:
            registry: ${{ env.GHCR_REGISTRY }}
            username: ${{ github.actor }}
            password: ${{ secrets.GITHUB_TOKEN }}

        - name: 确定镜像标签
          id: image-tag
          env:
            EVENT_NAME: ${{ github.event_name }}
            INPUT_TAG: ${{ github.event.inputs.tag }}
          run: |
            if [ "${EVENT_NAME}" == "push" ]; then
              echo "tag=${GITHUB_REF#refs/tags/}" >> $GITHUB_OUTPUT
            else
              echo "tag=${INPUT_TAG}" >> $GITHUB_OUTPUT
            fi

        - name: 设置 Docker Buildx
          uses: docker/setup-buildx-action@v4

        - name: 创建多架构 manifest
          env:
            IMAGE: ${{ env.GHCR_REGISTRY }}/${{ env.VULHUNTER_IMAGE_NAMESPACE }}/vulhunter-backend
            TAG: ${{ steps.image-tag.outputs.tag }}
          run: |
            docker buildx imagetools create \
              --tag "${IMAGE}:${TAG}" \
              "${IMAGE}:${TAG}-amd64" \
              "${IMAGE}:${TAG}-arm64"

        - name: 验证 manifest
          env:
            IMAGE: ${{ env.GHCR_REGISTRY }}/${{ env.VULHUNTER_IMAGE_NAMESPACE }}/vulhunter-backend
            TAG: ${{ steps.image-tag.outputs.tag }}
          run: docker buildx imagetools inspect "${IMAGE}:${TAG}"
  ```

- [ ] **Step 2: 从原有 `build-and-push` job 中移除后端构建步骤**

  在 `build-and-push` job 中，将 `build-backend` 步骤（第 163-176 行）以及后续的 `签名后端镜像` 步骤删除（因为签名移至 `merge-backend-manifest` job）。

  并在 `build-and-push` job 的开头添加条件，仅当 `build_backend == false` 时运行（避免冲突）：实际上建议将 Task 5 作为完全独立的 PR，全面替换后端构建逻辑后再删除旧步骤。

- [ ] **Step 3: 测试 workflow**

  使用 `workflow_dispatch` 手动触发，`build_backend: true`，观察：
  - `build-backend-matrix` job 是否出现两个并行子任务（amd64 / arm64）
  - arm64 子任务的 runner 是否显示为 `ubuntu-24.04-arm`
  - `merge-backend-manifest` job 是否成功创建 multi-arch manifest

- [ ] **Step 4: commit**
  ```bash
  git add .github/workflows/docker-publish.yml
  git commit -m "ci(backend): parallel native amd64/arm64 builds via matrix + ubuntu-24.04-arm

  - Split backend build into matrix job: amd64 (ubuntu-latest) + arm64 (ubuntu-24.04-arm)
  - Eliminates QEMU for arm64 Cython compilation (5-10x speedup)
  - Merge step creates multi-arch manifest via imagetools create"
  ```

---

## 预期收益汇总

| Task | 优化点 | 首次构建节省 | 增量构建节省 |
|------|--------|------------|------------|
| **Task 3** | **YASA 完全剥离**（删除 scanner-tools-base）| **~15-20 分钟** | **~15-20 分钟** |
| Task 1+2 | 并行 C 编译 + ccache | ~16 分钟 | ~20 分钟 |
| Task 4 | Registry cache 持久化 | 无（首次无 cache）| cache eviction 后节省全量重建 |
| Task 5 | ARM64 原生 runner | ARM64: ~40 分钟 | ARM64: ~40 分钟 |
| **amd64 合计（T1-3）** | | **节省 ~31-36 分钟** | **节省 ~35-40 分钟** |

> 当前总时间约 40+ 分钟 → **Task 3 执行后约 20-25 分钟；Task 1-3 全部完成后约 5-8 分钟**（首次），增量构建约 **1-3 分钟**（ccache hit）。
>
> **建议执行顺序：Task 3 → Task 1 → Task 2 → Task 4 → Task 5**（Task 3 单独执行即可获得最大单次收益）。

---

## 回滚方案

- **Task 1-2 回滚：** `git revert` Dockerfile 的 ccache 相关提交，删除 `CCACHE_DIR`、`CC=ccache gcc` 和 `--parallel` 即可恢复串行构建
- **Task 3 回滚：** `git revert` Task 3 的提交，恢复 `scanner-tools-base` 阶段及所有 YASA ARGs/ENVs；需同时恢复 `docker-compose.full.yml` 和 `docker-compose.hybrid.yml` 中的 build-args
- **Task 4 回滚：** 将 CI cache 改回 `type=gha,scope=backend`
- **Task 5 回滚：** 删除 `build-backend-matrix` 和 `merge-backend-manifest` job，恢复原 `build-backend` 步骤
