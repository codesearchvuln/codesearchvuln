# 上传压缩包后异步统计与简介生成改造规划

## 1. 背景与问题

当前 ZIP 上传链路里，`/projects/{id}/zip` 与 `/projects/create-with-zip` 在请求内同步执行了以下重操作：

1. 代码语言统计（`pygount`）
2. 项目用途描述生成（静态描述 + 可选 LLM）

对应实现位于：

- `backend/app/api/v1/endpoints/projects_shared.py` 的 `_store_uploaded_archive_for_project`
- `backend/app/api/v1/endpoints/projects_shared.py` 的 `_resolve_project_description_bundle`
- `backend/app/services/upload/project_stats.py`

这会导致上传接口耗时偏高，且在 LLM 配置不完整时产生额外告警（例如缺少 `llmModel`）。

---

## 2. 目标与非目标

### 2.1 目标

- 上传接口在“压缩包落盘成功 + 基础校验完成”后立即返回，不等待统计/描述完成。
- 服务端后台异步完成：
  - 语言统计
  - 静态描述生成
  - 可选 LLM 描述增强（失败时不影响主流程）
- 前端可感知处理状态（`pending/completed/failed`），支持自动刷新结果。

### 2.2 非目标（本次不做）

- 不引入外部任务队列（如 Celery/RQ/Kafka）作为第一阶段前提。
- 不改动压缩包安全校验、去重逻辑、文件大小限制策略。
- 不改变已有扫描任务创建流程。

---

## 3. 现状流程（瓶颈点）

### 3.1 当前同步流程（简化）

1. 上传文件 -> 校验 -> 解压 -> 重新打包 ZIP -> 保存项目 ZIP
2. 同步执行 `_resolve_project_description_bundle`：
   - `get_pygount_stats_from_extracted_dir`
   - `build_static_project_description`
   - 可选 `generate_project_description_from_extracted_dir`
3. 写入 `ProjectInfo`（`completed`）和 `Project.description`
4. 返回接口响应

### 3.2 主要问题

- 上传请求耗时随代码规模显著增长。
- `pygount` 输出量大，日志噪声高（`pygount` logger 默认 INFO）。
- 若 LLM 配置缺失/异常，会出现告警并拖慢上传路径（即使最终会回退静态描述）。
- 当前 `/projects/info/{id}` 在某些场景下仍可能触发同步统计，不利于“上传后立即可返回”目标。

---

## 4. 目标流程（异步化后）

### 4.1 新流程

1. 上传接口只做“上传必要步骤”：
   - 文件格式/完整性校验
   - 解压重打包
   - 哈希去重
   - 保存 ZIP
   - 更新项目基础字段（如 `programming_languages`, `zip_file_hash`）
2. 将 `ProjectInfo.status` 置为 `pending` 并提交事务。
3. 入队后台任务（按 `project_id + zip_hash` 去重）。
4. 立即返回上传成功响应（附带 `project_info_status=pending`）。
5. 后台任务独立 DB Session 执行统计 + 描述，完成后更新：
   - `ProjectInfo.language_info`
   - `ProjectInfo.description`
   - `ProjectInfo.status=completed/failed`
   - `Project.description`（成功时）

### 4.2 关键原则

- **上传接口不阻塞在统计/LLM上**。
- **LLM失败不影响 completed**：至少写入静态描述和语言统计。
- **幂等与防串写**：如果用户短时间重复上传，旧任务结果不得覆盖新 ZIP 对应结果（通过 `expected_zip_hash` 校验）。

---

## 5. 详细设计

### 5.1 后端任务执行器（MVP）

新增一个与 `project_metrics_refresher` 同风格的后台执行器（建议新文件）：

- `backend/app/services/upload/project_info_refresher.py`

建议接口：

- `enqueue(project_id: str, expected_zip_hash: str | None)`
- `recalc_now(project_id: str, expected_zip_hash: str | None)`（测试/手动调用）

执行逻辑：

1. 使用 `async_session_factory` 开新会话。
2. 读取 `Project` 与 `ProjectInfo`。
3. 若 `project.zip_file_hash != expected_zip_hash`，直接跳过（说明已有更新上传）。
4. 从 `load_project_zip` 读取归档并解压到临时目录。
5. 调用 `_resolve_project_description_bundle`（建议迁移到 service 层，避免 endpoint 依赖）。
6. 写回 `ProjectInfo` 与 `Project.description`。
7. 状态置 `completed`；异常时置 `failed` 并记录日志。

> 备注：MVP 可先使用进程内内存队列；若未来有多实例部署，再升级到 Redis/Celery 持久化队列。

### 5.2 上传接口改造点

主要改造：

