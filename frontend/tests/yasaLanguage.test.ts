import test from "node:test";
import assert from "node:assert/strict";

import {
  getYasaBlockedProjectMessage,
  isYasaBlockedProjectLanguage,
  resolveYasaLanguageFromProgrammingLanguages,
} from "../src/shared/utils/yasaLanguage.ts";

test("isYasaBlockedProjectLanguage blocks C/C++ aliases", () => {
  assert.equal(isYasaBlockedProjectLanguage('["cpp","java"]'), true);
  assert.equal(isYasaBlockedProjectLanguage("c++,python"), true);
  assert.equal(isYasaBlockedProjectLanguage(["cc", "golang"]), true);
  assert.equal(isYasaBlockedProjectLanguage('["java","python"]'), false);
});

test("resolveYasaLanguageFromProgrammingLanguages returns null for blocked C/C++ projects", () => {
  assert.equal(resolveYasaLanguageFromProgrammingLanguages('["cpp","java"]'), null);
});

test("getYasaBlockedProjectMessage returns fixed user-facing copy", () => {
  assert.equal(getYasaBlockedProjectMessage(), "YASA 引擎暂不支持 C/C++ 项目");
});
