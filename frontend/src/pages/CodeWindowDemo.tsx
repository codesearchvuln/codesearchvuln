import { useMemo, useState } from "react";
import { cn } from "@/shared/utils/utils";
import type { ProjectCodeBrowserFileViewState } from "@/pages/project-code-browser/model";
import {
	buildProjectCodeBrowserTree,
	toggleProjectCodeBrowserFolder,
} from "@/pages/project-code-browser/model";
import {
	ProjectCodeBrowserWorkspace,
} from "@/pages/ProjectCodeBrowser";
import type { FindingCodeWindowAppearance } from "@/pages/AgentAudit/components/FindingCodeWindow";

type DemoFileRecord = Record<
	string,
	{
		content: string;
		size: number;
		focusLine?: number;
		highlightStartLine?: number;
		highlightEndLine?: number;
	}
>;

const APPEARANCE_OPTIONS: Array<{
	value: FindingCodeWindowAppearance;
	label: string;
	description: string;
}> = [
	{
		value: "native-explorer",
		label: "Native Explorer",
		description: "圆角更柔和，像文件树延伸出的原生深色浏览器。",
	},
	{
		value: "terminal-flat",
		label: "Terminal Flat",
		description: "边框和层次更克制，像贴在页面上的黑色终端查看器。",
	},
	{
		value: "dense-ide",
		label: "Dense IDE",
		description: "gutter 更明确，阅读密度更像传统 IDE 代码面板。",
	},
];

const DEMO_FILES: DemoFileRecord = {
	"src/pages/AgentAudit/components/FindingCodeWindow.tsx": {
		content: [
			'import { useEffect, useMemo, useRef } from "react";',
			'import { cn } from "@/shared/utils/utils";',
			"",
			'export type FindingCodeWindowAppearance = "native-explorer" | "terminal-flat" | "dense-ide";',
			"",
			"export default function FindingCodeWindowDemoSample() {",
			"  const lines = useMemo(() => [",
			'    "const shell = \\"black\\";",',
			'    "const chrome = false;",',
			"  ], []);",
			"",
			"  return (",
			'    <section className="overflow-hidden rounded-2xl border border-white/10 bg-black text-white shadow-[0_18px_44px_rgba(0,0,0,0.34)]">', // long line for horizontal scroll
			'      <div className="border-b border-white/8 px-4 py-3 text-[13px] text-white/78">src/pages/AgentAudit/components/FindingCodeWindow.tsx:12-18</div>',
			'      <pre className="min-w-max whitespace-pre px-4 py-3 text-[12.5px] leading-6 text-white/92">{lines.join("\\n")}</pre>',
			"    </section>",
			"  );",
			"}",
		].join("\n"),
		size: 1187,
		focusLine: 13,
		highlightStartLine: 12,
		highlightEndLine: 15,
	},
	"src/pages/ProjectCodeBrowser.tsx": {
		content: [
			'import FindingCodeWindow from "@/pages/AgentAudit/components/FindingCodeWindow";',
			"",
			"export function ProjectCodeBrowserWorkspaceSample() {",
			"  return (",
			'    <div className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">',
			'      <aside className="rounded-2xl border border-white/10 bg-[#020202]">left tree</aside>',
			'      <main className="rounded-2xl border border-white/10 bg-[#020202]">right preview</main>',
			"    </div>",
			"  );",
			"}",
		].join("\n"),
		size: 734,
		focusLine: 5,
		highlightStartLine: 5,
		highlightEndLine: 6,
	},
	"src/app/routes.tsx": {
		content: [
			'const CodeWindowDemo = lazy(() => import("@/pages/CodeWindowDemo"));',
			"",
			"{",
			'  name: "代码窗 Demo",',
			'  path: "/agent-test/code-window-demo",',
			"  element: <CodeWindowDemo />,",
			"  visible: true,",
			"  navVisible: true,",
			'  navGroup: "devTest",',
			"  navOrder: 36,",
			"}",
		].join("\n"),
		size: 422,
	},
	"src/components/layout/Sidebar.tsx": {
		content: [
			'const routeIcons: Record<string, React.ReactNode> = {',
			'  "/agent-test": <Bot className="w-[18px] h-[18px]" />,',
			'  "/agent-test/code-window-demo": <Code className="w-[18px] h-[18px]" />,',
			"};",
		].join("\n"),
		size: 249,
	},
	"src/assets/styles/globals.css": {
		content: [
			".custom-scrollbar-dark::-webkit-scrollbar {",
			"  width: 9px;",
			"  height: 9px;",
			"}",
			"",
			".custom-scrollbar-dark::-webkit-scrollbar-track {",
			"  background: rgba(11, 15, 26, 0.96);",
			"}",
		].join("\n"),
		size: 188,
	},
	"src/demo/fixtures/long-lines.ts": {
		content: [
			'export const extremelyLongTailwindLine = "rounded-2xl border border-white/10 bg-black text-white shadow-[0_18px_44px_rgba(0,0,0,0.34)] min-w-max whitespace-pre overflow-x-auto custom-scrollbar-dark px-4 py-3 tracking-[0.24em]";',
		].join("\n"),
		size: 246,
	},
};

