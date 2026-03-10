import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath: string) {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function getCssBlock(content: string, selector: string) {
	const blockPattern = new RegExp(
		`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([\\s\\S]*?)\\}`,
	);
	return content.match(blockPattern)?.[1] ?? "";
}

test("shared table and card defaults use spacing instead of internal borders", () => {
	const table = read("src/components/ui/table.tsx");
	const card = read("src/components/ui/card.tsx");
	const globals = read("src/assets/styles/globals.css");
	const cyberCardHeader = getCssBlock(globals, ".cyber-card-header");
	const cyberTableThead = getCssBlock(globals, ".cyber-table thead");
	const cyberTableTd = getCssBlock(globals, ".cyber-table td");
	const cyberTableHover = getCssBlock(globals, ".cyber-table tbody tr:hover");

	assert.match(table, /hover:bg-muted\/50/);
	assert.match(table, /px-4 py-4 align-middle/);
	assert.doesNotMatch(table, /TableRow[\s\S]*border-b border-border/);
	assert.doesNotMatch(table, /TableHeader[\s\S]*\[_tr\]:border-b/);

	assert.match(card, /flex flex-col gap-2 pb-6/);
	assert.match(card, /flex items-center gap-3 pt-6/);
	assert.doesNotMatch(card, /CardHeader[\s\S]*border-b border-border/);
	assert.doesNotMatch(card, /CardFooter[\s\S]*border-t border-border/);

	assert.match(cyberCardHeader, /padding:\s*0\.75rem 1rem 1\.5rem 1rem;/);
	assert.doesNotMatch(cyberCardHeader, /border-bottom:/);
	assert.doesNotMatch(cyberTableThead, /border-bottom:/);
	assert.match(cyberTableTd, /padding:\s*1rem 1rem;/);
	assert.doesNotMatch(cyberTableTd, /border-bottom:/);
	assert.match(cyberTableHover, /background:\s*rgba\(15, 23, 42, 0\.8\);/);
});
