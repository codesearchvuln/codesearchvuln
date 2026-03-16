import test from "node:test";
import assert from "node:assert/strict";

import { apiClient } from "../src/shared/api/serverClient.ts";
import {
  batchDeletePhpstanRules,
  batchRestorePhpstanRules,
  batchUpdatePhpstanRulesEnabled,
  deletePhpstanRule,
  getPhpstanRule,
  getPhpstanRules,
  restorePhpstanRule,
  updatePhpstanRule,
  updatePhpstanRuleEnabled,
} from "../src/shared/api/phpstan.ts";

test("phpstan rules api client maps rules endpoints", async () => {
  const originalPost = apiClient.post;
  const originalGet = apiClient.get;
  const originalPatch = apiClient.patch;
  const calls: Array<{ method: string; url: string }> = [];

  apiClient.post = (async (url: string) => {
    calls.push({ method: "post", url });
    return { data: { ok: true } };
  }) as typeof apiClient.post;

  apiClient.get = (async (url: string) => {
    calls.push({ method: "get", url });
    return { data: [] };
  }) as typeof apiClient.get;

  apiClient.patch = (async (url: string) => {
    calls.push({ method: "patch", url });
    return { data: { ok: true } };
  }) as typeof apiClient.patch;

  try {
    await getPhpstanRules({ is_active: true, source: "official_extension", keyword: "strict", deleted: "false", skip: 1, limit: 5 });
    await getPhpstanRule("pkg:RuleClass");
    await updatePhpstanRule({ ruleId: "pkg:RuleClass", name: "RuleClassCustom" });
    await updatePhpstanRuleEnabled({ ruleId: "pkg:RuleClass", is_active: false });
    await batchUpdatePhpstanRulesEnabled({ rule_ids: ["pkg:RuleClass"], is_active: true });
    await deletePhpstanRule("pkg:RuleClass");
    await restorePhpstanRule("pkg:RuleClass");
    await batchDeletePhpstanRules({ rule_ids: ["pkg:RuleClass"] });
    await batchRestorePhpstanRules({ rule_ids: ["pkg:RuleClass"] });
  } finally {
    apiClient.post = originalPost;
    apiClient.get = originalGet;
    apiClient.patch = originalPatch;
  }

  assert.deepEqual(
    calls.map((item) => `${item.method}:${item.url}`),
    [
      "get:/static-tasks/phpstan/rules?is_active=true&source=official_extension&keyword=strict&deleted=false&skip=1&limit=5",
      "get:/static-tasks/phpstan/rules/pkg%3ARuleClass",
      "patch:/static-tasks/phpstan/rules/pkg%3ARuleClass",
      "post:/static-tasks/phpstan/rules/pkg%3ARuleClass/enabled",
      "post:/static-tasks/phpstan/rules/batch/enabled",
      "post:/static-tasks/phpstan/rules/pkg%3ARuleClass/delete",
      "post:/static-tasks/phpstan/rules/pkg%3ARuleClass/restore",
      "post:/static-tasks/phpstan/rules/batch/delete",
      "post:/static-tasks/phpstan/rules/batch/restore",
    ],
  );
});
