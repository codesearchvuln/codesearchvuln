import test from "node:test";
import assert from "node:assert/strict";

import { I18N_MESSAGES } from "../src/shared/i18n/messages.ts";

test("I18N_MESSAGES 仅保留中文消息源", () => {
  assert.deepEqual(Object.keys(I18N_MESSAGES), ["zh"]);
  assert.equal("lang.en" in I18N_MESSAGES.zh, false);
});
