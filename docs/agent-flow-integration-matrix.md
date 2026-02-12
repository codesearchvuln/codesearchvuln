# 智能审计三轨流分析接入矩阵

## 工具接入矩阵

| 轨道 | 工具 | 许可证 | 角色 | 语言范围 | 编译依赖 | 触发时机 | 证据输出 |
|---|---|---|---|---|---|---|---|
| 轻量主链 | tree-sitter + code2flow(可选) | MIT | AST/调用关系/入口到 sink 近似路径 | py/js/ts/java/c/cpp | 无 | 每次任务 | call_chain/control_conditions/path_score |
| 深度复核 | Joern | Apache-2.0 | 高危候选可达性深度复核 | c/cpp/java/js/py | 无(默认) | 高危+高置信灰区 | joern flow evidence |
| 逻辑漏洞专线 | Authz Graph Rule Engine(内部) | 内部代码 | 鉴权/越权/IDOR 图规则 | 主流 web 语言 + C/C++ 服务端模式 | 无 | 每次任务并行 | missing_authz/idor/proof_nodes |

## 合规模板

- SPDX: `compliance/sbom/backend.spdx.json`
- CycloneDX: `compliance/sbom/backend.cdx.json`
- NOTICE: `NOTICE`
- 生成脚本: `backend/scripts/generate_sbom.sh`
- 每周 CI 任务: `.github/workflows/sbom-weekly.yml`

## 分阶段顺序

1. Phase 1: 轻量主链（tree-sitter + code2flow 可选增强）
2. Phase 2: Joern 深度复核（高危候选）
3. Phase 3: 逻辑漏洞图规则（鉴权/越权/IDOR）
4. Phase 4: SBOM/NOTICE 合规产物与 CI 周期化
