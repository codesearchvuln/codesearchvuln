import test from "node:test";
import assert from "node:assert/strict";

import { buildAgentDisplayStageSummary } from "../src/pages/AgentAudit/stageProgress.ts";
import { getTaskActivityStageBadgeMeta } from "../src/features/tasks/services/taskActivities.ts";

test("buildAgentDisplayStageSummary prefers backend display phase over stale current_phase", () => {
  const summary = buildAgentDisplayStageSummary({
    task: {
      id: "task-1",
      project_id: "project-1",
      name: "智能扫描任务",
      description: "[INTELLIGENT] demo",
      task_type: "agent_audit",
      status: "running",
      current_phase: "analysis",
      current_step: "侦查阶段进行中",
      workflow_phase: "recon",
      display_phase: "recon",
      total_files: 0,
      indexed_files: 0,
      analyzed_files: 0,
      files_with_findings: 0,
      total_chunks: 0,
      findings_count: 0,
      verified_count: 0,
      false_positive_count: 0,
      total_iterations: 0,
      tool_calls_count: 0,
      tokens_used: 0,
      critical_count: 0,
      high_count: 0,
      medium_count: 0,
      low_count: 0,
      quality_score: 0,
      security_score: null,
      created_at: "2026-04-18T00:00:00.000Z",
      started_at: "2026-04-18T00:00:01.000Z",
      completed_at: null,
      progress_percentage: 0,
      audit_scope: null,
      target_vulnerabilities: null,
      verification_level: null,
      exclude_patterns: null,
      target_files: null,
      error_message: null,
    },
    logs: [],
  });

  assert.equal(summary?.currentStageKey, "recon");
  assert.equal(summary?.currentStageLabel, "侦查");
});

test("getTaskActivityStageBadgeMeta uses backend display phase for running tasks", () => {
  const badge = getTaskActivityStageBadgeMeta({
    kind: "intelligent_audit",
    sourceMode: "intelligent",
    status: "running",
    currentPhase: "analysis",
    currentStep: "侦查阶段进行中",
    workflowPhase: "recon",
    displayPhase: "recon",
  });

  assert.equal(badge?.key, "recon");
  assert.equal(badge?.label, "侦查");
});
