# 部署指南
## 部署准备

1. 复制运行时环境文件：

```bash
cp docker/env/backend/env.example docker/env/backend/.env
```

2. 至少确认以下变量：
   `LLM_API_KEY`、`LLM_PROVIDER`、`LLM_MODEL`

3. 再复制镜像映射模板：

```bash
cp docker/env/backend/offline-images.env.example docker/env/backend/offline-images.env
```

如果缺少 `.env` 或 `offline-images.env`，脚本会按模板自动补齐，但正式部署前仍应手动检查上述配置。
如果你使用 cloud 模型接口，运行时仍然需要访问对应 API；部署只负责让运行镜像走本地。

## 支持环境

- 宿主机：`Ubuntu 22.04 LTS`、`Ubuntu 24.04 LTS`、`Windows 10 WSL2 + Ubuntu 22.04 LTS`、`Windows 11 WSL2 + Ubuntu 22.04 LTS`
- 必需组件：`docker`、`docker compose`
- 部署额外需要：`zstd`、`python3`
- `Vulhunter-offline-bootstrap.sh --deploy` 会通过内部 deploy worker 统一检测 `docker`、`docker compose`、`zstd`、`python3`
- 对受支持的 Ubuntu / WSL Ubuntu 宿主机，若缺少上述依赖，脚本会优先尝试通过国内 Ubuntu apt 镜像自动安装（默认阿里云、清华），失败后再回退官方 Ubuntu 源
- 自动安装只面向上述受支持宿主机；其他发行版只做检测并输出手工安装提示，不会修改宿主机 apt 配置
- 即使包安装成功，脚本仍会继续校验 Docker daemon / socket / compose readiness；WSL 下若仍未接通 Docker Desktop / socket，部署会明确失败并给出提示
- 镜像包文件名固定为 `vulhunter-services-images-<arch>.tar.zst` 和 `vulhunter-scanner-images-<arch>.tar.zst`
- 两份镜像包必须与当前 release tree 使用同一个 snapshot，并放在 release 根目录或 `images/`
- release stack 的 compose project 名称可通过 `VULHUNTER_RELEASE_PROJECT_NAME` 覆盖；默认值是 `vulhunter-release`

## 部署命令

### 部署

```bash
bash ./Vulhunter-offline-bootstrap.sh --deploy
```

如需在终端持续查看启动日志：

```bash
bash ./Vulhunter-offline-bootstrap.sh --deploy --attach-logs
```

公开入口会先解析 release root / archive，再通过内部 deploy worker 校验 bundle 文件名和 SHA256、导入本地镜像并刷新同一套 release stack。
若 prereq 自动安装被触发，脚本会先完成依赖修复与 Docker readiness 校验，再继续 bundle 校验与镜像导入。

## 常用维护指令

```bash
docker compose ps
docker compose logs -f
bash ./Vulhunter-offline-bootstrap.sh --stop
bash ./Vulhunter-offline-bootstrap.sh --cleanup
bash ./Vulhunter-offline-bootstrap.sh --cleanup-all
docker compose down
docker compose down -v
```

`docker compose down -v` 会删除持久化 volumes，只应在明确需要清空数据时使用。日常 refresh / 停服 / 清理请优先使用 `Vulhunter-offline-bootstrap.sh` 的 `--deploy` / `--stop` / `--cleanup` / `--cleanup-all`，不要只把 `docker compose down` / `down -v` 当成完整的发布维护流程。