- `backend/app/api/v1/endpoints/projects_shared.py`
  - `_store_uploaded_archive_for_project` 中移除同步 `_resolve_project_description_bundle` 调用。
  - 改为写入 `ProjectInfo(status="pending")`，并保留已有描述（或保留用户手工描述）。
  - 在事务成功后调用 `project_info_refresher.enqueue(project.id, zip_hash)`。
- `backend/app/api/v1/endpoints/projects_uploads.py`
  - `upload_project_zip`、`create_project_with_zip` 响应增加异步状态字段（例如 `project_info_status`）。

### 5.3 ProjectInfo 状态机建议

第一阶段沿用现有状态值，避免迁移：

- `pending`: 已入队/处理中
- `completed`: 统计与描述可用
- `failed`: 后台任务失败

可选增强（第二阶段）：

- 增加 `updated_at`, `error_message`, `last_attempt_at`, `attempt_count` 便于可观测性和重试策略。

### 5.4 `/projects/info/{id}` 行为调整

当前 `ensure_project_info_has_language_info` 存在“按需同步计算”路径，不符合异步目标。建议：

1. 改为纯查询返回，不在请求线程内触发重算。
2. 若记录不存在，创建 `pending` 空记录并入队后返回。
3. 前端按状态轮询直到 `completed/failed`。

### 5.5 前端联动

涉及点：

- `frontend/src/shared/api/database.ts`
  - 为上传返回值补充 `project_info_status`（以及可选 `project_info_updated_at`）。
- 项目详情页（`frontend/src/pages/ProjectDetail.tsx`）
  - 进入页面时查询 `project info` 状态；
  - 若 `pending`，展示“正在统计项目信息”并轮询；
  - 避免与 `generateStoredProjectDescription` 自动触发逻辑重复执行（需加状态门禁）。

### 5.6 日志与可观测性

### 最小改动

- 在 `backend/app/main.py` 增加：
  - `logging.getLogger("pygount").setLevel(logging.WARNING)`

### 建议指标（后续）

- `upload_project_info_jobs_total{status}`
- `upload_project_info_job_duration_seconds`
- `upload_project_info_pending_count`

---

## 6. 分阶段实施计划

### Phase 1（MVP，建议先落地）

1. 新增 `project_info_refresher`（进程内异步任务执行器）
2. 上传接口改为“写 pending + 入队 + 立即返回”
3. `/projects/info/{id}` 改为纯读取/轻量触发，不做同步重算
4. 前端详情页增加 pending 状态展示与轮询
5. 降低 `pygount` 日志级别

### Phase 2（稳定性增强）

1. 增加 `ProjectInfo` 错误字段与重试计数
2. 启动恢复逻辑：服务重启时扫描 `pending` 任务并重入队
3. 限制并发（例如 `Semaphore`）避免大项目并发解压导致 IO 峰值

### Phase 3（多实例可扩展）

1. 引入 Redis/Celery/RQ 等持久化队列
2. 将任务幂等键升级为 `project_id + zip_hash`
3. 增加后台任务可视化与告警

---

## 7. 测试计划

### 7.1 单元测试（后端）

新增/调整建议：

- 上传成功后断言：
  - 返回时不包含最终 `language_info/description`
  - `ProjectInfo.status == "pending"`
  - `project_info_refresher.enqueue` 被调用
- 后台任务成功：
  - `ProjectInfo.status == "completed"`
  - `language_info` 与 `description` 写入
- 后台任务失败：
  - `ProjectInfo.status == "failed"`
  - 不影响已上传 ZIP 存储
- 幂等保护：
  - 旧 `expected_zip_hash` 任务不会覆盖新上传结果

参考改动测试文件：

- `backend/tests/test_projects_description_generate.py`
- `backend/tests/test_projects_create_with_zip.py`
- 可新增 `backend/tests/test_project_info_refresher.py`

### 7.2 集成测试（端到端）

- 上传大项目后 API 响应时间显著降低（不再受 pygount/LLM 影响）
- 前端能看到 pending -> completed 状态流转
- LLM 未配置时仍可稳定得到静态描述，不阻塞上传

---

## 8. 风险与对策

- **风险：进程内队列在服务重启时丢失任务**
  - 对策：启动阶段补偿扫描 `pending` 记录并重入队（Phase 2）
- **风险：多次上传导致旧任务覆盖新结果**
  - 对策：任务执行前后都校验 `expected_zip_hash`
- **风险：大项目并发解压导致资源争用**
  - 对策：后台并发上限 + 队列去重
- **风险：前端与旧接口契约不一致**
  - 对策：新增字段向后兼容，不移除旧字段

---

## 9. 验收标准（Done Definition）

- 上传接口返回时间不再包含语言统计与描述生成耗时。
- 上传后 `ProjectInfo` 初始为 `pending`，最终能转为 `completed` 或 `failed`。
- LLM 配置缺失时上传仍成功，且最终至少具备静态描述。
- 项目详情页可展示异步处理中状态并自动刷新结果。
