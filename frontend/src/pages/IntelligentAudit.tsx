import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Brain, Settings, Zap } from "lucide-react";
import { SystemConfig } from "@/components/system/SystemConfig";
import AgentSettingsPanel from "@/components/agent/AgentSettingsPanel";

const AGENT_ITEMS = [
  "Orchestrator 调度智能体",
  "Recon 侦察智能体",
  "Analysis 分析智能体",
  "Verification 验证智能体",
] as const;

function CapabilityPanel() {
  const [selectedAgent, setSelectedAgent] = useState<string>(AGENT_ITEMS[0]);

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="cyber-card p-4 space-y-3 h-fit">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-cyan-300" />
          <h2 className="text-lg font-bold">Agent（智能体）</h2>
        </div>
        <p className="text-xs text-muted-foreground">负责调度、分析、验证</p>
        <div className="space-y-1.5 pt-1">
          {AGENT_ITEMS.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => setSelectedAgent(item)}
              className={`w-full text-left text-sm rounded px-2 py-2 border transition ${
                selectedAgent === item
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="pt-2">
          <Badge className="cyber-badge-info">Agent 数量：{AGENT_ITEMS.length}</Badge>
        </div>
      </aside>

      <AgentSettingsPanel selectedAgent={selectedAgent} />
    </div>
  );
}

export default function IntelligentAudit() {
  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <aside className="cyber-card p-4 space-y-3 h-fit">
        <h2 className="text-lg font-bold">能力目录</h2>
        <Accordion
          type="single"
          collapsible
          value={selectedGroupId}
          onValueChange={(value) => {
            if (!value) return;
            const groupId = value as SidebarGroup["id"];
            setSelectedGroupId(groupId);
            const firstItem = SIDEBAR_GROUPS.find((group) => group.id === groupId)?.items[0];
            if (firstItem) {
              setSelectedItem(firstItem);
            }
          }}
          className="w-full"
        >
          {SIDEBAR_GROUPS.map((group) => (
            <AccordionItem key={group.id} value={group.id} className="border-border/70">
              <AccordionTrigger className="py-3">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5">{GROUP_ICON[group.id]}</span>
                  <div className="text-left">
                    <p className="text-sm font-bold">{group.title}</p>
                    <p className="text-xs text-muted-foreground">{group.subtitle}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-0 pb-2">
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setSelectedGroupId(group.id);
                        setSelectedItem(item);
                      }}
                      className={`w-full text-left text-sm rounded px-2 py-2 border transition ${
                        selectedItem === item
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </aside>

      <section className="cyber-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{selectedGroup.title}</h2>
            <p className="text-sm text-muted-foreground">{selectedGroup.subtitle}</p>
          </div>
          <Badge className="cyber-badge-info">项目数：{selectedGroup.items.length}</Badge>
        </div>

        <div className="rounded border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs text-muted-foreground mb-2">当前选择</p>
          <p className="text-lg font-bold">{selectedItem}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {selectedGroup.items.map((item) => (
            <div
              key={item}
              className={`rounded border p-3 transition ${
                selectedItem === item ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40"
              }`}
            >
              <p className="text-sm font-bold">{item}</p>
              <p className="text-xs text-muted-foreground mt-1">
                用于智能审计流程展示与后续提示词调优。
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function IntelligentAudit() {
  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <aside className="cyber-card p-4 space-y-3 h-fit">
        <h2 className="text-lg font-bold">能力目录</h2>
        <Accordion
          type="single"
          collapsible
          value={selectedGroupId}
          onValueChange={(value) => {
            if (!value) return;
            const groupId = value as SidebarGroup["id"];
            setSelectedGroupId(groupId);
            const firstItem = SIDEBAR_GROUPS.find((group) => group.id === groupId)?.items[0];
            if (firstItem) {
              setSelectedItem(firstItem);
            }
          }}
          className="w-full"
        >
          {SIDEBAR_GROUPS.map((group) => (
            <AccordionItem key={group.id} value={group.id} className="border-border/70">
              <AccordionTrigger className="py-3">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5">{GROUP_ICON[group.id]}</span>
                  <div className="text-left">
                    <p className="text-sm font-bold">{group.title}</p>
                    <p className="text-xs text-muted-foreground">{group.subtitle}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-0 pb-2">
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setSelectedGroupId(group.id);
                        setSelectedItem(item);
                      }}
                      className={`w-full text-left text-sm rounded px-2 py-2 border transition ${
                        selectedItem === item
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </aside>

      <section className="cyber-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{selectedGroup.title}</h2>
            <p className="text-sm text-muted-foreground">{selectedGroup.subtitle}</p>
          </div>
          <Badge className="cyber-badge-info">项目数：{selectedGroup.items.length}</Badge>
        </div>

        <div className="rounded border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs text-muted-foreground mb-2">当前选择</p>
          <p className="text-lg font-bold">{selectedItem}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {selectedGroup.items.map((item) => (
            <div
              key={item}
              className={`rounded border p-3 transition ${
                selectedItem === item ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40"
              }`}
            >
              <p className="text-sm font-bold">{item}</p>
              <p className="text-xs text-muted-foreground mt-1">
                用于智能审计流程展示与后续提示词调优。
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function IntelligentAudit() {
  return (
    <div className="space-y-6 p-6 bg-background min-h-screen relative">
      <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />
      <div className="relative z-10 space-y-6">
        <Tabs defaultValue="capability" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-muted border border-border p-1 h-auto gap-1 rounded-lg mb-6">
            <TabsTrigger
              value="capability"
              className="data-[state=active]:bg-primary data-[state=active]:text-foreground font-mono font-bold uppercase py-2.5 text-muted-foreground transition-all rounded text-xs flex items-center gap-2"
            >
              <Bot className="w-3 h-3" /> 智能审计能力
            </TabsTrigger>
            <TabsTrigger
              value="llm"
              className="data-[state=active]:bg-primary data-[state=active]:text-foreground font-mono font-bold uppercase py-2.5 text-muted-foreground transition-all rounded text-xs flex items-center gap-2"
            >
              <Zap className="w-3 h-3" /> LLM 配置
            </TabsTrigger>
            <TabsTrigger
              value="embedding"
              className="data-[state=active]:bg-primary data-[state=active]:text-foreground font-mono font-bold uppercase py-2.5 text-muted-foreground transition-all rounded text-xs flex items-center gap-2"
            >
              <Brain className="w-3 h-3" /> 嵌入模型
            </TabsTrigger>
            <TabsTrigger
              value="analysis"
              className="data-[state=active]:bg-primary data-[state=active]:text-foreground font-mono font-bold uppercase py-2.5 text-muted-foreground transition-all rounded text-xs flex items-center gap-2"
            >
              <Settings className="w-3 h-3" /> 分析参数
            </TabsTrigger>
          </TabsList>

          <TabsContent value="capability" className="space-y-6">
            <CapabilityPanel />
          </TabsContent>

          <TabsContent value="llm" className="space-y-6">
            <SystemConfig visibleSections={["llm"]} defaultSection="llm" />
          </TabsContent>

          <TabsContent value="embedding" className="space-y-6">
            <SystemConfig visibleSections={["embedding"]} defaultSection="embedding" />
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            <SystemConfig visibleSections={["analysis"]} defaultSection="analysis" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
