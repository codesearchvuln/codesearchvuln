import { useEffect, useState } from "react";
import type { ScanCreateMode } from "@/components/scan/CreateProjectScanDialog";
import type { Project } from "@/shared/types";

export function useProjectsBrowserState() {
	const [searchTerm, setSearchTerm] = useState("");
	const [projectPage, setProjectPage] = useState(1);
	const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(
		() => new Set(),
	);
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [createScanState, setCreateScanState] = useState({
		open: false,
		preselectedProjectId: "",
		initialMode: "static" as ScanCreateMode,
		navigateOnSuccess: true,
	});
	const [editProjectState, setEditProjectState] = useState<{
		open: boolean;
		project: Project | null;
	}>({
		open: false,
		project: null,
	});
	const [disableProjectState, setDisableProjectState] = useState<{
		open: boolean;
		project: Project | null;
	}>({
		open: false,
		project: null,
	});

	useEffect(() => {
		setProjectPage(1);
	}, [searchTerm]);

	function toggleProjectSelection(projectId: string, checked: boolean) {
		setSelectedProjectIds((previous) => {
			const next = new Set(previous);
			if (checked) {
				next.add(projectId);
			} else {
				next.delete(projectId);
			}
			return next;
		});
	}

	function toggleSelectProjects(projectIds: string[], checked: boolean) {
		setSelectedProjectIds((previous) => {
			const next = new Set(previous);
			if (checked) {
				for (const projectId of projectIds) {
					next.add(projectId);
				}
			} else {
				for (const projectId of projectIds) {
					next.delete(projectId);
				}
			}
			return next;
		});
	}

	function pruneSelectedProjects(projects: Pick<Project, "id">[]) {
		setSelectedProjectIds((previous) => {
			if (previous.size === 0) return previous;
			const validProjectIds = new Set(projects.map((project) => project.id));
			const next = new Set<string>();
			for (const projectId of previous) {
				if (validProjectIds.has(projectId)) {
					next.add(projectId);
				}
			}
			return next.size === previous.size ? previous : next;
		});
	}

	function openCreateScanDialog(
		initialMode: ScanCreateMode = "static",
		preselectedProjectId = "",
		options?: { navigateOnSuccess?: boolean },
	) {
		setCreateScanState({
			open: true,
			preselectedProjectId,
			initialMode,
			navigateOnSuccess: options?.navigateOnSuccess ?? true,
		});
	}

	function closeCreateScanDialog() {
		setCreateScanState({
			open: false,
			preselectedProjectId: "",
			initialMode: "static",
			navigateOnSuccess: true,
		});
	}

	return {
		searchTerm,
		setSearchTerm,
		projectPage,
		setProjectPage,
		selectedProjectIds,
		showCreateDialog,
		setShowCreateDialog,
		createScanState,
		editProjectState,
		setEditProjectState,
		disableProjectState,
		setDisableProjectState,
		toggleProjectSelection,
		toggleSelectProjects,
		pruneSelectedProjects,
		openCreateScanDialog,
		closeCreateScanDialog,
	};
}
