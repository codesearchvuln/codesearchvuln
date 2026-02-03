import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useDomAutoTranslation } from "./useDomAutoTranslation";
import { I18N_MESSAGES, type I18nKey } from "./messages";

export type AppLanguage = "zh" | "en";

interface LanguageContextValue {
  language: AppLanguage;
  isEnglish: boolean;
  setLanguage: (language: AppLanguage) => void;
  toggleLanguage: () => void;
  t: (key: I18nKey, fallback?: string) => string;
}

interface LanguageProviderProps {
  children: ReactNode;
}

const LANGUAGE_STORAGE_KEY = "vulhunter_ui_language";
const LanguageContext = createContext<LanguageContextValue | null>(null);

function resolveInitialLanguage(): AppLanguage {
  if (typeof window === "undefined") {
    return "zh";
  }

  const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (saved === "zh" || saved === "en") {
    return saved;
  }

  const browserLanguage = window.navigator.language.toLowerCase();
  return browserLanguage.startsWith("en") ? "en" : "zh";
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<AppLanguage>(
    resolveInitialLanguage,
  );

  useDomAutoTranslation(language);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => (prev === "zh" ? "en" : "zh"));
  }, []);

  const t = useCallback(
    (key: I18nKey, fallback?: string) => {
      const value = I18N_MESSAGES[language][key];
      if (value) {
        return value;
      }
      return fallback ?? key;
    },
    [language],
  );

  const contextValue = useMemo(
    () => ({
      language,
      isEnglish: language === "en",
      setLanguage,
      toggleLanguage,
      t,
    }),
    [language, setLanguage, toggleLanguage, t],
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }

  return context;
}

export const useI18n = useLanguage;
