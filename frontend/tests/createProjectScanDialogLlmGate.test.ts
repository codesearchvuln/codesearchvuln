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

test("provider catalog falls back to built-ins and preserves unknown current provider", async () => {
	const providerCatalog = await importOrFail<any>(
		"../src/shared/llm/providerCatalog.ts",
	);

	const options = providerCatalog.buildLlmProviderOptions({
		backendProviders: [],
		currentProviderId: "acme-cloud",
	});

	assert.equal(providerCatalog.normalizeLlmProviderId("Claude"), "anthropic");
	assert.equal(providerCatalog.normalizeLlmProviderId(""), "openai");
	assert.equal(
		options.some((provider: { id: string }) => provider.id === "openai"),
		true,
	);
	assert.equal(options.at(-1)?.id, "acme-cloud");
	assert.equal(
		providerCatalog.getCreateProjectScanProviderLabel(options[0]),
		"OpenAI 兼容",
	);
});

test("provider switching refreshes default model and only refreshes Base URL before manual override", async () => {
	const providerCatalog = await importOrFail<any>(
		"../src/shared/llm/providerCatalog.ts",
	);
	const llmGate = await importOrFail<any>(
		"../src/components/scan/create-project-scan/llmGate.ts",
	);

	const providerOptions = providerCatalog.buildLlmProviderOptions({
		backendProviders: [],
		currentProviderId: "openai",
	});

	const untouchedBaseUrl = llmGate.resolveQuickConfigAfterProviderChange({
		providerOptions,
		currentConfig: {
			provider: "openai",
			model: "gpt-5",
			baseUrl: "https://api.openai.com/v1",
			apiKey: "demo-key",
		},
		nextProvider: "ollama",
		hasManualBaseUrlOverride: false,
	});

	assert.deepEqual(untouchedBaseUrl, {
		provider: "ollama",
		model: "llama3.1",
		baseUrl: "http://localhost:11434/v1",
		apiKey: "demo-key",
	});

	const manualBaseUrl = llmGate.resolveQuickConfigAfterProviderChange({
		providerOptions,
		currentConfig: {
			provider: "openai",
			model: "gpt-5",
			baseUrl: "https://gateway.internal/v1",
			apiKey: "demo-key",
		},
		nextProvider: "ollama",
		hasManualBaseUrlOverride: true,
	});

	assert.deepEqual(manualBaseUrl, {
		provider: "ollama",
		model: "llama3.1",
		baseUrl: "https://gateway.internal/v1",
		apiKey: "demo-key",
	});
});

test("LLM gate marks only required missing fields and exempts ollama API keys", async () => {
	const providerCatalog = await importOrFail<any>(
		"../src/shared/llm/providerCatalog.ts",
	);
	const llmGate = await importOrFail<any>(
		"../src/components/scan/create-project-scan/llmGate.ts",
	);

	const providerOptions = providerCatalog.buildLlmProviderOptions({
		backendProviders: [],
		currentProviderId: "openai",
	});

	assert.deepEqual(
		llmGate.getLlmQuickConfigMissingFields(
			{
				provider: "openai",
				model: "",
				baseUrl: "",
				apiKey: "",
			},
			providerOptions,
		),
		["llmModel", "llmBaseUrl", "llmApiKey"],
	);

	assert.deepEqual(
		llmGate.getLlmQuickConfigMissingFields(
			{
				provider: "ollama",
				model: "llama3.1",
				baseUrl: "http://localhost:11434/v1",
				apiKey: "",
			},
			providerOptions,
		),
		[],
	);
});

test("LLM gate stays locked until saved and manually tested, then re-locks after edits", async () => {
	const providerCatalog = await importOrFail<any>(
		"../src/shared/llm/providerCatalog.ts",
	);
	const llmGate = await importOrFail<any>(
		"../src/components/scan/create-project-scan/llmGate.ts",
	);

	const providerOptions = providerCatalog.buildLlmProviderOptions({
		backendProviders: [],
		currentProviderId: "openai",
	});
	const cleanConfig = {
		provider: "openai",
		model: "gpt-5",
		baseUrl: "https://api.openai.com/v1",
		apiKey: "demo-key",
	};

	const savedButUntested = llmGate.getLlmQuickGateStatus({
		providerOptions,
		currentConfig: cleanConfig,
		savedConfig: cleanConfig,
		hasSuccessfulManualTest: false,
	});
	assert.equal(savedButUntested.canTest, true);
	assert.equal(savedButUntested.canCreate, false);

	const savedAndTested = llmGate.getLlmQuickGateStatus({
		providerOptions,
		currentConfig: cleanConfig,
		savedConfig: cleanConfig,
		hasSuccessfulManualTest: true,
	});
	assert.equal(savedAndTested.canCreate, true);

	const editedAfterSuccess = llmGate.getLlmQuickGateStatus({
		providerOptions,
		currentConfig: {
			...cleanConfig,
			model: "gpt-5-mini",
		},
		savedConfig: cleanConfig,
		hasSuccessfulManualTest: true,
	});
	assert.equal(editedAfterSuccess.hasUnsavedChanges, true);
	assert.equal(editedAfterSuccess.canTest, false);
	assert.equal(editedAfterSuccess.canCreate, false);
	assert.match(editedAfterSuccess.testBlockMessage, /先保存/);
	assert.equal(
		llmGate.invalidateSuccessfulManualTest({
			previousConfig: cleanConfig,
			nextConfig: {
				...cleanConfig,
				model: "gpt-5-mini",
			},
			hasSuccessfulManualTest: true,
		}),
		false,
	);
});

test("project pagination slices three cards per page and clamps invalid pages", async () => {
	const llmGate = await importOrFail<any>(
		"../src/components/scan/create-project-scan/llmGate.ts",
	);

	const projects = Array.from({ length: 7 }, (_, index) => ({
		id: `project-${index + 1}`,
		name: `Project ${index + 1}`,
	}));

	const firstPage = llmGate.paginateProjectCards(projects, 1);
	assert.equal(firstPage.currentPage, 1);
	assert.equal(firstPage.totalPages, 3);
	assert.deepEqual(
		firstPage.items.map((project: { id: string }) => project.id),
		["project-1", "project-2", "project-3"],
	);

	const lastPage = llmGate.paginateProjectCards(projects, 999);
	assert.equal(lastPage.currentPage, 3);
	assert.deepEqual(
		lastPage.items.map((project: { id: string }) => project.id),
		["project-7"],
	);

	assert.equal(
		llmGate.resolveProjectPageAfterSearchChange({
			currentPage: 2,
			previousSearchTerm: "repo",
			nextSearchTerm: "zip",
		}),
		1,
	);
	assert.equal(
		llmGate.resolveProjectPageAfterSearchChange({
			currentPage: 2,
			previousSearchTerm: " repo ",
			nextSearchTerm: "repo",
		}),
		2,
	);
});
