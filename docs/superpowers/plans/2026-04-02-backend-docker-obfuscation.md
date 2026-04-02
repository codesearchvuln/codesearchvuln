# 后端 Docker 混淆加固实施计划（开源方案）

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 Cython .so 编译基础上，为生产镜像 `runtime` target 增加三层防护，全程使用开源工具，防止商用镜像被逆向窃取源码。

**Architecture:**
- Layer 1（已有）: Cython 将 ~260 个 .py 模块编译为 .so；**本计划新增 `strip` 符号剥离**
- Layer 2（新增）: 将剩余必须保留的 .py 文件编译为 .pyc 字节码，从镜像中删除 .py 源文件
- Layer 3（新增）: Docker 镜像硬化——非 root 用户、移除 curl、Python 健康检查

**Tech Stack:** binutils `strip`、Python `compileall`（均内置/开源）、Docker BuildKit

**关键约束：**
- 不扩展 Cython 编译范围（build time 敏感），不引入 PyArmor 等商业工具
- `runtime-plain` target 用于本地开发，**不做任何加固**（保持源码可调试）
- `agent_tasks_reporting.py` 含通配符导入，需先重构再纳入保护（Task 4）

---

## 文件变更清单

| 动作 | 文件路径 | 说明 |
|------|---------|------|
| 修改 | `docker/backend.Dockerfile` | runtime-app-assembler 末尾：strip .so + .py→.pyc + 删源码；runtime 阶段：非 root 用户 |
| 修改 | `docker-compose.yml` | backend healthcheck 改为 Python stdlib 实现（移除 curl 依赖）|
| 修改 | `backend/app/api/v1/endpoints/agent_tasks_reporting.py` | 将 `from .agent_tasks_findings import *` 改为显式导入，消除 Cython/pyc 编译阻碍 |
| 修改 | `backend/cython_build/exclusion_list.txt` | 重构后移除 `agent_tasks_reporting.py`（可选：加入 Cython 编译；否则纳入 pyc 保护）|

---

## Task 1: 分析现状（信息收集，不改代码）

**Files:** Read `docker/backend.Dockerfile:362-404`（runtime-app-assembler 阶段）

- [ ] **Step 1: 确认 .so 符号暴露情况**

  ```bash
  # 临时构建 cython-compiler 阶段查看符号数
  docker build --target cython-compiler \
    -f docker/backend.Dockerfile \
    -t vulhunter/sym-check . --quiet
  docker run --rm vulhunter/sym-check sh -c \
    'find /build/compiled -name "*.so" | head -1 | xargs nm -D 2>/dev/null | grep -c " T " || echo 0'
  ```
  Expected: 输出正整数（如 `420`），表示当前 .so 暴露的函数符号数

- [ ] **Step 2: 确认 strip 后 .so 仍为有效 ELF**

  ```bash
  docker run --rm vulhunter/sym-check sh -c '
    f=$(find /build/compiled -name "*.so" | head -1)
    cp "$f" /tmp/t.so && strip --strip-all /tmp/t.so
    file /tmp/t.so | grep "ELF.*shared object" && echo "ELF OK"
    nm -D /tmp/t.so 2>/dev/null | grep -c " T " || echo "symbols after strip: 0"
  '
  ```
  Expected: `ELF OK`；符号数为 0 或仅剩 `PyInit_*` 入口（CPython 必需，无法移除）

- [ ] **Step 3: 确认 .pyc 无 .py 时 Python 可正常导入**

  验证 Python 3 在删除 .py 后仍能从 `__pycache__/*.cpython-311.pyc` 加载模块：

  ```bash
  docker run --rm python:3.11-slim sh -c '
    mkdir -p /tmp/test_pkg && touch /tmp/test_pkg/__init__.py
    cat > /tmp/test_pkg/hello.py << "EOF"
  SECRET = "source_code"
  def greet(): return "hello"
  EOF
    python3 -m compileall -q /tmp/test_pkg
    rm /tmp/test_pkg/hello.py
    python3 -c "import sys; sys.path.insert(0, \"/tmp\"); from test_pkg.hello import greet; print(greet())"
  '
  ```
  Expected: `hello`（无 .py 时成功从 `__pycache__/` 加载）

