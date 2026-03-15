/**
 * PHPStan 静态扫描 API 客户端封装
 */

import { apiClient } from "@/shared/api/serverClient";

export interface PhpstanScanTask {
  id: string;
  project_id: string;
  name: string;
  status: string;
  target_path: string;
  level: number;
  total_findings: number;
  scan_duration_ms: number;
  files_scanned: number;
  error_message?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface PhpstanFinding {
  id: string;
  scan_task_id: string;
  file_path: string;
  line?: number | null;
  message: string;
  identifier?: string | null;
  tip?: string | null;
  status: string;
}

export async function createPhpstanScanTask(params: {
  project_id: string;
  name?: string;
  target_path?: string;
  level?: number;
}): Promise<PhpstanScanTask> {
  const response = await apiClient.post("/static-tasks/phpstan/scan", params);
  return response.data;
}

export async function getPhpstanScanTask(taskId: string): Promise<PhpstanScanTask> {
  const response = await apiClient.get(`/static-tasks/phpstan/tasks/${taskId}`);
  return response.data;
}

export async function interruptPhpstanScanTask(
  taskId: string,
): Promise<{ message: string; task_id: string; status: string }> {
  const response = await apiClient.post(`/static-tasks/phpstan/tasks/${taskId}/interrupt`);
  return response.data;
}

export async function deletePhpstanScanTask(
  taskId: string,
): Promise<{ message: string; task_id: string }> {
  const response = await apiClient.delete(`/static-tasks/phpstan/tasks/${taskId}`);
  return response.data;
}

export async function getPhpstanScanTasks(params?: {
  projectId?: string;
  status?: string;
  skip?: number;
  limit?: number;
}): Promise<PhpstanScanTask[]> {
  const searchParams = new URLSearchParams();
  if (params?.projectId) searchParams.set("project_id", params.projectId);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.skip !== undefined) searchParams.set("skip", String(params.skip));
  if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));
  const query = searchParams.toString();
  const response = await apiClient.get(
    `/static-tasks/phpstan/tasks${query ? `?${query}` : ""}`,
  );
  return response.data;
}

export async function getPhpstanFindings(params: {
  taskId: string;
  status?: string;
  skip?: number;
  limit?: number;
}): Promise<PhpstanFinding[]> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set("status", params.status);
  if (params.skip !== undefined) searchParams.set("skip", String(params.skip));
  if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
  const query = searchParams.toString();
  const response = await apiClient.get(
    `/static-tasks/phpstan/tasks/${params.taskId}/findings${query ? `?${query}` : ""}`,
  );
  return response.data;
}

export async function getPhpstanFinding(params: {
  taskId: string;
  findingId: string;
}): Promise<PhpstanFinding> {
  const response = await apiClient.get(
    `/static-tasks/phpstan/tasks/${params.taskId}/findings/${params.findingId}`,
  );
  return response.data;
}

export async function updatePhpstanFindingStatus(params: {
  findingId: string;
  status: "open" | "verified" | "false_positive" | "fixed";
}): Promise<{ message: string; finding_id: string; status: string }> {
  const response = await apiClient.post(
    `/static-tasks/phpstan/findings/${params.findingId}/status`,
    undefined,
    { params: { status: params.status } },
  );
  return response.data;
}
