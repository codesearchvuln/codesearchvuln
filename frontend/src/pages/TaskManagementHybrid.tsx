import { Layers, Info } from "lucide-react";

export default function TaskManagementHybrid() {
  return (
    <div className="space-y-6 p-6 bg-background min-h-screen font-mono relative">
      <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />

      <div className="cyber-card p-6 relative z-10">
        <div className="section-header mb-4">
          <Layers className="w-5 h-5 text-primary" />
          <h3 className="section-title">混合扫描</h3>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
          <div className="inline-flex items-center gap-2 text-primary">
            <Info className="w-4 h-4" />
            <span className="font-semibold">功能占位</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            当前版本先提供混合扫描入口与页面骨架，暂不引入新的后端任务类型或聚合协议。
            后续将基于统一任务视图补充混合扫描规则与数据筛选策略。
          </p>
        </div>
      </div>
    </div>
  );
}