---

## Task 2: 在 Dockerfile 中添加 .so 符号剥离

**Files:** Modify `docker/backend.Dockerfile:400-407`

在 `runtime-app-assembler` 阶段，当前最后的 RUN 块结束于约第 404 行
（`echo "[Assembler] 组装完成"`），下一行（约 406 行）是 `FROM runtime-base AS runtime`。
**在第 404 行与 `FROM runtime-base` 之间新增独立 RUN 指令：**

- [ ] **Step 1: 在 runtime-app-assembler 阶段末尾插入 strip RUN 块**

  打开 `docker/backend.Dockerfile`，定位以下内容：
  ```dockerfile
      echo "[Assembler] 组装完成"
  
  FROM runtime-base AS runtime
  ```

  在两者之间插入：
  ```dockerfile
  # ── Layer 1 增强：.so 符号剥离 ──────────────────────────────
  # strip --strip-all 移除符号表和重定位信息（保留 PyInit_* CPython 入口）
  # --remove-section=.comment 额外移除编译器版本注释
  # 效果：减小 .so 体积 20-50%，反汇编结果无函数名可读
  RUN set -eux; \
      SO_COUNT=$(find /final/app -name "*.so" | wc -l); \
      echo "[Strip] 开始剥离 ${SO_COUNT} 个 .so 文件符号"; \
      find /final/app -name "*.so" \
          -exec strip --strip-all --remove-section=.comment {} \; ; \
      echo "[Strip] 符号剥离完成"; \
      find /final/app -name "*.so" | head -5 | while read so; do \
          file "$so" | grep -q "ELF.*shared object" || \
          { echo "INVALID ELF: $so" >&2; exit 1; }; \
      done; \
      echo "[Strip] ELF 完整性验证通过"
  ```

- [ ] **Step 2: 构建 runtime-app-assembler 阶段验证**

  ```bash
  docker build --target runtime-app-assembler \
    -f docker/backend.Dockerfile \
    -t vulhunter/strip-test . \
    2>&1 | grep -E "\[Strip\]|\[Assembler\]"
  ```
  Expected: 看到 `[Strip] ELF 完整性验证通过`

- [ ] **Step 3: 验证 strip 后核心 .so 仍可导入**

  ```bash
  docker run --rm vulhunter/strip-test \
    /opt/backend-venv/bin/python - << 'EOF'
  import importlib.util, sys
  sys.path.insert(0, '/final')
  for mod in ['app.core.config']:
      spec = importlib.util.find_spec(mod)
      if spec:
          print(f'[OK] {mod}: {spec.origin.split("/")[-1]}')
      else:
          print(f'[MISS] {mod}')
  EOF
  ```
  Expected: `[OK] app.core.config: config.cpython-311-x86_64-linux-gnu.so`

  > **注意**: runtime-app-assembler 阶段没有完整的 venv 路径映射，此验证可选跳过。
  > 真正的导入验证在 `runtime` 阶段末尾的 `RUN python...` 内置检查中完成。

- [ ] **Step 4: Commit**

  ```bash
  git add docker/backend.Dockerfile
  git commit -m "feat(security): strip debug symbols from Cython .so files

  Add strip --strip-all step after runtime-app-assembler assembly.
  Removes symbol tables and .comment sections from all .so files.
  ELF integrity verified post-strip. Reduces reverse engineering surface."
  ```

---

## Task 3: 将剩余 .py 文件编译为 .pyc 并删除源码

**原理：** Python 3 可在无 .py 源文件时从 `__pycache__/*.cpython-311.pyc` 加载模块。
编译为 .pyc 后删除 .py，使攻击者无法直接读取源码（需要额外反编译步骤）。

