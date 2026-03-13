import test from "node:test";
import assert from "node:assert/strict";

async function importOrFail<TModule = Record<string, unknown>>(
	relativePath: string,
): Promise<TModule> {
	try {
		return (await import(relativePath)) as TModule;
	} catch (error) {
		assert.fail(
			`expected helper module ${relativePath} to exist: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

test("createZipProjectWorkflow creates project then uploads zip file", async () => {
	const workflows = await importOrFail<any>(
		"../src/pages/projects/data/projectsPageWorkflows.ts",
	);

	const calls: string[] = [];
	const createdProject = { id: "project-1", name: "demo" };
	const file = { name: "demo.zip" } as File;

	const result = await workflows.createZipProjectWorkflow({
		input: { name: "demo", programming_languages: [] },
		file,
		createProject: async () => {
			calls.push("create");
			return createdProject;
		},
		deleteProject: async () => {
			calls.push("delete");
		},
		uploadZipFile: async () => {
			calls.push("upload");
			return { success: true };
		},
	});

	assert.equal(result.id, "project-1");
	assert.deepEqual(calls, ["create", "upload"]);
});

test("createZipProjectWorkflow rolls back project when zip upload fails", async () => {
	const workflows = await importOrFail<any>(
		"../src/pages/projects/data/projectsPageWorkflows.ts",
	);

	const calls: string[] = [];
	const file = { name: "demo.zip" } as File;

	await assert.rejects(async () => {
		await workflows.createZipProjectWorkflow({
			input: { name: "demo", programming_languages: [] },
			file,
			createProject: async () => {
				calls.push("create");
				return { id: "project-1", name: "demo" };
			},
			deleteProject: async () => {
				calls.push("delete");
			},
			uploadZipFile: async () => {
				calls.push("upload");
				return { success: false, message: "zip failed" };
			},
		});
	}, /zip failed/);

	assert.deepEqual(calls, ["create", "upload", "delete"]);
});

test("updateProjectWorkflow updates project and only uploads zip when provided", async () => {
	const workflows = await importOrFail<any>(
		"../src/pages/projects/data/projectsPageWorkflows.ts",
	);

	const calls: string[] = [];

	const updated = await workflows.updateProjectWorkflow({
		projectId: "project-1",
		input: { name: "next" },
		zipFile: null,
		updateProject: async () => {
			calls.push("update");
			return { id: "project-1", name: "next" };
		},
		uploadZipFile: async () => {
			calls.push("upload");
			return { success: true };
		},
	});

	assert.equal(updated.name, "next");
	assert.deepEqual(calls, ["update"]);
});
