# Alembic Refact Spec

## 阅读定位

- **文档类型**：Explanation 型设计规格文档，附带实施约束附录。
- **目标读者**：负责实施本次 Alembic 迁移整理的后端开发者与评审者。
- **阅读目标**：理解为什么要把 [`backend/alembic/versions`](/home/xyf/AuditTool/backend/alembic/versions) 从兼容旧图的多分支历史改写为单链历史，并明确实施时必须满足的边界、依赖和验证标准。
- **范围包含**：迁移链重排原则、每个 revision 的保留或删除依据、文件级改写约束、受影响代码位点、测试与验证矩阵、风险说明。
- **范围排除**：逐步执行 checklist、任务拆分、旧数据库处置脚本、发布窗口安排、提交策略。

## Background

当前 [`backend/alembic/versions`](/home/xyf/AuditTool/backend/alembic/versions) 的迁移历史同时承载了三类诉求：

1. 记录真实的 schema / data 业务变更。
2. 为旧 revision continuity 保留兼容 bridge。
3. 为并发开发期间出现的多头历史保留 merge revision。

这种结构在历史兼容阶段有价值，但已经不适合当前项目的维护目标。当前代码库里可以直接观察到以下事实：

- 迁移目录存在两个 base revision：`5b0f3c9a6d7e` 与 `c4b1a7e8d9f0`。
- `6c8d9e0f1a2b_finalize_projects_zip_file_hash.py` 的 `down_revision` 是 tuple，说明主链起点依赖双 base 收敛。
- `d4e5f6a7b8c9_merge_phpstan_and_agent_heads.py` 与 `5f6a7b8c9d0e_merge_project_metrics_and_yasa_phpstan_heads.py` 均为纯 merge no-op。
- `90a71996ac03_add_project_management_metrics_table.py` 与 `c4b1a7e8d9f0_legacy_agent_findings_report_bridge.py` 均为 compatibility no-op。
- [`backend/tests/test_alembic_project.py`](/home/xyf/AuditTool/backend/tests/test_alembic_project.py) 仍显式断言双 base、merge revision 和 compatibility bridge 的存在。
- [`backend/app/main.py`](/home/xyf/AuditTool/backend/app/main.py)、[`backend/docker-entrypoint.sh`](/home/xyf/AuditTool/backend/docker-entrypoint.sh)、[`backend/scripts/dev-entrypoint.sh`](/home/xyf/AuditTool/backend/scripts/dev-entrypoint.sh) 仍以 `upgrade heads` 为入口，反映运行时仍在容忍多 head 语义。

因此，本次改造不是“单纯整理迁移文件名”，而是一次维护策略切换：
项目不再追求对旧 revision 图的前向兼容，而是追求一条表达当前产品演进语义的、可读、可验证、可维护的单链迁移历史。

## Goals

本次 Alembic 重构的目标如下：

- 将迁移目录整理为**唯一 base + 唯一 head** 的单链历史。
- 保留现有业务变更语义，不把所有变化折叠成一个全新基线。
- 删除只为旧历史兼容服务的 bridge revision 和 merge revision。
- 让所有保留迁移的 `down_revision` 都为单值字符串或 `None`。
- 保证空数据库执行 `alembic upgrade head` 时能够稳定得到当前期望 schema。
- 让测试、启动校验和脚本围绕“唯一 head”建立断言，而不是围绕“历史兼容图”建立断言。

## Non-Goals

以下内容不在本次设计目标内：

- 不保证旧数据库从历史多分支 revision 图平滑升级到新图。
- 不保留旧 revision id continuity。
- 不改变当前最终 schema 的业务含义。
- 不在本规格中展开逐条实施步骤或任务排期。
- 不借这次改造顺带清理无关 schema、模型或接口设计问题。

## Design Decision

本次设计采用的核心决策有两条：

1. **保留业务边界，不重建全新 baseline。**
   `5b0f3c9a6d7e_squashed_baseline.py` 已经是压缩后的起点，但它之后仍有多次明确的业务演进，例如 `projects.zip_file_hash`、`agent_findings` 去重约束、规则状态表、`project_management_metrics`、YASA 表、静态扫描状态归一化。这些边界仍然有维护价值，不应全部吸入新的“超级基线”。
2. **删除兼容结构，不再维护旧 revision continuity。**
   旧 bridge / merge 的唯一价值是让历史环境还能沿旧图继续走到当前 head。既然本次明确放弃该目标，这些文件就不再具有长期维护意义，继续保留只会让测试、启动脚本和认知模型都停留在旧策略上。

## Current Migration Inventory