**Files:** Modify `docker/backend.Dockerfile`（在 Task 2 的 strip RUN 块之后，同一位置）

**保护目标（共 8 个文件）：**
- `app/main.py`
- `app/runtime/container_startup.py`
- `app/runtime/launchers/*.py`（5 个）
- `app/api/v1/endpoints/agent_tasks_reporting.py`（Task 4 重构后）

- [ ] **Step 1: 在 strip RUN 块之后，再新增 .pyc 编译 + 源码删除 RUN 块**

  紧接 Task 2 中插入的 strip RUN 块，再追加：
  ```dockerfile
  # ── Layer 2：.py → .pyc 字节码编译 + 删除源码 ───────────────
  # 将剩余 .py 文件编译为 .pyc（Python 3 在 __pycache__ 中查找）
  # 删除 .py 源文件，防止直接读取；__init__.py 保留（仅含 import 声明，敏感度低）
  # 注意：.pyc 可被工具反编译，保护强度低于 .so，但构成有效阻碍
  RUN set -eux; \
      # 使用 venv Python 编译（确保版本与运行时一致）
      /opt/backend-venv/bin/python -m compileall -q /final/app; \
      # 统计编译产物
      PYC_COUNT=$(find /final/app -name "*.pyc" | wc -l); \
      echo "[Bytecode] 编译完成，.pyc 文件数: ${PYC_COUNT}"; \
      # 删除 .py 源文件，保留 __init__.py（包结构标识，内容无商业价值）
      find /final/app -name "*.py" ! -name "__init__.py" -delete; \
      PY_REMAINING=$(find /final/app -name "*.py" | wc -l); \
      echo "[Bytecode] 删除 .py 完成，剩余 .py 文件数（仅 __init__.py）: ${PY_REMAINING}"; \
      # 验证核心入口点 .pyc 存在
      test -f /final/app/__pycache__/main.cpython-311.pyc || \
          { echo "ERROR: main.cpython-311.pyc 未生成" >&2; exit 1; }; \
      test -f /final/app/runtime/__pycache__/container_startup.cpython-311.pyc || \
          { echo "ERROR: container_startup.cpython-311.pyc 未生成" >&2; exit 1; }; \
      echo "[Bytecode] 关键 .pyc 文件验证通过"
  ```

- [ ] **Step 2: 构建并验证 .py 已删除**

  ```bash
  docker build --target runtime-app-assembler \
    -f docker/backend.Dockerfile \
    -t vulhunter/pyc-test . \
    2>&1 | grep -E "\[Strip\]|\[Bytecode\]|\[Assembler\]"
  ```
  Expected:
  ```
  [Strip] ELF 完整性验证通过
  [Bytecode] 编译完成，.pyc 文件数: 8（或更多）
  [Bytecode] 删除 .py 完成，剩余 .py 文件数（仅 __init__.py）: 50（仅 __init__.py）
  [Bytecode] 关键 .pyc 文件验证通过
  ```

- [ ] **Step 3: 验证 runtime target 完整启动（.pyc 无 .py 可正常运行）**

  ```bash
  docker build --target runtime \
    -f docker/backend.Dockerfile \
    -t vulhunter/backend-hardened . \
    2>&1 | tail -10
  ```
  Expected: 构建成功，包含 `[Cython] All core module verifications PASSED`

  ```bash
  # 验证入口点可加载
  docker run --rm vulhunter/backend-hardened \
    /opt/backend-venv/bin/python -c "
  import importlib.util
  # 验证 container_startup 从 .pyc 加载（无 .py 源）
  spec = importlib.util.find_spec('app.runtime.container_startup')
  assert spec is not None, 'container_startup not found'
  src = spec.origin
  print(f'container_startup loaded from: {src}')
  assert '.py' not in src or src.endswith('.pyc'), f'Source .py still exposed: {src}'
  print('OK: source .py not directly accessible')
  "
  ```
  Expected: `container_startup loaded from: /app/app/runtime/__pycache__/container_startup.cpython-311.pyc`

