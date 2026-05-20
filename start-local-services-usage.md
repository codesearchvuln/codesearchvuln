# `start-local-services.sh` 使用说明

本文列出仓库根目录下 `./start-local-services.sh` 当前支持的所有启动指令，以及每条指令的作用。

## 基本格式

```bash
./start-local-services.sh [mode] [options] [-- extra compose-up args]

# 默认启动指令
bash start-local-services.sh default
```

## 启动模式

| 指令 | 作用 |
| --- | --- |
| `default` | 默认模式。使用 `docker/docker-compose.yml + docker/docker-compose.hybrid.yml`，本地构建 `backend` 和 `frontend` 后启动。 |
| `remote` | `default` 的别名。 |
| `hybrid` | 混合模式。使用 `docker/docker-compose.yml + docker/docker-compose.hybrid.yml`，本地构建 `backend` 和 `frontend` 后启动。 |
| `mixed` | `hybrid` 的别名。 |
| `mix` | `hybrid` 的别名。 |
| `full` | 全量本地构建模式。使用 `docker/docker-compose.yml + docker/docker-compose.full.yml`，本地构建 `backend` 和 `frontend` 后启动。 |
| `all` | `full` 的别名。 |
| `local` | `full` 的别名。 |

## 可用参数

| 参数 | 作用 |
| --- | --- |
| `--mode <mode>` | 以参数形式指定模式，效果与直接写 `default` / `hybrid` / `full` 相同。 |
| `--dry-run` | 只打印将执行的命令，不真正执行。 |
| `--pull-only` | 只拉取依赖镜像，跳过构建和启动。 |
| `--build-only` | 只构建本地 `backend/frontend` 镜像，跳过启动。 |
| `--no-pull` | 跳过镜像拉取阶段。 |
| `--no-build` | 跳过本地镜像构建阶段。 |
| `--no-up` | 跳过服务启动阶段。 |
| `--no-preflight` | 关闭后端启动时的 runner/scanner 预检查。 |
| `-h` / `--help` | 打印帮助信息并退出。 |
| `--` | 后面的参数原样传给 `docker compose up`。 |

## 脚本实际执行的三个阶段

| 阶段 | 说明 |
| --- | --- |
| `pull db redis scan-workspace-init backend-uploads-init` | 只拉基础依赖镜像。 |
| `build backend frontend` | 只本地构建 `backend` 和 `frontend`。 |
| `up -d backend` / `up -d --no-deps frontend` | 启动核心服务，并让 `frontend` 不再自动带起其他依赖。 |

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `./start-local-services.sh` | 默认启动流程。 |
| `./start-local-services.sh default` | 显式使用默认模式。 |
| `./start-local-services.sh hybrid` | 显式使用混合模式。 |
| `./start-local-services.sh full` | 显式使用全量本地构建模式。 |
| `./start-local-services.sh --dry-run` | 查看完整执行计划，不实际启动。 |
| `./start-local-services.sh --build-only` | 只构建镜像，不启动服务。 |
| `./start-local-services.sh --pull-only` | 只拉镜像，不构建、不启动。 |
| `./start-local-services.sh --no-preflight` | 启动时不做 runner/scanner 预检查。 |
| `./start-local-services.sh hybrid -- --force-recreate` | 将 `--force-recreate` 原样传给 `docker compose up`。 |

## 说明

- 当前脚本不再提供 `nexus` 相关启动参数。
- 脚本默认只处理 `backend/frontend` 的本地构建和基础依赖镜像拉取。
- 如需更细的服务控制，可以使用 `--` 把参数透传给 `docker compose up`。
