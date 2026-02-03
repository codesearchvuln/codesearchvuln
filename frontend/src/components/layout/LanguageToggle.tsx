import { Languages } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { useLanguage, type AppLanguage } from "@/shared/i18n";

interface ToggleOptionProps {
  active: boolean;
  label: string;
  onClick: () => void;
  compact?: boolean;
}

function ToggleOption({ active, label, onClick, compact = false }: ToggleOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-xs font-semibold rounded transition-all duration-200 border",
        compact ? "px-1.5 py-1 min-w-9" : "px-2.5 py-1",
        active
          ? "text-primary-foreground bg-primary border-primary/80 shadow-sm"
          : "text-muted-foreground bg-transparent border-transparent hover:text-foreground hover:bg-muted/70",
      )}
    >
      {label}
    </button>
  );
}

interface LanguageToggleProps {
  compact?: boolean;
  className?: string;
}

export default function LanguageToggle({
  compact = false,
  className,
}: LanguageToggleProps) {
  const { language, setLanguage } = useLanguage();

  const setTargetLanguage = (next: AppLanguage) => {
    if (next !== language) {
      setLanguage(next);
    }
  };

  return (
    <div data-no-i18n="true" className={cn("w-full", className)}>
      <div
        className={cn(
          "flex items-center rounded-md border shadow-sm backdrop-blur-sm",
          compact ? "justify-center gap-1 px-1.5 py-1.5" : "gap-1.5 px-2.5 py-1.5",
        )}
        style={{
          background:
            "color-mix(in srgb, var(--cyber-bg-elevated) 92%, black)",
          borderColor: "var(--cyber-border)",
        }}
      >
        <Languages className="w-4 h-4 text-primary" />
        <ToggleOption
          active={language === "zh"}
          label="中文"
          compact={compact}
          onClick={() => setTargetLanguage("zh")}
        />
        <ToggleOption
          active={language === "en"}
          label="EN"
          compact={compact}
          onClick={() => setTargetLanguage("en")}
        />
      </div>
    </div>
  );
}
