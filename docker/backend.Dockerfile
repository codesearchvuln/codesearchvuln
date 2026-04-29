# ============================================
# 多阶段构建 - 构建阶段
# ============================================
ARG DOCKERHUB_LIBRARY_MIRROR=docker.m.daocloud.io/library
ARG UV_IMAGE=ghcr.io/astral-sh/uv:latest
ARG BACKEND_APT_MIRROR_PRIMARY=mirrors.aliyun.com
ARG BACKEND_APT_SECURITY_PRIMARY=mirrors.aliyun.com
ARG BACKEND_APT_MIRROR_FALLBACK=deb.debian.org
ARG BACKEND_APT_SECURITY_FALLBACK=security.debian.org
ARG BACKEND_PYPI_INDEX_PRIMARY=https://mirrors.aliyun.com/pypi/simple/
ARG BACKEND_PYPI_INDEX_FALLBACK=https://pypi.org/simple
ARG BACKEND_PYPI_INDEX_CANDIDATES=https://mirrors.aliyun.com/pypi/simple/,https://pypi.tuna.tsinghua.edu.cn/simple,https://pypi.mirrors.ustc.edu.cn/simple/,https://mirrors.cloud.tencent.com/pypi/simple/,https://mirrors.huaweicloud.com/repository/pypi/simple/,https://mirrors.bfsu.edu.cn/pypi/web/simple/,https://pypi.org/simple
ARG BACKEND_INSTALL_CJK_FONTS=1
ARG DOCKER_CLI_IMAGE=${DOCKERHUB_LIBRARY_MIRROR}/docker:cli
# CONTAINER_CLI_PROVIDER: 容器 CLI 提供方
#   docker (默认) — 仅使用 Docker CLI；配合 DOCKER_HOST 可透明路由到 Podman socket
#   podman — 额外安装 podman-remote，使 runner_preflight 可调用 podman build
ARG CONTAINER_CLI_PROVIDER=docker
FROM ${UV_IMAGE} AS uvbin
FROM ${DOCKER_CLI_IMAGE} AS docker-cli-src
FROM ${DOCKERHUB_LIBRARY_MIRROR}/python:3.11-slim AS python-base
FROM python-base AS builder

WORKDIR /app
ARG BACKEND_APT_MIRROR_PRIMARY
ARG BACKEND_APT_SECURITY_PRIMARY
ARG BACKEND_APT_MIRROR_FALLBACK
ARG BACKEND_APT_SECURITY_FALLBACK
ARG BACKEND_PYPI_INDEX_PRIMARY
ARG BACKEND_PYPI_INDEX_FALLBACK
ARG BACKEND_PYPI_INDEX_CANDIDATES

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV BACKEND_VENV_PATH=/opt/backend-venv

# 彻底清除代理设置
ENV http_proxy=""
ENV https_proxy=""
ENV HTTP_PROXY=""
ENV HTTPS_PROXY=""
ENV all_proxy=""
ENV ALL_PROXY=""
ENV no_proxy="*"
ENV NO_PROXY="*"

