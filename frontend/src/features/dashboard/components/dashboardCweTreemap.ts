export const CWE_TREEMAP_COLORS = [
	"#1E3A8A",
	"#2456B3",
	"#2C6CC9",
	"#0F5F99",
	"#1576B5",
	"#1A7082",
	"#0F766E",
	"#15928A",
	"#3A4EA1",
	"#2B6788",
	"#116A74",
	"#2E5C9A",
] as const;

export type CweTreemapNode = {
	cweId: string;
	cweName: string;
	totalFindings: number;
	opengrepFindings: number;
	agentFindings: number;
	banditFindings: number;
	name: string;
	size: number;
	fill: string;
};

export type CweTreemapLabelMode = "detailed" | "compact" | "hidden";

function hashCweId(value: string) {
	let hash = 0;
	for (const char of value) {
		hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	}
	return hash;
}

export function getCweTreemapColor(cweId: string) {
	const normalized = String(cweId || "CWE-UNKNOWN").trim().toUpperCase();
	return CWE_TREEMAP_COLORS[hashCweId(normalized) % CWE_TREEMAP_COLORS.length];
}

export function buildCweTreemapNodes(
	items: Array<{
		cwe_id: string;
		cwe_name: string;
		total_findings: number;
		opengrep_findings: number;
		agent_findings: number;
		bandit_findings: number;
	}>,
): CweTreemapNode[] {
	return items
		.map((item) => {
			const cweId = String(item.cwe_id || "CWE-UNKNOWN").trim() || "CWE-UNKNOWN";
			const totalFindings = Math.max(Number(item.total_findings || 0), 0);
			return {
				cweId,
				cweName: String(item.cwe_name || cweId).trim() || cweId,
				totalFindings,
				opengrepFindings: Math.max(Number(item.opengrep_findings || 0), 0),
				agentFindings: Math.max(Number(item.agent_findings || 0), 0),
				banditFindings: Math.max(Number(item.bandit_findings || 0), 0),
				name: cweId,
				size: totalFindings,
				fill: getCweTreemapColor(cweId),
			};
		})
		.filter((item) => item.totalFindings > 0);
}

export function getCweTreemapLabelMode({
	width = 0,
	height = 0,
}: {
	width?: number;
	height?: number;
}): CweTreemapLabelMode {
	if (width < 36 || height < 24) return "hidden";
	if (width < 84 || height < 48) return "compact";
	return "detailed";
}
