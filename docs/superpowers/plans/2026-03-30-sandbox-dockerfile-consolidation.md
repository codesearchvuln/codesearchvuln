# Sandbox Dockerfile 整合计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `docker/sandbox/` 子文件夹中的 Dockerfile 迁移到 `docker/` 根目录，删除所有多余的构建脚本/README，与其他 runner 容器保持一致的组织方式；同时移除沙箱内置的扫描引擎（已由各专用 runner 承担），强化 Python 运行库覆盖度。

**Architecture:** `docker/sandbox/Dockerfile` 重命名为 `docker/sandbox.Dockerfile`，构建上下文从 `./docker/sandbox` 改为项目根目录 `.`。新版 Dockerfile 不再内置 Go/Rust/opengrep/gitleaks/osv-scanner/pmd/trufflehog/phpstan 等扫描工具，专注于以非 root 用户运行 Python（及 Node.js/PHP/Java/Ruby）代码并输出结果。Python 依赖覆盖 HTTP、加解密、解析、数据库客户端、网络、序列化等常用场景。所有引用 `docker/sandbox/` 的文件同步更新，`docker/sandbox/` 文件夹及其所有内容删除。

**Tech Stack:** Docker, Bash, GitHub Actions YAML, Python

---

## 文件结构变更

| 操作 | 路径 |
|------|------|
| 创建 | `docker/sandbox.Dockerfile` |
| 删除 | `docker/sandbox/Dockerfile` |
| 删除 | `docker/sandbox/build.sh` |
| 删除 | `docker/sandbox/build.bat` |
| 删除 | `docker/sandbox/build.ps1` |
| 删除 | `docker/sandbox/build-runner.sh` |
| 删除 | `docker/sandbox/test-runner.sh` |
| 删除 | `docker/sandbox/README.md` |
| 删除 | `docker/sandbox/seccomp.json` |
| 删除 | `docker/sandbox/runtime/opengrep_launcher.py` |
| 修改 | `docker-compose.yml`（sandbox service 构建上下文）|
| 修改 | `.github/workflows/docker-publish.yml` |
| 修改 | `.github/workflows/release.yml` |
| 修改 | `scripts/setup_security_tools.sh` |
| 修改 | `backend/app/services/agent/tools/sandbox_tool.py` |
| 修改 | `docker/env/backend/env.example` |

---

## Task 1: 创建 `docker/sandbox.Dockerfile`

**Files:**
- Create: `docker/sandbox.Dockerfile`

新版设计目标：
- **移除**所有扫描引擎（opengrep/gitleaks/osv-scanner/pmd/trufflehog/phpstan/Go/Rust），这些已由专用 runner 镜像承担
- **保留**多语言运行时（Node.js/PHP/Java/Ruby），供沙箱内执行各语言代码
- **扩充** Python 依赖至全场景覆盖（HTTP、加解密、解析、数据库客户端、网络、序列化、Web 框架、数据处理等）
- **保留**非 root sandbox 用户、工作目录隔离

- [ ] **Step 1: 创建 `docker/sandbox.Dockerfile`**

