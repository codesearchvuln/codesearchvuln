import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/shared/i18n";
import { useLocation } from "react-router-dom";
import type { Project } from "@/shared/types";
import { PROJECT_PAGE_SIZE, MODULE_SCROLL_DELAY_MS, SUPPORTED_PROJECT_LANGUAGES } from "./constants";
import type { ProjectsPageProps } from "./types";
import { useProjectsBrowserState } from "./hooks/useProjectsBrowserState";
import { useProjectsPageData } from "./hooks/useProjectsPageData";
import {
	buildProjectsPageViewModel,
} from "./lib/buildProjectsPageViewModel";
import {
	filterProjects,
	paginateItems,
	pruneSelectedProjectIds,
} from "./lib/projectsPageSelectors";
import ProjectsToolbar from "./components/ProjectsToolbar";
import ProjectsTable from "./components/ProjectsTable";
import ProjectsPagination from "./components/ProjectsPagination";
import ProjectsEmptyState from "./components/ProjectsEmptyState";
import CreateProjectDialog from "./components/CreateProjectDialog";
import EditProjectDialog from "./components/EditProjectDialog";
import DisableProjectDialog from "./components/DisableProjectDialog";

function scrollToProjectBrowser() {
	window.setTimeout(() => {
		document.getElementById("project-browser")?.scrollIntoView({
			behavior: "smooth",
			block: "start",
		});
	}, MODULE_SCROLL_DELAY_MS);
}

function pinToProjectBrowserHash() {
	const { pathname, search } = window.location;
	window.history.replaceState(
		window.history.state,
		"",
		`${pathname}${search}#project-browser`,
	);
}

async function logUserAction(action: string, payload: Record<string, unknown>) {
	const loggerModule = await import("@/shared/utils/logger");
	loggerModule.logger.logUserAction(action, payload);
}

async function handleErrorMessage(error: unknown, fallbackMessage: string) {
	const errorHandlerModule = await import("@/shared/utils/errorHandler");
	errorHandlerModule.handleError(error, fallbackMessage);
}

