import FindingNarrativeMarkdown from "@/pages/AgentAudit/components/FindingNarrativeMarkdown";
import FindingDetailCodePanel, {
  type FindingDetailFullFileLoadResult,
} from "./FindingDetailCodePanel";
import FindingDetailHeaderActions, {
  type FindingDetailCodeBrowserAction,
} from "./FindingDetailHeaderActions";
import type {
  FindingDetailFullFileRequest,
  FindingDetailNarrativeSection,
  FindingDetailPageModel,
  FindingDetailTrackingItem,
} from "./viewModel";

export interface FindingDetailViewProps {
  model: FindingDetailPageModel;
  onBack: () => void;
  codeBrowserAction?: FindingDetailCodeBrowserAction | null;
  onLoadFullFile?: (
    request: FindingDetailFullFileRequest,
  ) => Promise<FindingDetailFullFileLoadResult>;
}

interface InfoSectionProps {
  title: string;
  items: FindingDetailTrackingItem[];
}

function InfoSection({ title, items }: InfoSectionProps) {
  return (
    <section className="rounded-xl border border-border/70 bg-card/35 p-5 space-y-4">
      <div>
        <p className="text-[0.975rem] font-mono uppercase tracking-[0.24em] text-muted-foreground">
          {title}
        </p>
      </div>
      <div className="grid gap-4">
        {items.map((item) => (
          <div
            key={`${item.label}-${item.value}`}
            className="grid gap-2 sm:grid-cols-[144px_minmax(0,1fr)] sm:gap-4"
          >
            <div className="text-[0.975rem] uppercase tracking-[0.18em] text-muted-foreground">
              {item.label}
            </div>
            <div
              className={`text-[1.1375rem] leading-[1.6] text-foreground break-all ${
                item.mono ? "font-mono text-[1.05625rem]" : ""
              }`}
              title={item.title || undefined}
            >
              {item.value || "-"}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function resolveNarrativeSectionClass(section: FindingDetailNarrativeSection): string {
  if (section.emphasis === "primary") {
    return "rounded-xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/10 via-card/70 to-card/85 shadow-[0_20px_60px_-34px_rgba(34,211,238,0.55)] p-5 space-y-4";
  }
  if (section.emphasis === "success") {
    return "rounded-xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/10 via-card/70 to-card/85 shadow-[0_20px_60px_-34px_rgba(16,185,129,0.5)] p-5 space-y-4";
  }
  if (section.emphasis === "secondary") {
    return "rounded-xl border border-border/70 bg-card/45 p-5 space-y-4";
  }
  return "rounded-xl border border-border/70 bg-card/50 p-5 space-y-4";
}

function NarrativeSectionCard({ section }: { section: FindingDetailNarrativeSection }) {
  return (
    <section className={resolveNarrativeSectionClass(section)}>
      <div>
        <p className="text-[0.975rem] font-mono uppercase tracking-[0.24em] text-muted-foreground">
          {section.title}
        </p>
      </div>
      {section.finding ? (
        <FindingNarrativeMarkdown
          finding={section.finding}
          variant="detail"
          className="[&_p]:text-[1.22rem] [&_pre]:text-[1.0625rem] [&_code]:text-[1rem]"
        />
      ) : (
        <p className="text-[1.22rem] leading-[1.72] text-foreground/92 whitespace-pre-wrap break-words">
          {section.body || "-"}
        </p>
      )}
    </section>
  );
}

export default function FindingDetailView({
  model,
  onBack,
  codeBrowserAction,
  onLoadFullFile,
}: FindingDetailViewProps) {
  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 flex flex-col gap-4 sm:gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-[1.95rem] font-bold tracking-[0.08em] text-foreground">
            {model.pageTitle}
          </h1>
        </div>
        <FindingDetailHeaderActions codeBrowserAction={codeBrowserAction} onBack={onBack} />
      </div>

      <div className="min-h-0 flex-1 grid grid-cols-1 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] gap-4">
        <div className="order-1 xl:order-1 cyber-card p-5 min-h-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
          <InfoSection title="概览信息" items={model.overviewItems} />
          {model.narrativeSections.map((section) => (
            <NarrativeSectionCard key={section.id} section={section} />
          ))}
        </div>

        <FindingDetailCodePanel
          title={model.codePanelTitle}
          sections={model.codeSections}
          emptyMessage={model.emptyCodeMessage}
          onLoadFullFile={onLoadFullFile}
        />
      </div>
    </div>
  );
}