- [ ] **Step 4: 确认 source .py 不存在**

  ```bash
  docker run --rm vulhunter/backend-hardened sh -c '
    echo "=== .py files remaining (should be __init__.py only) ==="
    find /app/app -name "*.py" ! -name "__init__.py"
    echo "=== Total .so files ==="
    find /app/app -name "*.so" | wc -l
    echo "=== Total .pyc files ==="
    find /app/app -name "*.pyc" | wc -l
  '
  ```
  Expected:
  - 非 `__init__.py` 的 .py 文件数 = 0（main.py、container_startup.py 等均已删除）
  - .so 文件数 > 50
  - .pyc 文件数 ≥ 8

- [ ] **Step 5: Commit**

  ```bash
  git add docker/backend.Dockerfile
  git commit -m "feat(security): compile remaining .py to .pyc and remove source files

  After Cython assembly, compile all remaining .py files to bytecode
  (.pyc in __pycache__/) then delete .py source. Python 3 can load
  modules from __pycache__ without .py present (PEP 3147 / importlib).
  __init__.py files retained (package markers, no business logic)."
  ```

---

## Task 4: 重构 `agent_tasks_reporting.py`，消除通配符导入

**背景：** `agent_tasks_reporting.py` 第 24 行有 `from .agent_tasks_findings import *`。
通配符导入的符号集合仅在运行时确定，Task 3 的 .pyc 保护已覆盖此文件，
但代码可读性差，且未来如需 Cython 编译则必须修复。
本 Task 将通配符改为显式导入，消除这个技术债。

**Files:**
- Modify: `backend/app/api/v1/endpoints/agent_tasks_reporting.py:24`（`from .agent_tasks_findings import *`）
- Modify: `backend/cython_build/exclusion_list.txt:24`（移除 `agent_tasks_reporting.py` 条目）

- [ ] **Step 1: 查明 agent_tasks_reporting.py 实际使用了哪些来自 findings 的符号**

  ```bash
  # 找出 agent_tasks_reporting.py 中引用的所有标识符
  grep -oE '\b[a-zA-Z_][a-zA-Z0-9_]*\b' \
    backend/app/api/v1/endpoints/agent_tasks_reporting.py \
    | sort -u > /tmp/reporting_names.txt

  # 找出 agent_tasks_findings.py 导出的所有公开名称（函数/类/变量）
  grep -oE '^(def|class|async def) ([a-zA-Z_][a-zA-Z0-9_]*)' \
    backend/app/api/v1/endpoints/agent_tasks_findings.py \
    | awk '{print $2}' > /tmp/findings_exports.txt

  # 求交集：reporting 中实际用到的 findings 符号
  comm -12 \
    <(sort /tmp/reporting_names.txt) \
    <(sort /tmp/findings_exports.txt)
  ```
  Expected: 输出若干函数名（这些是需要显式导入的符号）

- [ ] **Step 2: 将通配符导入替换为显式导入**

  编辑 `backend/app/api/v1/endpoints/agent_tasks_reporting.py`，
  将第 24 行：
  ```python
  from .agent_tasks_findings import *
  ```
  替换为 Step 1 查出的实际使用符号，例如：
  ```python
  from .agent_tasks_findings import (
      _save_findings,
      _enrich_findings_with_flow_and_logic,
      _serialize_agent_findings,
      # ... 其他 Step 1 输出的符号
  )
  ```

  > **具体符号列表以 Step 1 命令实际输出为准**，不要手动猜测。

- [ ] **Step 3: 运行现有测试验证功能未破坏**

  ```bash
  cd backend
  python -m pytest tests/ -x -q --tb=short 2>&1 | tail -20
  ```
  Expected: 无测试失败（如无相关测试，至少确认模块可正常导入）

  ```bash
  cd backend
  python -c "from app.api.v1.endpoints.agent_tasks_reporting import router; print('Import OK')"
  ```
  Expected: `Import OK`

