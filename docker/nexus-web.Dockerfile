# syntax=docker/dockerfile:1.7
# ──────────────────────────────────────────────────────────────────────────────
# nexus-web runtime image
#
# 源码来自 git submodule：nexus-web/（指向 https://github.com/happytraveller-alone/nexus-web）
# 构建 context 为仓库根目录，以统一 CI 缓存规则，与 backend/frontend Dockerfile 保持一致。
# 上游 Dockerfile 本身亦可直接使用，本文件仅做最小适配（路径前缀 nexus-web/）。
#
# 本镜像对外暴露端口 5174，nginx 配置内联，不依赖任何外部 nginx.conf。
# ──────────────────────────────────────────────────────────────────────────────
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder
WORKDIR /app
COPY nexus-web/package.json nexus-web/pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@10 --activate
RUN pnpm install --frozen-lockfile
COPY nexus-web/ ./
RUN pnpm build

FROM nginx:1.27-alpine AS runtime
RUN set -eux; \
    rm -rf /usr/share/nginx/html/*; \
    rm -f /etc/nginx/conf.d/default.conf; \
    mkdir -p /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp; \
    chown -R nginx:nginx /usr/share/nginx/html /tmp /var/cache/nginx

COPY --from=builder --chown=nginx:nginx /app/dist/ /usr/share/nginx/html/

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