export default function ProjectsPage({
	dataSource,
	renderCreateScanDialog,
}: ProjectsPageProps) {
	const location = useLocation();
	const { t } = useI18n();
	const browser = useProjectsBrowserState();
	const data = useProjectsPageData(dataSource);

	const filteredProjects = useMemo(
		() => filterProjects(data.projects, browser.searchTerm),
		[data.projects, browser.searchTerm],
	);
	const totalProjectPages = Math.max(
		1,
		Math.ceil(filteredProjects.length / PROJECT_PAGE_SIZE),
	);
	const pagedProjects = useMemo(
		() =>
			paginateItems(filteredProjects, browser.projectPage, PROJECT_PAGE_SIZE),
		[filteredProjects, browser.projectPage],
	);
	const currentPageProjectIds = useMemo(
		() => pagedProjects.map((project) => project.id),
		[pagedProjects],
	);
	const projectDetailFrom = `${location.pathname}${location.search}${location.hash}`;

	useEffect(() => {
		const nextSelected = pruneSelectedProjectIds(
			browser.selectedProjectIds,
			data.projects,
		);
		if (nextSelected !== browser.selectedProjectIds) {
			browser.pruneSelectedProjects(data.projects);
		}
	}, [browser, data.projects]);

	useEffect(() => {
		if (browser.projectPage > totalProjectPages) {
			browser.setProjectPage(totalProjectPages);
		}
	}, [browser, totalProjectPages]);

	useEffect(() => {
		data.ensureProjectData(currentPageProjectIds);
	}, [currentPageProjectIds, data]);

	useEffect(() => {
		const hash = window.location.hash;
		if (hash !== "#project-browser") {
			return;
		}
		scrollToProjectBrowser();
	}, []);

	const viewModel = useMemo(
		() =>
			buildProjectsPageViewModel({
				loading: data.loading,
				filteredProjects,
				pagedProjects,
				projectPage: browser.projectPage,
				totalProjectPages,
				selectedProjectIds: browser.selectedProjectIds,
				projectTaskPoolsMap: data.projectTaskPoolsMap,
				projectLanguageStatsMap: data.projectLanguageStatsMap,
				projectDetailFrom,
				searchTerm: browser.searchTerm,
				searchPlaceholder: t(
					"projects.searchPlaceholder",
					"按项目名称/描述/仓库地址搜索",
				),
			}),
		[
			browser.projectPage,
			browser.searchTerm,
			browser.selectedProjectIds,
			data.loading,
			data.projectLanguageStatsMap,
			data.projectTaskPoolsMap,
			filteredProjects,
			pagedProjects,
			projectDetailFrom,
			t,
			totalProjectPages,
		],
	);

	const projectMap = useMemo(
		() =>
			new Map<string, Project>(data.projects.map((project) => [project.id, project])),
		[data.projects],
	);

	async function handleCreateRepositoryProject(input: Parameters<typeof data.createProject>[0]) {
		try {
			await data.createProject(input);
			void logUserAction("创建项目", {
				projectName: input.name,
				repositoryType: input.repository_type,
				languages: input.programming_languages,
			});
			toast.success("项目创建成功");
			pinToProjectBrowserHash();
			scrollToProjectBrowser();
		} catch (error) {
			console.error("Failed to create project:", error);
			void handleErrorMessage(error, "创建项目失败");
			const errorMessage = error instanceof Error ? error.message : "未知错误";
			toast.error(`创建项目失败: ${errorMessage}`);
			throw error;
		}
	}

	async function handleCreateZipProject(
		input: Parameters<typeof data.createZipProject>[0],
		file: Parameters<typeof data.createZipProject>[1],
	) {
		try {
			const project = await data.createZipProject(input, file);
			void logUserAction("上传ZIP文件创建项目", {
				projectName: project.name,
				fileName: file.name,
				fileSize: file.size,
			});
			toast.success(`项目 "${project.name}" 已创建`, {
				description: "项目压缩包已保存，您可以启动代码扫描",
				duration: 4000,
			});
			pinToProjectBrowserHash();
			scrollToProjectBrowser();
		} catch (error) {
			console.error("Upload failed:", error);
			void handleErrorMessage(error, "上传ZIP文件失败");
			const errorMessage = error instanceof Error ? error.message : "未知错误";
			toast.error(`上传失败: ${errorMessage}`);
			throw error;
		}
	}

	async function handleUpdateProject(
		projectId: string,
		input: Partial<Parameters<typeof data.updateProject>[1]>,
		zipFile?: File | null,
	) {
		try {
			const project = await data.updateProject(projectId, input, zipFile);
			toast.success(`项目 "${project.name}" 已更新`);
		} catch (error) {
			console.error("Failed to update project:", error);
			toast.error("更新项目失败");
			throw error;
		}
	}

	async function handleConfirmDisableProject() {
		const project = browser.disableProjectState.project;
		if (!project) return;

		try {
			await data.disableProject(project.id);
			void logUserAction("禁用项目", {
				projectId: project.id,
				projectName: project.name,
			});
			toast.success(`项目 "${project.name}" 已禁用`, {
				description: "可通过“启用”按钮恢复该项目",
				duration: 4000,
			});
			browser.setDisableProjectState({ open: false, project: null });
		} catch (error) {
			console.error("Failed to disable project:", error);
			void handleErrorMessage(error, "禁用项目失败");
			const errorMessage = error instanceof Error ? error.message : "未知错误";
			toast.error(`禁用项目失败: ${errorMessage}`);
		}
	}

	async function handleEnableProject(projectId: string) {
		const project = projectMap.get(projectId);
		if (!project) return;

		try {
			await data.enableProject(project.id);
			void logUserAction("启用项目", {
				projectId: project.id,
				projectName: project.name,
			});
			toast.success(`项目 "${project.name}" 已启用`, {
				description: "项目恢复为可执行状态",
				duration: 3000,
			});
		} catch (error) {
			console.error("Failed to enable project:", error);
			void handleErrorMessage(error, "启用项目失败");
			const errorMessage = error instanceof Error ? error.message : "未知错误";
			toast.error(`启用项目失败: ${errorMessage}`);
		}
	}

	function handleTaskCreated() {
		const targetProjectIds = browser.createScanState.preselectedProjectId
			? [browser.createScanState.preselectedProjectId]
			: currentPageProjectIds;
		data.invalidateProjectMetrics(targetProjectIds);
		toast.success("扫描任务已创建", {
			description:
				"因为网络和代码文件大小等因素，扫描时长通常至少需要1分钟，请耐心等待...",
			duration: 5000,
		});
	}

	return (
		<div className="p-6 bg-background min-h-screen font-mono relative flex flex-col gap-6">
			<div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />
			{viewModel.loading ? (
				<div className="relative z-10 text-xs text-muted-foreground">
					加载项目列表中...
				</div>
			) : null}

			<CreateProjectDialog
				open={browser.showCreateDialog}
				supportedLanguages={SUPPORTED_PROJECT_LANGUAGES}
				onOpenChange={(open) => {
					browser.setShowCreateDialog(open);
					if (!open) {
						pinToProjectBrowserHash();
						scrollToProjectBrowser();
					}
				}}
				onCreateRepositoryProject={handleCreateRepositoryProject}
				onCreateZipProject={handleCreateZipProject}
			/>

			<div
				id="project-browser"
				className="cyber-card p-4 relative z-10 flex flex-col flex-1 min-h-[65vh]"
			>
				<ProjectsToolbar
					searchTerm={viewModel.toolbar.searchTerm}
					searchPlaceholder={viewModel.toolbar.searchPlaceholder}
					createButtonLabel={viewModel.toolbar.createButtonLabel}
					onSearchChange={browser.setSearchTerm}
					onCreateProjectClick={() => {
						pinToProjectBrowserHash();
						browser.setShowCreateDialog(true);
					}}
				/>

				{viewModel.loading && data.projects.length === 0 ? (
					<div className="cyber-card p-4 space-y-3">
						<Skeleton className="h-9 w-full" />
						<Skeleton className="h-48 w-full" />
					</div>
				) : viewModel.rows.length > 0 ? (
					<div className="flex-1 flex flex-col">
						<ProjectsTable
							rows={viewModel.rows}
							selectedProjectIds={viewModel.selection.selectedProjectIds}
							isAllCurrentPageSelected={
								viewModel.selection.isAllCurrentPageSelected
							}
							isSomeCurrentPageSelected={
								viewModel.selection.isSomeCurrentPageSelected
							}
							onToggleProjectSelection={browser.toggleProjectSelection}
							onToggleSelectCurrentPage={(checked) =>
								browser.toggleSelectProjects(
									viewModel.selection.currentPageProjectIds,
									checked,
								)
							}
							onCreateScan={(projectId) => {
								pinToProjectBrowserHash();
								browser.openCreateScanDialog("agent", projectId, {
									navigateOnSuccess: true,
								});
							}}
							onDisableProject={(projectId) => {
								const project = projectMap.get(projectId) || null;
								browser.setDisableProjectState({
									open: true,
									project,
								});
							}}
							onEnableProject={(projectId) => void handleEnableProject(projectId)}
						/>
						<ProjectsPagination
							currentPage={viewModel.pagination.currentPage}
							totalPages={viewModel.pagination.totalPages}
							totalCount={viewModel.pagination.totalCount}
							items={viewModel.pagination.items}
							onPageChange={browser.setProjectPage}
						/>
					</div>
				) : (
					<ProjectsEmptyState
						hasSearchTerm={viewModel.emptyState.hasSearchTerm}
						onCreateProjectClick={() => {
							pinToProjectBrowserHash();
							browser.setShowCreateDialog(true);
						}}
					/>
				)}
			</div>

			{renderCreateScanDialog
				? renderCreateScanDialog({
						open: browser.createScanState.open,
						onOpenChange: (open) => {
							if (!open) {
								browser.closeCreateScanDialog();
								pinToProjectBrowserHash();
								scrollToProjectBrowser();
								return;
							}
						},
						onTaskCreated: handleTaskCreated,
						preselectedProjectId:
							browser.createScanState.preselectedProjectId || undefined,
						lockProjectSelection: Boolean(
							browser.createScanState.preselectedProjectId,
						),
						initialMode: browser.createScanState.initialMode,
						navigateOnSuccess: browser.createScanState.navigateOnSuccess,
					})
				: null}

			<EditProjectDialog
				open={browser.editProjectState.open}
				project={browser.editProjectState.project}
				supportedLanguages={SUPPORTED_PROJECT_LANGUAGES}
				onOpenChange={(open) =>
					browser.setEditProjectState((previous) => ({
						open,
						project: open ? previous.project : null,
					}))
				}
				onSubmit={handleUpdateProject}
			/>

			<DisableProjectDialog
				open={browser.disableProjectState.open}
				project={browser.disableProjectState.project}
				onOpenChange={(open) =>
					browser.setDisableProjectState((previous) => ({
						open,
						project: open ? previous.project : null,
					}))
				}
				onConfirm={handleConfirmDisableProject}
			/>
		</div>
	);
}
