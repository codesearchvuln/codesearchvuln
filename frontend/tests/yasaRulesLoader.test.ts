import assert from "node:assert/strict";
import test from "node:test";

import {
  loadYasaRulesPageData,
  YASA_CUSTOM_RULE_CONFIGS_LOAD_ERROR_FALLBACK,
  YASA_RULES_LOAD_ERROR_FALLBACK,
  YASA_RUNTIME_CONFIG_LOAD_ERROR_FALLBACK,
} from "../src/pages/yasaRulesLoader.ts";

test("loadYasaRulesPageData returns complete data when all requests succeed", async () => {
  const result = await loadYasaRulesPageData({
    getRules: async () => [
      {
        checker_id: "builtin.rule",
        checker_packs: ["javascript_default"],
        languages: ["javascript"],
        source: "builtin",
      },
    ],
    getRuleConfigs: async () => [
      {
        id: "custom-1",
        name: "custom rule",
        language: "javascript",
        checker_ids: "builtin.rule",
        rule_config_json: "{}",
        is_active: true,
        source: "custom",
        created_at: "2026-03-24T10:00:00Z",
      },
    ],
    getRuntimeConfig: async () => ({
      yasa_timeout_seconds: 600,
      yasa_orphan_stale_seconds: 120,
      yasa_exec_heartbeat_seconds: 15,
      yasa_process_kill_grace_seconds: 2,
    }),
  });

  assert.equal(result.rules.length, 1);
  assert.equal(result.customRuleConfigs.length, 1);
  assert.equal(result.runtimeConfig?.yasa_timeout_seconds, 600);
  assert.equal(result.rulesLoadError, null);
  assert.equal(result.customConfigsLoadError, null);
  assert.equal(result.runtimeConfigLoadError, null);
});

test("loadYasaRulesPageData degrades gracefully when runtime config fails", async () => {
  const result = await loadYasaRulesPageData({
    getRules: async () => [
      {
        checker_id: "builtin.rule",
        checker_packs: [],
        languages: ["python"],
        source: "builtin",
      },
    ],
    getRuleConfigs: async () => [],
    getRuntimeConfig: async () => {
      throw new Error("runtime-config failed");
    },
  });

  assert.equal(result.rules.length, 1);
  assert.equal(result.runtimeConfig, null);
  assert.equal(result.rulesLoadError, null);
  assert.equal(result.customConfigsLoadError, null);
  assert.equal(
    result.runtimeConfigLoadError,
    YASA_RUNTIME_CONFIG_LOAD_ERROR_FALLBACK,
  );
});

test("loadYasaRulesPageData degrades gracefully when custom rule configs fail", async () => {
  const result = await loadYasaRulesPageData({
    getRules: async () => [
      {
        checker_id: "builtin.rule",
        checker_packs: ["python_default"],
        languages: ["python"],
        source: "builtin",
      },
    ],
    getRuleConfigs: async () => {
      throw new Error("rule-configs failed");
    },
    getRuntimeConfig: async () => ({
      yasa_timeout_seconds: 600,
      yasa_orphan_stale_seconds: 120,
      yasa_exec_heartbeat_seconds: 15,
      yasa_process_kill_grace_seconds: 2,
    }),
  });

  assert.equal(result.rules.length, 1);
  assert.equal(result.customRuleConfigs.length, 0);
  assert.equal(result.rulesLoadError, null);
  assert.equal(
    result.customConfigsLoadError,
    YASA_CUSTOM_RULE_CONFIGS_LOAD_ERROR_FALLBACK,
  );
  assert.equal(result.runtimeConfigLoadError, null);
});

test("loadYasaRulesPageData only marks rules failure when builtin rules request fails", async () => {
  const result = await loadYasaRulesPageData({
    getRules: async () => {
      throw new Error("rules failed");
    },
    getRuleConfigs: async () => [
      {
        id: "custom-1",
        name: "custom rule",
        language: "java",
        checker_ids: "builtin.rule",
        rule_config_json: "{}",
        is_active: true,
        source: "custom",
        created_at: "2026-03-24T10:00:00Z",
      },
    ],
    getRuntimeConfig: async () => ({
      yasa_timeout_seconds: 600,
      yasa_orphan_stale_seconds: 120,
      yasa_exec_heartbeat_seconds: 15,
      yasa_process_kill_grace_seconds: 2,
    }),
  });

  assert.equal(result.rules.length, 0);
  assert.equal(result.customRuleConfigs.length, 1);
  assert.equal(result.runtimeConfig?.yasa_timeout_seconds, 600);
  assert.equal(result.rulesLoadError, YASA_RULES_LOAD_ERROR_FALLBACK);
  assert.equal(result.customConfigsLoadError, null);
  assert.equal(result.runtimeConfigLoadError, null);
});
