import assert from "node:assert/strict";
import test from "node:test";

import {
  loadPmdRulesPageData,
  PMD_BUILTIN_RULESETS_LOAD_ERROR_FALLBACK,
  PMD_CUSTOM_RULE_CONFIGS_LOAD_ERROR_FALLBACK,
  PMD_PRESETS_LOAD_ERROR_FALLBACK,
} from "../src/pages/pmdRulesLoader.ts";

test("loadPmdRulesPageData returns complete data when all requests succeed", async () => {
  const result = await loadPmdRulesPageData({
    getPresets: async () => [
      {
        id: "security",
        name: "安全优先",
        alias: "category/java/security.xml",
        description: "demo",
        categories: ["java"],
      },
    ],
    getBuiltinRulesets: async () => [
      {
        id: "HardCodedCryptoKey.xml",
        name: "HardCodedCryptoKey Ruleset",
        filename: "HardCodedCryptoKey.xml",
        is_active: true,
        source: "builtin",
        ruleset_name: "HardCodedCryptoKey Ruleset",
        rule_count: 1,
        languages: ["java"],
        priorities: [3],
        external_info_urls: [],
        rules: [],
        raw_xml: "<ruleset />",
      },
    ],
    getRuleConfigs: async () => [
      {
        id: "cfg-1",
        name: "custom-pmd",
        filename: "custom.xml",
        is_active: true,
        source: "custom",
        ruleset_name: "Custom Ruleset",
        rule_count: 1,
        languages: ["java"],
        priorities: [2],
        external_info_urls: [],
        rules: [],
        raw_xml: "<ruleset />",
      },
    ],
  });

  assert.equal(result.presets.length, 1);
  assert.equal(result.builtinRulesets.length, 1);
  assert.equal(result.customRuleConfigs.length, 1);
  assert.equal(result.presetsLoadError, null);
  assert.equal(result.builtinLoadError, null);
  assert.equal(result.customConfigsLoadError, null);
});

test("loadPmdRulesPageData marks builtin failure while keeping presets and custom configs", async () => {
  const result = await loadPmdRulesPageData({
    getPresets: async () => [
      {
        id: "security",
        name: "安全优先",
        alias: "category/java/security.xml",
        description: "demo",
        categories: ["java"],
      },
    ],
    getBuiltinRulesets: async () => {
      throw new Error("builtin failed");
    },
    getRuleConfigs: async () => [
      {
        id: "cfg-1",
        name: "custom-pmd",
        filename: "custom.xml",
        is_active: true,
        source: "custom",
        ruleset_name: "Custom Ruleset",
        rule_count: 1,
        languages: ["java"],
        priorities: [2],
        external_info_urls: [],
        rules: [],
        raw_xml: "<ruleset />",
      },
    ],
  });

  assert.equal(result.presets.length, 1);
  assert.equal(result.builtinRulesets.length, 0);
  assert.equal(result.customRuleConfigs.length, 1);
  assert.equal(result.builtinLoadError, PMD_BUILTIN_RULESETS_LOAD_ERROR_FALLBACK);
  assert.equal(result.presetsLoadError, null);
  assert.equal(result.customConfigsLoadError, null);
});

test("loadPmdRulesPageData degrades gracefully when presets and custom configs fail", async () => {
  const result = await loadPmdRulesPageData({
    getPresets: async () => {
      throw { response: { data: { detail: "预设暂不可用" } } };
    },
    getBuiltinRulesets: async () => [
      {
        id: "HardCodedCryptoKey.xml",
        name: "HardCodedCryptoKey Ruleset",
        filename: "HardCodedCryptoKey.xml",
        is_active: true,
        source: "builtin",
        ruleset_name: "HardCodedCryptoKey Ruleset",
        rule_count: 1,
        languages: ["java"],
        priorities: [3],
        external_info_urls: [],
        rules: [],
        raw_xml: "<ruleset />",
      },
    ],
    getRuleConfigs: async () => {
      throw new Error("custom failed");
    },
  });

  assert.equal(result.presets.length, 0);
  assert.equal(result.builtinRulesets.length, 1);
  assert.equal(result.customRuleConfigs.length, 0);
  assert.equal(result.builtinLoadError, null);
  assert.equal(result.presetsLoadError, "预设暂不可用");
  assert.equal(
    result.customConfigsLoadError,
    PMD_CUSTOM_RULE_CONFIGS_LOAD_ERROR_FALLBACK,
  );
  assert.notEqual(result.presetsLoadError, PMD_PRESETS_LOAD_ERROR_FALLBACK);
});

test("loadPmdRulesPageData formats FastAPI validation detail arrays into readable messages", async () => {
  const result = await loadPmdRulesPageData({
    getPresets: async () => [],
    getBuiltinRulesets: async () => {
      throw {
        response: {
          data: {
            detail: [
              {
                type: "less_than_equal",
                loc: ["query", "limit"],
                msg: "Input should be less than or equal to 500",
                input: "2000",
                ctx: { le: 500 },
              },
            ],
          },
        },
      };
    },
    getRuleConfigs: async () => [],
  });

  assert.equal(
    result.builtinLoadError,
    "query.limit: Input should be less than or equal to 500",
  );
  assert.notEqual(result.builtinLoadError, "[object Object]");
  assert.notEqual(result.builtinLoadError, PMD_BUILTIN_RULESETS_LOAD_ERROR_FALLBACK);
});
