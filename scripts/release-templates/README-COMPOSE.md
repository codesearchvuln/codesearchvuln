# Compose 使用说明

## 启动

```bash
cp docker/env/backend/env.example docker/env/backend/.env
docker compose up -d
```

## 查看运行状态

查看服务状态：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f
```

重启单个服务：

```bash
docker compose restart backend
```

## 主要配置项

请在 `docker/env/backend/.env` 中维护运行配置，至少包括：

- `LLM_API_KEY`
- `LLM_PROVIDER`
- `LLM_MODEL`

如果需要替换运行镜像，也可以在 `.env` 中设置：

- `BACKEND_IMAGE`
- `FRONTEND_IMAGE`
- `SANDBOX_IMAGE`
- `SCANNER_*_IMAGE`
- `FLOW_PARSER_RUNNER_IMAGE`
- `SANDBOX_RUNNER_IMAGE`

## 默认访问地址

- 前端：`http://localhost:3000`
- 后端：`http://localhost:8000`
- OpenAPI：`http://localhost:8000/docs`
- `nexus-web`：`http://localhost:5174`
- `nexus-itemDetail`：`http://localhost:5175`

## 常见操作

停止服务：

```bash
docker compose down
```

删除服务和数据卷：

```bash
docker compose down -v
```

配置变更后重新拉起：

```bash
docker compose up -d
```
