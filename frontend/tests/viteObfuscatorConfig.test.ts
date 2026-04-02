import test from "node:test";
import assert from "node:assert/strict";

import { createChunkObfuscatorPlugin } from "../scripts/chunkObfuscatorPlugin.ts";

test("production obfuscator runs on final JS chunks instead of source-module transforms", () => {
  const plugin = createChunkObfuscatorPlugin();

  assert.equal(plugin.name, "vite-chunk-obfuscator");
  assert.equal(typeof plugin.renderChunk, "function");
  assert.equal("transform" in plugin, false);
});
