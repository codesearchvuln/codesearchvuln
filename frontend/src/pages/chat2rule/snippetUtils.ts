import type {
	ProjectCodeBrowserFileViewState,
	ProjectCodeBrowserPreviewDecoration,
} from "@/pages/project-code-browser/model";

export interface Chat2RuleSelectionItem {
	id: string;
	filePath: string;
	startLine: number;
	endLine: number;
	preview: string;
}

interface Chat2RuleSelectionRangeInput {
	filePath: string;
	startLine: number;
	endLine: number;
}

export function getDefaultChat2RuleLineRange(
	selectedFileState: ProjectCodeBrowserFileViewState,
	previewDecoration?: ProjectCodeBrowserPreviewDecoration,
) {
	if (selectedFileState.status !== "ready") {
		return { startLine: 1, endLine: 80 };
	}

	const totalLines = selectedFileState.displayLines.length || 1;
	const highlightedStart =
		previewDecoration?.highlightStartLine ?? previewDecoration?.focusLine ?? null;
	const highlightedEnd = previewDecoration?.highlightEndLine ?? highlightedStart;
	if (
		typeof highlightedStart === "number" &&
		Number.isFinite(highlightedStart) &&
		typeof highlightedEnd === "number" &&
		Number.isFinite(highlightedEnd)
	) {
		return {
			startLine: Math.max(1, Math.min(highlightedStart, totalLines)),
			endLine: Math.max(1, Math.min(highlightedEnd, totalLines)),
		};
	}

	return {
		startLine: 1,
		endLine: Math.min(totalLines, 80),
	};
}

export function makeChat2RuleSelectionId(
	filePath: string,
	startLine: number,
	endLine: number,
) {
	return `${filePath}:${startLine}-${endLine}`;
}

export function clampChat2RuleRange(
	content: string,
	startLine: number,
	endLine: number,
) {
	const lines = content.split(/\r?\n/);
	const totalLines = Math.max(lines.length, 1);
	const safeStart = Math.max(1, Math.min(startLine || 1, totalLines));
	const safeEnd = Math.max(safeStart, Math.min(endLine || safeStart, totalLines));
	return { totalLines, safeStart, safeEnd, lines };
}

export function buildChat2RuleSnippetPreview(
	content: string,
	startLine: number,
	endLine: number,
	limit = 8,
) {
	if (!content.trim()) {
		return "当前文件没有可预览的文本内容。";
	}

	const { safeStart, safeEnd, lines } = clampChat2RuleRange(content, startLine, endLine);
	const previewEnd = Math.min(safeEnd, safeStart + Math.max(limit - 1, 0));
	const snippet = lines.slice(safeStart - 1, previewEnd);
	const rendered = snippet
		.map((line, index) => `${String(safeStart + index).padStart(4, " ")} | ${line}`)
		.join("\n");

	return previewEnd < safeEnd ? `${rendered}\n...` : rendered;
}

export function buildChat2RuleSelectionItem(
	filePath: string,
	content: string,
	startLine: number,
	endLine: number,
): Chat2RuleSelectionItem {
	const { safeStart, safeEnd } = clampChat2RuleRange(content, startLine, endLine);
	return {
		id: makeChat2RuleSelectionId(filePath, safeStart, safeEnd),
		filePath,
		startLine: safeStart,
		endLine: safeEnd,
		preview: buildChat2RuleSnippetPreview(content, safeStart, safeEnd, 6),
	};
}

export function mergeChat2RuleSelectionItemsForFile(
	currentSelections: Chat2RuleSelectionItem[],
	nextRange: Chat2RuleSelectionRangeInput,
	fileContent: string,
) {
	const normalizedNextRange = buildChat2RuleSelectionItem(
		nextRange.filePath,
		fileContent,
		nextRange.startLine,
		nextRange.endLine,
	);

	const overlapIndexes: number[] = [];
	let mergedStartLine = normalizedNextRange.startLine;
	let mergedEndLine = normalizedNextRange.endLine;

	for (const [index, selection] of currentSelections.entries()) {
		if (selection.filePath !== normalizedNextRange.filePath) continue;
		const hasOverlap =
			selection.startLine <= normalizedNextRange.endLine &&
			normalizedNextRange.startLine <= selection.endLine;
		if (!hasOverlap) continue;

		overlapIndexes.push(index);
		mergedStartLine = Math.min(mergedStartLine, selection.startLine);
		mergedEndLine = Math.max(mergedEndLine, selection.endLine);
	}

	const mergedSelection = buildChat2RuleSelectionItem(
		normalizedNextRange.filePath,
		fileContent,
		mergedStartLine,
		mergedEndLine,
	);

	if (overlapIndexes.length === 0) {
		return [...currentSelections, mergedSelection];
	}

	const earliestOverlapIndex = overlapIndexes[0];
	return currentSelections.reduce<Chat2RuleSelectionItem[]>((result, selection, index) => {
		if (index === earliestOverlapIndex) {
			result.push(mergedSelection);
			return result;
		}
		if (overlapIndexes.includes(index)) {
			return result;
		}
		result.push(selection);
		return result;
	}, []);
}
