import { useCallback, useEffect, useState } from "react";
import type { CreateProjectForm, Project } from "@/shared/types";
import type { ProjectsPageDataSource } from "../data/projectsPageDataSource";

function extractLoadErrorMessage(error: unknown): string {
	if (error && typeof error === "object" && "response" in error) {
		const response = (error as { response?: { data?: unknown } }).response;
		const data = response?.data;
		if (typeof data === "string" && data.trim()) {
			return data.trim();
		}
		if (data && typeof data === "object" && "detail" in data) {
			const detail = (data as { detail?: unknown }).detail;
			if (typeof detail === "string" && detail.trim()) {
				return detail.trim();
			}
		}
	}
	if (error instanceof Error && error.message.trim()) {
		return error.message.trim();
	}
	return "项目列表加载失败，请检查后端服务状态。";
}

export function useProjectsPageData(dataSource: ProjectsPageDataSource) {
	const [projects, setProjects] = useState<Project[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);

	const loadProjects = useCallback(async () => {
		setLoading(true);
		try {
			const nextProjects = await dataSource.listProjects();
			setProjects(nextProjects);
			setLoadErrorMessage(null);
		} catch (error) {
			setLoadErrorMessage(extractLoadErrorMessage(error));
			throw error;
		} finally {
			setLoading(false);
		}
	}, [dataSource]);

	useEffect(() => {
		loadProjects().catch(() => {});
	}, [loadProjects]);

	return {
		projects,
		loading,
		loadErrorMessage,
		loadProjects,
		async createProject(input: CreateProjectForm) {
			const createdProject = await dataSource.createProject(input);
			await loadProjects();
			return createdProject;
		},
		async createZipProject(input: CreateProjectForm, file: File) {
			const createdProject = await dataSource.createZipProject(input, file);
			await loadProjects();
			return createdProject;
		},
		async deleteProject(projectId: string) {
			await dataSource.deleteProject(projectId);
			await loadProjects();
		},
		async updateProject(
			projectId: string,
			input: Partial<CreateProjectForm>,
			zipFile?: File | null,
		) {
			const updatedProject = await dataSource.updateProject(projectId, input, zipFile);
			await loadProjects();
			return updatedProject;
		},
	};
}
