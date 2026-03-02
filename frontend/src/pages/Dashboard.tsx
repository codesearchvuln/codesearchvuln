/**
 * Dashboard Page
 * Cyberpunk Terminal Aesthetic
 */

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Code, Search } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, isDemoMode } from "@/shared/config/database";
import type { ProjectStats } from "@/shared/types";
import { getOpengrepRules, type OpengrepRule } from "@/shared/api/opengrep";
import { runWithRefreshMode } from "@/shared/utils/refreshMode";

const DEFAULT_STATS: ProjectStats = {
  total_projects: 0,
  active_projects: 0,
  total_tasks: 0,
  completed_tasks: 0,
  interrupted_tasks: 0,
  running_tasks: 0,
  failed_tasks: 0,
  total_issues: 0,
  resolved_issues: 0,
  avg_quality_score: 0,
};

type RulesChartScope = "all" | "enabled";

type RuleLanguageChartItem = {
  language: string;
  total: number;
  highCount: number;
  mediumCount: number;
};

const normalizeConfidence = (confidence?: string | null) => {
  const normalized = String(confidence || "").trim().toUpperCase();
  if (!normalized) return "UNKNOWN";
  if (normalized === "MIDIUM" || normalized === "MIDDLE") return "MEDIUM";
  if (normalized === "HIGH") return "HIGH";
  if (normalized === "MEDIUM") return "MEDIUM";
  if (normalized === "LOW") return "LOW";
  return "UNKNOWN";
};

const formatTick = (value: number | string) => Number(value || 0).toLocaleString();

