import { cn } from "@/shared/utils/utils";

interface Chat2RuleSelectionPreviewProps {
	preview: string;
	className?: string;
}

function parsePreviewLine(line: string) {
	const matched = line.match(/^\s*(\d+)\s\|\s?(.*)$/);
	if (!matched) {
		return {
			lineNumber: null,
			content: line,
		};
	}

	return {
		lineNumber: matched[1],
		content: matched[2] ?? "",
	};
}

export default function Chat2RuleSelectionPreview({
	preview,
	className,
}: Chat2RuleSelectionPreviewProps) {
	const lines = String(preview || "").split("\n");

	return (
		<div
			className={cn(
				"overflow-auto rounded-lg border border-white/8 bg-black/55",
				className,
			)}
		>
			<div className="min-w-max font-mono text-[11px] leading-5 text-white/62">
				{lines.map((line) => {
					const parsedLine = parsePreviewLine(line);
					const isCodeLine = parsedLine.lineNumber !== null;

					if (!isCodeLine) {
						return (
							<div
								key={`preview-gap-${line}`}
								className="px-3 py-0.5 italic text-white/34"
							>
								{line || " "}
							</div>
						);
					}

					return (
						<div
							key={`preview-line-${parsedLine.lineNumber}`}
							className="grid grid-cols-[56px_minmax(0,1fr)]"
						>
							<div className="select-none border-r border-white/8 bg-[#16301d] px-2.5 py-0.5 text-right tabular-nums text-[#d5ff8a]">
								{parsedLine.lineNumber}
							</div>
							<pre className="overflow-visible whitespace-pre bg-[#122419] px-3 py-0.5 text-white">
								{parsedLine.content || " "}
							</pre>
						</div>
					);
				})}
			</div>
		</div>
	);
}
