# CodeBadger Joern server container.
#
# This image bundles:
# - Joern CLI + server (downloaded release tarball)
# - Python3 (used by /playground/build_cpg.py invoked via docker exec)
#
# It stays idle by default; CodeBadger MCP will docker-exec into it to:
# - Generate CPGs into /playground/cpgs/<hash>/
# - Start/stop Joern server instances on ports 2000-2999

FROM openjdk:11-slim

WORKDIR /

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    curl \
    unzip \
    python3 \
    python3-pip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Pin Joern version for reproducibility (matches CodeBadger default).
ENV JOERN_VERSION=4.0.478

RUN wget "https://github.com/joernio/joern/releases/download/v${JOERN_VERSION}/joern-install.sh" -O joern-install.sh && \
    chmod +x joern-install.sh && \
    ./joern-install.sh --version "${JOERN_VERSION}" --install-dir /opt/joern && \
    rm joern-install.sh

ENV PATH="/opt/joern/joern-cli:${PATH}"

WORKDIR /playground

CMD ["sh", "-c", "tail -f /dev/null"]

