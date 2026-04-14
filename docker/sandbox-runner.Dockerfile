# VulHunter Sandbox Runner
# 统一的安全代码执行环境，用于漏洞验证和 PoC 运行

ARG DOCKERHUB_LIBRARY_MIRROR=docker.m.daocloud.io/library
ARG SANDBOX_RUNNER_BASE_IMAGE=docker.m.daocloud.io/python:3.11-slim
FROM ${DOCKERHUB_LIBRARY_MIRROR}/node:22-slim AS nodebase
FROM ${SANDBOX_RUNNER_BASE_IMAGE}

ARG SANDBOX_RUNNER_APT_MIRROR_PRIMARY=mirrors.aliyun.com
ARG SANDBOX_RUNNER_APT_SECURITY_PRIMARY=mirrors.aliyun.com
ARG SANDBOX_RUNNER_APT_MIRROR_FALLBACK=deb.debian.org
ARG SANDBOX_RUNNER_APT_SECURITY_FALLBACK=security.debian.org
ARG SANDBOX_RUNNER_PYPI_INDEX_PRIMARY=https://mirrors.aliyun.com/pypi/simple/
ARG SANDBOX_RUNNER_PYPI_INDEX_FALLBACK=https://pypi.org/simple
ARG SANDBOX_RUNNER_NPM_REGISTRY_PRIMARY=https://registry.npmmirror.com
ARG SANDBOX_RUNNER_NPM_REGISTRY_FALLBACK=https://registry.npmjs.org

LABEL maintainer="VulHunter Team"
LABEL description="Sandboxed code execution environment for PoC verification (Python-focused)"

ENV PIP_INDEX_URL=${SANDBOX_RUNNER_PYPI_INDEX_PRIMARY}
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

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
  } > /etc/apt/apt.conf.d/99-sandbox-runner-network; \
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
  write_sources "${SANDBOX_RUNNER_APT_MIRROR_PRIMARY}" "${SANDBOX_RUNNER_APT_SECURITY_PRIMARY}"; \
  if ! install_runtime_packages; then \
  rm -rf /var/lib/apt/lists/*; \
  write_sources "${SANDBOX_RUNNER_APT_MIRROR_FALLBACK}" "${SANDBOX_RUNNER_APT_SECURITY_FALLBACK}"; \
  install_runtime_packages; \
  fi; \
  rm -rf /var/lib/apt/lists/*

COPY --from=nodebase /usr/local/bin/node /usr/local/bin/node
COPY --from=nodebase /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN set -eux; \
  ln -sf /usr/local/bin/node /usr/local/bin/nodejs; \
  ln -sf ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm; \
  ln -sf ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx; \
  npm config set registry "${SANDBOX_RUNNER_NPM_REGISTRY_PRIMARY}"; \
  node --version; npm --version

RUN --mount=type=cache,id=VulHunter-sandbox-runner-pip,target=/root/.cache/pip \
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
  pip_install_with_index "${SANDBOX_RUNNER_PYPI_INDEX_PRIMARY}" || pip_install_with_index "${SANDBOX_RUNNER_PYPI_INDEX_FALLBACK}"

RUN groupadd -g 1000 sandbox && \
  useradd -u 1000 -g sandbox -m -s /bin/bash sandbox

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