- [ ] **Step 4: 从 exclusion_list.txt 移除该文件条目**

  编辑 `backend/cython_build/exclusion_list.txt`，删除：
  ```
  # 含通配符导入（from .agent_tasks_findings import *）及 async 函数内嵌套闭包，
  # Cython 编译期无法解析通配符引入的名称
  api/v1/endpoints/agent_tasks_reporting.py
  ```

  > **关于 async 闭包问题**: 如果 Cython 编译仍失败（async 闭包），可将该文件保留在
  > exclusion_list.txt 并仅享受 Task 3 的 .pyc 保护（显式导入的改动仍有价值）。

- [ ] **Step 5: 验证（可选）Cython 可编译该文件**

  ```bash
  cd backend
  python -m cython --version  # 确认 cython 可用

  # 单独编译测试
  python -m cython -3 --no-docstrings \
    app/api/v1/endpoints/agent_tasks_reporting.py \
    -o /tmp/agent_tasks_reporting.c 2>&1 | tail -5
  ```
  Expected: 无 `error:` 输出（即 Cython 可成功解析）

- [ ] **Step 6: Commit**

  ```bash
  git add backend/app/api/v1/endpoints/agent_tasks_reporting.py \
          backend/cython_build/exclusion_list.txt
  git commit -m "refactor: replace wildcard import in agent_tasks_reporting with explicit imports

  Replace 'from .agent_tasks_findings import *' with explicit symbol imports.
  Eliminates Cython/pyc compilation barrier. No behavioral change."
  ```

---

## Task 5: 添加非 root 用户（仅 runtime target）

**Files:** Modify `docker/backend.Dockerfile`（`runtime` 阶段，`EXPOSE 8000` 之前）

> **注意**: 仅修改 `runtime` 阶段，`runtime-plain`（开发用）**不做修改**。

- [ ] **Step 1: 在 runtime 阶段的 EXPOSE 8000 之前插入用户创建**

  打开 `docker/backend.Dockerfile`，定位 `runtime` 阶段的 `EXPOSE 8000`（约第 459 行），
  在其之前插入：

  ```dockerfile
  # ── 非 root 用户：降权运行，减小容器逃逸风险 ───────────────
  RUN groupadd --gid 1001 appgroup && \
      useradd --uid 1001 --gid appgroup \
              --no-create-home --shell /sbin/nologin appuser && \
      chown -R appuser:appgroup \
        /app \
        /opt/backend-venv \
        /opt/backend-build-context

  USER appuser
  ```

- [ ] **Step 2: 验证运行用户**

  ```bash
  docker build --target runtime \
    -f docker/backend.Dockerfile \
    -t vulhunter/backend-nonroot .
  docker run --rm vulhunter/backend-nonroot id
  ```
  Expected: `uid=1001(appuser) gid=1001(appgroup) groups=1001(appgroup)`

- [ ] **Step 3: 验证 volume 写入权限（模拟 compose 挂载）**

  ```bash
  docker run --rm \
    -v /tmp/vulhunter-test:/app/uploads \
    vulhunter/backend-nonroot \
    sh -c 'touch /app/uploads/test.txt && echo "Write OK" || echo "Write FAILED"'
  ```
  Expected: `Write OK`
  > 如失败，在 `docker-compose.yml` 中添加 `user: "1001:1001"` 或确保宿主机 volume 目录 owner 为 uid 1001。

- [ ] **Step 4: Commit**

  ```bash
  git add docker/backend.Dockerfile
  git commit -m "feat(security): run production backend as non-root user (uid=1001)

  Add appuser/appgroup (uid/gid 1001) to runtime stage only.
  runtime-plain (dev target) unchanged. Transfer ownership of
  /app, /opt/backend-venv, /opt/backend-build-context."
  ```

---

## Task 6: Python healthcheck 替代 curl，减小攻击面