export default function Dashboard() {
  const [stats, setStats] = useState<ProjectStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [ruleStats, setRuleStats] = useState({ total: 0, enabled: 0 });
  const [rules, setRules] = useState<OpengrepRule[]>([]);
  const [rulesChartScope, setRulesChartScope] = useState<RulesChartScope>("all");
  const [rulesLanguageKeyword, setRulesLanguageKeyword] = useState("");

  useEffect(() => {
    void loadDashboardData();

    const timer = window.setInterval(() => {
      void loadDashboardData({ silent: true });
    }, 15000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const loadStatsData = async () => {
    const [statsResult, rulesResult] = await Promise.allSettled([
      api.getProjectStats(),
      getOpengrepRules(),
    ]);

    if (statsResult.status === "fulfilled") {
      setStats(statsResult.value);
    } else {
      setStats(DEFAULT_STATS);
    }

    if (rulesResult.status === "fulfilled") {
      const allRules = rulesResult.value;
      const totalRules = allRules.length;
      const enabledRules = allRules.filter((rule) => rule.is_active).length;
      setRuleStats({ total: totalRules, enabled: enabledRules });
      setRules(allRules);
    } else {
      setRuleStats({ total: 0, enabled: 0 });
      setRules([]);
    }
  };

  const loadDashboardData = async (options?: { silent?: boolean }) => {
    try {
      await runWithRefreshMode(loadStatsData, { ...options, setLoading });
    } catch (error) {
      console.error("仪表盘数据加载失败:", error);
      toast.error("数据加载失败");
    }
  };

  const filteredRulesByScope = useMemo(() => {
    return rulesChartScope === "enabled"
      ? rules.filter((rule) => rule.is_active)
      : rules;
  }, [rules, rulesChartScope]);

  const rulesByLanguageData = useMemo<RuleLanguageChartItem[]>(() => {
    const aggregate = new Map<string, RuleLanguageChartItem>();

    for (const rule of filteredRulesByScope) {
      const language = String(rule.language || "unknown").trim() || "unknown";
      if (!aggregate.has(language)) {
        aggregate.set(language, {
          language,
          total: 0,
          highCount: 0,
          mediumCount: 0,
        });
      }
      const entry = aggregate.get(language);
      if (!entry) continue;

      const severity = String(rule.severity || "").toUpperCase();
      if (severity !== "ERROR") continue;

      const confidence = normalizeConfidence(rule.confidence);
      if (confidence === "HIGH") {
        entry.highCount += 1;
      } else if (confidence === "MEDIUM") {
        entry.mediumCount += 1;
      }
    }

    const languageKeyword = rulesLanguageKeyword.trim().toLowerCase();
    return Array.from(aggregate.values())
      .map((item) => ({
        ...item,
        total: item.highCount + item.mediumCount,
      }))
      .filter((item) => item.total > 0)
      .filter((item) =>
        languageKeyword ? item.language.toLowerCase().includes(languageKeyword) : true,
      )
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.language.localeCompare(b.language, "zh-CN");
      });
  }, [filteredRulesByScope, rulesLanguageKeyword]);

  const chartMax = useMemo(() => {
    if (rulesByLanguageData.length === 0) return 1;
    const maxSide = Math.max(...rulesByLanguageData.map((item) => item.total));
    return Math.max(1, maxSide);
  }, [rulesByLanguageData]);

  const rulesChartHeight = useMemo(() => {
    const rowCount = Math.max(1, rulesByLanguageData.length);
    return Math.min(760, Math.max(360, rowCount * 48));
  }, [rulesByLanguageData.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="loading-spinner mx-auto" />
          <p className="text-muted-foreground font-mono text-base uppercase tracking-wider">
            加载数据中...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-background min-h-screen font-mono relative">
      <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />

      {isDemoMode && (
        <div className="relative z-10 cyber-card p-4 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
            <div className="text-sm text-foreground/80">
              当前使用<span className="text-amber-400 font-bold">演示模式</span>
              ，显示的是模拟数据。
              <Link
                to="/scan-config/engines"
                className="ml-2 text-primary font-bold hover:underline"
              >
                前往扫描引擎 →
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
        <div className="cyber-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">总项目数</p>
              <p className="stat-value">{stats.active_projects || 0}</p>
            </div>
            <div className="stat-icon text-primary">
              <Code className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="cyber-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">审计任务</p>
              <p className="stat-value">{stats.total_tasks || 0}</p>
              <p className="text-sm mt-1 flex items-center gap-3">
                <span className="text-emerald-400 inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  已完成: {stats.completed_tasks || 0}
                </span>
                <span className="text-sky-400 inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  运行中: {stats.running_tasks || 0}
                </span>
              </p>
            </div>
            <div className="stat-icon text-emerald-400">
              <Activity className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="cyber-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">审计规则</p>
              <p className="stat-value">{ruleStats.total}</p>
              <p className="text-sm text-sky-400 mt-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                已启用: {ruleStats.enabled}
              </p>
            </div>
            <div className="stat-icon text-sky-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      <div className="cyber-card p-4 relative z-10">
        <div className="section-header mb-3">
          <AlertTriangle className="w-5 h-5 text-sky-400" />
          <div className="w-full">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="section-title">规则分布横向条形统计图</h3>
              <span className="text-sm text-muted-foreground">语言数：{rulesByLanguageData.length}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              仅统计严重(ERROR)且中/高置信度规则
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={rulesChartScope === "all" ? "default" : "outline"}
            className={rulesChartScope === "all" ? "cyber-btn-primary h-8" : "cyber-btn-outline h-8"}
            onClick={() => setRulesChartScope("all")}
          >
            全部规则
          </Button>
          <Button
            type="button"
            size="sm"
            variant={rulesChartScope === "enabled" ? "default" : "outline"}
            className={
              rulesChartScope === "enabled"
                ? "cyber-btn-primary h-8"
                : "cyber-btn-outline h-8"
            }
            onClick={() => setRulesChartScope("enabled")}
          >
            仅启用规则
          </Button>
          <div className="relative ml-auto w-full sm:w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={rulesLanguageKeyword}
              onChange={(e) => setRulesLanguageKeyword(e.target.value)}
              placeholder="搜索语言..."
              className="h-8 pl-9 font-mono text-xs"
            />
          </div>
        </div>

        <div
          className="mt-4 border border-border/60 rounded-lg bg-muted/15 p-3"
          style={{ height: rulesChartHeight }}
        >
          {rulesByLanguageData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-base text-muted-foreground">
              暂无符合条件的规则分布数据
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rulesByLanguageData}
                layout="vertical"
                margin={{ top: 6, right: 6, left: 4, bottom: 6 }}
                barCategoryGap={16}
                barGap={6}
                barSize={18}
              >
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis
                  type="number"
                  domain={[0, chartMax]}
                  tickFormatter={formatTick}
                  tick={{ fontSize: 13 }}
                />
                <YAxis
                  type="category"
                  dataKey="language"
                  width={96}
                  tick={{ fontSize: 13 }}
                />
                <Tooltip
                  formatter={(value: number | string, name: string) => [
                    Number(value || 0).toLocaleString(),
                    name,
                  ]}
                  contentStyle={{ fontSize: 13 }}
                />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Bar
                  dataKey="highCount"
                  stackId="confidence"
                  fill="#22c55e"
                  name="高置信度"
                  radius={[2, 2, 2, 2]}
                  minPointSize={6}
                />
                <Bar
                  stackId="confidence"
                  dataKey="mediumCount"
                  fill="#facc15"
                  name="中置信度"
                  radius={[2, 2, 2, 2]}
                  minPointSize={6}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
