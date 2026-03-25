import test from "node:test";
import assert from "node:assert/strict";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  YasaRuleDetailPanel,
  type YasaRuleRowViewModel,
} from "../src/pages/YasaRules.tsx";
import { PmdRulesetDetailPanel } from "../src/pages/PmdRules.tsx";
import type { PmdRulesetSummary } from "../src/shared/api/pmd.ts";

globalThis.React = React;

const customYasaRule: YasaRuleRowViewModel = {
  id: "custom-yasa-rule-1",
  ruleName: "Custom taint flow guard",
  languages: ["golang", "java"],
  source: "自定义规则",
  confidence: "低",
  activeStatus: "已禁用",
  verifyStatus: "✓ 可用",
  createdAt: "-",
  checkerPacks: ["taint-flow", "input-validation"],
  checkerPath: "/opt/yasa/checkers/custom/taint-flow",
  demoRuleConfigPath: "/opt/yasa/demo/custom-taint-rule.json",
  description: "检测跨边界输入在未校验时进入危险 sink。",
  ruleConfigJson: JSON.stringify(
    {
      checkerIds: ["taint_flow_go_input"],
      options: { strict: true },
    },
    null,
    2,
  ),
};

const builtinPmdRuleset: PmdRulesetSummary = {
  id: "pmd-java-security",
  name: "PMD Java Security",
  description: "聚合了 Java 安全检查规则。",
  filename: "java-security.xml",
  is_active: true,
  source: "builtin",
  ruleset_name: "category/java/security.xml",
  rule_count: 42,
  languages: ["java"],
  priorities: [1, 2, 3],
  external_info_urls: ["https://pmd.github.io"],
  rules: [],
  raw_xml: "<ruleset name=\"Java Security\">\n  <rule ref=\"category/java/security.xml\" />\n</ruleset>",
  created_by: null,
  created_at: "2026-03-20T00:00:00Z",
  updated_at: "2026-03-21T00:00:00Z",
};

test("YasaRuleDetailPanel renders segmented detail sections with copyable raw config", () => {
  const markup = renderToStaticMarkup(
    createElement(YasaRuleDetailPanel, {
      rule: customYasaRule,
      onCopyRawContent: async () => {},
    }),
  );

  assert.match(markup, /基本信息/);
  assert.match(markup, /说明信息/);
  assert.match(markup, /技术路径/);
  assert.match(markup, /规则配置/);
  assert.match(markup, /自定义规则/);
  assert.match(markup, /已禁用/);
  assert.match(markup, /taint-flow/);
  assert.match(markup, /input-validation/);
  assert.match(markup, /复制配置/);
  assert.match(markup, /checkerIds/);
  assert.match(markup, /custom-taint-rule\.json/);
});

test("PmdRulesetDetailPanel renders overview metadata and dedicated raw xml viewer", () => {
  const markup = renderToStaticMarkup(
    createElement(PmdRulesetDetailPanel, {
      ruleset: builtinPmdRuleset,
      onCopyRawXml: async () => {},
    }),
  );

  assert.match(markup, /基本信息/);
  assert.match(markup, /说明信息/);
  assert.match(markup, /原始 XML/);
  assert.match(markup, /复制 XML/);
  assert.match(markup, /PMD Java Security/);
  assert.match(markup, /内置 ruleset/);
  assert.match(markup, /启用/);
  assert.match(markup, /42/);
  assert.match(markup, /java-security\.xml/);
  assert.match(markup, /category\/java\/security\.xml/);
  assert.match(markup, /&lt;ruleset name=/);
});
