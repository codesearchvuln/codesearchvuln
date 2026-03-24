import test from "node:test";
import assert from "node:assert/strict";

type DashboardModule = {
  formatTokenValue?: (value: number | null | undefined) => string;
};

let dashboardModule: DashboardModule | null = null;

try {
  dashboardModule = (await import(
    "../src/features/dashboard/components/DashboardCommandCenter.tsx"
  )) as DashboardModule;
} catch {
  dashboardModule = null;
}

test("DashboardCommandCenter 将累计消耗模型 token 在 1M 以下按 K 截断展示", () => {
  assert.equal(typeof dashboardModule?.formatTokenValue, "function");
  assert.equal(dashboardModule?.formatTokenValue?.(999), "0.999K");
  assert.equal(dashboardModule?.formatTokenValue?.(12_345), "12.345K");
});

test("DashboardCommandCenter 将累计消耗模型 token 在 1M 及以上按 M 截断展示", () => {
  assert.equal(typeof dashboardModule?.formatTokenValue, "function");
  assert.equal(dashboardModule?.formatTokenValue?.(1_000_000), "1M");
  assert.equal(dashboardModule?.formatTokenValue?.(1_482_360), "1.482M");
});
