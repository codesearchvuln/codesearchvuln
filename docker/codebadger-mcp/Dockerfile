# CodeBadger MCP service container (Streamable HTTP at /mcp).
#
# We vendor CodeBadger at build time by downloading a tagged source tarball.
# This avoids needing git in the build environment and makes the version explicit.

FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV UV_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/
ENV PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/
ENV PIP_TRUSTED_HOST=mirrors.aliyun.com

RUN set -eux; \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
        sed -ri 's|https?://deb.debian.org|https://mirrors.aliyun.com|g; s|https?://security.debian.org|https://mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources; \
    fi; \
    if [ -f /etc/apt/sources.list ]; then \
        sed -ri 's|https?://deb.debian.org|https://mirrors.aliyun.com|g; s|https?://security.debian.org|https://mirrors.aliyun.com|g' /etc/apt/sources.list; \
    fi; \
    apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Pinned CodeBadger version (update consciously).
ARG CODEBADGER_VERSION=v0.3.5-beta
ARG GIT_MIRROR_PREFIX=https://ghfast.top

RUN set -eux; \
    ORIGIN_URL="https://github.com/Lekssays/codebadger/archive/refs/tags/${CODEBADGER_VERSION}.tar.gz"; \
    MIRROR_URL="${GIT_MIRROR_PREFIX%/}/${ORIGIN_URL}"; \
    if ! curl -fsSL "${MIRROR_URL}" | tar -xz --strip-components=1; then \
        curl -fsSL "${ORIGIN_URL}" | tar -xz --strip-components=1; \
    fi

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 4242

CMD ["python", "main.py"]