**Files:**
- Modify: `docker-compose.yml`（backend service healthcheck 段）
- Modify: `docker/backend.Dockerfile:248-258`（runtime-base 的 `RUNTIME_PACKAGES`）

- [ ] **Step 1: 修改 docker-compose.yml 的 backend healthcheck**

  打开 `docker-compose.yml`，找到 backend service 的 healthcheck：
  ```yaml
  healthcheck:
    test: [ "CMD-SHELL", "curl -fsS http://127.0.0.1:8000/health >/dev/null" ]
    interval: 5s
    timeout: 3s
    start_period: 10s
    retries: 60
  ```

  替换为：
  ```yaml
  healthcheck:
    test:
      - "CMD"
      - "/opt/backend-venv/bin/python"
      - "-c"
      - "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"
    interval: 5s
    timeout: 5s
    start_period: 10s
    retries: 60
  ```

- [ ] **Step 2: 从 runtime-base APT 安装包列表中删除 curl**

  打开 `docker/backend.Dockerfile`，找到 runtime-base 阶段的 `RUNTIME_PACKAGES` 赋值（约第 248-258 行）：

  ```dockerfile
  RUNTIME_PACKAGES=" \
    libpq5 \
    curl \
    git \
    libpango-1.0-0 \
  ```

  删除 `curl \` 这一行，结果为：
  ```dockerfile
  RUNTIME_PACKAGES=" \
    libpq5 \
    git \
    libpango-1.0-0 \
  ```

  > `libpq5 \` 之后的续行反斜杠已被 `git \` 承接，删除 `curl \` 不影响 shell 语法。

- [ ] **Step 3: 验证 Python healthcheck 可用**

  ```bash
  docker run --rm vulhunter/backend-nonroot \
    /opt/backend-venv/bin/python -c "
  import urllib.request
  print('urllib.request available:', hasattr(urllib.request, 'urlopen'))
  "
  ```
  Expected: `urllib.request available: True`

- [ ] **Step 4: 验证 curl 已不存在于镜像**

  ```bash
  docker run --rm vulhunter/backend-nonroot \
    sh -c 'which curl 2>&1 || echo "curl NOT FOUND (expected)"'
  ```
  Expected: `curl NOT FOUND (expected)`

- [ ] **Step 5: 完整 compose 冒烟测试（如有可用环境）**

  ```bash
  docker compose up -d db redis backend
  sleep 15
  docker compose ps backend | grep -E "healthy|starting"
  ```
  Expected: backend 状态为 `healthy`

- [ ] **Step 6: Commit**

  ```bash
  git add docker/backend.Dockerfile docker-compose.yml
  git commit -m "feat(security): replace curl healthcheck with Python urllib, remove curl

  Use stdlib urllib.request.urlopen for health endpoint check.
  Remove curl from runtime image (reduces attack surface / exploit tools).
  Healthcheck timeout bumped to 5s to compensate for Python startup."
  ```

---

## Task 7: 端到端验证（最终验收）

- [ ] **Step 1: 完整生产镜像构建**

  ```bash
  docker build --target runtime \
    -f docker/backend.Dockerfile \
    -t vulhunter/backend-final:hardened . \
    2>&1 | grep -E "\[Strip\]|\[Bytecode\]|\[Cython\]|\[Assembler\]"
  ```
  Expected: 依次出现 `[Strip] ELF 完整性验证通过`、`[Bytecode] 关键 .pyc 文件验证通过`、`[Cython] All core module verifications PASSED`

- [ ] **Step 2: 逆向难度矩阵验证**

  ```bash
  docker run --rm vulhunter/backend-final:hardened sh -c '
    echo "=== 1. 运行用户 ==="
    id

    echo "=== 2. .so 符号状态（应为 0 或仅 PyInit_*）==="
    find /app/app -name "*.so" | head -3 | while read so; do
      count=$(nm -D "$so" 2>/dev/null | grep -c " T " || echo 0)
      echo "  $so: exported_T_symbols=$count"
    done

    echo "=== 3. 明文 .py 源文件（非 __init__.py，应为 0）==="
    find /app/app -name "*.py" ! -name "__init__.py" | wc -l

    echo "=== 4. .pyc 字节码文件（应 >= 8）==="
    find /app/app -name "*.pyc" | wc -l

    echo "=== 5. .so 编译模块（应 > 50）==="
    find /app/app -name "*.so" | wc -l

    echo "=== 6. curl 可执行文件（应不存在）==="
    which curl 2>&1 || echo "curl: NOT FOUND (OK)"

    echo "=== 7. Python 版本（运行时一致性）==="
    /opt/backend-venv/bin/python --version
  '
  ```
  Expected:
  - 运行用户：`uid=1001(appuser)`
  - .so 导出符号：每个 ≤ 1（仅 `PyInit_*`）
  - 明文 .py 源文件（非 __init__.py）：`0`
  - .pyc 文件：`>= 8`
  - .so 文件：`> 50`
  - curl：`NOT FOUND`

- [ ] **Step 3: 核心业务模块导入验证**

  ```bash
  docker run --rm vulhunter/backend-final:hardened \
    /opt/backend-venv/bin/python -c "
  import importlib.util
  results = []
  tests = [
      ('app.core.config',             '.so'),
      ('app.services.agent.config',   '.so'),
      ('app.db.session',              '.so'),
      ('app.runtime.container_startup', '.pyc'),
  ]
  for mod, expected_ext in tests:
      spec = importlib.util.find_spec(mod)
      assert spec, f'Module not found: {mod}'
      ext = '.so' if spec.origin.endswith('.so') else '.pyc'
      status = 'OK' if ext == expected_ext else f'WARN(got {ext})'
      print(f'[{status}] {mod}: {spec.origin.split(\"/\")[-1]}')
  "
  ```
  Expected: 所有行显示 `[OK]`

- [ ] **Step 4: 最终 Commit**

  ```bash
  git add -A
  git commit -m "feat(security): complete backend Docker obfuscation hardening (open source)

  Three-layer protection for production runtime target:
  Layer 1: Cython .so (existing) + strip --strip-all debug symbols
  Layer 2: Remaining .py → .pyc bytecode, source .py deleted from image
  Layer 3: Non-root user appuser (uid=1001), curl removed, Python healthcheck

  Tools: binutils strip (layer 1), Python compileall (layer 2), Docker (layer 3)
  No commercial tools required. runtime-plain dev target unchanged."
  ```

---

## 附录 A：防护层覆盖范围总结

| 文件类型 | 数量 | 防护方式 | 可逆向性 |
|---------|------|---------|---------|
| Cython 编译 .so + 符号剥离 | ~260 | .so stripped | 高难度（需 IDA/Ghidra 反汇编） |
| `__init__.py` 包标识文件 | ~50 | 无（仅含 import，无商业逻辑）| 可读（可接受） |
| 入口/启动/launcher + reporting | 8 | .pyc（无 .py 源） | 中难度（需 decompyle3 等工具）|
| Alembic 迁移脚本 | N | 无（含 schema，无业务逻辑）| 可读（可接受）|

## 附录 B：开源工具清单

| 工具 | 许可证 | 用途 |
|------|--------|------|
| `strip` (binutils) | GPL-3.0 | 剥离 .so ELF 符号 |
| `python -m compileall` | PSF License | 生成 .pyc 字节码 |
| Docker BuildKit | Apache-2.0 | 多阶段构建 |

## 附录 C：.pyc 保护的局限性说明

`.pyc` 可被 `decompyle3`、`pycdc` 等工具反编译回接近原始 Python 的代码。
其价值在于**提高攻击门槛**，而非提供密码学意义上的不可逆保护。
主要商业价值代码（services/、core/、api/）已由 Cython .so 保护，.pyc 仅补充保护入口脚本。
如需更强保护入口脚本，可将启动逻辑迁移至 .so 中，保留最小化入口存根。
