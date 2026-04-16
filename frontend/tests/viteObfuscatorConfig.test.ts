import test from "node:test";
import assert from "node:assert/strict";

import { createChunkObfuscatorPlugin } from "../scripts/chunkObfuscatorPlugin.ts";
import { createProductionObfuscatorOptions } from "../scripts/obfuscatorOptions.ts";

test("production obfuscator runs on final JS chunks instead of source-module transforms", () => {
  const plugin = createChunkObfuscatorPlugin();

  assert.equal(plugin.name, "vite-chunk-obfuscator");
  assert.equal(typeof plugin.renderChunk, "function");
  assert.equal("transform" in plugin, false);
});

test("production obfuscator uses a deterministic seed by default and respects overrides", () => {
  const originalSeed = process.env.VITE_BUILD_OBFUSCATION_SEED;

  try {
    delete process.env.VITE_BUILD_OBFUSCATION_SEED;
    assert.equal(createProductionObfuscatorOptions().seed, 1337);

    process.env.VITE_BUILD_OBFUSCATION_SEED = "20260416";
    assert.equal(createProductionObfuscatorOptions().seed, 20260416);
  } finally {
    if (originalSeed === undefined) {
      delete process.env.VITE_BUILD_OBFUSCATION_SEED;
    } else {
      process.env.VITE_BUILD_OBFUSCATION_SEED = originalSeed;
    }
  }
});