### 唯一应保留的 baseline

- `5b0f3c9a6d7e_squashed_baseline.py`

保留理由：

- 它已经通过 frozen schema snapshot 固化为稳定起点。
- [`backend/tests/test_alembic_project.py`](/home/xyf/AuditTool/backend/tests/test_alembic_project.py) 已经验证其依赖 [`baseline_5b0f3c9a6d7e.py`](/home/xyf/AuditTool/backend/app/db/schema_snapshots/baseline_5b0f3c9a6d7e.py)，而不是运行时动态导入模型。
- 它覆盖了压缩前的核心表集，是最合适的唯一起点。

### 迁移映射表

下表给出每个现有 revision 在新单链中的处置方式。这里的“保留”不等于原文件原样保留，而是保留其业务语义并重写为单链的一部分。

| 当前文件 | 当前角色 | 处置 | 依据 |
| --- | --- | --- | --- |
| `5b0f3c9a6d7e_squashed_baseline.py` | squashed baseline | 保留 | 唯一合理的 frozen base，已有 snapshot 契约 |
| `c4b1a7e8d9f0_legacy_agent_findings_report_bridge.py` | compatibility bridge | 删除 | 纯 no-op，只为旧 revision continuity 服务 |
| `6c8d9e0f1a2b_finalize_projects_zip_file_hash.py` | 双 base 汇合后的真实 schema 变更 | 保留并重命名 | 实际增加 `projects.zip_file_hash` 列和唯一索引，不是 no-op |
| `7f8e9d0c1b2a_normalize_static_finding_paths.py` | 数据迁移 | 保留 | 对 `bandit_findings` / `opengrep_findings` 做路径归一化，属真实数据演进 |
| `8c1d2e3f4a5b_add_agent_finding_identity.py` | schema + backfill | 保留 | 新增 `finding_identity` 并回填历史数据 |
| `9a7b6c5d4e3f_enforce_agent_finding_task_uniqueness.py` | 数据清理 + 唯一索引 | 保留 | 先去重再建唯一索引，属真实约束收敛 |
| `9d3e4f5a6b7c_add_bandit_rule_states.py` | schema 变更 | 保留 | 创建 `bandit_rule_states` 表及索引 |
| `a1b2c3d4e5f6_add_phpstan_rule_states.py` | schema 变更 | 保留 | 创建 `phpstan_rule_states` 表及索引 |
| `b2c3d4e5f6a7_add_bandit_rule_soft_delete.py` | schema 变更 | 保留 | 为 `bandit_rule_states` 增加 `is_deleted` |
| `c3d4e5f6a7b8_add_phpstan_rule_soft_delete.py` | schema 变更 | 保留 | 为 `phpstan_rule_states` 增加 `is_deleted` |
| `d4e5f6a7b8c9_merge_phpstan_and_agent_heads.py` | merge revision | 删除 | 纯 no-op，只用于收敛并发 head |
| `e5f6a7b8c9d0_add_project_management_metrics.py` | schema 变更 | 保留 | 实际创建 `project_management_metrics` 表 |
| `b7e8f9a0b1c2_add_yasa_scan_tables.py` | schema 变更 | 保留 | 实际创建 `yasa_scan_tasks` / `yasa_findings` |
| `5f6a7b8c9d0e_merge_project_metrics_and_yasa_phpstan_heads.py` | merge revision | 删除 | 纯 no-op，只用于收敛分叉 |
| `90a71996ac03_add_project_management_metrics_table.py` | compatibility bridge | 删除 | 纯 no-op，真实建表已经在 `e5f6a7b8c9d0` 完成 |
| `a8f1c2d3e4b5_add_agent_tasks_report_column.py` | schema 变更 | 保留 | 实际新增 `agent_tasks.report` |
| `b9d8e7f6a5b4_drop_legacy_audit_tables.py` | schema 变更 | 保留 | 删除 `audit_issues` / `audit_tasks`，并移除 `project_management_metrics.audit_tasks` |
| `f6a7b8c9d0e1_remove_fixed_static_finding_status.py` | 数据迁移 | 保留 | 将多个 findings 表中的 `fixed` 归一化为 `verified` |

## Target Linear History

目标状态下，迁移历史应是一条依赖方向单一、业务语义明确的链。推荐的线性顺序如下：

1. `baseline`
   由 `5b0f3c9a6d7e` 提供唯一基础 schema。
2. `projects.zip_file_hash`
   对 `projects` 表补齐 `zip_file_hash` 列与唯一索引。
3. `static finding path normalization`
   对 `bandit_findings`、`opengrep_findings` 的历史路径进行归一化。
