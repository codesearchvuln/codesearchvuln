import generatedMap from "./offlineZhEnMap.generated.json";
import {
  manualDomTranslations,
  manualFragmentTranslations,
} from "./dom-dictionaries";

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

const FRAGMENT_TRANSLATIONS = manualFragmentTranslations;

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