RUN --mount=type=cache,id=vulhunter-backend-builder-apt-lists,target=/var/lib/apt/lists,sharing=locked \
  --mount=type=cache,id=vulhunter-backend-builder-apt-cache,target=/var/cache/apt,sharing=locked \
  set -eux; \
  rm -f /etc/apt/apt.conf.d/proxy.conf 2>/dev/null || true; \
  { \
  echo 'Acquire::http::Proxy "false";'; \
  echo 'Acquire::https::Proxy "false";'; \
  echo 'Acquire::Retries "5";'; \
  echo 'Acquire::http::Timeout "60";'; \
  } > /etc/apt/apt.conf.d/99-no-proxy; \
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
  install_builder_packages() { \
  apt-get update && \
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  gcc \
  libc6-dev \
  libpq-dev \
  libffi-dev; \
  }; \
  write_sources "${BACKEND_APT_MIRROR_PRIMARY}" "${BACKEND_APT_SECURITY_PRIMARY}"; \
  if ! install_builder_packages; then \
  rm -rf /var/lib/apt/lists/*; \
  write_sources "${BACKEND_APT_MIRROR_FALLBACK}" "${BACKEND_APT_SECURITY_FALLBACK}"; \
  install_builder_packages; \
  fi; \
  rm -rf /var/lib/apt/lists/*

# 安装 uv
COPY --from=uvbin /uv /usr/local/bin/uv

# 配置 uv/pip 镜像（主源 + 回退）
ENV UV_INDEX_URL=${BACKEND_PYPI_INDEX_PRIMARY}
ENV PIP_INDEX_URL=${BACKEND_PYPI_INDEX_PRIMARY}

# 镜像源测速脚本（最先复制，几乎不会变化）
COPY backend/scripts/package_source_selector.py /usr/local/bin/package_source_selector.py

# ── 重量级依赖预安装层 ───────────────────────────────────────────────────────────
# requirements-heavy.txt 的变更频率远低于 uv.lock：
#   - 仅升级轻量工具包 → 此层 Docker 缓存命中，uv sync 只安装少量剩余包
#   - 升级 heavy 包版本 → 此层失效，但依然受益于 uv wheel 缓存
# 注意：此文件中的版本号必须与 uv.lock 保持一致。
COPY backend/requirements-heavy.txt ./requirements-heavy.txt

RUN --mount=type=cache,id=vulhunter-backend-uv-cache,target=/root/.cache/uv \
  set -eux; \
  uv_http_timeout=45; \
  step_timeout=300; \
  pypi_index_candidates="${BACKEND_PYPI_INDEX_CANDIDATES:-https://mirrors.aliyun.com/pypi/simple/,https://pypi.tuna.tsinghua.edu.cn/simple,https://pypi.mirrors.ustc.edu.cn/simple/,https://mirrors.cloud.tencent.com/pypi/simple/,https://mirrors.huaweicloud.com/repository/pypi/simple/,https://pypi.org/simple}"; \
  best_index="${BACKEND_PYPI_INDEX_PRIMARY:-https://mirrors.aliyun.com/pypi/simple/}"; \
  ordered="$(python3 /usr/local/bin/package_source_selector.py \
  --candidates "${pypi_index_candidates}" --kind pypi --timeout-seconds 2 2>/dev/null || true)"; \
  if [ -n "${ordered}" ]; then \
  first="$(printf '%s\n' "${ordered}" | head -1)"; \
  [ -z "${first}" ] || best_index="${first}"; \
  fi; \
  printf '%s\n' "${best_index}" > /tmp/pypi-best-index; \
  echo "Selected PyPI index: ${best_index}"; \
  uv venv "${BACKEND_VENV_PATH}"; \
  install_heavy() { \
  idx="$1"; attempt=1; \
  while [ "${attempt}" -le 2 ]; do \
  echo "uv pip install heavy deps via ${idx} (attempt ${attempt}/2)"; \
  if timeout "${step_timeout}" env \
  VIRTUAL_ENV="${BACKEND_VENV_PATH}" PATH="${BACKEND_VENV_PATH}/bin:${PATH}" \
  UV_INDEX_URL="${idx}" UV_HTTP_TIMEOUT="${uv_http_timeout}" \
  UV_CONCURRENT_DOWNLOADS=50 UV_CONCURRENT_INSTALLS=8 \
  uv pip install --no-deps --index-url "${idx}" -r requirements-heavy.txt; then \
  return 0; \
  fi; \
  sleep $((attempt + 1)); attempt=$((attempt + 1)); \
  done; return 1; \
  }; \
  if install_heavy "${best_index}"; then \
  exit 0; \
  fi; \
  OLD_IFS="${IFS}"; IFS=','; set -- ${pypi_index_candidates}; IFS="${OLD_IFS}"; \
  for idx in "$@"; do \
  stripped="$(printf '%s' "${idx}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"; \
  [ -n "${stripped}" ] && [ "${stripped}" != "${best_index}" ] || continue; \
  if install_heavy "${stripped}"; then \
  printf '%s\n' "${stripped}" > /tmp/pypi-best-index; \
  exit 0; \
  fi; \
  done; \
  echo "ERROR: Failed to install heavy packages from all mirrors" >&2; exit 1

# ── 完整依赖同步层（基于 uv.lock 精确锁定）────────────────────────────────────────
# 重量级包已在 venv 中，uv sync 直接跳过它们，仅安装剩余轻量级包，速度显著提升。
COPY backend/pyproject.toml backend/uv.lock backend/README.md ./

RUN --mount=type=cache,id=vulhunter-backend-uv-cache,target=/root/.cache/uv \
  set -eux; \
  uv_step_timeout=240; \
  uv_http_timeout=45; \
  if [ -f /tmp/pypi-best-index ] && [ -s /tmp/pypi-best-index ]; then \
  best_index="$(cat /tmp/pypi-best-index)"; \
  else \
  best_index="${BACKEND_PYPI_INDEX_PRIMARY:-https://mirrors.aliyun.com/pypi/simple/}"; \
  fi; \
  pypi_index_candidates="${BACKEND_PYPI_INDEX_CANDIDATES:-https://mirrors.aliyun.com/pypi/simple/,https://pypi.tuna.tsinghua.edu.cn/simple,https://pypi.mirrors.ustc.edu.cn/simple/,https://mirrors.cloud.tencent.com/pypi/simple/,https://mirrors.huaweicloud.com/repository/pypi/simple/,https://pypi.org/simple}"; \
  sync_with_index() { \
  idx="$1"; attempt=1; \
  while [ "${attempt}" -le 2 ]; do \
  echo "uv sync via ${idx} (attempt ${attempt}/2, timeout ${uv_step_timeout}s)"; \
  if timeout "${uv_step_timeout}" env \
  VIRTUAL_ENV="${BACKEND_VENV_PATH}" PATH="${BACKEND_VENV_PATH}/bin:${PATH}" \
  UV_HTTP_TIMEOUT="${uv_http_timeout}" UV_INDEX_URL="${idx}" PIP_INDEX_URL="${idx}" \
  UV_CONCURRENT_DOWNLOADS=50 UV_CONCURRENT_INSTALLS=8 \
  uv sync --active --frozen --no-dev; then \
  return 0; \
  else \
  status="$?"; \
  fi; \
  if [ "${status}" -eq 124 ]; then \
  echo "uv sync timed out via ${idx} after ${uv_step_timeout}s (attempt ${attempt}/2)." >&2; \
  else \
  echo "uv sync failed via ${idx} (attempt ${attempt}/2, exit ${status})." >&2; \
  fi; \
  sleep $((attempt + 1)); attempt=$((attempt + 1)); \
  done; return 1; \
  }; \
  echo "uv sync using index: ${best_index}"; \
  if sync_with_index "${best_index}"; then \
  printf 'ready\n' > /tmp/builder-network-ready; exit 0; \
  fi; \
  OLD_IFS="${IFS}"; IFS=','; set -- ${pypi_index_candidates}; IFS="${OLD_IFS}"; \
  for idx in "$@"; do \
  stripped="$(printf '%s' "${idx}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"; \
  [ -n "${stripped}" ] && [ "${stripped}" != "${best_index}" ] || continue; \
  if sync_with_index "${stripped}"; then \
  printf 'ready\n' > /tmp/builder-network-ready; exit 0; \
  fi; \
  done; \
  echo "ERROR: uv sync failed on all mirrors" >&2; exit 1

# ============================================
# 多阶段构建 - 运行时基础阶段
# ============================================
FROM python-base AS runtime-base

WORKDIR /app
ARG BACKEND_APT_MIRROR_PRIMARY
ARG BACKEND_APT_SECURITY_PRIMARY
ARG BACKEND_APT_MIRROR_FALLBACK
ARG BACKEND_APT_SECURITY_FALLBACK
ARG BACKEND_PYPI_INDEX_PRIMARY
ARG BACKEND_PYPI_INDEX_FALLBACK
ARG BACKEND_PYPI_INDEX_CANDIDATES
ARG CONTAINER_CLI_PROVIDER=docker

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV BACKEND_VENV_PATH=/opt/backend-venv

# 彻底清除代理设置
ENV http_proxy=""
ENV https_proxy=""
ENV HTTP_PROXY=""
ENV HTTPS_PROXY=""
ENV all_proxy=""
ENV ALL_PROXY=""
ENV no_proxy="*"
ENV NO_PROXY="*"
ENV UV_INDEX_URL=${BACKEND_PYPI_INDEX_PRIMARY}
ENV PIP_INDEX_URL=${BACKEND_PYPI_INDEX_PRIMARY}
ENV PYPI_INDEX_CANDIDATES=${BACKEND_PYPI_INDEX_CANDIDATES}


# 只安装运行时依赖（不需要 gcc）；CJK 字体可通过 BACKEND_INSTALL_CJK_FONTS 控制
ARG BACKEND_INSTALL_CJK_FONTS
RUN --mount=type=cache,id=vulhunter-backend-runtime-apt-lists,target=/var/lib/apt/lists,sharing=locked \
  --mount=type=cache,id=vulhunter-backend-runtime-apt-cache,target=/var/cache/apt,sharing=locked \
  set -eux; \
  rm -f /etc/apt/apt.conf.d/proxy.conf 2>/dev/null || true; \
  { \
  echo 'Acquire::http::Proxy "false";'; \
  echo 'Acquire::https::Proxy "false";'; \
  echo 'Acquire::Retries "5";'; \
  echo 'Acquire::http::Timeout "60";'; \
  } > /etc/apt/apt.conf.d/99-no-proxy; \
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
  RUNTIME_PACKAGES=" \
  libpq5 \
  git \
  libpango-1.0-0 \
  libpangoft2-1.0-0 \
  libpangocairo-1.0-0 \
  libcairo2 \
  libgdk-pixbuf-2.0-0 \
  libglib2.0-0 \
  shared-mime-info \
  ripgrep"; \
  if [ "${BACKEND_INSTALL_CJK_FONTS}" = "1" ]; then \
  RUNTIME_PACKAGES="${RUNTIME_PACKAGES} fonts-noto-cjk"; \
  fi; \
  install_runtime_packages() { \
  apt-get update && \
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ${RUNTIME_PACKAGES}; \
  }; \
  write_sources "${BACKEND_APT_MIRROR_PRIMARY}" "${BACKEND_APT_SECURITY_PRIMARY}"; \
  if ! install_runtime_packages; then \
  rm -rf /var/lib/apt/lists/*; \
  write_sources "${BACKEND_APT_MIRROR_FALLBACK}" "${BACKEND_APT_SECURITY_FALLBACK}"; \
  install_runtime_packages; \
  fi; \
  if [ "${BACKEND_INSTALL_CJK_FONTS}" = "1" ]; then \
  fc-cache -fv; \
  fi; \
  rm -rf /var/lib/apt/lists/*

# 复制 docker CLI 及 buildx 插件，供 runner_preflight 以 subprocess 方式执行 docker build
# buildx 是 Docker 23+ 执行 BuildKit 构建的必要插件（--mount=type=cache 等特性依赖它）
COPY --from=docker-cli-src /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker-cli-src /usr/local/libexec/docker/cli-plugins/docker-buildx /usr/local/libexec/docker/cli-plugins/docker-buildx

# Podman 支持：当 CONTAINER_CLI_PROVIDER=podman 时安装 podman-remote 并建立软链接
# podman-remote 是无守护进程的 podman 客户端，连接宿主机 Podman socket 执行 podman build
# 若使用默认的 docker（CONTAINER_CLI_PROVIDER=docker），此步骤跳过，不增加镜像体积
RUN --mount=type=cache,id=vulhunter-backend-runtime-apt-lists,target=/var/lib/apt/lists,sharing=locked \
  --mount=type=cache,id=vulhunter-backend-runtime-apt-cache,target=/var/cache/apt,sharing=locked \
  if [ "${CONTAINER_CLI_PROVIDER}" = "podman" ]; then \
  set -eux; \
  apt-get update && \
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends podman-remote && \
  ln -sf /usr/bin/podman-remote /usr/local/bin/podman; \
  fi


# ============================================
# 多阶段构建 - 运行阶段
# ============================================
FROM runtime-base AS dev-runtime

ARG VCS_REF=""
LABEL org.opencontainers.image.revision="${VCS_REF}"

COPY --from=builder /usr/local/bin/uv /usr/local/bin/uv

RUN set -eux; \
  for site_packages_dir in $(python3 -c 'import site; [print(path) for path in site.getsitepackages() if "site-packages" in path]'); do \
  find "${site_packages_dir}" -mindepth 1 -maxdepth 1 -exec rm -rf {} +; \
  done; \
  rm -rf /root/.cache/pip; \
  rm -f /usr/local/bin/pip /usr/local/bin/pip3 /usr/local/bin/pip3.11

ENV VIRTUAL_ENV=/opt/backend-venv
ENV PATH=/opt/backend-venv/bin:${PATH}
ENV PYTHONNOUSERSITE=1

RUN mkdir -p /app /opt/backend-venv /root/.cache/uv /app/uploads/zip_files /app/data/runtime

EXPOSE 8000

CMD ["python3", "-m", "app.runtime.container_startup", "dev"]

# ============================================================
# runtime: 平衡型生产 target
# 保留轻量混淆（legacy .pyc）+ 非 root 运行
# 作为可选生产 target 保留，不参与默认 release 发布链
# ============================================================
FROM runtime-base AS runtime

ARG VCS_REF=""
LABEL org.opencontainers.image.revision="${VCS_REF}"

COPY --from=builder /opt/backend-venv /opt/backend-venv

RUN set -eux; \
  for site_packages_dir in $(python3 -c 'import site; [print(path) for path in site.getsitepackages() if "site-packages" in path]'); do \
  find "${site_packages_dir}" -mindepth 1 -maxdepth 1 -exec rm -rf {} +; \
  done; \
  rm -rf /root/.cache/pip; \
  rm -f /usr/local/bin/pip /usr/local/bin/pip3 /usr/local/bin/pip3.11

ENV VIRTUAL_ENV=/opt/backend-venv
ENV PATH=/opt/backend-venv/bin:${PATH}
ENV PYTHONNOUSERSITE=1

ENV XDG_DATA_HOME=/app/data/runtime/xdg-data
ENV XDG_CACHE_HOME=/app/data/runtime/xdg-cache
ENV XDG_CONFIG_HOME=/app/data/runtime/xdg-config
RUN mkdir -p /app/data/runtime/xdg-data /app/data/runtime/xdg-cache /app/data/runtime/xdg-config

COPY backend/app /app/app
RUN find /app/app -name "*.c" -delete 2>/dev/null || true
COPY backend/alembic /app/alembic
COPY backend/alembic.ini /app/alembic.ini
COPY backend/scripts/reset_static_scan_tables.py /app/scripts/reset_static_scan_tables.py

RUN mkdir -p \
  /app/uploads/zip_files \
  /app/data/runtime \
  /app/data/runtime/xdg-config

# 默认 target 只对少量高价值入口做轻量混淆，避免额外构建复杂度。
RUN set -eux; \
  BYTECODE_TARGETS="\
  /app/app/main.py \
  /app/app/runtime/container_startup.py \
  /app/app/runtime/launchers/yasa_uast4py_launcher.py \
  /app/app/runtime/launchers/opengrep_launcher.py \
  /app/app/runtime/launchers/phpstan_launcher.py \
  /app/app/runtime/launchers/yasa_engine_launcher.py \
  /app/app/runtime/launchers/yasa_launcher.py \
  /app/app/api/v1/endpoints/agent_tasks_reporting.py"; \
  TARGET_COUNT=0; \
  for src in ${BYTECODE_TARGETS}; do \
  test -f "${src}"; \
  /opt/backend-venv/bin/python -m compileall -q -b "${src}"; \
  test -f "${src}c"; \
  rm -f "${src}"; \
  TARGET_COUNT=$((TARGET_COUNT + 1)); \
  echo "[Bytecode] protected: ${src#/app/}"; \
  done; \
  PY_REMAINING=$(find /app/app -name "*.py" ! -name "__init__.py" | wc -l); \
  echo "[Bytecode] 受保护文件数: ${TARGET_COUNT}"; \
  echo "[Bytecode] 剩余源码文件数（白名单外保留）: ${PY_REMAINING}"; \
  test -f /app/app/main.pyc || \
  { echo "ERROR: main.pyc 未生成" >&2; exit 1; }; \
  test -f /app/app/runtime/container_startup.pyc || \
  { echo "ERROR: container_startup.pyc 未生成" >&2; exit 1; }; \
  echo "[Bytecode] 关键 legacy .pyc 验证通过"

RUN groupadd --gid 1001 appgroup && \
  useradd --uid 1001 --gid appgroup \
  --no-create-home --shell /usr/sbin/nologin appuser && \
  chown -R appuser:appgroup \
  /app \
  /opt/backend-venv

USER appuser

EXPOSE 8000

RUN /opt/backend-venv/bin/python - <<'PYEOF'
import importlib.util
pyc_mods = [
    'app.main',
    'app.runtime.container_startup',
    'app.api.v1.endpoints.agent_tasks_reporting',
]
for mod_name in pyc_mods:
    spec = importlib.util.find_spec(mod_name)
    assert spec is not None, 'Module ' + mod_name + ' not found'
    assert spec.origin.endswith('.pyc'), 'Expected .pyc for ' + mod_name + ', got ' + spec.origin
    print('[Bytecode] ' + mod_name + ': OK (' + spec.origin.split('/')[-1] + ')')
source_mods = ['app.core.config', 'app.db.session']
for mod_name in source_mods:
    spec = importlib.util.find_spec(mod_name)
    assert spec is not None, 'Module ' + mod_name + ' not found'
    assert spec.origin.endswith('.py'), 'Expected .py for ' + mod_name + ', got ' + spec.origin
    print('[Source] ' + mod_name + ': OK (' + spec.origin.split('/')[-1] + ')')
print('[Runtime] Balanced obfuscation verifications PASSED')
PYEOF

CMD ["python3", "-m", "app.runtime.container_startup", "prod"]

# ============================================================
# runtime-plain: 默认 release backend target
# 直接使用 Python 源码，保持 release 路径简单稳定
# ============================================================
FROM runtime-base AS runtime-plain

ARG VCS_REF=""
LABEL org.opencontainers.image.revision="${VCS_REF}"

COPY --from=builder /opt/backend-venv /opt/backend-venv

RUN set -eux; \
  for site_packages_dir in $(python3 -c 'import site; [print(path) for path in site.getsitepackages() if "site-packages" in path]'); do \
  find "${site_packages_dir}" -mindepth 1 -maxdepth 1 -exec rm -rf {} +; \
  done; \
  rm -rf /root/.cache/pip; \
  rm -f /usr/local/bin/pip /usr/local/bin/pip3 /usr/local/bin/pip3.11

ENV VIRTUAL_ENV=/opt/backend-venv
ENV PATH=/opt/backend-venv/bin:${PATH}
ENV PYTHONNOUSERSITE=1

# Runtime 持久化目录
ENV XDG_DATA_HOME=/app/data/runtime/xdg-data
ENV XDG_CACHE_HOME=/app/data/runtime/xdg-cache
ENV XDG_CONFIG_HOME=/app/data/runtime/xdg-config
RUN mkdir -p /app/data/runtime/xdg-data /app/data/runtime/xdg-cache /app/data/runtime/xdg-config

# 直接复制 Python 源码
COPY backend/app /app/app
COPY backend/alembic /app/alembic
COPY backend/alembic.ini /app/alembic.ini
COPY backend/scripts/reset_static_scan_tables.py /app/scripts/reset_static_scan_tables.py

RUN mkdir -p \
  /app/uploads/zip_files \
  /app/data/runtime \
  /app/data/runtime/xdg-config

RUN groupadd --gid 1001 appgroup && \
  useradd --uid 1001 --gid appgroup \
  --no-create-home --shell /usr/sbin/nologin appuser && \
  chown -R appuser:appgroup \
  /app \
  /opt/backend-venv

USER appuser

EXPOSE 8000

RUN /opt/backend-venv/bin/python - <<'PYEOF'
import importlib.util
source_mods = [
    'app.main',
    'app.runtime.container_startup',
    'app.core.config',
    'app.db.session',
]
for mod_name in source_mods:
    spec = importlib.util.find_spec(mod_name)
    assert spec is not None, 'Module ' + mod_name + ' not found'
    assert spec.origin.endswith('.py'), 'Expected .py for ' + mod_name + ', got ' + spec.origin
    print('[RuntimePlain][Source] ' + mod_name + ': OK (' + spec.origin.split('/')[-1] + ')')
print('[RuntimePlain] source runtime verifications PASSED')
PYEOF

CMD ["python3", "-m", "app.runtime.container_startup", "prod"]