```dockerfile
# VulHunter Agent Sandbox
# 安全代码执行环境，用于漏洞验证和 PoC 运行
# 专注于 Python 代码执行，不内置扫描引擎（由专用 runner 镜像承担）

ARG DOCKERHUB_LIBRARY_MIRROR=docker.m.daocloud.io/library
ARG SANDBOX_BASE_IMAGE=docker.m.daocloud.io/python:3.11-slim
FROM ${DOCKERHUB_LIBRARY_MIRROR}/node:22-slim AS nodebase
FROM ${SANDBOX_BASE_IMAGE}

ARG SANDBOX_APT_MIRROR_PRIMARY=mirrors.aliyun.com
ARG SANDBOX_APT_SECURITY_PRIMARY=mirrors.aliyun.com
ARG SANDBOX_APT_MIRROR_FALLBACK=deb.debian.org
ARG SANDBOX_APT_SECURITY_FALLBACK=security.debian.org
ARG SANDBOX_PYPI_INDEX_PRIMARY=https://mirrors.aliyun.com/pypi/simple/
ARG SANDBOX_PYPI_INDEX_FALLBACK=https://pypi.org/simple
ARG SANDBOX_NPM_REGISTRY_PRIMARY=https://registry.npmmirror.com
ARG SANDBOX_NPM_REGISTRY_FALLBACK=https://registry.npmjs.org

LABEL maintainer="VulHunter Team"
LABEL description="Sandboxed code execution environment for PoC verification (Python-focused)"

ENV PIP_INDEX_URL=${SANDBOX_PYPI_INDEX_PRIMARY}
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 安装运行时依赖（主镜像源失败后回退）
RUN set -eux; \
  unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY all_proxy ALL_PROXY; \
  rm -f /etc/apt/apt.conf.d/proxy.conf 2>/dev/null || true; \
  { \
  echo 'Acquire::http::Proxy "false";'; \
  echo 'Acquire::https::Proxy "false";'; \
  echo 'Acquire::Retries "5";'; \
  echo 'Acquire::http::Timeout "30";'; \
  echo 'Acquire::https::Timeout "30";'; \
  echo 'Acquire::ForceIPv4 "true";'; \
  } > /etc/apt/apt.conf.d/99-VulHunter-network; \
  . /etc/os-release; \
  CODENAME="${VERSION_CODENAME:-bookworm}"; \
  write_sources() { \
  main_host="$1"; \
  security_host="$2"; \
  rm -f /etc/apt/sources.list.d/debian.sources 2>/dev/null || true; \
  printf 'deb https://%s/debian %s main\n' "${main_host}" "${CODENAME}" > /etc/apt/sources.list; \
  printf 'deb https://%s/debian %s-updates main\n' "${main_host}" "${CODENAME}" >> /etc/apt/sources.list; \
  printf 'deb https://%s/debian-security %s-security main\n' "${security_host}" "${CODENAME}" >> /etc/apt/sources.list; \
  }; \
  install_runtime_packages() { \
  apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  wget \
  netcat-openbsd \
  dnsutils \
  iputils-ping \
  git \
  jq \
  unzip \
  build-essential \
  libffi-dev \
  libssl-dev \
  php-cli \
  openjdk-21-jre-headless \
  ruby; \
  }; \
  write_sources "${SANDBOX_APT_MIRROR_PRIMARY}" "${SANDBOX_APT_SECURITY_PRIMARY}"; \
  if ! install_runtime_packages; then \
  rm -rf /var/lib/apt/lists/*; \
  write_sources "${SANDBOX_APT_MIRROR_FALLBACK}" "${SANDBOX_APT_SECURITY_FALLBACK}"; \
  install_runtime_packages; \
  fi; \
  rm -rf /var/lib/apt/lists/*

# 引入 Node.js 22 运行时
COPY --from=nodebase /usr/local/bin/node /usr/local/bin/node
COPY --from=nodebase /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN set -eux; \
  ln -sf /usr/local/bin/node /usr/local/bin/nodejs; \
  ln -sf ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm; \
  ln -sf ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx; \
  npm config set registry "${SANDBOX_NPM_REGISTRY_PRIMARY}"; \
  node --version; npm --version

# 安装全面的 Python 运行库（主源失败后回退）
RUN --mount=type=cache,id=VulHunter-sandbox-pip,target=/root/.cache/pip \
  set -eux; \
  pip_install_with_index() { \
  idx="$1"; \
  PIP_INDEX_URL="${idx}" pip install --no-cache-dir \
  requests httpx aiohttp websockets urllib3 \
  beautifulsoup4 lxml html5lib chardet \
  pycryptodome cryptography pyjwt python-jose \
  paramiko \
  sqlalchemy pymysql psycopg2-binary pymongo redis \
  pyyaml toml msgpack \
  flask fastapi uvicorn \
  numpy pandas \
  click rich colorama tabulate \
  sqlparse \
  python-dotenv tqdm retry tenacity; \
  }; \
  pip_install_with_index "${SANDBOX_PYPI_INDEX_PRIMARY}" || pip_install_with_index "${SANDBOX_PYPI_INDEX_FALLBACK}"

# 创建非 root 用户
RUN groupadd -g 1000 sandbox && \
  useradd -u 1000 -g sandbox -m -s /bin/bash sandbox

# 创建工作目录
RUN mkdir -p /workspace /tmp/sandbox \
  /workspace/.VulHunter/runtime/xdg-data \
  /workspace/.VulHunter/runtime/xdg-cache \
  /workspace/.VulHunter/runtime/xdg-config && \
  chown -R sandbox:sandbox /workspace /tmp/sandbox

ENV HOME=/home/sandbox
ENV PATH=/home/sandbox/.local/bin:$PATH
ENV XDG_DATA_HOME=/workspace/.VulHunter/runtime/xdg-data
ENV XDG_CACHE_HOME=/workspace/.VulHunter/runtime/xdg-cache
ENV XDG_CONFIG_HOME=/workspace/.VulHunter/runtime/xdg-config
ENV PYTHONPATH=/workspace

USER sandbox

WORKDIR /workspace

CMD ["/bin/bash"]
```

