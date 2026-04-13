import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
	type RefObject,
} from "react";
import {
	ArrowLeft,
	ArrowDown,
	ArrowUp,
	ChevronDown,
	ChevronRight,
	FileCode2,
	Folder,
	FolderOpen,
	LocateFixed,
	Plus,
	Search,
	Sparkles,
	Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import FindingCodeWindow, {
	type FindingCodeWindowAppearance,
} from "@/pages/AgentAudit/components/FindingCodeWindow";
import Chat2RuleDialog from "@/pages/chat2rule/Chat2RuleDialog";
import Chat2RuleSelectionPreview from "@/pages/chat2rule/Chat2RuleSelectionPreview";
import {
	buildChat2RuleSelectionItem,
	clampChat2RuleRange,
	getDefaultChat2RuleLineRange,
	mergeChat2RuleSelectionItemsForFile,
	type Chat2RuleSelectionItem,
} from "@/pages/chat2rule/snippetUtils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { api } from "@/shared/api/database";
import type { Project } from "@/shared/types";
import { cn } from "@/shared/utils/utils";
import {
	buildProjectCodeBrowserContentSearchResults,
	buildProjectCodeBrowserFileSearchResults,
	buildProjectCodeBrowserTree,
	buildProjectCodeBrowserExpandedFoldersForSelection,
	filterProjectCodeBrowserTreeByQuery,
	filterProjectCodeBrowserFilesByPath,
	mergeProjectCodeBrowserSearchResults,
	normalizeProjectCodeBrowserSearchQuery,
	parseProjectCodeBrowserNavigationTarget,
	PROJECT_CODE_BROWSER_EMPTY_MESSAGE,
	PROJECT_CODE_BROWSER_FAILED_MESSAGE,
	PROJECT_CODE_BROWSER_SEARCH_EMPTY_MESSAGE,
	PROJECT_CODE_BROWSER_SEARCH_LOADING_MESSAGE,
	PROJECT_CODE_BROWSER_SEARCH_NO_RESULTS_MESSAGE,
	buildProjectCodeBrowserPreviewDecorationFromLine,
	buildProjectCodeBrowserFileSuccessState,
	resolveProjectCodeBrowserBackTarget,
	resolveProjectCodeBrowserFileFailure,
	resolveProjectCodeBrowserNavigationFilePath,
	resolveProjectCodeBrowserPreviewDecorationForSearchResult,
	shouldProjectCodeBrowserSearchContent,
	toggleProjectCodeBrowserFolder,
	type ProjectCodeBrowserFileEntry,
	type ProjectCodeBrowserFileViewState,
	type ProjectCodeBrowserMode,
	type ProjectCodeBrowserPreviewDecoration,
	type ProjectCodeBrowserSearchHighlightPart,
	type ProjectCodeBrowserSearchResult,
	type ProjectCodeBrowserSearchStatus,
	type ProjectCodeBrowserTreeNode,
} from "@/pages/project-code-browser/model";

const SEARCH_CONTENT_CONCURRENCY = 4;
const MAX_CONTENT_MATCHES_PER_FILE = 3;
const MAX_TOTAL_SEARCH_RESULTS = 50;

type ProjectCodeBrowserSearchFileLoadState =
	| { status: "ready"; content: string }
	| { status: "unavailable" | "failed" };

interface ProjectCodeBrowserWorkspaceProps {
	tree: ProjectCodeBrowserTreeNode[];
	expandedFolders: Set<string>;
	selectedFilePath: string | null;
	displayFilePath?: string | null;
	selectedFileState: ProjectCodeBrowserFileViewState;
	chat2RuleSelections?: Chat2RuleSelectionItem[];
	chat2RuleStartLine?: number;
	chat2RuleEndLine?: number;
	browserMode?: ProjectCodeBrowserMode;
	fileQuickOpenQuery?: string;
	searchQuery?: string;
	includeFileQuery?: string;
	excludeFileQuery?: string;
	searchStatus?: ProjectCodeBrowserSearchStatus;
	searchResults?: ProjectCodeBrowserSearchResult[];
	onToggleFolder: (folderPath: string) => void;
	onSelectFile: (filePath: string) => void;
	onAddChat2RuleSelection?: () => void;
	onChat2RuleRangeChange?: (startLine: number, endLine: number) => void;
	onSelectMode?: (mode: ProjectCodeBrowserMode) => void;
	onFileQuickOpenQueryChange?: (query: string) => void;
	onSearchQueryChange?: (query: string) => void;
	onIncludeFileQueryChange?: (query: string) => void;
	onExcludeFileQueryChange?: (query: string) => void;
	onSelectSearchResult?: (result: ProjectCodeBrowserSearchResult) => void;
	appearance?: FindingCodeWindowAppearance;
	previewDecorations?: Record<string, ProjectCodeBrowserPreviewDecoration | undefined>;
	searchInputRef?: RefObject<HTMLInputElement | null>;
	className?: string;
}

interface ProjectCodeBrowserContentProps extends ProjectCodeBrowserWorkspaceProps {
	project: Project | null;
	loading: boolean;
	error: string | null;
	filesCount: number;
	onBack: () => void;
	onOpenChat2Rule: () => void;
	onRemoveChat2RuleSelection?: (selectionId: string) => void;
	onClearChat2RuleSelections?: () => void;
	onMoveChat2RuleSelectionUp?: (selectionId: string) => void;
	onMoveChat2RuleSelectionDown?: (selectionId: string) => void;
	onJumpToChat2RuleSelection?: (selection: Chat2RuleSelectionItem) => void;
}

interface ProjectCodeBrowserTreeProps {
	nodes: ProjectCodeBrowserTreeNode[];
	expandedFolders: Set<string>;
	selectedFilePath: string | null;
	onToggleFolder: (folderPath: string) => void;
	onSelectFile: (filePath: string) => void;
	appearance: FindingCodeWindowAppearance;
	depth?: number;
	forceExpandAll?: boolean;
}

interface ProjectCodeBrowserModeRailProps {
	browserMode: ProjectCodeBrowserMode;
	onSelectMode: (mode: ProjectCodeBrowserMode) => void;
	appearance: FindingCodeWindowAppearance;
}

interface ProjectCodeBrowserSearchPanelProps {
	searchQuery: string;
	includeFileQuery: string;
	excludeFileQuery: string;
	searchStatus: ProjectCodeBrowserSearchStatus;
	searchResults: ProjectCodeBrowserSearchResult[];
	selectedFilePath: string | null;
	onSearchQueryChange: (query: string) => void;
	onIncludeFileQueryChange: (query: string) => void;
	onExcludeFileQueryChange: (query: string) => void;
	onSelectSearchResult: (result: ProjectCodeBrowserSearchResult) => void;
	inputRef?: RefObject<HTMLInputElement | null>;
}

interface ProjectCodeBrowserQuickOpenPanelProps {
	tree: ProjectCodeBrowserTreeNode[];
	expandedFolders: Set<string>;
	selectedFilePath: string | null;
	fileQuickOpenQuery: string;
	onToggleFolder: (folderPath: string) => void;
	onSelectFile: (filePath: string) => void;
	onFileQuickOpenQueryChange: (query: string) => void;
	appearance: FindingCodeWindowAppearance;
}

function renderFileSize(size?: number) {
	if (typeof size !== "number" || !Number.isFinite(size)) return null;
	return `${size.toLocaleString()} B`;
}

function getPaneShellClasses(appearance: FindingCodeWindowAppearance) {
	if (appearance === "terminal-flat") {
		return "rounded-md border border-white/14 bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.04)]";
	}
	if (appearance === "dense-ide") {
		return "rounded-lg border border-white/14 bg-[#030303] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]";
	}
	return "rounded-2xl border border-white/14 bg-[#020202] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]";
}

function getEmptyStateClasses() {
	return "flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center font-mono text-base text-white/48";
}

function renderHighlightedParts(
	parts: ProjectCodeBrowserSearchHighlightPart[],
	fallbackText: string,
): ReactNode {
	if (!parts.length) return fallbackText;
	return parts.map((part, index) =>
		part.matched ? (
			<mark
				key={`${part.text}-${index}`}
				className="rounded bg-[#c7ff6a]/20 px-1 text-[#efffc3]"
			>
				{part.text}
			</mark>
		) : (
			<span key={`${part.text}-${index}`}>{part.text}</span>
		),
	);
}

function findProjectCodeBrowserDisplayPath(
	nodes: ProjectCodeBrowserTreeNode[],
	sourcePath: string,
): string | null {
	for (const node of nodes) {
		if (node.kind === "file" && (node.sourcePath ?? node.path) === sourcePath) {
			return node.path;
		}
		if (node.children?.length) {
			const nested = findProjectCodeBrowserDisplayPath(node.children, sourcePath);
			if (nested) return nested;
		}
	}
	return null;
}

function ProjectCodeBrowserTree({
	nodes,
	expandedFolders,
	selectedFilePath,
	onToggleFolder,
	onSelectFile,
	appearance,
	depth = 0,
	forceExpandAll = false,
}: ProjectCodeBrowserTreeProps) {
	return (
		<div className={cn("space-y-1.5", depth > 0 && "mt-1.5")}>
			{nodes.map((node) => {
				if (node.kind === "directory") {
					const isExpanded = forceExpandAll || expandedFolders.has(node.path);
					return (
						<div key={node.path}>
							<button
								type="button"
								onClick={() => onToggleFolder(node.path)}
								className={cn(
									"flex w-full items-center gap-2 rounded-md border border-transparent px-3 py-2 text-left text-sm transition-colors cursor-pointer",
									"text-white/82 hover:border-white/10 hover:bg-white/[0.04]",
									appearance === "terminal-flat" && "rounded-sm",
								)}
								style={{ paddingLeft: `${depth * 16 + 12}px` }}
							>
								{isExpanded ? (
									<ChevronDown className="h-4 w-4 text-white/56" />
								) : (
									<ChevronRight className="h-4 w-4 text-white/38" />
								)}
								{isExpanded ? (
									<FolderOpen className="h-4 w-4 text-white/70" />
								) : (
									<Folder className="h-4 w-4 text-white/56" />
								)}
								<span className="truncate font-mono">{node.name}</span>
							</button>
							{isExpanded && node.children?.length ? (
								<ProjectCodeBrowserTree
									nodes={node.children}
									expandedFolders={expandedFolders}
									selectedFilePath={selectedFilePath}
									onToggleFolder={onToggleFolder}
									onSelectFile={onSelectFile}
									appearance={appearance}
									depth={depth + 1}
									forceExpandAll={forceExpandAll}
								/>
							) : null}
						</div>
					);
				}

				const resolvedFilePath = node.sourcePath ?? node.path;
				const isResolvedSelected = selectedFilePath === resolvedFilePath;
				return (
					<button
						key={node.path}
						type="button"
						onClick={() => onSelectFile(resolvedFilePath)}
						className={cn(
							"flex w-full items-center justify-between gap-3 border px-3 py-2 text-left transition-colors cursor-pointer",
							appearance === "terminal-flat" ? "rounded-sm" : "rounded-md",
							isResolvedSelected
								? "border-white/14 bg-white/[0.08] text-white"
								: "border-transparent text-white/74 hover:border-white/10 hover:bg-white/[0.04]",
						)}
						style={{ paddingLeft: `${depth * 16 + 32}px` }}
					>
						<span className="flex min-w-0 items-center gap-2">
							<FileCode2 className="h-4 w-4 shrink-0 text-white/62" />
							<span className="truncate font-mono text-sm">{node.name}</span>
						</span>
						{node.size ? (
							<span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-white/34">
								{renderFileSize(node.size)}
							</span>
						) : null}
					</button>
				);
			})}
		</div>
	);
}

function ProjectCodeBrowserModeRail({
	browserMode,
	onSelectMode,
	appearance,
}: ProjectCodeBrowserModeRailProps) {
	const items = [
		{
			mode: "files" as const,
			label: "文件",
			ariaLabel: "切换到文件浏览",
			icon: FileCode2,
		},
		{
			mode: "search" as const,
			label: "搜索",
			ariaLabel: "切换到搜索",
			icon: Search,
		},
	];

	return (
		<div
			className={cn(
				getPaneShellClasses(appearance),
				"min-h-[52px] overflow-hidden xl:min-h-0",
			)}
		>
			<div className="flex h-full items-center justify-center gap-2 p-2 xl:flex-col xl:justify-start xl:gap-3 xl:p-3">
				{items.map((item) => {
					const Icon = item.icon;
					const isActive = browserMode === item.mode;
					return (
						<button
							key={item.mode}
							type="button"
							aria-label={item.ariaLabel}
							aria-pressed={isActive}
							title={item.label}
							onClick={() => onSelectMode(item.mode)}
							className={cn(
								"group flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-200 cursor-pointer",
								isActive
									? "border-[#c7ff6a]/40 bg-[#c7ff6a]/10 text-[#efffc3] shadow-[0_0_30px_rgba(199,255,106,0.08)]"
									: "border-white/8 bg-white/[0.02] text-white/55 hover:border-white/14 hover:bg-white/[0.05] hover:text-white/84",
							)}
						>
							<Icon className="h-4.5 w-4.5" />
						</button>
					);
				})}
			</div>
		</div>
	);
}

function ProjectCodeBrowserSearchPanel({
	searchQuery,
	includeFileQuery,
	excludeFileQuery,
	searchStatus,
	searchResults,
	selectedFilePath,
	onSearchQueryChange,
	onIncludeFileQueryChange,
	onExcludeFileQueryChange,
	onSelectSearchResult,
	inputRef,
}: ProjectCodeBrowserSearchPanelProps) {
	const normalizedQuery = normalizeProjectCodeBrowserSearchQuery(searchQuery);

	let body: ReactNode = (
		<div className={getEmptyStateClasses()}>{PROJECT_CODE_BROWSER_SEARCH_EMPTY_MESSAGE}</div>
	);

	if (normalizedQuery) {
		if (searchResults.length > 0) {
			body = (
				<div className="space-y-2">
					{searchResults.map((result) => {
						const isSelected = selectedFilePath === result.filePath;
						return (
							<button
								key={result.id}
								type="button"
								onClick={() => onSelectSearchResult(result)}
								className={cn(
									"w-full rounded-xl border px-3 py-3 text-left transition-all cursor-pointer",
									isSelected
										? "border-[#c7ff6a]/28 bg-[#c7ff6a]/[0.07]"
										: "border-white/8 bg-white/[0.02] hover:border-white/14 hover:bg-white/[0.05]",
								)}
							>
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0 space-y-1.5">
										<div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-white/34">
											<span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] tracking-[0.18em] text-white/45">
												{result.kind === "file" ? "文件" : "内容"}
											</span>
											{result.lineNumber ? <span>第 {result.lineNumber} 行</span> : null}
										</div>
										<div className="truncate text-sm font-semibold text-white/88">
											{renderHighlightedParts(
												result.fileNameParts,
												result.fileName,
											)}
										</div>
										<div className="truncate text-xs text-white/46">
											{renderHighlightedParts(result.pathParts, result.filePath)}
										</div>
										{result.kind === "content" ? (
											<p className="line-clamp-2 text-xs leading-6 text-white/68">
												{renderHighlightedParts(
													result.excerptParts,
													result.excerpt,
												)}
											</p>
										) : null}
									</div>
								</div>
							</button>
						);
					})}
				</div>
			);
		} else if (searchStatus.state === "scanning") {
			body = (
				<div className={getEmptyStateClasses()}>
					{PROJECT_CODE_BROWSER_SEARCH_LOADING_MESSAGE}
				</div>
			);
		} else {
			body = (
				<div className={getEmptyStateClasses()}>
					{PROJECT_CODE_BROWSER_SEARCH_NO_RESULTS_MESSAGE}
				</div>
			);
		}
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="border-b border-white/8 px-4 py-4">
				<div className="mt-3 grid grid-cols-1 gap-2">
					<label className="space-y-1">
						<span className="text-[13px] uppercase tracking-[0.18em] text-white/34">
							内容搜索
						</span>
						<input
							ref={inputRef}
							type="search"
							value={searchQuery}
							onChange={(event) => onSearchQueryChange(event.target.value)}
							placeholder="输入文件名或代码片段"
							className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white outline-none transition-colors placeholder:text-white/28 focus:border-[#c7ff6a]/28 focus:bg-black/50"
						/>
					</label>
					<label className="space-y-1">
						<span className="text-[13px] uppercase tracking-[0.18em] text-white/34">
							包含文件
						</span>
						<input
							type="text"
							value={includeFileQuery}
							onChange={(event) => onIncludeFileQueryChange(event.target.value)}
							placeholder="例如 src/, api"
							className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white outline-none transition-colors placeholder:text-white/28 focus:border-[#c7ff6a]/28 focus:bg-black/50"
						/>
					</label>
					<label className="space-y-1">
						<span className="text-[13px] uppercase tracking-[0.18em] text-white/34">
							排除文件
						</span>
						<input
							type="text"
							value={excludeFileQuery}
							onChange={(event) => onExcludeFileQueryChange(event.target.value)}
							placeholder="例如 dist, mock"
							className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white outline-none transition-colors placeholder:text-white/28 focus:border-[#c7ff6a]/28 focus:bg-black/50"
						/>
					</label>
				</div>

			</div>

			<div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 custom-scrollbar-dark">
				{body}
			</div>
		</div>
	);
}

function ProjectCodeBrowserQuickOpenPanel({
	tree,
	expandedFolders,
	selectedFilePath,
	fileQuickOpenQuery,
	onToggleFolder,
	onSelectFile,
	onFileQuickOpenQueryChange,
	appearance,
}: ProjectCodeBrowserQuickOpenPanelProps) {
	const normalizedQuery = normalizeProjectCodeBrowserSearchQuery(fileQuickOpenQuery);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="border-b border-white/8 px-4 py-4">
				<p className="text-[13px] uppercase tracking-[0.18em] text-white/34">
					打开文件
				</p>
				<label className="mt-3 block space-y-1">
					<input
						type="search"
						value={fileQuickOpenQuery}
						onChange={(event) => onFileQuickOpenQueryChange(event.target.value)}
						placeholder="搜索文件名 / 路径"
						className="w-full rounded-lg border border-white/14 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none transition-colors placeholder:text-white/28 focus:border-[#c7ff6a]/32 focus:bg-black/55"
					/>
				</label>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 custom-scrollbar-dark">
				{tree.length > 0 ? (
					<ProjectCodeBrowserTree
						nodes={tree}
						expandedFolders={expandedFolders}
						selectedFilePath={selectedFilePath}
						onToggleFolder={onToggleFolder}
						onSelectFile={onSelectFile}
						appearance={appearance}
						forceExpandAll={Boolean(normalizedQuery)}
					/>
				) : (
					<div className="px-3 py-8 text-center text-sm text-white/42">
						{normalizedQuery ? "未找到匹配文件" : "当前项目没有可浏览的文本文件"}
					</div>
				)}
			</div>
		</div>
	);
}

function ProjectCodeBrowserPreview({
	selectedFilePath,
	displayFilePath,
	selectedFileState,
	chat2RuleSelections,
	chat2RuleStartLine = 1,
	chat2RuleEndLine = 80,
	appearance,
	previewDecorations,
	onAddChat2RuleSelection,
	onChat2RuleRangeChange,
}: Pick<
	ProjectCodeBrowserWorkspaceProps,
	| "selectedFilePath"
	| "displayFilePath"
	| "selectedFileState"
	| "chat2RuleSelections"
	| "chat2RuleStartLine"
	| "chat2RuleEndLine"
	| "appearance"
	| "previewDecorations"
	| "onAddChat2RuleSelection"
	| "onChat2RuleRangeChange"
>) {
	const [isMouseSelecting, setIsMouseSelecting] = useState(false);
	const [selectionAnchorLine, setSelectionAnchorLine] = useState<number | null>(null);
	const requestedPathForDecoration =
		selectedFileState.status === "ready"
			? selectedFileState.requestedFilePath
			: selectedFilePath || "";
	const previewDecoration = requestedPathForDecoration
		? previewDecorations?.[requestedPathForDecoration]
		: undefined;
	const persistedSelectionRanges = useMemo(() => {
		if (selectedFileState.status !== "ready") return [];
		return (chat2RuleSelections ?? [])
			.filter((selection) => selection.filePath === selectedFileState.requestedFilePath)
			.map((selection) => ({
				startLine: selection.startLine,
				endLine: selection.endLine,
			}));
	}, [chat2RuleSelections, selectedFileState]);

	useEffect(() => {
		if (!isMouseSelecting) return undefined;
		const stopSelecting = () => {
			setIsMouseSelecting(false);
			setSelectionAnchorLine(null);
		};
		window.addEventListener("mouseup", stopSelecting);
		return () => {
			window.removeEventListener("mouseup", stopSelecting);
		};
	}, [isMouseSelecting]);

	if (selectedFileState.status === "loading") {
		return <div className={getEmptyStateClasses()}>正在加载文件内容...</div>;
	}

	if (selectedFileState.status === "failed") {
		return <div className={getEmptyStateClasses()}>{selectedFileState.message}</div>;
	}

	if (selectedFileState.status === "unavailable") {
		return <div className={getEmptyStateClasses()}>{selectedFileState.message}</div>;
	}

	if (selectedFileState.status === "ready") {
		const lineEnd = selectedFileState.displayLines.length;
		const selectedRange = clampChat2RuleRange(
			selectedFileState.content,
			chat2RuleStartLine,
			chat2RuleEndLine,
		);
		const meta =
			selectedFileState.syntaxLanguageLabel &&
				selectedFileState.syntaxStatus === "highlighted"
				? [selectedFileState.syntaxLanguageLabel]
				: selectedFileState.syntaxLanguageLabel &&
					selectedFileState.syntaxStatus === "plain-text"
					? [selectedFileState.syntaxLanguageLabel, "纯文本回退"]
					: ["纯文本"];
		return (
			<div className="flex h-full min-h-0 flex-col gap-3">
				<div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
					<div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
						<div className="flex flex-wrap items-end gap-3">
							<div className="space-y-1.5">
								<Label className="text-[11px] uppercase tracking-[0.18em] text-white/42">
									当前鼠标选择
								</Label>
								<div className="flex h-9 min-w-[168px] items-center rounded-md border border-white/10 bg-black/50 px-3 text-sm text-white/78">
									{selectedRange.safeStart === selectedRange.safeEnd
										? `第 ${selectedRange.safeStart} 行`
										: `${selectedRange.safeStart}-${selectedRange.safeEnd} 行`}
								</div>
							</div>
							<Button
								type="button"
								size="sm"
								onClick={onAddChat2RuleSelection}
								className="h-9 bg-[#c7ff6a] text-black hover:bg-[#d6ff8d]"
								disabled={selectedFileState.status !== "ready"}
							>
								<Plus className="h-4 w-4" />
								添加当前片段
							</Button>
						</div>
						<div className="flex flex-wrap items-center gap-2 text-xs text-white/48">
							<Badge variant="outline" className="border-white/12 text-white/72">
								已添加 {chat2RuleSelections?.length ?? 0} 个片段
							</Badge>
							<span>深绿色为已添加片段；拖拽代码行选择范围后可继续添加。</span>
						</div>
					</div>
				</div>

				<div className="min-h-0 flex-1">
					<FindingCodeWindow
						filePath={displayFilePath || selectedFileState.requestedFilePath}
						code={selectedFileState.content}
						displayLines={selectedFileState.displayLines}
						lineStart={1}
						lineEnd={lineEnd}
						highlightStartLine={previewDecoration?.highlightStartLine ?? undefined}
						highlightEndLine={previewDecoration?.highlightEndLine ?? undefined}
						focusLine={previewDecoration?.focusLine ?? undefined}
						persistedSelectionRanges={persistedSelectionRanges}
						selectionStartLine={selectedRange.safeStart}
						selectionEndLine={selectedRange.safeEnd}
						onLineSelectionStart={(lineNumber) => {
							setSelectionAnchorLine(lineNumber);
							setIsMouseSelecting(true);
							onChat2RuleRangeChange?.(lineNumber, lineNumber);
						}}
						onLineSelectionExtend={(lineNumber) => {
							if (!isMouseSelecting || selectionAnchorLine === null) return;
							onChat2RuleRangeChange?.(
								Math.min(selectionAnchorLine, lineNumber),
								Math.max(selectionAnchorLine, lineNumber),
							);
						}}
						onLineSelectionEnd={(lineNumber) => {
							const anchorLine =
								selectionAnchorLine ?? chat2RuleStartLine ?? lineNumber;
							onChat2RuleRangeChange?.(
								Math.min(anchorLine, lineNumber),
								Math.max(anchorLine, lineNumber),
							);
							setIsMouseSelecting(false);
							setSelectionAnchorLine(null);
						}}
						meta={meta}
						variant="detail"
						appearance={appearance}
						displayPreset="project-browser"
					/>
				</div>
			</div>
		);
	}

	return (
		<div className={getEmptyStateClasses()}>
			{selectedFilePath ? PROJECT_CODE_BROWSER_FAILED_MESSAGE : PROJECT_CODE_BROWSER_EMPTY_MESSAGE}
		</div>
	);
}

function ProjectCodeBrowserSidePanel({
	tree,
	expandedFolders,
	selectedFilePath,
	browserMode,
	fileQuickOpenQuery,
	searchQuery,
	includeFileQuery,
	excludeFileQuery,
	searchStatus,
	searchResults,
	onToggleFolder,
	onSelectFile,
	onFileQuickOpenQueryChange,
	onSearchQueryChange,
	onIncludeFileQueryChange,
	onExcludeFileQueryChange,
	onSelectSearchResult,
	appearance,
	searchInputRef,
}: Pick<
	ProjectCodeBrowserWorkspaceProps,
	| "tree"
	| "expandedFolders"
	| "selectedFilePath"
	| "browserMode"
	| "fileQuickOpenQuery"
	| "searchQuery"
	| "includeFileQuery"
	| "excludeFileQuery"
	| "searchStatus"
	| "searchResults"
	| "onToggleFolder"
	| "onSelectFile"
	| "onFileQuickOpenQueryChange"
	| "onSearchQueryChange"
	| "onIncludeFileQueryChange"
	| "onExcludeFileQueryChange"
	| "onSelectSearchResult"
	| "appearance"
	| "searchInputRef"
>) {
	if (
		browserMode === "search" &&
		searchStatus &&
		searchResults &&
		onSearchQueryChange &&
		onSelectSearchResult
	) {
		return (
			<ProjectCodeBrowserSearchPanel
				searchQuery={searchQuery ?? ""}
				includeFileQuery={includeFileQuery ?? ""}
				excludeFileQuery={excludeFileQuery ?? ""}
				searchStatus={searchStatus}
				searchResults={searchResults}
				selectedFilePath={selectedFilePath}
				onSearchQueryChange={onSearchQueryChange}
				onIncludeFileQueryChange={onIncludeFileQueryChange ?? (() => { })}
				onExcludeFileQueryChange={onExcludeFileQueryChange ?? (() => { })}
				onSelectSearchResult={onSelectSearchResult}
				inputRef={searchInputRef}
			/>
		);
	}

	return (
		<ProjectCodeBrowserQuickOpenPanel
			tree={tree}
			expandedFolders={expandedFolders}
			selectedFilePath={selectedFilePath}
			fileQuickOpenQuery={fileQuickOpenQuery ?? ""}
			onToggleFolder={onToggleFolder}
			onSelectFile={onSelectFile}
			onFileQuickOpenQueryChange={onFileQuickOpenQueryChange ?? (() => { })}
			appearance={appearance ?? "native-explorer"}
		/>
	);
}

interface ProjectCodeBrowserSelectedSnippetsPanelProps {
	selections: Chat2RuleSelectionItem[];
	selectedFilePath: string | null;
	onClearSelections: () => void;
	onRemoveSelection: (selectionId: string) => void;
	onMoveSelectionUp: (selectionId: string) => void;
	onMoveSelectionDown: (selectionId: string) => void;
	onJumpToSelection: (selection: Chat2RuleSelectionItem) => void;
}

function ProjectCodeBrowserSelectedSnippetsPanel({
	selections,
	selectedFilePath,
	onClearSelections,
	onRemoveSelection,
	onMoveSelectionUp,
	onMoveSelectionDown,
	onJumpToSelection,
}: ProjectCodeBrowserSelectedSnippetsPanelProps) {
	return (
		<section className="shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/80">
			<div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="space-y-1.5">
					<div className="flex flex-wrap items-center gap-2">
						<Label className="text-xs uppercase tracking-[0.18em] text-white/42">
							当前已选片段栏
						</Label>
						<Badge variant="outline" className="border-white/12 text-white/72">
							{selections.length} 个片段
						</Badge>
					</div>
					<p className="text-sm text-white/48">
						支持清空、上下重排，并快速跳回片段对应位置；列表过长时会在内部滚动。
					</p>
				</div>

				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={onClearSelections}
					disabled={selections.length === 0}
					className="border-white/10 bg-white/[0.03] text-white/72 hover:bg-white/[0.06]"
				>
					<Trash2 className="h-4 w-4" />
					清空全部
				</Button>
			</div>

			<div className="max-h-64 overflow-y-auto px-4 py-4 custom-scrollbar-dark">
				{selections.length === 0 ? (
					<div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-white/42">
						还没有已选片段。先在右侧代码区拖拽选择行，再点“添加当前片段”。
					</div>
				) : (
					<div className="space-y-3">
						{selections.map((selection, index) => {
							const isActive = selectedFilePath === selection.filePath;
							const isFirst = index === 0;
							const isLast = index === selections.length - 1;
							return (
								<div
									key={selection.id}
									className={cn(
										"rounded-xl border p-3 transition-colors",
										isActive
											? "border-[#c7ff6a]/24 bg-[#c7ff6a]/[0.06]"
											: "border-white/10 bg-white/[0.03]",
									)}
								>
									<div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
										<div className="min-w-0 space-y-1.5">
											<div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/38">
												<span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] tracking-[0.18em] text-white/48">
													#{index + 1}
												</span>
												<span>
													第 {selection.startLine}-{selection.endLine} 行
												</span>
												{isActive ? (
													<span className="rounded-full border border-[#c7ff6a]/22 px-2 py-0.5 text-[9px] text-[#efffc3]">
														当前文件
													</span>
												) : null}
											</div>
											<button
												type="button"
												onClick={() => onJumpToSelection(selection)}
												className="truncate text-left text-sm font-semibold text-white/88 transition-colors hover:text-[#efffc3]"
											>
												{selection.filePath}
											</button>
										</div>

										<div className="flex shrink-0 items-center gap-1.5">
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => onMoveSelectionUp(selection.id)}
												disabled={isFirst}
												className="border-white/10 bg-transparent px-2 text-white/64 hover:bg-white/[0.05]"
												aria-label={`上移片段 ${selection.filePath}`}
											>
												<ArrowUp className="h-4 w-4" />
											</Button>
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => onMoveSelectionDown(selection.id)}
												disabled={isLast}
												className="border-white/10 bg-transparent px-2 text-white/64 hover:bg-white/[0.05]"
												aria-label={`下移片段 ${selection.filePath}`}
											>
												<ArrowDown className="h-4 w-4" />
											</Button>
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => onJumpToSelection(selection)}
												className="border-white/10 bg-transparent px-2 text-white/64 hover:bg-white/[0.05]"
												aria-label={`跳转到片段 ${selection.filePath}`}
											>
												<LocateFixed className="h-4 w-4" />
											</Button>
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => onRemoveSelection(selection.id)}
												className="border-white/10 bg-transparent px-2 text-white/64 hover:bg-white/[0.05]"
												aria-label={`移除片段 ${selection.filePath}`}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									</div>

									<Chat2RuleSelectionPreview
										preview={selection.preview}
										className="mt-3 max-h-28"
									/>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</section>
	);
}

export function ProjectCodeBrowserWorkspace({
	tree,
	expandedFolders,
	selectedFilePath,
	selectedFileState,
	chat2RuleSelections = [],
	chat2RuleStartLine = 1,
	chat2RuleEndLine = 80,
	browserMode = "files",
	fileQuickOpenQuery = "",
	searchQuery = "",
	includeFileQuery = "",
	excludeFileQuery = "",
	searchStatus = { state: "idle", scanned: 0, total: 0 },
	searchResults = [],
	onToggleFolder,
	onSelectFile,
	onAddChat2RuleSelection = () => { },
	onChat2RuleRangeChange = () => { },
	onSelectMode = () => { },
	onFileQuickOpenQueryChange = () => { },
	onSearchQueryChange = () => { },
	onIncludeFileQueryChange = () => { },
	onExcludeFileQueryChange = () => { },
	onSelectSearchResult = () => { },
	appearance = "native-explorer",
	previewDecorations,
	searchInputRef,
	className,
}: ProjectCodeBrowserWorkspaceProps) {
	const selectedDisplayPath = useMemo(() => {
		if (!selectedFilePath) return null;
		return findProjectCodeBrowserDisplayPath(tree, selectedFilePath) ?? selectedFilePath;
	}, [selectedFilePath, tree]);

	return (
		<section
			className={cn(
				"grid min-h-0 grid-cols-1 gap-4 overflow-hidden xl:grid-cols-[52px_minmax(280px,320px)_minmax(0,1fr)]",
				className,
			)}
		>
			<ProjectCodeBrowserModeRail
				browserMode={browserMode}
				onSelectMode={onSelectMode}
				appearance={appearance}
			/>

			<div
				className={cn(
					getPaneShellClasses(appearance),
					"min-h-[360px] overflow-hidden xl:min-h-0",
				)}
			>
				<ProjectCodeBrowserSidePanel
					tree={tree}
					expandedFolders={expandedFolders}
					selectedFilePath={selectedFilePath}
					browserMode={browserMode}
					fileQuickOpenQuery={fileQuickOpenQuery}
					searchQuery={searchQuery}
					includeFileQuery={includeFileQuery}
					excludeFileQuery={excludeFileQuery}
					searchStatus={searchStatus}
					searchResults={searchResults}
					onToggleFolder={onToggleFolder}
					onSelectFile={onSelectFile}
					onFileQuickOpenQueryChange={onFileQuickOpenQueryChange}
					onSearchQueryChange={onSearchQueryChange}
					onIncludeFileQueryChange={onIncludeFileQueryChange}
					onExcludeFileQueryChange={onExcludeFileQueryChange}
					onSelectSearchResult={onSelectSearchResult}
					appearance={appearance}
					searchInputRef={searchInputRef}
				/>
			</div>

			<div
				className={cn(
					getPaneShellClasses(appearance),
					"min-h-[360px] overflow-hidden xl:min-h-0",
				)}
			>
				<div className="flex h-full min-h-0 flex-col">
					<div className="flex min-h-0 flex-1 flex-col p-3">
						<ProjectCodeBrowserPreview
							selectedFilePath={selectedFilePath}
							displayFilePath={selectedDisplayPath}
							selectedFileState={selectedFileState}
							chat2RuleSelections={chat2RuleSelections}
							chat2RuleStartLine={chat2RuleStartLine}
							chat2RuleEndLine={chat2RuleEndLine}
							appearance={appearance}
							previewDecorations={previewDecorations}
							onAddChat2RuleSelection={onAddChat2RuleSelection}
							onChat2RuleRangeChange={onChat2RuleRangeChange}
						/>
					</div>
				</div>
			</div>
		</section>
	);
}

export function ProjectCodeBrowserContent({
	project,
	loading,
	error,
	filesCount,
	tree,
	expandedFolders,
	selectedFilePath,
	selectedFileState,
	chat2RuleSelections = [],
	chat2RuleStartLine = 1,
	chat2RuleEndLine = 80,
	browserMode = "files",
	fileQuickOpenQuery = "",
	searchQuery = "",
	includeFileQuery = "",
	excludeFileQuery = "",
	searchStatus = { state: "idle", scanned: 0, total: 0 },
	searchResults = [],
	onBack,
	onOpenChat2Rule,
	onRemoveChat2RuleSelection = () => {},
	onClearChat2RuleSelections = () => {},
	onMoveChat2RuleSelectionUp = () => {},
	onMoveChat2RuleSelectionDown = () => {},
	onJumpToChat2RuleSelection = () => {},
	onToggleFolder,
	onSelectFile,
	onAddChat2RuleSelection = () => {},
	onChat2RuleRangeChange = () => {},
	onSelectMode = () => {},
	onFileQuickOpenQueryChange = () => {},
	onSearchQueryChange = () => {},
	onIncludeFileQueryChange = () => {},
	onExcludeFileQueryChange = () => {},
	onSelectSearchResult = () => {},
	appearance = "native-explorer",
	previewDecorations,
	searchInputRef,
}: ProjectCodeBrowserContentProps) {
	void filesCount;
	const isZipProject = project?.source_type === "zip";

	return (
		<div className="relative flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col gap-4 overflow-hidden bg-background p-6 font-mono">
			<section className="rounded-2xl border border-white/10 bg-black/80 px-5 py-4">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div className="flex min-w-0 items-start gap-3">
						<Button
							type="button"
							size="sm"
							variant="outline"
							className="h-9 border-white/10 bg-black px-3 text-white/80 hover:bg-white/[0.04] hover:text-white"
							onClick={onBack}
						>
							<ArrowLeft className="h-4 w-4" />
							返回
						</Button>
						<div className="min-w-0 space-y-1">
							<h1 className="truncate text-2xl font-bold text-white">
								{project?.name || "项目代码浏览"}
							</h1>
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="outline" className="border-white/12 text-white/72">
							已选中片段片段 {chat2RuleSelections.length}
						</Badge>
						<Button
							type="button"
							size="sm"
							className="border border-[#c7ff6a]/20 bg-[#c7ff6a]/10 px-3 text-[#efffc3] hover:bg-[#c7ff6a]/18 hover:text-white"
							onClick={onOpenChat2Rule}
							disabled={!isZipProject}
						>
							<Sparkles className="h-4 w-4" />
							对话生成规则
						</Button>
					</div>
				</div>
			</section>

			{!loading && !error && project && isZipProject ? (
				<ProjectCodeBrowserSelectedSnippetsPanel
					selections={chat2RuleSelections}
					selectedFilePath={selectedFilePath}
					onClearSelections={onClearChat2RuleSelections}
					onRemoveSelection={onRemoveChat2RuleSelection}
					onMoveSelectionUp={onMoveChat2RuleSelectionUp}
					onMoveSelectionDown={onMoveChat2RuleSelectionDown}
					onJumpToSelection={onJumpToChat2RuleSelection}
				/>
			) : null}

			{loading ? (
				<section className="flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-black/80 p-6 text-sm text-white/56">
					正在加载项目代码浏览数据...
				</section>
			) : error ? (
				<section className="flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-black/80 p-6 text-sm text-white/56">
					{error}
				</section>
			) : !project ? (
				<section className="flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-black/80 p-6 text-sm text-white/56">
					项目不存在或已被删除
				</section>
			) : !isZipProject ? (
				<section className="flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-black/80 p-6 text-sm text-white/56">
					仅 ZIP 类型项目支持代码浏览
				</section>
			) : (
				<ProjectCodeBrowserWorkspace
					tree={tree}
					expandedFolders={expandedFolders}
					selectedFilePath={selectedFilePath}
					selectedFileState={selectedFileState}
					chat2RuleSelections={chat2RuleSelections}
					chat2RuleStartLine={chat2RuleStartLine}
					chat2RuleEndLine={chat2RuleEndLine}
					browserMode={browserMode}
					fileQuickOpenQuery={fileQuickOpenQuery}
					searchQuery={searchQuery}
					includeFileQuery={includeFileQuery}
					excludeFileQuery={excludeFileQuery}
					searchStatus={searchStatus}
					searchResults={searchResults}
					onToggleFolder={onToggleFolder}
					onSelectFile={onSelectFile}
					onAddChat2RuleSelection={onAddChat2RuleSelection}
					onChat2RuleRangeChange={onChat2RuleRangeChange}
					onSelectMode={onSelectMode}
					onFileQuickOpenQueryChange={onFileQuickOpenQueryChange}
					onSearchQueryChange={onSearchQueryChange}
					onIncludeFileQueryChange={onIncludeFileQueryChange}
					onExcludeFileQueryChange={onExcludeFileQueryChange}
					onSelectSearchResult={onSelectSearchResult}
					appearance={appearance}
					previewDecorations={previewDecorations}
					searchInputRef={searchInputRef}
					className="flex-1 min-h-0 overflow-hidden"
				/>
			)}
		</div>
	);
}

export default function ProjectCodeBrowser() {
	const navigate = useNavigate();
	const location = useLocation();
	const { id } = useParams<{ id: string }>();
	const [project, setProject] = useState<Project | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [projectFiles, setProjectFiles] = useState<ProjectCodeBrowserFileEntry[]>([]);
	const [tree, setTree] = useState<ProjectCodeBrowserTreeNode[]>([]);
	const [filesCount, setFilesCount] = useState(0);
	const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
		() => new Set(),
	);
	const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
	const [fileStates, setFileStates] = useState<
		Record<string, ProjectCodeBrowserFileViewState>
	>({});
	const [browserMode, setBrowserMode] = useState<ProjectCodeBrowserMode>("files");
	const [fileQuickOpenQuery, setFileQuickOpenQuery] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [includeFileQuery, setIncludeFileQuery] = useState("");
	const [excludeFileQuery, setExcludeFileQuery] = useState("");
	const [searchStatus, setSearchStatus] = useState<ProjectCodeBrowserSearchStatus>({
		state: "idle",
		scanned: 0,
		total: 0,
	});
	const [searchResults, setSearchResults] = useState<ProjectCodeBrowserSearchResult[]>([]);
	const [previewDecorations, setPreviewDecorations] = useState<
		Record<string, ProjectCodeBrowserPreviewDecoration | undefined>
	>({});
	const [isChat2RuleOpen, setIsChat2RuleOpen] = useState(false);
	const [chat2RuleSelections, setChat2RuleSelections] = useState<Chat2RuleSelectionItem[]>([]);
	const [chat2RuleStartLine, setChat2RuleStartLine] = useState(1);
	const [chat2RuleEndLine, setChat2RuleEndLine] = useState(80);
	const searchInputRef = useRef<HTMLInputElement | null>(null);
	const fileStatesRef = useRef<Record<string, ProjectCodeBrowserFileViewState>>({});
	const pendingFileLoadsRef = useRef<
		Record<string, Promise<ProjectCodeBrowserFileViewState>>
	>({});
	const searchFileStatesRef = useRef<
		Record<string, ProjectCodeBrowserSearchFileLoadState>
	>({});
	const pendingSearchFileLoadsRef = useRef<
		Record<string, Promise<ProjectCodeBrowserSearchFileLoadState>>
	>({});
	const searchSessionRef = useRef(0);
	const appliedNavigationTargetRef = useRef<string | null>(null);

	const from =
		typeof (location.state as { from?: unknown } | null)?.from === "string"
			? ((location.state as { from?: string }).from ?? "")
			: "";
	const navigationTarget = useMemo(
		() => parseProjectCodeBrowserNavigationTarget(location.search),
		[location.search],
	);

	const updateFileState = useCallback(
		(filePath: string, nextState: ProjectCodeBrowserFileViewState) => {
			setFileStates((current) => {
				const next = {
					...current,
					[filePath]: nextState,
				};
				fileStatesRef.current = next;
				return next;
			});
		},
		[],
	);

	useEffect(() => {
		fileStatesRef.current = fileStates;
	}, [fileStates]);

	useEffect(() => {
		return () => {
			searchSessionRef.current += 1;
		};
	}, []);

	useEffect(() => {
		if (browserMode !== "search") return;
		const frame = window.requestAnimationFrame(() => {
			searchInputRef.current?.focus();
		});
		return () => window.cancelAnimationFrame(frame);
	}, [browserMode]);

	const loadFileState = useCallback(
		async (filePath: string, options?: { selectFile?: boolean }) => {
			if (!id || project?.source_type !== "zip") {
				return { status: "idle" } as ProjectCodeBrowserFileViewState;
			}

			if (options?.selectFile) {
				setSelectedFilePath(filePath);
			}

			const cachedState = fileStatesRef.current[filePath];
			if (cachedState && cachedState.status !== "idle" && cachedState.status !== "loading") {
				return cachedState;
			}

			const pending = pendingFileLoadsRef.current[filePath];
			if (pending) {
				return pending;
			}

			updateFileState(filePath, { status: "loading" });
			const request = api
				.getProjectFileContent(id, filePath)
				.then(async (response) => {
					const nextState = await buildProjectCodeBrowserFileSuccessState(
						filePath,
						response,
					);
					updateFileState(filePath, nextState);
					return nextState;
				})
				.catch((requestError) => {
					const nextState = resolveProjectCodeBrowserFileFailure(requestError);
					updateFileState(filePath, nextState);
					return nextState;
				})
				.finally(() => {
					delete pendingFileLoadsRef.current[filePath];
				});

			pendingFileLoadsRef.current[filePath] = request;
			return request;
		},
		[id, project?.source_type, updateFileState],
	);

	const loadSearchFileState = useCallback(
		async (filePath: string): Promise<ProjectCodeBrowserSearchFileLoadState> => {
			const previewState = fileStatesRef.current[filePath];
			if (previewState?.status === "ready") {
				return {
					status: "ready",
					content: previewState.content,
				};
			}
			if (previewState?.status === "unavailable") {
				return { status: "unavailable" };
			}
			if (previewState?.status === "failed") {
				return { status: "failed" };
			}

			const cachedSearchState = searchFileStatesRef.current[filePath];
			if (cachedSearchState) {
				return cachedSearchState;
			}

			const pendingSearchLoad = pendingSearchFileLoadsRef.current[filePath];
			if (pendingSearchLoad) {
				return pendingSearchLoad;
			}

			if (!id || project?.source_type !== "zip") {
				return { status: "failed" };
			}

			const request = api
				.getProjectFileContent(id, filePath)
				.then((response) => {
					const nextState: ProjectCodeBrowserSearchFileLoadState = response.is_text
						? { status: "ready", content: response.content }
						: { status: "unavailable" };
					searchFileStatesRef.current[filePath] = nextState;
					return nextState;
				})
				.catch(() => {
					const nextState: ProjectCodeBrowserSearchFileLoadState = {
						status: "failed",
					};
					searchFileStatesRef.current[filePath] = nextState;
					return nextState;
				})
				.finally(() => {
					delete pendingSearchFileLoadsRef.current[filePath];
				});

			pendingSearchFileLoadsRef.current[filePath] = request;
			return request;
		},
		[id, project?.source_type],
	);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			setLoading(true);
			setError(null);
			setProject(null);
			setProjectFiles([]);
			setTree([]);
			setFilesCount(0);
			setExpandedFolders(new Set());
			setSelectedFilePath(null);
			setFileStates({});
			fileStatesRef.current = {};
			pendingFileLoadsRef.current = {};
			searchFileStatesRef.current = {};
			pendingSearchFileLoadsRef.current = {};
			setBrowserMode("files");
			setFileQuickOpenQuery("");
			setSearchQuery("");
			setIncludeFileQuery("");
			setExcludeFileQuery("");
			setSearchStatus({ state: "idle", scanned: 0, total: 0 });
			setSearchResults([]);
			setPreviewDecorations({});
			setChat2RuleSelections([]);
			setChat2RuleStartLine(1);
			setChat2RuleEndLine(80);
			appliedNavigationTargetRef.current = null;

			if (!id) {
				setError("项目不存在或已被删除");
				setLoading(false);
				return;
			}

			try {
				const currentProject = await api.getProjectById(id);
				if (cancelled) return;

				if (!currentProject) {
					setError("项目不存在或已被删除");
					setLoading(false);
					return;
				}

				setProject(currentProject);

				if (currentProject.source_type !== "zip") {
					setLoading(false);
					return;
				}

				const files = await api.getProjectFiles(id);
				if (cancelled) return;

				setProjectFiles(files);
				setFilesCount(files.length);
				setTree(buildProjectCodeBrowserTree(files));
			} catch (_error) {
				if (cancelled) return;
				setError("加载项目代码浏览数据失败");
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		void load();

		return () => {
			cancelled = true;
		};
	}, [id]);

	const filteredProjectFiles = useMemo(
		() =>
			filterProjectCodeBrowserFilesByPath(projectFiles, {
				include: includeFileQuery,
				exclude: excludeFileQuery,
			}),
		[excludeFileQuery, includeFileQuery, projectFiles],
	);

	const filteredFileTree = useMemo(
		() => filterProjectCodeBrowserTreeByQuery(tree, fileQuickOpenQuery),
		[fileQuickOpenQuery, tree],
	);

	useEffect(() => {
		const normalizedQuery = normalizeProjectCodeBrowserSearchQuery(searchQuery);
		const sessionId = searchSessionRef.current + 1;
		searchSessionRef.current = sessionId;
		const totalFiles = filteredProjectFiles.length;

		if (!normalizedQuery) {
			setSearchResults([]);
			setSearchStatus({ state: "idle", scanned: 0, total: totalFiles });
			return;
		}

		const fileResults = buildProjectCodeBrowserFileSearchResults(
			filteredProjectFiles,
			normalizedQuery,
		);
		setSearchResults(fileResults.slice(0, MAX_TOTAL_SEARCH_RESULTS));

		if (!shouldProjectCodeBrowserSearchContent(normalizedQuery)) {
			setSearchStatus({ state: "done", scanned: 0, total: 0 });
			return;
		}

		let cancelled = false;
		const contentResults: ProjectCodeBrowserSearchResult[] = [];
		let scanned = 0;
		setSearchStatus({ state: "scanning", scanned: 0, total: totalFiles });

		const applyProgress = () => {
			if (cancelled || searchSessionRef.current !== sessionId) return;
			setSearchResults(
				mergeProjectCodeBrowserSearchResults(fileResults, contentResults, {
					maxResults: MAX_TOTAL_SEARCH_RESULTS,
				}),
			);
			setSearchStatus({
				state: "scanning",
				scanned,
				total: totalFiles,
			});
		};

		const scanFile = async (file: ProjectCodeBrowserFileEntry) => {
			const state = await loadSearchFileState(file.path);
			if (cancelled || searchSessionRef.current !== sessionId) return;

			if (state.status === "ready") {
				contentResults.push(
					...buildProjectCodeBrowserContentSearchResults(
						file.path,
						state.content,
						normalizedQuery,
						{ maxMatchesPerFile: MAX_CONTENT_MATCHES_PER_FILE },
					),
				);
			}

			scanned += 1;
			applyProgress();
		};

		const workerCount = Math.min(SEARCH_CONTENT_CONCURRENCY, Math.max(totalFiles, 1));
		void Promise.all(
			Array.from({ length: workerCount }, async (_, workerIndex) => {
				for (let index = workerIndex; index < filteredProjectFiles.length; index += workerCount) {
					if (cancelled || searchSessionRef.current !== sessionId) return;
					await scanFile(filteredProjectFiles[index]);
				}
			}),
		)
			.then(() => {
				if (cancelled || searchSessionRef.current !== sessionId) return;
				setSearchResults(
					mergeProjectCodeBrowserSearchResults(fileResults, contentResults, {
						maxResults: MAX_TOTAL_SEARCH_RESULTS,
					}),
				);
				setSearchStatus({
					state: "done",
					scanned,
					total: totalFiles,
				});
			})
			.catch(() => {
				if (cancelled || searchSessionRef.current !== sessionId) return;
				setSearchStatus({
					state: "failed",
					scanned,
					total: totalFiles,
					error: "搜索失败，请稍后重试",
				});
			});

		return () => {
			cancelled = true;
		};
	}, [filteredProjectFiles, loadSearchFileState, searchQuery]);

	const selectedFileState = useMemo<ProjectCodeBrowserFileViewState>(() => {
		if (!selectedFilePath) {
			return { status: "idle" };
		}
		return fileStates[selectedFilePath] ?? { status: "idle" };
	}, [fileStates, selectedFilePath]);
	const selectedPreviewDecoration = useMemo(() => {
		if (!selectedFilePath) return undefined;
		return previewDecorations[selectedFilePath];
	}, [previewDecorations, selectedFilePath]);

	useEffect(() => {
		if (selectedFileState.status !== "ready") return;
		const defaultRange = getDefaultChat2RuleLineRange(
			selectedFileState,
			selectedPreviewDecoration,
		);
		setChat2RuleStartLine(defaultRange.startLine);
		setChat2RuleEndLine(defaultRange.endLine);
	}, [selectedFileState, selectedPreviewDecoration]);

	const handleAddChat2RuleSelection = useCallback(() => {
		if (selectedFileState.status !== "ready") {
			toast.error("先打开一个可预览的文本文件，再添加片段");
			return;
		}

		const nextSelection = buildChat2RuleSelectionItem(
			selectedFileState.requestedFilePath,
			selectedFileState.content,
			chat2RuleStartLine,
			chat2RuleEndLine,
		);

		setChat2RuleSelections((current) => {
			const alreadyExists = current.some(
				(selection) => selection.id === nextSelection.id,
			);
			if (alreadyExists) {
				toast.error(
					`该片段已存在：${nextSelection.filePath}:${nextSelection.startLine}-${nextSelection.endLine}`,
				);
				return current;
			}
			const mergedSelections = mergeChat2RuleSelectionItemsForFile(
				current,
				{
					filePath: selectedFileState.requestedFilePath,
					startLine: nextSelection.startLine,
					endLine: nextSelection.endLine,
				},
				selectedFileState.content,
			);
			const wasMerged =
				current.some((selection) => selection.filePath === nextSelection.filePath) &&
				!mergedSelections.some((selection) => selection.id === nextSelection.id);
			toast.success(
				wasMerged
					? `已合并重叠片段：${nextSelection.filePath}:${nextSelection.startLine}-${nextSelection.endLine}`
					: `已添加片段：${nextSelection.filePath}:${nextSelection.startLine}-${nextSelection.endLine}`,
			);
			return mergedSelections;
		});
	}, [chat2RuleEndLine, chat2RuleStartLine, selectedFileState]);

	const handleRemoveChat2RuleSelection = useCallback((selectionId: string) => {
		setChat2RuleSelections((current) =>
			current.filter((selection) => selection.id !== selectionId),
		);
	}, []);

	const handleClearChat2RuleSelections = useCallback(() => {
		setChat2RuleSelections([]);
		toast.success("已清空当前已选片段");
	}, []);

	const handleMoveChat2RuleSelection = useCallback(
		(selectionId: string, direction: "up" | "down") => {
			setChat2RuleSelections((current) => {
				const currentIndex = current.findIndex((selection) => selection.id === selectionId);
				if (currentIndex < 0) return current;

				const targetIndex =
					direction === "up" ? currentIndex - 1 : currentIndex + 1;
				if (targetIndex < 0 || targetIndex >= current.length) {
					return current;
				}

				const nextSelections = [...current];
				const [selection] = nextSelections.splice(currentIndex, 1);
				nextSelections.splice(targetIndex, 0, selection);
				return nextSelections;
			});
		},
		[],
	);

	const handleJumpToChat2RuleSelection = useCallback(
		async (selection: Chat2RuleSelectionItem) => {
			if (project?.source_type !== "zip") {
				toast.error("当前项目暂不支持片段跳转");
				return;
			}

			const resolvedFilePath =
				resolveProjectCodeBrowserNavigationFilePath(selection.filePath, projectFiles) ??
				selection.filePath;

			setExpandedFolders((current) =>
				buildProjectCodeBrowserExpandedFoldersForSelection(
					current,
					tree,
					resolvedFilePath,
				),
			);
			setPreviewDecorations({
				[resolvedFilePath]: {
					focusLine: selection.startLine,
					highlightStartLine: selection.startLine,
					highlightEndLine: selection.endLine,
				},
			});

			const nextState = await loadFileState(resolvedFilePath, { selectFile: true });
			if (nextState.status !== "ready") {
				toast.error(`跳转失败：${selection.filePath}`);
				return;
			}

			setChat2RuleStartLine(selection.startLine);
			setChat2RuleEndLine(selection.endLine);
		},
		[loadFileState, project?.source_type, projectFiles, tree],
	);

	const handleChat2RuleStartLineChange = useCallback(
		(nextLine: number) => {
			if (selectedFileState.status !== "ready") {
				setChat2RuleStartLine(nextLine);
				return;
			}
			const { safeStart } = clampChat2RuleRange(
				selectedFileState.content,
				nextLine,
				chat2RuleEndLine,
			);
			setChat2RuleStartLine(safeStart);
		},
		[chat2RuleEndLine, selectedFileState],
	);

	const handleChat2RuleEndLineChange = useCallback(
		(nextLine: number) => {
			if (selectedFileState.status !== "ready") {
				setChat2RuleEndLine(nextLine);
				return;
			}
			const { safeEnd } = clampChat2RuleRange(
				selectedFileState.content,
				chat2RuleStartLine,
				nextLine,
			);
			setChat2RuleEndLine(safeEnd);
		},
		[chat2RuleStartLine, selectedFileState],
	);

	const handleBack = useCallback(() => {
		const target = resolveProjectCodeBrowserBackTarget({
			from,
			hasHistory: typeof window !== "undefined" && window.history.length > 1,
		});
		if (typeof target === "number") {
			navigate(target);
			return;
		}
		navigate(target);
	}, [from, navigate]);

	const handleToggleFolder = useCallback((folderPath: string) => {
		setExpandedFolders((current) =>
			toggleProjectCodeBrowserFolder(current, folderPath),
		);
	}, []);

	const handleSelectMode = useCallback((mode: ProjectCodeBrowserMode) => {
		setBrowserMode(mode);
	}, []);

	const handleSelectFile = useCallback(
		async (filePath: string) => {
			setPreviewDecorations({});
			await loadFileState(filePath, { selectFile: true });
		},
		[loadFileState],
	);

	const handleSelectSearchResult = useCallback(
		async (result: ProjectCodeBrowserSearchResult) => {
			setPreviewDecorations(
				resolveProjectCodeBrowserPreviewDecorationForSearchResult(result),
			);
			await loadFileState(result.filePath, { selectFile: true });
		},
		[loadFileState],
	);

	useEffect(() => {
		if (!project || project.source_type !== "zip") return;
		if (!navigationTarget.filePath) return;
		if (projectFiles.length === 0 || tree.length === 0) return;

		const navigationKey = `${navigationTarget.filePath}:${navigationTarget.line ?? ""}`;
		if (appliedNavigationTargetRef.current === navigationKey) return;

		const resolvedFilePath = resolveProjectCodeBrowserNavigationFilePath(
			navigationTarget.filePath,
			projectFiles,
		);
		if (!resolvedFilePath) {
			appliedNavigationTargetRef.current = navigationKey;
			return;
		}

		appliedNavigationTargetRef.current = navigationKey;
		setExpandedFolders((current) =>
			buildProjectCodeBrowserExpandedFoldersForSelection(
				current,
				tree,
				resolvedFilePath,
			),
		);

		void loadFileState(resolvedFilePath, { selectFile: true }).then((nextState) => {
			setPreviewDecorations({
				[resolvedFilePath]: buildProjectCodeBrowserPreviewDecorationFromLine(
					navigationTarget.line,
					nextState,
				),
			});
		});
	}, [loadFileState, navigationTarget, project, projectFiles, tree]);

	return (
		<>
			<ProjectCodeBrowserContent
				project={project}
				loading={loading}
				error={error}
				filesCount={filesCount}
				tree={filteredFileTree}
				expandedFolders={expandedFolders}
				selectedFilePath={selectedFilePath}
				selectedFileState={selectedFileState}
				chat2RuleSelections={chat2RuleSelections}
				chat2RuleStartLine={chat2RuleStartLine}
				chat2RuleEndLine={chat2RuleEndLine}
				browserMode={browserMode}
				fileQuickOpenQuery={fileQuickOpenQuery}
				searchQuery={searchQuery}
				includeFileQuery={includeFileQuery}
				excludeFileQuery={excludeFileQuery}
				searchStatus={searchStatus}
				searchResults={searchResults}
				onBack={handleBack}
				onOpenChat2Rule={() => setIsChat2RuleOpen(true)}
				onRemoveChat2RuleSelection={handleRemoveChat2RuleSelection}
				onClearChat2RuleSelections={handleClearChat2RuleSelections}
				onMoveChat2RuleSelectionUp={(selectionId) =>
					handleMoveChat2RuleSelection(selectionId, "up")
				}
				onMoveChat2RuleSelectionDown={(selectionId) =>
					handleMoveChat2RuleSelection(selectionId, "down")
				}
				onJumpToChat2RuleSelection={handleJumpToChat2RuleSelection}
				onToggleFolder={handleToggleFolder}
				onSelectFile={handleSelectFile}
				onAddChat2RuleSelection={handleAddChat2RuleSelection}
				onChat2RuleRangeChange={(startLine, endLine) => {
					handleChat2RuleStartLineChange(startLine);
					handleChat2RuleEndLineChange(endLine);
				}}
				onSelectMode={handleSelectMode}
				onFileQuickOpenQueryChange={setFileQuickOpenQuery}
				onSearchQueryChange={setSearchQuery}
				onIncludeFileQueryChange={setIncludeFileQuery}
				onExcludeFileQueryChange={setExcludeFileQuery}
				onSelectSearchResult={handleSelectSearchResult}
				previewDecorations={previewDecorations}
				searchInputRef={searchInputRef}
			/>
			<Chat2RuleDialog
				open={isChat2RuleOpen}
				onOpenChange={setIsChat2RuleOpen}
				projectId={id ?? ""}
				projectName={project?.name}
				selections={chat2RuleSelections}
				onRemoveSelection={handleRemoveChat2RuleSelection}
			/>
		</>
	);
}
