# CodeBadger MCP service container (Streamable HTTP at /mcp).
#
# We vendor CodeBadger at build time by downloading a tagged source tarball.
# This avoids needing git in the build environment and makes the version explicit.

FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Pinned CodeBadger version (update consciously).
ARG CODEBADGER_VERSION=v0.3.5-beta

RUN curl -fsSL "https://github.com/Lekssays/codebadger/archive/refs/tags/${CODEBADGER_VERSION}.tar.gz" \
    | tar -xz --strip-components=1

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 4242

CMD ["python", "main.py"]

