import test from "node:test";
import assert from "node:assert/strict";

import type { ExportOptions } from "../src/pages/AgentAudit/report-export/components.tsx";
import { buildReportExportParams } from "../src/pages/AgentAudit/report-export/request.ts";

const DEFAULT_OPTIONS: ExportOptions = {
  includeCodeSnippets: true,
  includeRemediation: false,
  includeMetadata: true,
  compactMode: false,
};

test("buildReportExportParams maps export options to backend query params", () => {
  assert.deepEqual(buildReportExportParams("markdown", DEFAULT_OPTIONS), {
    format: "markdown",
    include_code_snippets: true,
    include_remediation: false,
    include_metadata: true,
    compact_mode: false,
  });
});

test("buildReportExportParams preserves explicit false values", () => {
  assert.deepEqual(
    buildReportExportParams("json", {
      includeCodeSnippets: false,
      includeRemediation: false,
      includeMetadata: false,
      compactMode: true,
    }),
    {
      format: "json",
      include_code_snippets: false,
      include_remediation: false,
      include_metadata: false,
      compact_mode: true,
    },
  );
});
