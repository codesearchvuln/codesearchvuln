export type NexusEmbedLoadState = "loading" | "ready" | "failed";

export type NexusEmbedLoadEvent =
	| "iframe-loaded"
	| "iframe-error"
	| "load-timeout"
	| "reset";

export const NEXUS_EMBED_LOAD_TIMEOUT_MS = 15000;

export function reduceNexusEmbedLoadState(
	state: NexusEmbedLoadState,
	event: NexusEmbedLoadEvent,
): NexusEmbedLoadState {
	if (event === "reset") {
		return "loading";
	}

	if (state === "failed") {
		return "failed";
	}

	if (state === "ready") {
		return "ready";
	}

	switch (event) {
		case "iframe-loaded":
			return "ready";
		case "iframe-error":
		case "load-timeout":
			return "failed";
		default:
			return state;
	}
}
