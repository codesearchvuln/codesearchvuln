import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Info,
  Search,
  Shield,
  Tag,
} from "lucide-react";
import { getYasaRules, type YasaRule } from "@/shared/api/yasa";

type EngineTab = "opengrep" | "gitleaks" | "bandit" | "phpstan" | "yasa";

interface YasaRulesProps {
  showEngineSelector?: boolean;
  engineValue?: EngineTab;
  onEngineChange?: (value: EngineTab) => void;
}

const LANGUAGE_OPTIONS = [
  { value: "all", label: "所有语言" },
  { value: "python", label: "python" },
  { value: "javascript", label: "javascript" },
  { value: "typescript", label: "typescript" },
  { value: "golang", label: "golang" },
  { value: "java", label: "java" },
];

const SOURCE_OPTIONS = [{ value: "all", label: "所有来源" }];
const CONFIDENCE_OPTIONS = [
  { value: "all", label: "所有等级" },
  { value: "low", label: "低" },
];
const ACTIVE_STATUS_OPTIONS = [
  { value: "all", label: "所有状态" },
  { value: "enabled", label: "已启用" },
];
const PAGE_SIZE_OPTIONS = ["10", "20", "50"];

interface YasaRuleRowViewModel {
  id: string;
  ruleName: string;
  languages: string[];
  source: "内置规则";
  confidence: "低";
  activeStatus: "已启用";
  verifyStatus: "✓ 可用";
  createdAt: "-";
  checkerPacks: string[];
  checkerPath: string;
  demoRuleConfigPath: string;
  description: string;
}

function toViewModel(rule: YasaRule): YasaRuleRowViewModel {
  return {
    id: rule.checker_id,
    ruleName: rule.checker_id,
    languages: rule.languages || [],
    source: "内置规则",
    confidence: "低",
    activeStatus: "已启用",
    verifyStatus: "✓ 可用",
    createdAt: "-",
    checkerPacks: rule.checker_packs || [],
    checkerPath: rule.checker_path || "-",
    demoRuleConfigPath: rule.demo_rule_config_path || "-",
    description: rule.description || "-",
  };
}