4. `agent finding identity`
   引入 `agent_findings.finding_identity` 并回填。
5. `agent finding uniqueness`
   基于 `task_id + finding_identity` / `task_id + fingerprint` 做去重与唯一索引收敛。
6. `bandit rule states`
   创建 `bandit_rule_states`。
7. `phpstan rule states`
   创建 `phpstan_rule_states`。
8. `bandit rule soft delete`
   为 `bandit_rule_states` 增加 `is_deleted`。
9. `phpstan rule soft delete`
   为 `phpstan_rule_states` 增加 `is_deleted`。
10. `project_management_metrics`
    创建 `project_management_metrics`。
11. `yasa scan tables`
    创建 `yasa_scan_tasks` 与 `yasa_findings`。
12. `agent_tasks.report`
    为 `agent_tasks` 增加 `report` 字段。
13. `drop legacy audit tables`
    删除旧审计表，并删除 `project_management_metrics.audit_tasks`。
14. `remove fixed static finding status`
    将 `gitleaks_findings`、`bandit_findings`、`phpstan_findings`、`yasa_findings` 中的 `fixed` 归一化为 `verified`。

### 该顺序的硬依赖

以上顺序不是“按时间排一排”，而是由真实依赖决定的：

- `projects.zip_file_hash` 必须紧跟 baseline 之后，因为它只依赖 `projects` 表，不应继续背负“双 base 汇合”的桥接语义。
- `static finding path normalization` 依赖 baseline 中已存在的 `bandit_findings` / `opengrep_findings` 及其扫描任务表，因此必须位于这些表之后，但不依赖后续新增表。
- `agent finding uniqueness` 必须晚于 `agent finding identity`，因为它要先消费 `finding_identity` 列并基于该列做去重与索引构建。
- `bandit/phpstan soft delete` 必须分别晚于各自的 `rule_states` 建表迁移。
- `drop legacy audit tables` 必须晚于 `project_management_metrics`，因为它要删除该表中的 `audit_tasks` 列。
- `remove fixed static finding status` 必须晚于 `yasa scan tables`，因为它会更新 `yasa_findings`，若该表尚未创建会直接失败。

### 该顺序的柔性取舍

有些迁移在业务上彼此独立，但仍建议按上面的线性顺序串接，而不是为了“更纯粹的领域分组”再引入分叉：

- `bandit` 与 `phpstan` 规则状态相关迁移可以视为同一条产品演进链，线性串接比重新拆成并发分支更容易维护。
- `project_management_metrics` 与 YASA 表理论上相互独立，但后续 head 已经同时消费它们的存在；既然目标是单链，就应让它们在主链中显式排出先后。
- `agent_tasks.report` 放在 YASA 之后并非强 schema 依赖，而是为了避免与 `project_management_metrics` / 审计表清理阶段交错，降低认知复杂度。

## File-Level Refactor Rules

### Baseline 规则

- `5b0f3c9a6d7e_squashed_baseline.py` 继续保留。
- 它必须成为唯一 `down_revision = None` 的迁移文件。
- 它继续引用 frozen snapshot，而不是运行时模型。
- 与 baseline 配套的 snapshot 相关测试，改为围绕“唯一 base”与“表集未漂移”建立断言。

### 保留迁移的改写规则

对所有保留的真实业务迁移，统一采用以下规则：

- 每个文件只保留一个父 revision。
- 不再使用 tuple 型 `down_revision`。
- 文件名和 revision id 可以重写，但新命名只描述真实业务变化，不再带有 `merge`、`bridge`、`compatibility` 等字样。
- 迁移内部 SQL / Alembic 操作尽量保持原有业务语义，不借重排顺带改变行为。
- 若某个迁移当前的 docstring、注释或命名仍暗示“桥接语义”，应在重写时清理。例如 `6c8d9e0f1a2b_finalize_projects_zip_file_hash.py` 应改为直接表达“新增 zip_file_hash 列”，而不是“finalize bridge”。

### downgrade 约束

单链改写不要求把所有 downgrade 都补成完全可逆，但必须保留当前契约边界：

- 当前已经是 no-op downgrade 的迁移，若其升级过程包含不可安全回滚的数据归一化或兼容性选择，可以继续保持 no-op。
- 当前已经有明确且安全的 downgrade 的迁移，例如唯一索引移除、表删除回滚、列删除回滚，应尽量维持原契约。
- 不允许为了“看起来更完整”而添加具有误导性的伪回滚逻辑。

### 删除迁移的处理规则

对于 merge / bridge / compatibility 文件：

