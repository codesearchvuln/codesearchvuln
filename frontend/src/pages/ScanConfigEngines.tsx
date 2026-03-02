import { Zap } from "lucide-react";
import { SystemConfig } from "@/components/system/SystemConfig";
import EmbeddingConfig from "@/components/agent/EmbeddingConfig";

export default function ScanConfigEngines() {
  return (
    <div className="space-y-6 p-6 bg-background min-h-screen relative">
      <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />
      <div className="relative z-10 space-y-6">
        <div className="cyber-card p-5 space-y-2">
          <div>
            <div className="font-mono font-bold uppercase text-sm text-foreground">
              智能引擎（LLM）
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              配置模型参数、请求预算和超时策略。
            </div>
          </div>
          <SystemConfig
            visibleSections={["llm"]}
            defaultSection="llm"
            mergedView={false}
          />
        </div>

        <div className="cyber-card p-5 space-y-2">
          <div className="section-header mb-1">
            <Zap className="w-4 h-4 text-primary" />
            <div className="font-mono font-bold uppercase text-sm text-foreground">
              RAG（向量索引 / 代码向量化）
            </div>
          </div>
          <EmbeddingConfig />
        </div>
      </div>
    </div>
  );
}
