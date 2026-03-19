# Node Dist Mirror Integration for pkg-fetch

## 1. 背景与目标
- backend/Dockerfile 的 `scanner-tools-base` 阶段需要 `pkg` 构建 YASA，当缺少缓存时会访问 `https://nodejs.org/dist/` 下载 Node v18.5.0 tarball 与 SHASUMS。
- Dockerfile 在下载前统一 `unset HTTP(S)_PROXY`，受限网络无法访问 nodejs.org，pkg-fetch 在第 2 次 `enableProgress` 调用时触发 `assert(!this.bar)` 并导致构建失败。
- 目标：引入可配置的 Node dist 镜像，复用现有 `download_with_fallback` 体系，确保无外网也能构建，同时保留校验逻辑。

## 2. 范围
- **包含**：新增镜像构建参数、扩展下载逻辑、补充日志；保证 pkg-fetch 流程与缓存目录 `/var/cache/vulhunter-tools` 相容。
- **不包含**：改动 pkg-fetch 上游源码、取消源码构建、影响其他工具（opengrep/phpstan）或整体代理策略。

## 3. 现状
- `download_with_fallback` 已用于 OG/PHPStan/YASA tarball，默认含多条 gh-proxy URL + 官方地址。
- Node 下载逻辑在 pkg-fetch 内部，不受 Dockerfile 控制，失败后进度条未清理产生断言。
- Docker build 目前通过 `BACKEND_*`、`YASA_*` 等 ARG 覆盖镜像/超时时间。

## 4. 方案
### 4.1 构建参数
- 在 Dockerfile 顶部 `ARG` 区新增：
  - `ARG NODE_DIST_PRIMARY=https://registry.npmmirror.com/-/binary/node`
  - `ARG NODE_DIST_FALLBACK=https://nodejs.org/dist`
- 在 `scanner-tools-base` 阶段（以及任何需要下载 Node 的阶段）重新声明上述 ARG，确保阶段内可以读取镜像值。
- 在 `docker-compose.yml` 的 backend `build.args` 区块补充 `NODE_DIST_PRIMARY/FALLBACK` 并保持默认值，同时更新 CI/Bake/Pipeline（与 `BACKEND_*` 参数同一处）以便企业环境通过环境变量覆盖。

### 4.2 下载逻辑
- 在准备 Node tarball/校验文件的 shell 段落，显式复用 pkg-fetch 约定的变量：
  - `NODE_VERSION` 对齐 pkg-fetch（v18.5.0）
  - `NODE_TAR="node-${NODE_VERSION}.tar.gz"`（若已有变量直接复用，保持架构后缀）
  - `NODE_TARBALL="/var/cache/vulhunter-tools/${NODE_TAR}"`
  - `NODE_SHASUM="/var/cache/vulhunter-tools/${NODE_TAR}.sha256sum"`
- 使用 `download_with_fallback`：
  - `download_with_fallback "${NODE_TARBALL}" "${NODE_DIST_PRIMARY}/${NODE_VERSION}/${NODE_TAR}" "${NODE_DIST_FALLBACK}/${NODE_VERSION}/${NODE_TAR}"`
  - `download_with_fallback "${NODE_SHASUM}" "${NODE_DIST_PRIMARY}/${NODE_VERSION}/SHASUMS256.txt" "${NODE_DIST_FALLBACK}/${NODE_VERSION}/SHASUMS256.txt"`
- 下载前 `echo "NODE_DIST_PRIMARY=..."`，与其他工具一致，便于日志诊断。
- 若 primary/fallback 为空则跳过该 URL；下载成功后写入 `/var/cache/vulhunter-tools` 缓存。

### 4.3 校验与容错
- 保留 pkg-fetch 的 hash 校验逻辑，镜像仅改变下载源，校验仍以官方 SHASUMS 为准。
- 下载失败或 fallback 生效时打印尝试过的 URL 以及当前镜像变量，沿用原有重试与超时策略；所有源失败时退出并提示。

## 5. 失败场景与可观测性
- **镜像不可用**：fallback 日志展示尝试的 URL，最终回退 nodejs.org。
- **hash 不一致**：触发现有 “Hash mismatch” 流程，删除缓存后重新下载。
- **网络阻断**：所有 URL 失败时脚本 `exit 1`，明确网络/配置问题。

## 6. 测试计划
1. Docker 配置检查：运行 `docker compose config` 或 `docker buildx bake --print`，确保新的 ARG 透传无语法问题。
2. 默认构建：不覆写 ARG，确认日志中显示 primary URL，构建成功。
3. 断网模拟：封禁 nodejs.org，仅保留 primary 镜像，确保构建成功。
4. 自定义镜像：通过 docker compose / CI 覆写为企业镜像，验证日志及缓存命中。
5. Hash 异常：篡改缓存文件，确认校验能清理并重新下载。
6. 回退路径：让 primary 返回 404（或配置为空），观察 fallback 生效并有明确日志。
7. 可选：在执行前运行 `docker builder prune --filter until=24h --force`，避免旧层/缓存掩盖问题。

## 7. Rollout
- 仅影响 Docker build，运行时镜像不变；构建完成后无额外迁移动作。
- 后续若需更多镜像，仅更新 Compose/CI 参数即可。
