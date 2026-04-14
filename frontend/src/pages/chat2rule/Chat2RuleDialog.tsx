import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
	Loader2,
	MessageSquareCode,
	Save,
	Sparkles,
	Square,
	Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Chat2RuleSelectionPreview from "@/pages/chat2rule/Chat2RuleSelectionPreview";
import type { Chat2RuleSelectionItem } from "@/pages/chat2rule/snippetUtils";
import {
	saveRuleFromChat,
	streamChatWithRule,
	type Chat2RuleEngineType,
	type Chat2RuleValidationResult,
} from "@/shared/api/chat2rule";
import { cn } from "@/shared/utils/utils";

interface Chat2RuleDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectId: string;
	projectName?: string | null;
	selections: Chat2RuleSelectionItem[];
	onRemoveSelection: (selectionId: string) => void;
}

type DraftSnapshot = {
	ruleTitle: string;
	ruleText: string;
	explanation: string;
	validationResult: Chat2RuleValidationResult | null;
};

type ChatTurn = {
	id: string;
	role: "user" | "assistant";
	content: string;
	selections?: Chat2RuleSelectionItem[];
	artifact?: DraftSnapshot | null;
};

const CHAT2RULE_ENGINES: Array<{
	value: Chat2RuleEngineType;
	label: string;
	saveSupported: boolean;
	ruleTextLabel: string;
}> = [
	{ value: "opengrep", label: "Opengrep", saveSupported: true, ruleTextLabel: "规则 YAML" },
	{ value: "gitleaks", label: "Gitleaks", saveSupported: true, ruleTextLabel: "规则 JSON" },
	{ value: "bandit", label: "Bandit", saveSupported: false, ruleTextLabel: "规则草案" },
	{ value: "phpstan", label: "PHPStan", saveSupported: false, ruleTextLabel: "规则草案" },
	{ value: "pmd", label: "PMD", saveSupported: true, ruleTextLabel: "Ruleset XML" },
	{ value: "yasa", label: "YASA", saveSupported: true, ruleTextLabel: "Rule Config JSON" },
];

function findEngineConfig(engineType: Chat2RuleEngineType) {
	return CHAT2RULE_ENGINES.find((item) => item.value === engineType) || CHAT2RULE_ENGINES[0];
}

function normalizeApiError(error: unknown) {
	if ((error as Error)?.name === "AbortError") {
		return "已停止生成";
	}
	const candidate = error as {
		response?: { data?: { detail?: string } };
		message?: string;
	};
	return candidate?.response?.data?.detail || candidate?.message || "请求失败，请稍后重试";
}

