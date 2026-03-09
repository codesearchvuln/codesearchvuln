import { useMemo } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import OpengrepRules from "@/pages/OpengrepRules";

type EngineTab = "opengrep" | "gitleaks";

const ENGINE_TABS: EngineTab[] = ["opengrep", "gitleaks"];

export default function ScanConfigEngines() {
	const [searchParams, setSearchParams] = useSearchParams();
	const rawTab = (searchParams.get("tab") || "").toLowerCase();
	if (rawTab === "llm") {
		return <Navigate to="/scan-config/intelligent-engine" replace />;
	}

	const currentTab = useMemo<EngineTab>(() => {
		return ENGINE_TABS.includes(rawTab as EngineTab)
			? (rawTab as EngineTab)
			: "opengrep";
	}, [rawTab]);

	const handleEngineChange = (value: string) => {
		const next = ENGINE_TABS.includes(value as EngineTab)
			? (value as EngineTab)
			: "opengrep";
		const nextParams = new URLSearchParams(searchParams);
		nextParams.set("tab", next);
		setSearchParams(nextParams, { replace: true });
	};

	return (
		<div className="space-y-6 p-6 bg-background min-h-screen relative">
			<div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />
			<div className="relative z-10">
				<div className="cyber-card p-0">
					<OpengrepRules
						embedded
						showEngineSelector
						engineValue={currentTab}
						onEngineChange={handleEngineChange}
					/>
				</div>
			</div>
		</div>
	);
}