const TREE = buildProjectCodeBrowserTree(
	Object.entries(DEMO_FILES).map(([path, value]) => ({
		path,
		size: value.size,
	})),
);

const DEFAULT_FILE_PATH = "src/pages/AgentAudit/components/FindingCodeWindow.tsx";

export default function CodeWindowDemo() {
	const [appearance, setAppearance] =
		useState<FindingCodeWindowAppearance>("native-explorer");
	const [selectedFilePath, setSelectedFilePath] = useState<string>(DEFAULT_FILE_PATH);
	const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
		() =>
			new Set([
				"src",
				"src/pages",
				"src/pages/AgentAudit",
				"src/pages/AgentAudit/components",
				"src/app",
				"src/components",
				"src/components/layout",
				"src/assets",
				"src/assets/styles",
				"src/demo",
				"src/demo/fixtures",
			]),
	);

	const selectedFileState = useMemo<ProjectCodeBrowserFileViewState>(() => {
		const file = DEMO_FILES[selectedFilePath];
		if (!file) {
			return { status: "failed", message: "Demo 文件不存在" };
		}
		return {
			status: "ready",
			filePath: selectedFilePath,
			content: file.content,
			size: file.size,
			encoding: "utf-8",
		};
	}, [selectedFilePath]);

	const previewDecorations = useMemo(
		() =>
			Object.fromEntries(
				Object.entries(DEMO_FILES).map(([path, file]) => [
					path,
					{
						focusLine: file.focusLine ?? null,
						highlightStartLine: file.highlightStartLine ?? null,
						highlightEndLine: file.highlightEndLine ?? null,
					},
				]),
			),
		[],
	);

	return (
		<div className="relative flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col gap-4 overflow-hidden bg-background p-6 font-mono">
			<section className="rounded-2xl border border-white/10 bg-black/80 px-5 py-4">
				<div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
					<div className="space-y-1">
						<div className="text-xs uppercase tracking-[0.24em] text-white/34">
							样式预览
						</div>
						<h1 className="text-2xl font-bold text-white">代码窗 Demo</h1>
						<p className="max-w-3xl text-sm leading-6 text-white/54">
							这个页面直接复用正式代码浏览 split-pane，用 mock 文件树和代码内容展示三套纯黑浏览器风格。
						</p>
					</div>

					<div className="rounded-2xl border border-white/10 bg-white/[0.02] p-1">
						<div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
							{APPEARANCE_OPTIONS.map((option) => {
								const isActive = option.value === appearance;
								return (
									<button
										key={option.value}
										type="button"
										onClick={() => setAppearance(option.value)}
										className={cn(
											"rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer",
											isActive
												? "border-white/16 bg-white/[0.08] text-white"
												: "border-transparent bg-transparent text-white/54 hover:border-white/10 hover:bg-white/[0.04] hover:text-white/86",
										)}
									>
										<div className="text-sm font-semibold">{option.label}</div>
										<div className="mt-1 text-[11px] leading-5 text-current/80">
											{option.description}
										</div>
									</button>
								);
							})}
						</div>
					</div>
				</div>
			</section>

			<ProjectCodeBrowserWorkspace
				tree={TREE}
				expandedFolders={expandedFolders}
				selectedFilePath={selectedFilePath}
				selectedFileState={selectedFileState}
				onToggleFolder={(folderPath) =>
					setExpandedFolders((current) =>
						toggleProjectCodeBrowserFolder(current, folderPath),
					)
				}
				onSelectFile={setSelectedFilePath}
				appearance={appearance}
				previewDecorations={previewDecorations}
				className="flex-1 min-h-0 overflow-hidden"
			/>
		</div>
	);
}
