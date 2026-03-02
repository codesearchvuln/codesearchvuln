import { Wrench } from "lucide-react";
import { SystemConfig } from "@/components/system/SystemConfig";
import SkillToolsPanel from "@/pages/intelligent-audit/SkillToolsPanel";

export default function ScanConfigExternalTools() {
  return (
    <div className="space-y-6 p-6 bg-background min-h-screen relative">
      <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />
      <div className="relative z-10 space-y-6">
        <div className="cyber-card p-5 space-y-2">
          <div className="section-header mb-1">
            <Wrench className="w-4 h-4 text-primary" />
            <div className="font-mono font-bold uppercase text-sm text-foreground">
              MCP 运行时配置
            </div>
          </div>
          <div className="text-xs text-muted-foreground mb-2">
            管理 MCP 启停策略、运行域和写入约束。
          </div>
          <SystemConfig
            visibleSections={["mcp"]}
            defaultSection="mcp"
            mergedView={false}
          />
        </div>

        <div className="cyber-card p-5 space-y-2">
          <div className="section-header mb-1">
            <Wrench className="w-4 h-4 text-primary" />
            <div className="font-mono font-bold uppercase text-sm text-foreground">
              MCP 目录
            </div>
          </div>
          <SkillToolsPanel mode="mcp" />
        </div>

        <div className="cyber-card p-5 space-y-2">
          <div className="section-header mb-1">
            <Wrench className="w-4 h-4 text-primary" />
            <div className="font-mono font-bold uppercase text-sm text-foreground">
              SKILL 配置
            </div>
          </div>
          <SkillToolsPanel mode="skill" />
        </div>
      </div>
    </div>
  );
}
