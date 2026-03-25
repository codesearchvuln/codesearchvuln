import { apiClient } from "@/shared/api/serverClient";

export interface PmdPreset {
  id: string;
  name: string;
  alias: string;
  description: string;
  categories: string[];
}

export interface PmdRuleDetail {
  name?: string | null;
  ref?: string | null;
  language?: string | null;
  message?: string | null;
  class_name?: string | null;
  priority?: number | null;
  since?: string | null;
  external_info_url?: string | null;
  description?: string | null;
}

export interface PmdRulesetSummary {
  id: string;
  name: string;
  description?: string | null;
  filename: string;
  is_active: boolean;
  source: string;
  ruleset_name: string;
  rule_count: number;
  languages: string[];
  priorities: number[];
  external_info_urls: string[];
  rules: PmdRuleDetail[];
  raw_xml: string;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type PmdRuleConfig = PmdRulesetSummary;

export async function getPmdPresets(): Promise<PmdPreset[]> {
  const response = await apiClient.get("/static-tasks/pmd/presets");
  return response.data;
}

export async function getPmdBuiltinRulesets(params?: {
  keyword?: string;
  language?: string;
  limit?: number;
}): Promise<PmdRulesetSummary[]> {
  const searchParams = new URLSearchParams();
  if (params?.keyword) searchParams.set("keyword", params.keyword);
  if (params?.language) searchParams.set("language", params.language);
  if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));
  const query = searchParams.toString();
  const response = await apiClient.get(
    `/static-tasks/pmd/builtin-rulesets${query ? `?${query}` : ""}`,
  );
  return response.data;
}

export async function getPmdBuiltinRuleset(
  rulesetId: string,
): Promise<PmdRulesetSummary> {
  const response = await apiClient.get(
    `/static-tasks/pmd/builtin-rulesets/${encodeURIComponent(rulesetId)}`,
  );
  return response.data;
}

export async function importPmdRuleConfig(params: {
  name: string;
  description?: string;
  xmlFile: File;
}): Promise<PmdRuleConfig> {
  const formData = new FormData();
  formData.append("name", params.name);
  if (params.description) formData.append("description", params.description);
  formData.append("xml_file", params.xmlFile);
  const response = await apiClient.post("/static-tasks/pmd/rule-configs/import", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function getPmdRuleConfigs(params?: {
  is_active?: boolean;
  keyword?: string;
  skip?: number;
  limit?: number;
}): Promise<PmdRuleConfig[]> {
  const searchParams = new URLSearchParams();
  if (params?.is_active !== undefined) {
    searchParams.set("is_active", String(params.is_active));
  }
  if (params?.keyword) searchParams.set("keyword", params.keyword);
  if (params?.skip !== undefined) searchParams.set("skip", String(params.skip));
  if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));
  const query = searchParams.toString();
  const response = await apiClient.get(
    `/static-tasks/pmd/rule-configs${query ? `?${query}` : ""}`,
  );
  return response.data;
}

export async function getPmdRuleConfig(ruleConfigId: string): Promise<PmdRuleConfig> {
  const response = await apiClient.get(
    `/static-tasks/pmd/rule-configs/${encodeURIComponent(ruleConfigId)}`,
  );
  return response.data;
}

export async function updatePmdRuleConfig(
  ruleConfigId: string,
  payload: {
    name?: string;
    description?: string;
    is_active?: boolean;
  },
): Promise<PmdRuleConfig> {
  const response = await apiClient.patch(
    `/static-tasks/pmd/rule-configs/${encodeURIComponent(ruleConfigId)}`,
    payload,
  );
  return response.data;
}

export async function deletePmdRuleConfig(
  ruleConfigId: string,
): Promise<{ message: string; id: string }> {
  const response = await apiClient.delete(
    `/static-tasks/pmd/rule-configs/${encodeURIComponent(ruleConfigId)}`,
  );
  return response.data;
}