export default function Chat2RuleDialog({
	open,
	onOpenChange,
	projectId,
	projectName,
	selections,
	onRemoveSelection,
}: Chat2RuleDialogProps) {
	const chatScrollRef = useRef<HTMLDivElement | null>(null);
	const abortRef = useRef<AbortController | null>(null);
	const wasOpenRef = useRef(false);
	const idPrefix = useId();

	const [turns, setTurns] = useState<ChatTurn[]>([]);
	const [composer, setComposer] = useState("");
	const [engineType, setEngineType] = useState<Chat2RuleEngineType>("opengrep");
	const [saveSupported, setSaveSupported] = useState(true);
	const [isGenerating, setIsGenerating] = useState(false);
	const [streamingAssistantMessage, setStreamingAssistantMessage] = useState("");
	const [streamingDraft, setStreamingDraft] = useState<Partial<DraftSnapshot>>({});
	const [currentDraft, setCurrentDraft] = useState<DraftSnapshot | null>(null);
	const [isSavePanelOpen, setIsSavePanelOpen] = useState(false);
	const [saveTitle, setSaveTitle] = useState("");
	const [saveDescription, setSaveDescription] = useState("");
	const [saveRuleText, setSaveRuleText] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	const displayedDraft = useMemo<DraftSnapshot | null>(() => {
		const ruleTitle = (streamingDraft.ruleTitle || currentDraft?.ruleTitle || "").trim();
		const ruleText = (streamingDraft.ruleText || currentDraft?.ruleText || "").trim();
		const explanation = (streamingDraft.explanation || currentDraft?.explanation || "").trim();
		if (!ruleText && !ruleTitle && !explanation) return null;
		return {
			ruleTitle,
			ruleText,
			explanation,
			validationResult: isGenerating ? null : currentDraft?.validationResult ?? null,
		};
	}, [currentDraft, isGenerating, streamingDraft]);
	const engineConfig = useMemo(() => findEngineConfig(engineType), [engineType]);
	const saveTitleInputId = `${idPrefix}-save-title`;
	const chatScrollVersion = useMemo(
		() =>
			`${turns.length}:${streamingAssistantMessage.length}:${displayedDraft?.ruleText?.length ?? 0}`,
		[displayedDraft?.ruleText, streamingAssistantMessage.length, turns.length],
	);

	useEffect(() => {
		const justOpened = open && !wasOpenRef.current;
		wasOpenRef.current = open;
		if (!justOpened) {
			if (!open) {
				abortRef.current?.abort();
			}
			return;
		}

		abortRef.current?.abort();
		setComposer("");
		setEngineType("opengrep");
		setSaveSupported(true);
		setTurns([]);
		setCurrentDraft(null);
		setStreamingDraft({});
		setStreamingAssistantMessage("");
		setIsGenerating(false);
		setIsSavePanelOpen(false);
		setSaveTitle("");
		setSaveDescription("");
		setSaveRuleText("");
	}, [open]);

	useEffect(() => {
		const container = chatScrollRef.current;
		if (!container) return;
		if (!chatScrollVersion) return;
		container.scrollTop = container.scrollHeight;
	}, [chatScrollVersion]);

	useEffect(() => {
		setIsSavePanelOpen(false);
	}, [engineType]);

	const openSavePanel = () => {
		if (!saveSupported) {
			toast.error(`当前引擎 ${engineConfig.label} 仅支持生成草案，不支持直接保存`);
			return;
		}
		if (!displayedDraft?.ruleText.trim()) {
			toast.error("当前还没有可保存的规则草案");
			return;
		}
		setSaveTitle(displayedDraft.ruleTitle || "");
		setSaveDescription(displayedDraft.explanation || "");
		setSaveRuleText(displayedDraft.ruleText || "");
		setIsSavePanelOpen(true);
	};

	const handleStopGenerating = () => {
		abortRef.current?.abort();
		abortRef.current = null;
		setIsGenerating(false);
		setStreamingAssistantMessage("");
		setStreamingDraft({});
	};

	const handleSend = async () => {
		const content = composer.trim();
		if (!content) {
			toast.error("先输入你想生成或调整的规则需求");
			return;
		}
		if (selections.length === 0) {
			toast.error("至少添加一个代码片段再开始对话");
			return;
		}
		if (isGenerating) {
			toast.error("当前还在生成中，请先等待或停止本轮生成");
			return;
		}

		const userTurn: ChatTurn = {
			id: `turn-${Date.now()}`,
			role: "user",
			content,
			selections: selections.map((selection) => ({ ...selection })),
		};
		const nextTurns = [...turns, userTurn];
		setTurns(nextTurns);
		setComposer("");
		setStreamingAssistantMessage("");
		setStreamingDraft({});
		setIsGenerating(true);
		setIsSavePanelOpen(false);

		const controller = new AbortController();
		abortRef.current = controller;

		try {
			await streamChatWithRule(
				projectId,
				engineType,
				{
					messages: nextTurns.map(({ role, content: messageContent }) => ({
						role,
						content: messageContent,
					})),
					selections: selections.map((selection) => ({
						file_path: selection.filePath,
						start_line: selection.startLine,
						end_line: selection.endLine,
					})),
					draft_rule_text: currentDraft?.ruleText || undefined,
				},
				{
					signal: controller.signal,
					onEvent: (event) => {
						if (event.engine_type) {
							setEngineType(event.engine_type);
						}
						if (typeof event.save_supported === "boolean") {
							setSaveSupported(event.save_supported);
						}
						if (event.type === "draft") {
							setStreamingAssistantMessage(event.assistant_message || "");
							setStreamingDraft({
								ruleTitle: event.rule_title,
								ruleText: event.rule_text,
								explanation: event.explanation,
							});
							return;
						}
						if (event.type === "result") {
							setEngineType(event.engine_type);
							setSaveSupported(event.save_supported);
							const nextDraft: DraftSnapshot = {
								ruleTitle: event.rule_title,
								ruleText: event.rule_text,
								explanation: event.explanation,
								validationResult: event.validation_result,
							};
							setCurrentDraft(nextDraft);
							setStreamingAssistantMessage("");
							setStreamingDraft({});
							setTurns((current) => [
								...current,
								{
									id: `turn-${Date.now()}-assistant`,
									role: "assistant",
									content: event.assistant_message,
									artifact: nextDraft,
								},
							]);
						}
					},
				},
			);
		} catch (error) {
			if ((error as Error)?.name !== "AbortError") {
				toast.error(normalizeApiError(error));
			}
		} finally {
			abortRef.current = null;
			setIsGenerating(false);
			setStreamingAssistantMessage("");
			setStreamingDraft({});
		}
	};

	const handleSave = async () => {
		if (!saveRuleText.trim()) {
			toast.error("规则文本不能为空");
			return;
		}
		setIsSaving(true);
		try {
			const response = await saveRuleFromChat(projectId, engineType, {
				rule_text: saveRuleText,
				title: saveTitle.trim() || undefined,
				description: saveDescription.trim() || undefined,
			});
			toast.success(`${response.message}：${response.name}`);
			setIsSavePanelOpen(false);
		} catch (error) {
			toast.error(normalizeApiError(error));
		} finally {
			setIsSaving(false);
		}
	};

	const canSend = composer.trim().length > 0 && selections.length > 0 && !isGenerating;
	const canOpenSavePanel = Boolean(displayedDraft?.ruleText.trim()) && !isGenerating && saveSupported;
	const saveDisabled = !saveRuleText.trim() || isSaving;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="!w-[min(96vw,1440px)] !max-w-none h-[88vh] max-h-[88vh] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden border-white/10 bg-[#050505] p-0 text-white">
				<DialogHeader className="border-b border-white/10 bg-black/80 px-6 py-5">
					<div className="flex items-start justify-between gap-4">
						<div className="space-y-2">
							<DialogTitle className="flex items-center gap-2 text-left text-white">
								<MessageSquareCode className="h-5 w-5 text-[#c7ff6a]" />
								聊天生成规则 · {engineConfig.label}
							</DialogTitle>
							<DialogDescription className="text-left text-white/64">
								片段需要先在代码浏览页添加；这里专注聊天生成、查看草案，以及在最后手动保存。
							</DialogDescription>
						</div>
						<div className="flex flex-wrap items-center gap-2 text-xs text-white/56">
							<label className="flex items-center gap-2 rounded-md border border-white/12 bg-white/[0.03] px-2 py-1">
								<span className="text-white/56">引擎</span>
								<select
									value={engineType}
									onChange={(event) => {
										const next = event.target.value as Chat2RuleEngineType;
										setEngineType(next);
										setSaveSupported(findEngineConfig(next).saveSupported);
									}}
									className="bg-transparent text-white outline-none"
								>
									{CHAT2RULE_ENGINES.map((engine) => (
										<option key={engine.value} value={engine.value} className="bg-[#101010]">
											{engine.label}
										</option>
									))}
								</select>
							</label>
							{projectName ? (
								<Badge variant="outline" className="border-white/12 text-white/72">
									{projectName}
								</Badge>
							) : null}
							<Badge variant="outline" className="border-white/12 text-white/72">
								片段 {selections.length}
							</Badge>
						</div>
					</div>
				</DialogHeader>

				<div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px]">
					<div className="flex min-h-0 flex-col border-b border-white/10 lg:border-b-0 lg:border-r">
						<div className="border-b border-white/10 px-6 py-4">
							<div className="flex items-center justify-between gap-3">
								<div>
									<Label className="text-xs uppercase tracking-[0.18em] text-white/42">
										聊天会话
									</Label>
									<p className="mt-2 text-sm text-white/48">
										每次发送都会带上当前所有片段和最近一版规则草案。
									</p>
								</div>
								{isGenerating ? (
									<Button
										type="button"
										variant="outline"
										onClick={handleStopGenerating}
										className="border-white/12 bg-white/[0.03] text-white/74 hover:bg-white/[0.06]"
									>
										<Square className="h-4 w-4 fill-current" />
										停止生成
									</Button>
								) : null}
							</div>
						</div>

						<div ref={chatScrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
							{turns.length === 0 ? (
								<div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm leading-7 text-white/48">
									先在代码浏览页添加片段，再回到这里像聊天一样描述你要检测的风险模式。
								</div>
							) : null}
							{turns.map((turn) => (
								<div
									key={turn.id}
									className={cn(
										"rounded-2xl border px-4 py-4",
										turn.role === "user"
											? "border-[#c7ff6a]/20 bg-[#c7ff6a]/[0.06]"
											: "border-white/10 bg-white/[0.03]",
									)}
								>
									<div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/38">
										{turn.role === "user" ? "你" : "AI"}
									</div>
									<div className="whitespace-pre-wrap break-words text-sm leading-7 text-white/88">
										{turn.content}
									</div>

									{turn.selections?.length ? (
										<div className="mt-4 flex flex-wrap gap-2">
											{turn.selections.map((selection) => (
												<Badge
													key={selection.id}
													variant="outline"
													className="border-white/12 text-white/70"
												>
													{selection.filePath}:{selection.startLine}-{selection.endLine}
												</Badge>
											))}
										</div>
									) : null}

									{turn.artifact ? (
										<div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-4">
											<div className="flex items-center justify-between gap-3">
												<div className="text-sm font-semibold text-white">
													{turn.artifact.ruleTitle || "当前草案"}
												</div>
												<Badge
													variant="outline"
													className={cn(
														"border-white/12",
														turn.artifact.validationResult?.valid
															? "text-[#c7ff6a]"
															: "text-[#ffb59a]",
													)}
												>
													{turn.artifact.validationResult?.valid ? "校验通过" : "待检查"}
												</Badge>
											</div>
											{turn.artifact.explanation ? (
												<p className="mt-3 text-sm leading-6 text-white/62">
													{turn.artifact.explanation}
												</p>
											) : null}
											<pre className="mt-3 overflow-x-auto rounded-lg border border-white/8 bg-black/70 p-3 text-xs leading-6 text-white/78">
												{turn.artifact.ruleText.split("\n").slice(0, 16).join("\n")}
												{turn.artifact.ruleText.split("\n").length > 16 ? "\n..." : ""}
											</pre>
										</div>
									) : null}
								</div>
							))}

							{isGenerating ? (
								<div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
									<div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/38">
										<Loader2 className="h-3.5 w-3.5 animate-spin" />
										AI
									</div>
									<div className="whitespace-pre-wrap break-words text-sm leading-7 text-white/84">
										{streamingAssistantMessage || "正在组织回复..."}
									</div>
									{displayedDraft?.ruleText ? (
										<div className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/40 p-4 text-xs leading-6 text-white/58">
											<div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/38">
												草案流式更新中
											</div>
											<pre className="overflow-x-auto whitespace-pre-wrap break-words">
												{displayedDraft.ruleText.slice(0, 1800)}
												{displayedDraft.ruleText.length > 1800 ? "..." : ""}
											</pre>
										</div>
									) : null}
								</div>
							) : null}
						</div>

						<div className="border-t border-white/10 px-6 py-4">
							<div className="space-y-3">
								<Textarea
									value={composer}
									onChange={(event) => setComposer(event.target.value)}
									placeholder="例如：根据选中的代码片段，我想要一个规则来检测 Python 里使用 subprocess 模块时，shell 参数被设置为 True 的情况。"
									className="min-h-[132px] border-white/10 bg-white/[0.03] text-white placeholder:text-white/28"
								/>
								<div className="flex items-center justify-between gap-3">
									<p className="text-xs text-white/42">
										当前会带上 {selections.length} 个片段和最新草案一起发给模型。
									</p>
									<Button
										type="button"
										onClick={handleSend}
										disabled={!canSend}
										className="bg-[#c7ff6a] text-black hover:bg-[#d6ff8d]"
									>
										{isGenerating ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<Sparkles className="h-4 w-4" />
										)}
										发送并生成
									</Button>
								</div>
							</div>
						</div>
					</div>

					<div className="flex min-h-0 flex-col bg-black/30">
						<div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
							<div className="space-y-6">
								<section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
									<div>
										<Label className="text-xs uppercase tracking-[0.18em] text-white/42">
											多片段上下文
										</Label>
										<p className="mt-2 text-sm text-white/48">
											片段只能在代码浏览页添加；这里仅展示当前会话会带上的上下文。
										</p>
									</div>

									<div className="space-y-3">
										{selections.length === 0 ? (
											<div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-sm text-white/42">
												还没有上下文片段。先关闭弹窗，在代码浏览区域选好行号后添加。
											</div>
										) : null}
										{selections.map((selection) => (
											<div key={selection.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
												<div className="flex items-start justify-between gap-3">
													<div className="min-w-0">
														<div className="truncate text-sm font-semibold text-white/88">
															{selection.filePath}
														</div>
														<div className="mt-1 text-xs text-white/46">
															{selection.startLine}-{selection.endLine}
														</div>
													</div>
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={() => onRemoveSelection(selection.id)}
														className="border-white/10 bg-transparent px-2 text-white/64 hover:bg-white/[0.05]"
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</div>
												<Chat2RuleSelectionPreview
													preview={selection.preview}
													className="mt-3 max-h-36"
												/>
											</div>
										))}
									</div>
								</section>

								<section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
									<div className="flex items-start justify-between gap-3">
										<div>
											<Label className="text-xs uppercase tracking-[0.18em] text-white/42">
												当前草案
											</Label>
											<p className="mt-2 text-sm text-white/48">
												这里展示当前会话里最新一版规则，不会自动保存。
											</p>
										</div>
										{displayedDraft?.validationResult ? (
											<Badge
												variant="outline"
												className={cn(
													"border-white/12",
													displayedDraft.validationResult.valid
														? "text-[#c7ff6a]"
														: "text-[#ffb59a]",
												)}
											>
												{displayedDraft.validationResult.valid ? "校验通过" : "校验失败"}
											</Badge>
										) : isGenerating && displayedDraft ? (
											<Badge variant="outline" className="border-white/12 text-white/70">
												流式更新中
											</Badge>
										) : null}
									</div>

									{displayedDraft ? (
										<>
											{displayedDraft.ruleTitle ? (
												<div className="text-sm font-semibold text-white">
													{displayedDraft.ruleTitle}
												</div>
											) : null}
											{displayedDraft.explanation ? (
												<p className="text-sm leading-6 text-white/62">
													{displayedDraft.explanation}
												</p>
											) : null}
											<pre className="max-h-72 overflow-auto rounded-xl border border-white/10 bg-black/60 p-3 text-xs leading-6 text-white/78">
												{displayedDraft.ruleText || "规则内容还在生成中..."}
											</pre>
											{displayedDraft.validationResult && !displayedDraft.validationResult.valid ? (
												<div className="rounded-xl border border-[#ff9d7a]/20 bg-[#ff9d7a]/[0.08] p-3 text-sm text-[#ffd0bf]">
													{displayedDraft.validationResult.errors.join("；")}
												</div>
											) : null}
										</>
									) : (
										<div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-sm text-white/42">
											聊天生成后，这里会显示当前草案。
										</div>
									)}

									<div className="flex justify-end">
										<div className="flex flex-col items-end gap-2">
											<Button
												type="button"
												onClick={openSavePanel}
												disabled={!canOpenSavePanel}
												className="bg-[#c7ff6a] text-black hover:bg-[#d6ff8d]"
											>
												<Save className="h-4 w-4" />
												手动保存当前草案
											</Button>
											{!saveSupported ? (
												<p className="text-xs text-white/42">
													{engineConfig.label} 当前仅支持生成草案，不支持直接保存。
												</p>
											) : null}
										</div>
									</div>
								</section>

								{isSavePanelOpen ? (
									<section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
										<div>
											<Label className="text-xs uppercase tracking-[0.18em] text-white/42">
												保存表单
											</Label>
											<p className="mt-2 text-sm text-white/48">
												现在才会真正提交保存；你可以补标题、说明，或者直接改规则文本。
											</p>
										</div>

										<div className="space-y-2">
											<Label htmlFor={saveTitleInputId} className="text-xs uppercase tracking-[0.18em] text-white/42">
												规则标题
											</Label>
											<Input
												id={saveTitleInputId}
												value={saveTitle}
												onChange={(event) => setSaveTitle(event.target.value)}
												placeholder="例如 python-subprocess-shell-injection"
												className="border-white/10 bg-white/[0.03] text-white"
											/>
										</div>

										<div className="space-y-2">
											<Label className="text-xs uppercase tracking-[0.18em] text-white/42">
												规则说明
											</Label>
											<Textarea
												value={saveDescription}
												onChange={(event) => setSaveDescription(event.target.value)}
												placeholder="补充一点规则用途或限制"
												className="min-h-[100px] border-white/10 bg-white/[0.03] text-white placeholder:text-white/28"
											/>
										</div>

										<div className="space-y-2">
											<Label className="text-xs uppercase tracking-[0.18em] text-white/42">
												{engineConfig.ruleTextLabel}
											</Label>
											<Textarea
												value={saveRuleText}
												onChange={(event) => setSaveRuleText(event.target.value)}
												placeholder={`最终保存的 ${engineConfig.label} 规则内容`}
												className="min-h-[260px] border-white/10 bg-black/70 text-white placeholder:text-white/28"
											/>
										</div>

										<div className="flex items-center justify-end gap-3">
											<Button
												type="button"
												variant="outline"
												onClick={() => setIsSavePanelOpen(false)}
												className="border-white/10 bg-transparent text-white/72 hover:bg-white/[0.05]"
											>
												取消
											</Button>
											<Button
												type="button"
												onClick={handleSave}
												disabled={saveDisabled}
												className="bg-white text-black hover:bg-white/90"
											>
												{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
												确认保存
											</Button>
										</div>
									</section>
								) : null}
							</div>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