- 从迁移目录中直接删除。
- 测试中不再断言这些文件存在。
- 代码、脚本、文档中若有写死这些 revision id 的引用，也要一并删除或改写。
- 若某个真实迁移目前通过 `Revises:` 或文件名对这些删除对象产生语义耦合，改写时要同步清理说明文字。

## Affected Code Surface

本次改造不只影响 Alembic 目录，还会影响以下代码面：

### 1. 迁移图静态测试

[`backend/tests/test_alembic_project.py`](/home/xyf/AuditTool/backend/tests/test_alembic_project.py) 当前仍在验证旧兼容结构，包括：

- 双 base revision。
- merge / bridge 文件仍然存在。
- `90a71996ac03` 是 no-op bridge。
- `6c8d9e0f1a2b` 仍然承担“bridge contract”。

这些断言都应重写为围绕新单链建立验证。

### 2. 启动时版本检查

[`backend/app/main.py`](/home/xyf/AuditTool/backend/app/main.py) 当前使用：

- `subprocess.run(["alembic", "upgrade", "heads"], ...)`
- `ScriptDirectory.get_heads()`
- “请运行 alembic upgrade heads” 相关错误文案

在单链设计下，运行时语义应收敛为“唯一 head”：

- 启动自动迁移入口应切换为 `alembic upgrade head`。
- 错误文案与日志应不再向维护者传达“多 head 合法”的暗示。
- 版本校验虽然仍可使用 `get_heads()`，但测试与实现都应明确期望值只有一个。

### 3. 容器与开发入口脚本

以下脚本也要同步改为单 head 语义：

- [`backend/docker-entrypoint.sh`](/home/xyf/AuditTool/backend/docker-entrypoint.sh)
- [`backend/scripts/dev-entrypoint.sh`](/home/xyf/AuditTool/backend/scripts/dev-entrypoint.sh)

### 4. 启动测试

[`backend/tests/test_startup_schema_migration.py`](/home/xyf/AuditTool/backend/tests/test_startup_schema_migration.py) 当前 fake revision 仍使用 `90a71996ac03`、`a8f1c2d3e4b5` 这样的旧链节点来模拟升级与失败路径。改造后，测试数据应基于新的单链 head 与其前驱 revision 重新表达。

### 5. 文档与脚本中的硬编码 revision 搜索

实施前应对仓库进行全量搜索，至少覆盖：

- 旧 revision id 字面量。
- `upgrade heads`、`get_heads()`、`heads=` 等文案。
- 对 merge / bridge 文件名的直接引用。

## Test And Verification Strategy

本次验证必须覆盖“迁移图正确”“运行入口正确”“最终 schema 正确”三层，而不是只跑一次 `alembic upgrade`。

### A. 迁移图静态断言

[`backend/tests/test_alembic_project.py`](/home/xyf/AuditTool/backend/tests/test_alembic_project.py) 重写后的核心断言应包括：

- 只有一个 base revision。
- 只有一个 head revision。
- 所有 `down_revision` 要么是 `None`，要么是单个字符串。
- 不再存在 tuple 型 `down_revision`。
- 不再断言 merge / bridge / compatibility 文件存在。
- 断言新的线性顺序符合设计预期。
- 继续保留 baseline snapshot 不漂移的断言。

建议新增的静态断言：

- `project_management_metrics` 只由一个真实建表迁移创建。
- 迁移目录中不存在名字包含 `merge`、`bridge`、`compatibility` 的迁移文件。
- 唯一 head 对应的最终迁移是“remove fixed static finding status”这一真实业务变更，而不是壳迁移。

### B. 空库升级断言

至少应验证以下命令路径：

- `alembic upgrade head`
- `alembic current`

期望结果：

- 空数据库从 0 到 head 全流程成功。
- `alembic current` 返回唯一 head。
- `alembic_version` 中只记录一个 version。

### C. 启动路径断言

除 Alembic 自身外，还应验证应用启动路径：

- 启动时若数据库 revision 落后，会自动执行单链升级。
- 升级后版本检查通过。
- 若升级后仍不一致，会抛出包含唯一 head 语义的错误，而不是 `heads` 语义。

### D. 最终 schema 语义断言

不能只验证“升级成功”，还要验证最终结构与行为和当前产品代码一致。最少应覆盖以下关键点：

- `projects` 存在 `zip_file_hash` 列及唯一索引。
- `agent_findings` 存在 `finding_identity` 列及任务级唯一索引。
- `bandit_rule_states`、`phpstan_rule_states` 均存在且包含 `is_deleted`。
- `project_management_metrics` 存在，但不再包含 `audit_tasks`。
- `yasa_scan_tasks` 与 `yasa_findings` 存在。
- `agent_tasks.report` 存在。
- `audit_tasks` 与 `audit_issues` 不存在。
- `gitleaks_findings`、`bandit_findings`、`phpstan_findings`、`yasa_findings` 中不再保留 `fixed` 状态语义。

