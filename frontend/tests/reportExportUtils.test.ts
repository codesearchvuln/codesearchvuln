import test from "node:test";
import assert from "node:assert/strict";

import {
  formatReportExportBytes,
  getReportExportScoreColor,
  getReportExportSeverityColor,
} from "../src/pages/AgentAudit/report-export/utils.ts";

test("formatReportExportBytes formats byte sizes", () => {
  assert.equal(formatReportExportBytes(0), "0 B");
  assert.equal(formatReportExportBytes(1024), "1 KB");
  assert.equal(formatReportExportBytes(1536), "1.5 KB");
});

test("getReportExportSeverityColor maps common severities", () => {
  assert.equal(
    getReportExportSeverityColor("critical"),
    "text-rose-600 dark:text-rose-400",
  );
  assert.equal(
    getReportExportSeverityColor("unknown"),
    "text-muted-foreground",
  );
});

test("getReportExportScoreColor returns expected bands", () => {
  assert.equal(getReportExportScoreColor(85).text, "text-emerald-600 dark:text-emerald-400");
  assert.equal(getReportExportScoreColor(65).bg, "stroke-amber-500");
  assert.equal(getReportExportScoreColor(20).bg, "stroke-rose-500");
});