- [ ] **Step 2: 验证文件已创建，且不含扫描引擎关键词**

```bash
ls -la docker/sandbox.Dockerfile
head -5 docker/sandbox.Dockerfile
# 确认不含扫描工具
grep -E "opengrep|gitleaks|pmd|trufflehog|phpstan|osv-scanner|golang|rustup" docker/sandbox.Dockerfile && echo "FAIL: found scanner refs" || echo "OK: no scanner refs"
```

Expected: 文件存在，grep 输出 "OK: no scanner refs"

- [ ] **Step 3: Commit**

```bash
git add docker/sandbox.Dockerfile
git commit -m "feat: add docker/sandbox.Dockerfile - lightweight sandbox without scan engines"
```

---

## Task 2: 更新 `docker-compose.yml` 中的 sandbox service

**Files:**
- Modify: `docker-compose.yml:201-220`

- [ ] **Step 1: 更新 sandbox service 构建配置**

找到 `docker-compose.yml` 中 `sandbox:` service 部分（约第201行），将：
```yaml
  sandbox:
    build:
      context: ./docker/sandbox
      dockerfile: Dockerfile
```
改为：
```yaml
  sandbox:
    build:
      context: .
      dockerfile: docker/sandbox.Dockerfile
```

- [ ] **Step 2: 验证 YAML 语法**

```bash
docker compose config --quiet 2>&1 | head -20
```

Expected: 无错误输出（或只有警告）

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "fix: update sandbox build context to project root in docker-compose.yml"
```

---

## Task 3: 更新 GitHub Actions workflows

**Files:**
- Modify: `.github/workflows/docker-publish.yml:233-244`
- Modify: `.github/workflows/release.yml:115-135` 和 `release.yml:259-270`

- [ ] **Step 1: 更新 `docker-publish.yml` 中的 sandbox 构建步骤**

找到以下内容（约第237-238行）：
```yaml
          context: ./docker/sandbox
          file: ./docker/sandbox/Dockerfile
```
改为：
```yaml
          context: .
          file: ./docker/sandbox.Dockerfile
```

- [ ] **Step 2: 更新 `release.yml` 中的 tar 打包列表**

找到（约第135行）：
```yaml
            docker/sandbox/
```
改为（分两行，包含 sandbox.Dockerfile 和 sandbox-runner 相关文件）：
```yaml
            docker/sandbox.Dockerfile \
            docker/sandbox-runner.Dockerfile \
            docker/sandbox-runner.requirements.txt \
```

注意：`docker/sandbox-runner.Dockerfile` 和 `docker/sandbox-runner.requirements.txt` 如果原来没有在打包列表中，也一并加入（与其他 runner 保持一致）。

- [ ] **Step 3: 更新 `release.yml` 中的 sandbox 镜像构建步骤**

找到（约第262-263行）：
```yaml
          context: ./docker/sandbox
          file: ./docker/sandbox/Dockerfile
```
改为：
```yaml
          context: .
          file: ./docker/sandbox.Dockerfile
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/docker-publish.yml .github/workflows/release.yml
git commit -m "fix: update sandbox build context paths in GitHub Actions workflows"
```

---

## Task 4: 更新脚本和后端代码引用

**Files:**
- Modify: `scripts/setup_security_tools.sh:620-638`
- Modify: `backend/app/services/agent/tools/sandbox_tool.py:167`
- Modify: `docker/env/backend/env.example:164`

- [ ] **Step 1: 更新 `setup_security_tools.sh`**

找到（约第621-638行）：
```bash
    local sandbox_dir="$PROJECT_ROOT/docker/sandbox"
    local dockerfile="$sandbox_dir/Dockerfile"

    if [[ ! -f "$dockerfile" ]]; then
        log_warning "沙盒 Dockerfile 不存在，创建默认配置..."
        mkdir -p "$sandbox_dir"
        create_sandbox_dockerfile "$sandbox_dir"
    fi

    log_info "构建 VulHunter 沙盒镜像..."

    cd "$sandbox_dir"

    # 带重试的构建
    for attempt in $(seq 1 $MAX_RETRIES); do
        log_info "构建镜像 (尝试 $attempt/$MAX_RETRIES)..."

        if docker build -t VulHunter-sandbox:latest -f Dockerfile . 2>&1; then
