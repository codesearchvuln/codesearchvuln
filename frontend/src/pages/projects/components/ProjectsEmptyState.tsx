import { Code, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PROJECT_ACTION_BTN } from "../constants";

interface ProjectsEmptyStateProps {
	hasSearchTerm: boolean;
	loadFailed?: boolean;
	message?: string | null;
	onCreateProjectClick: () => void;
}

export default function ProjectsEmptyState({
	hasSearchTerm,
	loadFailed = false,
	message = null,
	onCreateProjectClick,
}: ProjectsEmptyStateProps) {
	return (
		<div className="empty-state py-10">
			<Code className="w-12 h-12 text-muted-foreground mb-3" />
			<p className="text-base text-muted-foreground">
				{loadFailed ? "项目列表加载失败" : hasSearchTerm ? "未匹配到项目" : "暂无项目"}
			</p>
			{loadFailed && message ? (
				<p className="mt-2 text-sm text-muted-foreground">{message}</p>
			) : null}
			{!loadFailed && !hasSearchTerm ? (
				<Button
					onClick={onCreateProjectClick}
					className={`${PROJECT_ACTION_BTN} mt-4`}
				>
					<Plus className="w-4 h-4 mr-2" />
					创建项目
				</Button>
			) : null}
		</div>
	);
}
