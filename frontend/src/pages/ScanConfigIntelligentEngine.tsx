import { Brain, KeyRound, Settings, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type {
	LlmModelStatsSource,
	LlmModelStatsStatus,
} from "@/components/system/llmModelStatsSummary";
import {
	SystemConfig,
	useSystemConfigDraftState,
} from "@/components/system/SystemConfig";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
	api,
	type AgentWorkflowConfigPayload,
	type AgentWorkflowConfigSource,
} from "@/shared/api/database";
import { toast } from "sonner";

type LlmSummaryState = {
	providerLabel: string;
	currentModelName: string;
	availableModelCount: number;
	availableModelMetadataCount: number;
	supportsModelFetch: boolean;
	modelStatsStatus: LlmModelStatsStatus;
	modelStatsSource: LlmModelStatsSource;
	shouldPreferOnlineStats: boolean;
};

type WorkflowDraftState = {
	reconCount: string;
	analysisCount: string;
	verificationCount: string;
};

const WORKFLOW_SOURCE_LABELS: Record<AgentWorkflowConfigSource, string> = {
	user_override: "用户覆盖",
	local_file: "本地 config.yml",
	settings_default: "系统默认",
};

export default function ScanConfigIntelligentEngine() {
	const sharedDraftState = useSystemConfigDraftState();
	const summaryConfig = sharedDraftState.config;
	const [summaryState, setSummaryState] = useState<LlmSummaryState | null>(
		null,
	);
	const [workflowConfig, setWorkflowConfig] =
		useState<AgentWorkflowConfigPayload | null>(null);
	const [workflowDraft, setWorkflowDraft] = useState<WorkflowDraftState>({
		reconCount: "",
		analysisCount: "",
		verificationCount: "",
	});
	const [workflowLoading, setWorkflowLoading] = useState(true);
	const [workflowSaving, setWorkflowSaving] = useState(false);
	const summary: LlmSummaryState = {
		providerLabel:
			summaryState?.providerLabel || summaryConfig?.llmProvider || "--",
		currentModelName:
			summaryState?.currentModelName || summaryConfig?.llmModel || "--",
		availableModelCount: summaryState?.availableModelCount ?? 0,
		availableModelMetadataCount: summaryState?.availableModelMetadataCount ?? 0,
		supportsModelFetch: summaryState?.supportsModelFetch || false,
		modelStatsStatus: summaryState?.modelStatsStatus || "static",
		modelStatsSource: summaryState?.modelStatsSource || "static",
		shouldPreferOnlineStats: summaryState?.shouldPreferOnlineStats || false,
	};

	const modelStatsValue =
		summary.modelStatsStatus === "loading"
			? "加载中..."
			: summary.modelStatsStatus === "empty"
				? "--"
				: `${summary.availableModelCount}`;

	useEffect(() => {
		let active = true;

		const loadWorkflowConfig = async () => {
			try {
				setWorkflowLoading(true);
				const response = await api.getAgentWorkflowConfig();
				if (!active) return;
				setWorkflowConfig(response);
				setWorkflowDraft({
					reconCount: String(response.recon_count),
					analysisCount: String(response.analysis_count),
					verificationCount: String(response.verification_count),
				});
			} catch (error) {
				if (!active) return;
				console.error("Failed to load agent workflow config:", error);
				toast.error("加载智能引擎并发配置失败");
			} finally {
				if (active) setWorkflowLoading(false);
			}
		};

		void loadWorkflowConfig();
		return () => {
			active = false;
		};
	}, []);

	const updateWorkflowDraft = (
		key: keyof WorkflowDraftState,
		value: string,
	) => {
		setWorkflowDraft((prev) => ({
			...prev,
			[key]: value,
		}));
	};

	const applyWorkflowDefaults = () => {
		if (!workflowConfig) return;
		setWorkflowDraft({
			reconCount: String(workflowConfig.default_recon_count),
			analysisCount: String(workflowConfig.default_analysis_count),
			verificationCount: String(workflowConfig.default_verification_count),
		});
	};

	const saveWorkflowConfig = async () => {
		const reconCount = Number.parseInt(workflowDraft.reconCount, 10);
		const analysisCount = Number.parseInt(workflowDraft.analysisCount, 10);
		const verificationCount = Number.parseInt(
			workflowDraft.verificationCount,
			10,
		);

		if (!Number.isInteger(reconCount) || reconCount < 1 || reconCount > 32) {
			toast.error("Recon(SubAgent) 并发数必须是 1 到 32 的整数");
			return;
		}
		if (!Number.isInteger(analysisCount) || analysisCount < 1 || analysisCount > 32) {
			toast.error("Analysis 并发数必须是 1 到 32 的整数");
			return;
		}
		if (
			!Number.isInteger(verificationCount) ||
			verificationCount < 1 ||
			verificationCount > 32
		) {
			toast.error("Verification 并发数必须是 1 到 32 的整数");
			return;
		}

		try {
			setWorkflowSaving(true);
			const response = await api.updateAgentWorkflowConfig({
				recon_count: reconCount,
				analysis_count: analysisCount,
				verification_count: verificationCount,
			});
			setWorkflowConfig(response);
			setWorkflowDraft({
				reconCount: String(response.recon_count),
				analysisCount: String(response.analysis_count),
				verificationCount: String(response.verification_count),
			});
			toast.success("智能引擎并发配置已保存");
		} catch (error) {
			console.error("Failed to save agent workflow config:", error);
			toast.error("保存智能引擎并发配置失败");
		} finally {
			setWorkflowSaving(false);
		}
	};

	const workflowSourceLabel = workflowConfig
		? WORKFLOW_SOURCE_LABELS[workflowConfig.source]
		: "--";
	const workflowDefaultSourceLabel = workflowConfig
		? WORKFLOW_SOURCE_LABELS[workflowConfig.default_source]
		: "--";

	return (
		<div className="space-y-6 p-6 bg-background min-h-screen relative">
			<div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />

			<div className="relative z-10 space-y-5 max-w-[1680px] mx-auto">
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					<div className="cyber-card p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="stat-label">模型提供商</p>
								<p className="stat-value text-2xl break-all">
									{summary.providerLabel}
								</p>
							</div>
							<div className="stat-icon text-primary">
								<Settings className="w-6 h-6" />
							</div>
						</div>
					</div>

					<div className="cyber-card p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="stat-label">当前采用模型</p>
								<p className="stat-value text-2xl break-all">
									{summary.currentModelName || "--"}
								</p>
							</div>
							<div className="stat-icon text-sky-400">
								<Brain className="w-6 h-6" />
							</div>
						</div>
					</div>

					<div className="cyber-card p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="stat-label">支持模型数量</p>
								<p className="stat-value text-2xl break-all">
									{modelStatsValue}
								</p>
							</div>
							<div className="stat-icon text-emerald-400">
								<Zap className="w-6 h-6" />
							</div>
						</div>
					</div>
				</div>

				<div className="space-y-4">
					<div className="section-header mb-0">
						<KeyRound className="w-4 h-4 text-primary" />
						<div className="font-mono font-bold uppercase text-sm text-foreground">
							推理模块
						</div>
					</div>
					<SystemConfig
						visibleSections={["llm"]}
						defaultSection="llm"
						mergedView={false}
						showLlmSummaryCards={false}
						showFloatingSaveButton={false}
						compactLayout
						sharedDraftState={sharedDraftState}
						onLlmSummaryChange={setSummaryState}
					/>

					<div className="section-header mb-0">
						<Zap className="w-4 h-4 text-primary" />
						<div className="font-mono font-bold uppercase text-sm text-foreground">
							Workflow 并发控制
						</div>
					</div>
					<div className="cyber-card p-4 space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
							<div className="rounded-sm border border-border/50 bg-background/20 p-4">
								<div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
									当前来源
								</div>
								<div className="mt-2 text-lg font-semibold text-foreground">
									{workflowLoading ? "加载中..." : workflowSourceLabel}
								</div>
								<div className="mt-2 text-xs leading-5 text-muted-foreground">
									未单独设置时，默认取自 {workflowDefaultSourceLabel}
								</div>
							</div>
							<div className="rounded-sm border border-border/50 bg-background/20 p-4">
								<div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
									Recon(SubAgent) 池
								</div>
								<div className="mt-2 text-2xl font-semibold text-foreground">
									{workflowLoading ? "--" : workflowConfig?.recon_count ?? "--"}
								</div>
								<div className="mt-2 text-xs leading-5 text-muted-foreground">
									控制模块级 Recon SubAgent 的并发 worker 数（Recon Host 固定单实例）
								</div>
							</div>
							<div className="rounded-sm border border-border/50 bg-background/20 p-4">
								<div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
									Analysis 共享池
								</div>
								<div className="mt-2 text-2xl font-semibold text-foreground">
									{workflowLoading ? "--" : workflowConfig?.analysis_count ?? "--"}
								</div>
								<div className="mt-2 text-xs leading-5 text-muted-foreground">
									同时作用于 Analysis 与 Business Logic Analysis
								</div>
							</div>
							<div className="rounded-sm border border-border/50 bg-background/20 p-4">
								<div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
									Verification 池
								</div>
								<div className="mt-2 text-2xl font-semibold text-foreground">
									{workflowLoading
										? "--"
										: workflowConfig?.verification_count ?? "--"}
								</div>
								<div className="mt-2 text-xs leading-5 text-muted-foreground">
									控制漏洞验证阶段的并发 worker 数
								</div>
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div className="space-y-2">
								<Label htmlFor="workflow-recon-count">
									Recon(SubAgent) 并发数
								</Label>
								<Input
									id="workflow-recon-count"
									type="number"
									min={1}
									max={32}
									step={1}
									value={workflowDraft.reconCount}
									onChange={(event) =>
										updateWorkflowDraft("reconCount", event.target.value)
									}
									disabled={workflowLoading || workflowSaving}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="workflow-analysis-count">
									Analysis 并发数
								</Label>
								<Input
									id="workflow-analysis-count"
									type="number"
									min={1}
									max={32}
									step={1}
									value={workflowDraft.analysisCount}
									onChange={(event) =>
										updateWorkflowDraft("analysisCount", event.target.value)
									}
									disabled={workflowLoading || workflowSaving}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="workflow-verification-count">
									Verification 并发数
								</Label>
								<Input
									id="workflow-verification-count"
									type="number"
									min={1}
									max={32}
									step={1}
									value={workflowDraft.verificationCount}
									onChange={(event) =>
										updateWorkflowDraft("verificationCount", event.target.value)
									}
									disabled={workflowLoading || workflowSaving}
								/>
							</div>
						</div>

						<div className="rounded-sm border border-dashed border-border/50 bg-background/10 p-3 text-sm leading-6 text-muted-foreground">
							这里配置的是智能扫描 workflow 的 worker 池大小。Recon Host 固定为 1，Recon 配置仅影响 SubAgent 并发。保存后会作用于当前用户后续新发起的智能扫描 / 混合扫描任务，不会追溯修改正在运行的任务。
						</div>

						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div className="text-xs leading-5 text-muted-foreground">
								本地默认值：Recon(SubAgent) {workflowConfig?.default_recon_count ?? "--"} /
								Analysis{" "}
								{workflowConfig?.default_analysis_count ?? "--"} / Verification{" "}
								{workflowConfig?.default_verification_count ?? "--"}
							</div>
							<div className="flex flex-col-reverse gap-2 sm:flex-row">
								<Button
									type="button"
									variant="outline"
									className="cyber-btn-ghost"
									onClick={applyWorkflowDefaults}
									disabled={workflowLoading || workflowSaving || !workflowConfig}
								>
									填回本地默认
								</Button>
								<Button
									type="button"
									className="cyber-btn"
									onClick={saveWorkflowConfig}
									disabled={workflowLoading || workflowSaving}
								>
									{workflowSaving ? "保存中..." : "保存并发配置"}
								</Button>
							</div>
						</div>
					</div>

					{/* <div className="section-header mb-0">
						<Zap className="w-4 h-4 text-primary" />
						<div className="font-mono font-bold uppercase text-sm text-foreground">
							搜索增强模块
						</div>
					</div>
					/* 已移除历史搜索增强配置入口 */}
					<div className="section-header mb-0">
						<KeyRound className="w-4 h-4 text-primary" />
						<div className="font-mono font-bold uppercase text-sm text-foreground">
							Skill 管理
						</div>
					</div>
					<div className="cyber-card p-4 space-y-4">
						<div className="rounded-sm border border-border/50 bg-background/20 p-4">
							<div className="space-y-3">
								<div className="text-sm font-semibold text-foreground">
									Prompt Skill 已迁移到外部工具页
								</div>
								<p className="text-sm leading-6 text-muted-foreground">
									统一列表页现在同时展示 scan-core、内置 Prompt Skill 和自定义 Prompt Skill。
									后续新增、启停和详情查看都从外部工具页进入。
								</p>
							</div>
						</div>
						<div className="flex justify-end">
							<Button
								asChild
								type="button"
								variant="outline"
								className="cyber-btn-ghost"
							>
								<Link to="/scan-config/external-tools">前往外部工具管理</Link>
							</Button>
						</div>
					</div>

				</div>
			</div>
		</div>
	);
}