export default function YasaRules({
  showEngineSelector = false,
  engineValue = "yasa",
  onEngineChange,
}: YasaRulesProps) {
  const [rules, setRules] = useState<YasaRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("all");
  const [selectedSource, setSelectedSource] = useState("all");
  const [selectedConfidence, setSelectedConfidence] = useState("all");
  const [selectedActiveStatus, setSelectedActiveStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
  const [detailRule, setDetailRule] = useState<YasaRuleRowViewModel | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const loadRules = async () => {
    try {
      setLoading(true);
      setLoadFailed(false);
      const data = await getYasaRules({ limit: 2000 });
      setRules(data);
    } catch (error: any) {
      setLoadFailed(true);
      console.error("Failed to load yasa rules:", error);
      const detail =
        error?.response?.data?.detail ||
        "未找到 YASA 资源目录，请检查 YASA_RESOURCE_DIR 或本机安装";
      toast.error(String(detail));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRules();
  }, []);

  const rows = useMemo(() => rules.map(toViewModel), [rules]);

  const checkerPackOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows.flatMap((rule) => rule.checkerPacks).filter((item) => item && item.trim()),
        ),
      ).sort(),
    [rows],
  );
  const [selectedCheckerPack, setSelectedCheckerPack] = useState("all");

  const stats = useMemo(() => {
    const languageCount = new Set(rows.flatMap((item) => item.languages)).size;
    return {
      total: rows.length,
      active: rows.length,
      checkerPackCount: checkerPackOptions.length,
      languageCount,
    };
  }, [rows, checkerPackOptions.length]);

  const filteredRows = useMemo(
    () =>
      rows.filter((item) => {
        const keyword = searchTerm.trim().toLowerCase();
        const matchKeyword =
          !keyword ||
          item.ruleName.toLowerCase().includes(keyword) ||
          item.description.toLowerCase().includes(keyword) ||
          item.id.toLowerCase().includes(keyword) ||
          item.checkerPath.toLowerCase().includes(keyword);

        const matchLanguage =
          selectedLanguage === "all" || item.languages.includes(selectedLanguage);
        const matchSource =
          selectedSource === "all" || item.source === "内置规则";
        const matchConfidence =
          selectedConfidence === "all" || item.confidence === "低";
        const matchStatus =
          selectedActiveStatus === "all" || item.activeStatus === "已启用";
        const matchCheckerPack =
          selectedCheckerPack === "all" || item.checkerPacks.includes(selectedCheckerPack);

        return (
          matchKeyword &&
          matchLanguage &&
          matchSource &&
          matchConfidence &&
          matchStatus &&
          matchCheckerPack
        );
      }),
    [
      rows,
      searchTerm,
      selectedLanguage,
      selectedSource,
      selectedConfidence,
      selectedActiveStatus,
      selectedCheckerPack,
    ],
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedRuleIds(new Set());
  }, [
    searchTerm,
    selectedLanguage,
    selectedSource,
    selectedConfidence,
    selectedActiveStatus,
    selectedCheckerPack,
    pageSize,
  ]);

  const allPageSelected =
    paginatedRows.length > 0 &&
    paginatedRows.every((row) => selectedRuleIds.has(row.id));

  const handleToggleAllSelection = () => {
    if (allPageSelected) {
      const next = new Set(selectedRuleIds);
      for (const row of paginatedRows) next.delete(row.id);
      setSelectedRuleIds(next);
      return;
    }
    const next = new Set(selectedRuleIds);
    for (const row of paginatedRows) next.add(row.id);
    setSelectedRuleIds(next);
  };

  const handleToggleRuleSelection = (ruleId: string) => {
    const next = new Set(selectedRuleIds);
    if (next.has(ruleId)) next.delete(ruleId);
    else next.add(ruleId);
    setSelectedRuleIds(next);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedLanguage("all");
    setSelectedSource("all");
    setSelectedConfidence("all");
    setSelectedActiveStatus("all");
    setSelectedCheckerPack("all");
  };

  const handleCopyRule = async (row: YasaRuleRowViewModel) => {
    try {
      const text = JSON.stringify(
        {
          checker_id: row.id,
          checker_packs: row.checkerPacks,
          languages: row.languages,
          checker_path: row.checkerPath,
          demo_rule_config_path: row.demoRuleConfigPath,
        },
        null,
        2,
      );
      await navigator.clipboard.writeText(text);
      toast.success(`已复制规则: ${row.id}`);
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
        <div className="cyber-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">有效规则总数</p>
              <div className="flex items-end gap-3">
                <p className="stat-value">{stats.total}</p>
                <p className="text-sm mb-1 flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    已启用 {stats.active}
                  </span>
                </p>
              </div>
            </div>
            <div className="stat-icon text-primary">
              <Database className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="cyber-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">CheckerPack 数量</p>
              <p className="stat-value">{stats.checkerPackCount}</p>
            </div>
            <div className="stat-icon text-indigo-400">
              <Tag className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="cyber-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">支持语言数量</p>
              <p className="stat-value">{stats.languageCount}</p>
            </div>
            <div className="stat-icon text-cyan-400">
              <Shield className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      <div className="cyber-card p-4">
        <p className="text-sm text-muted-foreground">
          YASA 规则来自本机 yasa-engine 资源，当前为只读展示。
        </p>
      </div>

      <div className="cyber-card relative z-10 overflow-hidden">
        <div className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative w-full max-w-sm shrink-0">
              <Label className="font-mono font-bold uppercase text-xs text-muted-foreground">
                搜索规则
              </Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="搜索规则名称或ID..."
                  className="cyber-input !pl-10 h-10"
                />
              </div>
            </div>

            <div className="flex flex-1 flex-wrap items-end gap-3">
              {showEngineSelector ? (
                <div className="min-w-[150px] flex-1">
                  <Label className="font-mono font-bold uppercase text-xs text-muted-foreground">
                    扫描引擎
                  </Label>
                  <Select
                    value={engineValue}
                    onValueChange={(val) => {
                      if (
                        val === "opengrep" ||
                        val === "gitleaks" ||
                        val === "bandit" ||
                        val === "phpstan" ||
                        val === "yasa"
                      ) {
                        onEngineChange?.(val);
                      }
                    }}
                  >
                    <SelectTrigger className="cyber-input h-10 mt-1.5">
                      <SelectValue placeholder="选择引擎" />
                    </SelectTrigger>
                    <SelectContent className="cyber-dialog border-border">
                      <SelectItem value="opengrep">opengrep</SelectItem>
                      <SelectItem value="gitleaks">gitleaks</SelectItem>
                      <SelectItem value="bandit">bandit</SelectItem>
                      <SelectItem value="phpstan">phpstan</SelectItem>
                      <SelectItem value="yasa">yasa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="min-w-[140px] flex-1">
                <Label className="font-mono font-bold uppercase text-xs text-muted-foreground">
                  编程语言
                </Label>
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                  <SelectTrigger className="cyber-input h-10 mt-1.5">
                    <SelectValue placeholder="所有语言" />
                  </SelectTrigger>
                  <SelectContent className="cyber-dialog border-border">
                    {LANGUAGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[140px] flex-1">
                <Label className="font-mono font-bold uppercase text-xs text-muted-foreground">
                  规则来源
                </Label>
                <Select value={selectedSource} onValueChange={setSelectedSource}>
                  <SelectTrigger className="cyber-input h-10 mt-1.5">
                    <SelectValue placeholder="所有来源" />
                  </SelectTrigger>
                  <SelectContent className="cyber-dialog border-border">
                    {SOURCE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[120px] flex-1">
                <Label className="font-mono font-bold uppercase text-xs text-muted-foreground">
                  置信度
                </Label>
                <Select value={selectedConfidence} onValueChange={setSelectedConfidence}>
                  <SelectTrigger className="cyber-input h-10 mt-1.5">
                    <SelectValue placeholder="所有等级" />
                  </SelectTrigger>
                  <SelectContent className="cyber-dialog border-border">
                    {CONFIDENCE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[120px] flex-1">
                <Label className="font-mono font-bold uppercase text-xs text-muted-foreground">
                  启用状态
                </Label>
                <Select value={selectedActiveStatus} onValueChange={setSelectedActiveStatus}>
                  <SelectTrigger className="cyber-input h-10 mt-1.5">
                    <SelectValue placeholder="所有状态" />
                  </SelectTrigger>
                  <SelectContent className="cyber-dialog border-border">
                    {ACTIVE_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[180px] flex-1">
                <Label className="font-mono font-bold uppercase text-xs text-muted-foreground">
                  CheckerPack
                </Label>
                <Select value={selectedCheckerPack} onValueChange={setSelectedCheckerPack}>
                  <SelectTrigger className="cyber-input h-10 mt-1.5">
                    <SelectValue placeholder="所有来源" />
                  </SelectTrigger>
                  <SelectContent className="cyber-dialog border-border">
                    <SelectItem value="all">所有 CheckerPack</SelectItem>
                    {checkerPackOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                variant="outline"
                className="cyber-btn-outline h-10 mt-1.5"
                onClick={resetFilters}
              >
                重置
              </Button>
            </div>
          </div>
        </div>

        <div className="border-t border-border px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              将对全部 {filteredRows.length} 条规则进行操作
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" className="cyber-btn-primary h-8" disabled>
                批量启用
              </Button>
              <Button type="button" size="sm" variant="outline" className="cyber-btn-outline h-8" disabled>
                批量禁用
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8 text-muted-foreground" disabled>
                取消操作
              </Button>
            </div>
          </div>
          <div className="text-xs text-amber-300 flex items-center gap-1">
            <Info className="w-3 h-3" />
            YASA 规则当前只读，暂不支持启停写回
          </div>
        </div>

        <div className="border-t border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[48px]">
                  <Checkbox checked={allPageSelected} onCheckedChange={handleToggleAllSelection} />
                </TableHead>
                <TableHead className="w-[64px]">序号</TableHead>
                <TableHead>规则名称</TableHead>
                <TableHead>编程语言</TableHead>
                <TableHead>规则来源</TableHead>
                <TableHead>置信度</TableHead>
                <TableHead>启用状态</TableHead>
                <TableHead>验证状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="min-w-[220px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-28 text-center text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : paginatedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-28 text-center text-muted-foreground">
                    {loadFailed ? "加载失败，请检查 YASA 资源目录配置" : "暂无符合条件的规则"}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((row, index) => (
                  <TableRow key={row.id} className="hover:bg-muted/20">
                    <TableCell>
                      <Checkbox
                        checked={selectedRuleIds.has(row.id)}
                        onCheckedChange={() => handleToggleRuleSelection(row.id)}
                      />
                    </TableCell>
                    <TableCell>{(page - 1) * pageSize + index + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{row.ruleName}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row.languages.length > 0 ? (
                          row.languages.map((language) => (
                            <Badge key={`${row.id}-${language}`} className="cyber-badge-info">
                              {language}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">未标注</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="cyber-badge-info">{row.source}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="cyber-badge-info">{row.confidence}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="cyber-badge-success">{row.activeStatus}</Badge>
                    </TableCell>
                    <TableCell className="text-emerald-400">{row.verifyStatus}</TableCell>
                    <TableCell>{row.createdAt}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 text-sm">
                        <button
                          type="button"
                          className="text-primary hover:text-primary/80"
                          onClick={() => {
                            setDetailRule(row);
                            setShowDetail(true);
                          }}
                        >
                          详情
                        </button>
                        <button
                          type="button"
                          className="text-primary hover:text-primary/80 inline-flex items-center gap-1"
                          onClick={() => void handleCopyRule(row)}
                        >
                          <Copy className="w-3 h-3" />
                          复制
                        </button>
                        <span className="text-muted-foreground/50 cursor-not-allowed">编辑</span>
                        <span className="text-muted-foreground/50 cursor-not-allowed">禁用</span>
                        <span className="text-muted-foreground/50 cursor-not-allowed">删除</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>每页显示:</span>
            <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
              <SelectTrigger className="w-[84px] h-8 cyber-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="cyber-dialog border-border">
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-muted-foreground">
            第 {page}/{totalPages} 页 共 {filteredRows.length} 条
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="cyber-btn-outline h-8"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="cyber-btn-outline h-8"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="cyber-dialog border border-border max-w-3xl">
          <DialogHeader>
            <DialogTitle>YASA 规则详情</DialogTitle>
          </DialogHeader>
          {detailRule ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground">规则名称</p>
                  <p className="font-mono break-all">{detailRule.ruleName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">规则来源</p>
                  <p>{detailRule.source}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">语言映射</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {detailRule.languages.length > 0 ? (
                    detailRule.languages.map((language) => (
                      <Badge key={`detail-${detailRule.id}-${language}`} className="cyber-badge-info">
                        {language}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground">未标注</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">CheckerPack</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {detailRule.checkerPacks.length > 0 ? (
                    detailRule.checkerPacks.map((pack) => (
                      <Badge key={`detail-${detailRule.id}-${pack}`} className="cyber-badge-muted">
                        {pack}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">规则路径</p>
                <p className="font-mono break-all">{detailRule.checkerPath}</p>
              </div>
              <div>
                <p className="text-muted-foreground">demo rule config 路径</p>
                <p className="font-mono break-all">{detailRule.demoRuleConfigPath}</p>
              </div>
              <div>
                <p className="text-muted-foreground">规则描述</p>
                <p className="whitespace-pre-wrap">{detailRule.description}</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