```

改为：
```bash
    local dockerfile="$PROJECT_ROOT/docker/sandbox.Dockerfile"

    if [[ ! -f "$dockerfile" ]]; then
        log_warning "沙盒 Dockerfile 不存在: ${dockerfile}"
        return 1
    fi

    log_info "构建 VulHunter 沙盒镜像..."

    cd "$PROJECT_ROOT"

    # 带重试的构建
    for attempt in $(seq 1 $MAX_RETRIES); do
        log_info "构建镜像 (尝试 $attempt/$MAX_RETRIES)..."

        if docker build -t VulHunter-sandbox:latest -f docker/sandbox.Dockerfile . 2>&1; then
```

- [ ] **Step 2: 更新 `sandbox_tool.py` 中的 build_hint**

找到（约第167行）：
```python
        build_hint = "cd docker/sandbox && docker build -t vulhunter/sandbox:latest ."
```
改为：
```python
        build_hint = "docker build -f docker/sandbox.Dockerfile -t vulhunter/sandbox:latest ."
```

- [ ] **Step 3: 更新 `env.example` 注释**

找到（约第164行）：
```
# 构建方式 2: cd docker/sandbox && ./build.sh
```
改为：
```
# 构建方式 2: docker build -f docker/sandbox.Dockerfile -t vulhunter/sandbox:latest .
```

- [ ] **Step 4: Commit**

```bash
git add scripts/setup_security_tools.sh \
        backend/app/services/agent/tools/sandbox_tool.py \
        docker/env/backend/env.example
git commit -m "fix: update sandbox path references in scripts and backend code"
```

---

## Task 5: 删除 `docker/sandbox/` 子文件夹

**Files:**
- Delete: `docker/sandbox/Dockerfile`
- Delete: `docker/sandbox/build.sh`
- Delete: `docker/sandbox/build.bat`
- Delete: `docker/sandbox/build.ps1`
- Delete: `docker/sandbox/build-runner.sh`
- Delete: `docker/sandbox/test-runner.sh`
- Delete: `docker/sandbox/README.md`
- Delete: `docker/sandbox/seccomp.json`
- Delete: `docker/sandbox/runtime/opengrep_launcher.py`

- [ ] **Step 1: 删除整个 sandbox 子文件夹**

```bash
git rm -r docker/sandbox/
```

- [ ] **Step 2: 验证删除结果**

```bash
ls docker/ | sort
```

Expected: 不再有 `sandbox/` 目录，但应有 `sandbox.Dockerfile` 和 `sandbox-runner.Dockerfile`

- [ ] **Step 3: 验证 docker-compose 配置仍可解析**

```bash
docker compose config --quiet 2>&1 | head -5
```

Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor: remove docker/sandbox/ subfolder, align with runner container layout"
```

---

## 验证检查清单

完成所有任务后执行：

```bash
# 1. 确认 sandbox.Dockerfile 存在且 sandbox/ 子目录已消失
ls docker/*.Dockerfile | sort
ls docker/ | grep -E "^sandbox$" && echo "FAIL: sandbox/ dir still exists" || echo "OK: sandbox/ removed"

# 2. 确认新 Dockerfile 不含扫描引擎
grep -E "opengrep|gitleaks|pmd|trufflehog|phpstan|golang|rustup" docker/sandbox.Dockerfile \
  && echo "FAIL" || echo "OK: no scan engines in sandbox.Dockerfile"

# 3. 确认 docker-compose.yml 使用新路径
grep -A5 "sandbox:" docker-compose.yml | grep -E "context|dockerfile"

# 4. 确认 GitHub Actions 已更新（不再有 docker/sandbox/ 路径）
grep "docker/sandbox/" .github/workflows/docker-publish.yml && echo "FAIL" || echo "OK"
grep "docker/sandbox/" .github/workflows/release.yml && echo "FAIL" || echo "OK"

# 5. 确认后端引用已更新
grep "build_hint" backend/app/services/agent/tools/sandbox_tool.py
```

Expected:
```
docker/sandbox-runner.Dockerfile
docker/sandbox.Dockerfile
OK: sandbox/ removed
OK: no scan engines in sandbox.Dockerfile
context: .
dockerfile: docker/sandbox.Dockerfile
OK (no old paths in workflows)
OK (no old paths in workflows)
build_hint = "docker build -f docker/sandbox.Dockerfile ..."
```
