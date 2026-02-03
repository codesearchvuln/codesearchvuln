import generatedMap from "./offlineZhEnMap.generated.json";
import { manualDomTranslations } from "./dom-dictionaries";

interface TextSegments {
  prefix: string;
  core: string;
  suffix: string;
}

type TranslationMap = Record<string, string>;

const OFFLINE_TRANSLATIONS: TranslationMap = {
  ...(generatedMap as TranslationMap),
  ...manualDomTranslations,
};

const FRAGMENT_TRANSLATIONS: Array<[string, string]> = Object.entries({
  "面向代码安全与合规审计的智能分析平台。": "An intelligent platform for code security and compliance audits.",
  "聚焦仓库级项目，": "Focused on repository-level projects,",
  "提供任务编排、自动化审计与结果追踪，帮助团队更快定位风险与改进点。": "it provides task orchestration, automated auditing, and result tracking to help teams identify risks and improvements faster.",
  "活跃:": "Active:",
  "已完成:": "Completed:",
  "已解决:": "Resolved:",
  "保存失败:": "Save failed:",
  "重置失败:": "Reset failed:",
  "连接失败:": "Connection failed:",
  "测试失败:": "Test failed:",
  "LLM 已配置": "LLM configured",
  "规则": "Rule",
  "项目": "Project",
  "审计": "Audit",
  "启用": "Enable",
  "禁用": "Disable",
  "保存": "Save",
  "删除": "Delete",
  "取消": "Cancel",
  "返回": "Back",
  "成功": "Success",
  "失败": "Failed",
  "加载": "Loading",
  "生成": "Generate",
  "筛选": "Filter",
  "搜索": "Search",
  "状态": "Status",
  "名称": "Name",
  "语言": "Language",
  "严重程度": "Severity",
  "创建时间": "Created At",
  "详情": "Details",
  "基本信息": "Basic Information",
  "编程语言": "Programming Language",
  "所有状态": "All Status",
  "所有来源": "All Sources",
  "所有级别": "All Levels",
  "所有语言": "All Languages",
  "确认删除": "Confirm Delete",
  "通用型": "Generic",
  "事件型": "Patch-based",
}).sort(([a], [b]) => b.length - a.length);

function splitTextSegments(text: string): TextSegments {
  const prefixMatch = text.match(/^\s*/);
  const suffixMatch = text.match(/\s*$/);
  const prefix = prefixMatch ? prefixMatch[0] : "";
  const suffix = suffixMatch ? suffixMatch[0] : "";
  const core = text.slice(prefix.length, text.length - suffix.length);
  return { prefix, core, suffix };
}

function mergeTextSegments(segments: TextSegments, translatedCore: string): string {
  return `${segments.prefix}${translatedCore}${segments.suffix}`;
}

export function containsChinese(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text);
}

function translateByFragments(text: string): string | null {
  let translated = text;
  for (const [zh, en] of FRAGMENT_TRANSLATIONS) {
    if (translated.includes(zh)) {
      translated = translated.split(zh).join(en);
    }
  }

  return translated === text ? null : translated;
}

function translateCoreText(text: string): string | null {
  const exact = OFFLINE_TRANSLATIONS[text];
  if (exact) {
    return exact;
  }

  return translateByFragments(text);
}

export function getCachedEnglish(text: string): string | null {
  const segments = splitTextSegments(text);
  if (!segments.core || !containsChinese(segments.core)) {
    return null;
  }

  const translatedCore = translateCoreText(segments.core);
  if (!translatedCore) {
    return null;
  }

  return mergeTextSegments(segments, translatedCore);
}

export function translateToEnglish(text: string): string | null {
  return getCachedEnglish(text);
}
