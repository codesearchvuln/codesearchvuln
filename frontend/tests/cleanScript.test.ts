import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("package clean script delegates to the dedicated cleaner", async () => {
	const packageJson = JSON.parse(
		fs.readFileSync(path.join(frontendDir, "package.json"), "utf8"),
	) as {
		scripts?: Record<string, string>;
	};

	assert.equal(packageJson.scripts?.clean, "node scripts/clean.mjs");
});

test("package build script cleans before invoking vite build", async () => {
	const packageJson = JSON.parse(
		fs.readFileSync(path.join(frontendDir, "package.json"), "utf8"),
	) as {
		scripts?: Record<string, string>;
	};

	assert.equal(packageJson.scripts?.build, "node scripts/clean.mjs && vite build");
});

test("cleanTargets keeps going when inaccessible targets cannot be moved aside", async () => {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "frontend-clean-"));
	const distDir = path.join(tempDir, "dist");
	const viteDir = path.join(tempDir, "node_modules", ".vite");
	fs.mkdirSync(distDir, { recursive: true });
	fs.mkdirSync(viteDir, { recursive: true });

	const warnings: string[] = [];
	const { cleanTargets } = await import(
		pathToFileURL(path.join(frontendDir, "scripts", "clean.mjs")).href
	);

	cleanTargets([distDir, viteDir], {
		rmSync(target: string) {
			if (target === distDir) {
				const error = new Error("permission denied") as NodeJS.ErrnoException;
				error.code = "EACCES";
				throw error;
			}
			fs.rmSync(target, { recursive: true, force: true });
		},
		renameSync() {
			const error = new Error("rename permission denied") as NodeJS.ErrnoException;
			error.code = "EPERM";
			throw error;
		},
		warn(message: string) {
			warnings.push(message);
		},
	});

	assert.equal(fs.existsSync(distDir), true);
	assert.equal(fs.existsSync(viteDir), false);
	assert.equal(warnings.length, 1);
	assert.match(warnings[0], /dist/);
});

test("cleanTargets renames inaccessible dist directories when direct removal fails", async () => {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "frontend-clean-rename-"));
	const distDir = path.join(tempDir, "dist");
	const viteDir = path.join(tempDir, "node_modules", ".vite");
	fs.mkdirSync(path.join(distDir, "assets"), { recursive: true });
	fs.mkdirSync(viteDir, { recursive: true });

	const warnings: string[] = [];
	const renames: Array<{ from: string; to: string }> = [];
	const removals: string[] = [];
	const { cleanTargets } = await import(
		pathToFileURL(path.join(frontendDir, "scripts", "clean.mjs")).href
	);

	cleanTargets([distDir, viteDir], {
		rmSync(target: string) {
			removals.push(target);
			if (target === distDir) {
				const error = new Error("permission denied") as NodeJS.ErrnoException;
				error.code = "EACCES";
				throw error;
			}
			fs.rmSync(target, { recursive: true, force: true });
		},
		renameSync(from: string, to: string) {
			renames.push({ from, to });
			fs.renameSync(from, to);
		},
		warn(message: string) {
			warnings.push(message);
		},
		now() {
			return 1700000000000;
		},
	});

	assert.equal(fs.existsSync(distDir), false);
	assert.equal(fs.existsSync(viteDir), false);
	assert.deepEqual(removals, [distDir, viteDir]);
	assert.equal(renames.length, 1);
	assert.equal(renames[0]?.from, distDir);
	assert.match(renames[0]?.to ?? "", /dist\.stale-1700000000000$/);
	assert.equal(fs.existsSync(renames[0]!.to), true);
	assert.equal(warnings.length, 1);
	assert.match(warnings[0], /moved aside/);
});

test("cleanTargets rethrows unexpected removal failures", async () => {
	const { cleanTargets } = await import(
		pathToFileURL(path.join(frontendDir, "scripts", "clean.mjs")).href
	);

	assert.throws(
		() =>
			cleanTargets(["/tmp/example"], {
				rmSync() {
					throw new Error("boom");
				},
			}),
		/boom/,
	);
});
