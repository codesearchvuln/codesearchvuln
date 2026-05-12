import test from "node:test";
import assert from "node:assert/strict";

import { apiClient } from "../src/shared/api/serverClient.ts";
import { downloadAgentLogs } from "../src/shared/api/agentTasks.ts";

function installBrowserShim() {
  const originalWindow = (globalThis as { window?: Window & typeof globalThis }).window;
  const originalDocument = (globalThis as { document?: Document }).document;

  let currentAnchor: {
    href: string;
    download: string;
    clickCount: number;
    parentNode: { removeChild: (node: unknown) => void };
    setAttribute: (name: string, value: string) => void;
    click: () => void;
  } | null = null;

  const fakeDocument = {
    body: {
      appendChild: (_node: unknown) => undefined,
    },
    createElement: (tag: string) => {
      assert.equal(tag, "a");
      currentAnchor = {
        href: "",
        download: "",
        clickCount: 0,
        parentNode: {
          removeChild: () => undefined,
        },
        setAttribute(name: string, value: string) {
          if (name === "download") this.download = value;
        },
        click() {
          this.clickCount += 1;
        },
      };
      return currentAnchor as unknown as HTMLAnchorElement;
    },
  } as unknown as Document;

  const fakeWindow = {
    URL: {
      createObjectURL: (_blob: Blob) => "blob:test-url",
      revokeObjectURL: (_url: string) => undefined,
    },
  } as unknown as Window & typeof globalThis;

  (globalThis as { window?: Window & typeof globalThis }).window = fakeWindow;
  (globalThis as { document?: Document }).document = fakeDocument;

  const restore = () => {
    (globalThis as { window?: Window & typeof globalThis }).window = originalWindow;
    (globalThis as { document?: Document }).document = originalDocument;
  };

  return {
    restore,
    getAnchor: () => currentAnchor,
  };
}

test("downloadAgentLogs requests local_zip format and prefers Content-Disposition filename", async () => {
  const originalGet = apiClient.get;
  const shim = installBrowserShim();

  const calls: Array<{ url: string; config: unknown }> = [];
  apiClient.get = (async (url: string, config?: unknown) => {
    calls.push({ url, config });
    return {
      data: new Blob(["zip-bytes"], { type: "application/zip" }),
      headers: {
        "content-disposition":
          "attachment; filename=\"logs.zip\"; filename*=UTF-8''%E6%9C%AC%E5%9C%B0%E6%97%A5%E5%BF%97-Demo-2026-04-10.zip",
      },
    };
  }) as typeof apiClient.get;

  try {
    await downloadAgentLogs("12345678-abcdef", "local_zip", {
      taskName: "ignored-by-header",
    });
  } finally {
    apiClient.get = originalGet;
    shim.restore();
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "/agent-tasks/12345678-abcdef/logs/export");
  assert.deepEqual(calls[0]?.config, {
    params: { format: "local_zip" },
    responseType: "blob",
  });

  const anchor = shim.getAnchor();
  assert.ok(anchor);
  assert.equal(anchor?.download, "本地日志-Demo-2026-04-10.zip");
  assert.equal(anchor?.clickCount, 1);
});

test("downloadAgentLogs falls back to zip extension for local_zip when header is missing", async () => {
  const originalGet = apiClient.get;
  const shim = installBrowserShim();

  apiClient.get = (async () => {
    return {
      data: new Blob(["zip-bytes"], { type: "application/zip" }),
      headers: {},
    };
  }) as typeof apiClient.get;

  try {
    await downloadAgentLogs("12345678-abcdef", "local_zip");
  } finally {
    apiClient.get = originalGet;
    shim.restore();
  }

  const anchor = shim.getAnchor();
  assert.ok(anchor);
  assert.match(anchor?.download || "", /^本地日志-12345678-\d{4}-\d{2}-\d{2}\.zip$/);
});
