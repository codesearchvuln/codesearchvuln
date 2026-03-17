import type { Project } from "@/shared/types";

interface ResponsiveProjectsPageSizeInput {
	containerHeight: number;
	tableHeaderHeight: number;
	paginationHeight: number;
	rowHeight: number;
}

function toFiniteNumber(value: unknown): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

export function filterProjects<T extends Pick<Project, "name" | "description">>(
	projects: T[],
	searchTerm: string,
) {
	const keyword = searchTerm.trim().toLowerCase();
	if (!keyword) return projects;

	return projects.filter((project) => {
		return (
			project.name.toLowerCase().includes(keyword) ||
			(project.description || "").toLowerCase().includes(keyword)
		);
	});
}

export function paginateItems<T>(
	items: T[],
	currentPage: number,
	pageSize: number,
) {
	const start = (currentPage - 1) * pageSize;
	return items.slice(start, start + pageSize);
}

export function calculateResponsiveProjectsPageSize(
	input: ResponsiveProjectsPageSizeInput,
) {
	const containerHeight = Math.max(toFiniteNumber(input.containerHeight), 0);
	const tableHeaderHeight = Math.max(toFiniteNumber(input.tableHeaderHeight), 0);
	const paginationHeight = Math.max(toFiniteNumber(input.paginationHeight), 0);
	const rowHeight = Math.max(toFiniteNumber(input.rowHeight), 1);
	const availableRowsHeight = Math.max(
		containerHeight - tableHeaderHeight - paginationHeight,
		rowHeight,
	);
	return Math.max(1, Math.floor(availableRowsHeight / rowHeight));
}

export function buildPaginationItems(
	currentPage: number,
	totalPages: number,
): Array<number | "ellipsis"> {
	if (totalPages <= 7) {
		return Array.from({ length: totalPages }, (_, index) => index + 1);
	}

	const pages = new Set<number>([
		1,
		totalPages,
		currentPage - 1,
		currentPage,
		currentPage + 1,
	]);
	const sortedPages = Array.from(pages)
		.filter((page) => page >= 1 && page <= totalPages)
		.sort((a, b) => a - b);

	const items: Array<number | "ellipsis"> = [];
	let previousPage = 0;
	for (const page of sortedPages) {
		if (previousPage > 0 && page - previousPage > 1) {
			items.push("ellipsis");
		}
		items.push(page);
		previousPage = page;
	}
	return items;
}
