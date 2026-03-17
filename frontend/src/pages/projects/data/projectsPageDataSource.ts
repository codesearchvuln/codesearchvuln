import type { ProjectCardLanguageStats } from "@/features/projects/services/projectCardPreview";
import type { CreateProjectForm, Project } from "@/shared/types";
import type { ProjectTaskPool } from "../types";

export interface ProjectsPageDataSource {
	listProjects(): Promise<Project[]>;
	getProjectTaskPool(projectId: string): Promise<ProjectTaskPool>;
	getProjectLanguageStats(projectId: string): Promise<ProjectCardLanguageStats>;
	createProject(input: CreateProjectForm): Promise<Project>;
	createZipProject(input: CreateProjectForm, file: File): Promise<Project>;
	updateProject(
		projectId: string,
		input: Partial<CreateProjectForm>,
		zipFile?: File | null,
	): Promise<Project>;
}