### E. 仓库级引用断言

如果实施后仓库中仍有旧 revision id 的硬编码引用，说明迁移策略切换并未完成。至少要检查：

- 测试文件。
- 启动入口与脚本。
- 运维或开发文档。

## Acceptance Matrix

为了让评审时能快速判断是否完成，本次改造的验收应按下表执行：

| 验收项 | 通过标准 |
| --- | --- |
| 迁移图结构 | 唯一 base、唯一 head、无 tuple `down_revision` |
| 目录内容 | 无 merge / bridge / compatibility 性质的 no-op 迁移 |
| 基线契约 | baseline 仍使用 frozen snapshot，表集未意外扩张 |
| 升级路径 | 空库 `alembic upgrade head` 成功 |
| 当前版本读取 | `alembic current` 返回唯一 head |
| 启动校验 | 应用启动自动升级与版本检查通过 |
| 关键 schema | 指定表、列、索引存在或不存在，符合当前产品语义 |
| 测试更新 | 不再依赖旧兼容 revision 图 |
| 代码引用 | 运行时和脚本不再传播 `heads` 兼容语义 |

## Risks

### 风险 1：代码或测试仍依赖旧 revision id

重写迁移历史后，所有以旧 revision id 为稳定标识的断言都可能失效。当前已知的依赖点至少包括：

- [`backend/tests/test_alembic_project.py`](/home/xyf/AuditTool/backend/tests/test_alembic_project.py)
- [`backend/tests/test_startup_schema_migration.py`](/home/xyf/AuditTool/backend/tests/test_startup_schema_migration.py)
- [`backend/app/main.py`](/home/xyf/AuditTool/backend/app/main.py)
- [`backend/docker-entrypoint.sh`](/home/xyf/AuditTool/backend/docker-entrypoint.sh)
- [`backend/scripts/dev-entrypoint.sh`](/home/xyf/AuditTool/backend/scripts/dev-entrypoint.sh)

### 风险 2：线性重排引入隐式依赖错误

原多分支图中，有些依赖是通过 merge revision 被动满足的。改成单链后，如果排序不当，就可能出现以下问题：

- 数据迁移早于建表迁移。
- 删除列的迁移早于依赖该列的业务迁移。
- 最终状态归一化早于相关表创建。

因此排序必须以 schema / data 依赖为先，而不是以旧时间戳为先。

### 风险 3：历史数据库不再可直接升级

这是本次改造的显式代价，而不是意外副作用。文档、测试和实施说明都应明确这一点，避免后续维护者误以为新图仍兼容曾经的 `c4b1a7e8d9f0`、`90a71996ac03` 等历史状态。

### 风险 4：baseline 语义被误扩张

本次目标不是重新生成“当前最终 schema 基线”，而是保留现有业务变更边界。若把 `zip_file_hash`、规则状态表、YASA 表、审计表清理等变化偷偷吸入 baseline，会导致演进语义丢失，后续维护也更难定位问题。

### 风险 5：运行时入口仍停留在多 head 认知

即使迁移目录已经变成单链，只要启动代码和脚本仍然到处写 `upgrade heads`，维护者就会继续默认“多 head 是正常设计”。这会削弱改造收益，也会在后续新增迁移时诱发错误的心智模型。

## Acceptance Criteria

本设计完成实施后，应满足以下验收条件：

- [`backend/alembic/versions`](/home/xyf/AuditTool/backend/alembic/versions) 中仅存在一个 base revision。
- 迁移目录中仅存在一个 head revision。
- 所有保留迁移的 `down_revision` 都是单值字符串或 `None`。
- 目录中不存在 merge、bridge 或 compatibility 性质的 no-op 迁移。
- 空数据库执行 `alembic upgrade head` 成功。
- `alembic current` 返回新的唯一 head。
- 启动路径的数据库迁移版本检查通过，且不再传播 `heads` 兼容语义。
- 当前最终 schema 语义与重构前一致。
- 迁移图测试与启动测试都不再依赖旧兼容分支结构。

## Out Of Scope Follow-Up

本规格之外，仍可在后续单独文档中补充以下内容：

- 具体实施计划与任务拆分。
- 旧数据库或旧环境的迁移处置方案。
- revision id 重命名策略的执行细则。
- 发布窗口、回滚窗口与提交策略。
