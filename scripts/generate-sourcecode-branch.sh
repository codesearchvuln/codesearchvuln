#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR"
SOURCE_REF=""
OUTPUT_DIR=""
VALIDATE="false"
TEMPLATE_DIR="$ROOT_DIR/scripts/sourcecode-templates"

usage() {
  cat <<'USAGE'
Usage: generate-sourcecode-branch.sh --output <dir> [--source <dir>] [--ref <git-ref>] [--validate]

Generate the public sourcecode branch tree from tracked repository files.
The output keeps runtime/build source code and strips CI, docs, release packaging,
and internal development-only entrypoints.

Options:
  --output <dir>   Required. Destination directory for the generated tree.
  --source <dir>   Override the source repository root. Defaults to the current checkout.
  --ref <git-ref>  Optional git ref to export exactly. Defaults to tracked files in the current checkout.
  --validate       Validate the generated tree after pruning and templating.
  -h, --help       Show this help text.
USAGE
}

log() {
  echo "[sourcecode-tree] $*"
}

die() {
  echo "[sourcecode-tree] $*" >&2
  exit 1
}

clean_generated_tree() {
  find "$OUTPUT_DIR" \
    \( -name '__pycache__' -o -name '.pytest_cache' -o -name '.mypy_cache' -o -name '.ruff_cache' -o -name '.cache' \) \
    -exec rm -rf {} +
  find "$OUTPUT_DIR" \
    \( -name '*.pyc' -o -name '*.pyo' -o -name '.DS_Store' -o -name '*.tmp' -o -name '*.bak' -o -name '*.swp' -o -name '*.map' -o -name '*.log' \) \
    -delete
}

export_tracked_tree() {
  if [[ -n "$SOURCE_REF" ]]; then
    git -C "$SOURCE_DIR" archive --format=tar "$SOURCE_REF" | tar -xf - -C "$OUTPUT_DIR"
  else
    (
      cd "$SOURCE_DIR"
      git ls-files -z | tar --null -T - -cf -
    ) | tar -xf - -C "$OUTPUT_DIR"
  fi

  # git ls-files / git archive do not include submodule contents.
  # Copy each initialised submodule into the output tree.
  git -C "$SOURCE_DIR" submodule --quiet foreach --recursive '
    rel="${sm_path}"
    src="${toplevel}/${rel}"
    dst="'"$OUTPUT_DIR"'/${rel}"
    if [ -d "${src}" ]; then
      rm -rf "${dst}"
      mkdir -p "${dst}"
      git -C "${src}" ls-files -z | (cd "${src}" && tar --null -T - -cf -) | tar -xf - -C "${dst}"
    fi
  '
}

prune_public_tree() {
  rm -rf \
    "$OUTPUT_DIR/.github" \
    "$OUTPUT_DIR/docs" \
    "$OUTPUT_DIR/deploy" \
    "$OUTPUT_DIR/agent_checkpoints" \
    "$OUTPUT_DIR/backend/tests" \
    "$OUTPUT_DIR/frontend/tests" \
    "$OUTPUT_DIR/CLAUDE.md" \
    "$OUTPUT_DIR/docker-compose.hybrid.yml"

  if [[ -d "$OUTPUT_DIR/scripts" ]]; then
    find "$OUTPUT_DIR/scripts" -mindepth 1 ! -name 'setup-env.sh' -exec rm -rf {} +
  fi

  [[ -f "$OUTPUT_DIR/scripts/setup-env.sh" ]] || die "missing required public script: scripts/setup-env.sh"
  mkdir -p "$OUTPUT_DIR/data"
  chmod +x "$OUTPUT_DIR/scripts/setup-env.sh"
}

overlay_templates() {
  [[ -d "$TEMPLATE_DIR" ]] || die "template directory not found: $TEMPLATE_DIR"

  cp "$TEMPLATE_DIR/README.md" "$OUTPUT_DIR/README.md"
  cp "$TEMPLATE_DIR/README_EN.md" "$OUTPUT_DIR/README_EN.md"
  cp "$TEMPLATE_DIR/Makefile" "$OUTPUT_DIR/Makefile"
  cp "$TEMPLATE_DIR/docker-compose.full.yml" "$OUTPUT_DIR/docker-compose.full.yml"
}

sanitize_public_tree() {
  python3 - "$OUTPUT_DIR" <<'PY_SANITIZE'
import io
import os
import re
import shutil
import sys
import tokenize
from pathlib import Path

root = Path(sys.argv[1]).resolve()

PRESERVED_PREFIXES = (
    "backend/app/db/rules/",
    "backend/app/db/rules_",
)
REMOVABLE_DIR_NAMES = {
    "__tests__",
    "fixtures",
    "fixture",
    "mocks",
    "mock",
    "samples",
    "sample",
    "examples",
    "example",
}
REMOVABLE_FILE_SUFFIXES = {".pyc", ".pyo", ".tmp", ".bak", ".swp", ".map", ".log"}
REMOVABLE_CACHE_DIRS = {
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".cache",
}
TEST_FILE_RE = re.compile(r".*\.(test|spec)(\.|$).*", re.IGNORECASE)
PRESERVED_TEST_FILE_RE = re.compile(r"^tsconfig.*\.json$", re.IGNORECASE)
NOTICE_RE = re.compile(
    r"(copyright|license|licensed|spdx|agpl|gpl|affero|author|attribution|notice)",
    re.IGNORECASE,
)
DIRECTIVE_RE = re.compile(
    r"(coding[:=]|shellcheck|eslint|ts-ignore|ts-expect-error|ts-nocheck|type:\s*ignore|"
    r"noqa|pylint|pragma:|coverage:|yaml-language-server|dockerfile|@vite-ignore|"
    r"webpack|@jsx|@jsximportsource|@refresh|@preserve|@__pure__|#__pure__)",
    re.IGNORECASE,
)
COMMENT_STRIP_ALLOWLIST = {
    "backend/app/keep.py",
    "scripts/setup-env.sh",
}
FRONTEND_HARDEN_PREFIXES = (
    "frontend/src/app/",
    "frontend/src/shared/api/",
    "frontend/src/shared/services/",
    "frontend/src/shared/utils/",
    "frontend/src/features/",
)
FRONTEND_HARDEN_SUFFIXES = {".ts", ".tsx"}
FRONTEND_HARDEN_EXCLUDED_PARTS = {
    "__generated__",
    "__mocks__",
    "__tests__",
    "fixtures",
    "generated",
    "mocks",
    "stories",
    "storybook",
}
FRONTEND_HARDEN_EXCLUDED_SUFFIXES = (
    ".d.ts",
    ".generated.ts",
    ".generated.tsx",
)
FRONTEND_STORY_RE = re.compile(r".*\.(stories|story)(\.|$).*", re.IGNORECASE)
REGEX_PREFIX_TOKENS = {
    "",
    "(",
    "[",
    "{",
    ",",
    ";",
    ":",
    "=",
    "!",
    "?",
    "&",
    "|",
    "^",
    "~",
    "+",
    "-",
    "*",
    "%",
    "<",
    ">",
    "=>",
    "return",
    "throw",
    "case",
    "delete",
    "void",
    "typeof",
    "instanceof",
    "yield",
    "await",
    "else",
    "do",
}


def rel(path: Path) -> str:
    return path.resolve().relative_to(root).as_posix()


def is_identifier_start(char: str) -> bool:
    return char == "_" or char == "$" or char.isalpha()


def is_identifier_part(char: str) -> bool:
    return char == "_" or char == "$" or char.isalnum()


def last_non_whitespace(chunks) -> str:
    for chunk in reversed(chunks):
        for char in reversed(chunk):
            if not char.isspace():
                return char
    return ""


def next_non_whitespace(source: str, index: int) -> str:
    while index < len(source) and source[index].isspace():
        index += 1
    return source[index] if index < len(source) else ""


def needs_separator(previous: str, following: str) -> bool:
    if not previous or not following:
        return False
    if is_identifier_part(previous) and is_identifier_part(following):
        return True
    return (previous == following and previous in {"+", "-"})


def normalize_frontend_source(source: str) -> str:
    normalized = "\n".join(line.rstrip() for line in source.splitlines())
    normalized = normalized.strip("\n")
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    if source.endswith(("\n", "\r")):
        normalized += "\n"
    return normalized


def regex_literal_allowed_after(token) -> bool:
    return (token or "") in REGEX_PREFIX_TOKENS


def current_line_is_whitespace(chunks) -> bool:
    for chunk in reversed(chunks):
        for char in reversed(chunk):
            if char in "\r\n":
                return True
            if not char.isspace():
                return False
    return True


def skip_line_ending(source: str, index: int) -> int:
    if index < len(source) and source[index] == "\r":
        index += 1
        if index < len(source) and source[index] == "\n":
            index += 1
        return index
    if index < len(source) and source[index] == "\n":
        return index + 1
    return index


def is_frontend_hardening_candidate(path: Path) -> bool:
    rel_path = rel(path)
    lowered_name = path.name.lower()
    if not rel_path.startswith(FRONTEND_HARDEN_PREFIXES):
        return False
    if path.suffix.lower() not in FRONTEND_HARDEN_SUFFIXES:
        return False
    if lowered_name.endswith(FRONTEND_HARDEN_EXCLUDED_SUFFIXES):
        return False
    if TEST_FILE_RE.search(path.name) or FRONTEND_STORY_RE.search(path.name):
        return False
    rel_parts = {part.lower() for part in Path(rel_path).parts}
    return rel_parts.isdisjoint(FRONTEND_HARDEN_EXCLUDED_PARTS)


def transform_frontend_source(source: str, *, is_tsx: bool):
    output = []
    index = 0
    line_number = 1
    last_token = None
    jsx_depth = 0
    length = len(source)

    while index < length:
        char = source[index]
        following = source[index + 1] if index + 1 < length else ""

        if is_tsx and jsx_depth > 0:
            output.append(char)
            if char == "\n":
                line_number += 1
            if char in {'"', "'"}:
                quote = char
                index += 1
                while index < length:
                    current = source[index]
                    output.append(current)
                    if current == "\n":
                        line_number += 1
                    if current == "\\":
                        index += 1
                        if index < length:
                            escaped = source[index]
                            output.append(escaped)
                            if escaped == "\n":
                                line_number += 1
                    elif current == quote:
                        break
                    index += 1
                else:
                    return source, False, "unterminated_jsx_attribute"
            elif char == "{":
                jsx_depth += 1
            elif char == "}":
                jsx_depth = max(0, jsx_depth - 1)
            elif char == ">" and jsx_depth == 1:
                jsx_depth = 0
            index += 1
            continue

        if char.isspace():
            output.append(char)
            if char == "\n":
                line_number += 1
            index += 1
            continue

        if is_identifier_start(char):
            end = index + 1
            while end < length and is_identifier_part(source[end]):
                end += 1
            token = source[index:end]
            output.append(token)
            last_token = token
            index = end
            continue

        if char in {'"', "'", "`"}:
            quote = char
            start = index
            index += 1
            while index < length:
                current = source[index]
                if current == "\n":
                    line_number += 1
                    if quote != "`":
                        return source, False, "newline_in_string_literal"
                if current == "\\":
                    index += 2
                    continue
                if current == quote:
                    index += 1
                    output.append(source[start:index])
                    last_token = "literal"
                    break
                index += 1
            else:
                return source, False, "unterminated_string_or_template"
            continue

        if char == "/" and following == "/":
            end = index + 2
            while end < length and source[end] not in "\r\n":
                end += 1
            comment = source[index:end]
            if preserve_comment(comment, line_number=line_number):
                output.append(comment)
                index = end
            elif current_line_is_whitespace(output):
                line_number += 1 if end < length and source[end] in "\r\n" else 0
                index = skip_line_ending(source, end)
            else:
                index = end
            continue

        if char == "/" and following == "*":
            end = index + 2
            while end + 1 < length and source[end : end + 2] != "*/":
                end += 1
            if end + 1 >= length:
                return source, False, "unterminated_block_comment"
            end += 2
            comment = source[index:end]
            start_line = line_number
            line_number += comment.count("\n")
            if preserve_comment(comment, line_number=start_line):
                output.append(comment)
            elif current_line_is_whitespace(output):
                line_number += 1 if end < length and source[end] in "\r\n" else 0
                index = skip_line_ending(source, end)
                continue
            else:
                previous = last_non_whitespace(output)
                next_char = next_non_whitespace(source, end)
                if previous == "{" and next_char == "}":
                    output.append("/* */")
                elif "\n" in comment:
                    output.append("\n")
                elif needs_separator(previous, next_char):
                    output.append(" ")
            index = end
            continue

        if char == "/" and following not in {"/", "*"} and regex_literal_allowed_after(last_token):
            end = index + 1
            escaped = False
            in_character_class = False
            while end < length:
                current = source[end]
                if current == "\n":
                    break
                if escaped:
                    escaped = False
                elif current == "\\":
                    escaped = True
                elif current == "[":
                    in_character_class = True
                elif current == "]" and in_character_class:
                    in_character_class = False
                elif current == "/" and not in_character_class:
                    end += 1
                    while end < length and is_identifier_part(source[end]):
                        end += 1
                    output.append(source[index:end])
                    last_token = "literal"
                    index = end
                    break
                end += 1
            else:
                output.append(char)
                last_token = char
                index += 1
                continue
            if index == end:
                continue
            if end >= length or source[end - 1] != "/" and not is_identifier_part(source[end - 1]):
                output.append(char)
                last_token = char
                index += 1
            continue

        if is_tsx and char == "<" and (following.isalpha() or following in {">", "/"}):
            jsx_depth = 1
            output.append(char)
            last_token = char
            index += 1
            continue

        if char == "=" and following == ">":
            output.append("=>")
            last_token = "=>"
            index += 2
            continue

        output.append(char)
        last_token = char
        index += 1

    transformed = normalize_frontend_source("".join(output))
    return transformed, transformed != source, None


def is_preserved_path(path: Path) -> bool:
    rel_path = rel(path)
    if rel_path == "LICENSE" or rel_path.startswith(".git/"):
        return True
    return rel_path.startswith(PRESERVED_PREFIXES)


def remove_path(path: Path) -> None:
    if not path.exists() or is_preserved_path(path):
        return
    if path.is_dir():
        shutil.rmtree(path)
    else:
        path.unlink()


def prune_artifacts() -> None:
    for dirpath, dirnames, filenames in os.walk(root, topdown=True):
        current = Path(dirpath)
        if is_preserved_path(current):
            dirnames[:] = []
            continue
        for dirname in list(dirnames):
            path = current / dirname
            lowered = dirname.lower()
            if lowered in REMOVABLE_CACHE_DIRS or dirname in REMOVABLE_DIR_NAMES:
                remove_path(path)
                dirnames.remove(dirname)
        for filename in filenames:
            path = current / filename
            if is_preserved_path(path):
                continue
            is_removable_suffix = Path(filename).suffix.lower() in REMOVABLE_FILE_SUFFIXES
            is_test_source = TEST_FILE_RE.search(filename) and not PRESERVED_TEST_FILE_RE.match(filename)
            if is_removable_suffix or is_test_source:
                remove_path(path)


def preserve_comment(text: str, *, line_number: int) -> bool:
    stripped = text.strip()
    if line_number == 1 and stripped.startswith("#!"):
        return True
    return bool(NOTICE_RE.search(stripped) or DIRECTIVE_RE.search(stripped))


def strip_python_comments(path: Path) -> None:
    raw = path.read_bytes()
    try:
        source = raw.decode("utf-8")
    except UnicodeDecodeError:
        return
    try:
        tokens = list(tokenize.generate_tokens(io.StringIO(source).readline))
    except tokenize.TokenError:
        return
    changed = False
    filtered = []
    for token in tokens:
        if token.type == tokenize.COMMENT and not preserve_comment(token.string, line_number=token.start[0]):
            changed = True
            continue
        filtered.append(token)
    if changed:
        path.write_text(tokenize.untokenize(filtered), encoding="utf-8")


def strip_line_comments(path: Path) -> None:
    try:
        lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    except UnicodeDecodeError:
        return
    changed = False
    kept = []
    in_heredoc = False
    heredoc_end = ""
    for index, line in enumerate(lines, start=1):
        stripped = line.lstrip()
        if in_heredoc:
            kept.append(line)
            if line.strip() == heredoc_end:
                in_heredoc = False
            continue
        match = re.search(r"<<-?'?([A-Za-z_][A-Za-z0-9_]*)'?", line)
        if match:
            in_heredoc = True
            heredoc_end = match.group(1)
            kept.append(line)
            continue
        if stripped.startswith("#") and not preserve_comment(stripped, line_number=index):
            changed = True
            continue
        kept.append(line)
    if changed:
        path.write_text("".join(kept), encoding="utf-8")


def strip_comments() -> None:
    for path in root.rglob("*"):
        if not path.is_file() or is_preserved_path(path):
            continue
        rel_path = rel(path)
        if rel_path not in COMMENT_STRIP_ALLOWLIST:
            continue
        suffix = path.suffix.lower()
        if suffix == ".py":
            strip_python_comments(path)
        elif suffix in {".sh", ".yml", ".yaml"} or path.name in {
            "Dockerfile",
            "docker-compose.yml",
            "docker-compose.full.yml",
        }:
            strip_line_comments(path)


def harden_frontend_sources() -> None:
    hardened = []
    unchanged = []
    skipped = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or is_preserved_path(path) or not is_frontend_hardening_candidate(path):
            continue
        rel_path = rel(path)
        try:
            source = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            skipped.append((rel_path, "non_utf8"))
            continue
        transformed, changed, skip_reason = transform_frontend_source(
            source,
            is_tsx=path.suffix.lower() == ".tsx",
        )
        if skip_reason:
            skipped.append((rel_path, skip_reason))
            continue
        if changed:
            path.write_text(transformed, encoding="utf-8")
            hardened.append(rel_path)
        else:
            unchanged.append(rel_path)

    print(
        "[sourcecode-tree] frontend hardening: "
        f"hardened={len(hardened)} unchanged={len(unchanged)} skipped={len(skipped)}"
    )
    if hardened:
        shown = ", ".join(hardened[:20])
        suffix = "" if len(hardened) <= 20 else f", ... (+{len(hardened) - 20})"
        print(f"[sourcecode-tree] frontend hardening hardened paths: {shown}{suffix}")
    if skipped:
        shown = ", ".join(f"{path} ({reason})" for path, reason in skipped[:20])
        suffix = "" if len(skipped) <= 20 else f", ... (+{len(skipped) - 20})"
        print(f"[sourcecode-tree] frontend hardening skipped paths: {shown}{suffix}")


prune_artifacts()
strip_comments()
harden_frontend_sources()
PY_SANITIZE
}
assert_no_sanitizer_artifacts() {
  python3 - "$OUTPUT_DIR" <<'PY_VALIDATE'
import os
import re
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
PRESERVED_PREFIXES = (
    "backend/app/db/rules/",
    "backend/app/db/rules_",
)
REMOVABLE_DIR_NAMES = {
    "__tests__",
    "fixtures",
    "fixture",
    "mocks",
    "mock",
    "samples",
    "sample",
    "examples",
    "example",
}
REMOVABLE_FILE_SUFFIXES = {".pyc", ".pyo", ".tmp", ".bak", ".swp", ".map", ".log"}
REMOVABLE_CACHE_DIRS = {
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".cache",
}
TEST_FILE_RE = re.compile(r".*\.(test|spec)(\.|$).*", re.IGNORECASE)
PRESERVED_TEST_FILE_RE = re.compile(r"^tsconfig.*\.json$", re.IGNORECASE)
failures = []


def rel(path: Path) -> str:
    return path.resolve().relative_to(root).as_posix()


def is_preserved(path: Path) -> bool:
    rel_path = rel(path)
    if rel_path == "LICENSE":
        return True
    return any(rel_path == prefix.rstrip("/") or rel_path.startswith(prefix) for prefix in PRESERVED_PREFIXES)

for dirpath, dirnames, filenames in os.walk(root):
    current = Path(dirpath)
    if is_preserved(current):
        dirnames[:] = []
        continue
    for dirname in dirnames:
        lowered = dirname.lower()
        if lowered in REMOVABLE_CACHE_DIRS or dirname in REMOVABLE_DIR_NAMES:
            failures.append(rel(current / dirname))
    for filename in filenames:
        path = current / filename
        if is_preserved(path):
            continue
        is_removable_suffix = Path(filename).suffix.lower() in REMOVABLE_FILE_SUFFIXES
        is_test_source = TEST_FILE_RE.search(filename) and not PRESERVED_TEST_FILE_RE.match(filename)
        if is_removable_suffix or is_test_source:
            failures.append(rel(path))

if failures:
    print("[sourcecode-tree] forbidden sanitizer artifacts present:", file=sys.stderr)
    for failure in sorted(failures)[:100]:
        print(f"  - {failure}", file=sys.stderr)
    raise SystemExit(1)
PY_VALIDATE
}

assert_frontend_hardening() {
  python3 - "$OUTPUT_DIR" <<'PY_VALIDATE_FRONTEND_HARDENING'
import re
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
NOTICE_RE = re.compile(
    r"(copyright|license|licensed|spdx|agpl|gpl|affero|author|attribution|notice)",
    re.IGNORECASE,
)
DIRECTIVE_RE = re.compile(
    r"(coding[:=]|shellcheck|eslint|ts-ignore|ts-expect-error|ts-nocheck|type:\s*ignore|"
    r"noqa|pylint|pragma:|coverage:|yaml-language-server|dockerfile|@vite-ignore|"
    r"webpack|@jsx|@jsximportsource|@refresh|@preserve|@__pure__|#__pure__)",
    re.IGNORECASE,
)
TEST_FILE_RE = re.compile(r".*\.(test|spec)(\.|$).*", re.IGNORECASE)
FRONTEND_STORY_RE = re.compile(r".*\.(stories|story)(\.|$).*", re.IGNORECASE)
FRONTEND_HARDEN_PREFIXES = (
    "frontend/src/app/",
    "frontend/src/shared/api/",
    "frontend/src/shared/services/",
    "frontend/src/shared/utils/",
    "frontend/src/features/",
)
FRONTEND_HARDEN_SUFFIXES = {".ts", ".tsx"}
FRONTEND_HARDEN_EXCLUDED_PARTS = {
    "__generated__",
    "__mocks__",
    "__tests__",
    "fixtures",
    "generated",
    "mocks",
    "stories",
    "storybook",
}
FRONTEND_HARDEN_EXCLUDED_SUFFIXES = (
    ".d.ts",
    ".generated.ts",
    ".generated.tsx",
)
REGEX_PREFIX_TOKENS = {
    "",
    "(",
    "[",
    "{",
    ",",
    ";",
    ":",
    "=",
    "!",
    "?",
    "&",
    "|",
    "^",
    "~",
    "+",
    "-",
    "*",
    "%",
    "<",
    ">",
    "=>",
    "return",
    "throw",
    "case",
    "delete",
    "void",
    "typeof",
    "instanceof",
    "yield",
    "await",
    "else",
    "do",
}


def rel(path: Path) -> str:
    return path.resolve().relative_to(root).as_posix()


def is_identifier_start(char: str) -> bool:
    return char == "_" or char == "$" or char.isalpha()


def is_identifier_part(char: str) -> bool:
    return char == "_" or char == "$" or char.isalnum()


def last_non_whitespace(chunks) -> str:
    for chunk in reversed(chunks):
        for char in reversed(chunk):
            if not char.isspace():
                return char
    return ""


def next_non_whitespace(source: str, index: int) -> str:
    while index < len(source) and source[index].isspace():
        index += 1
    return source[index] if index < len(source) else ""


def needs_separator(previous: str, following: str) -> bool:
    if not previous or not following:
        return False
    if is_identifier_part(previous) and is_identifier_part(following):
        return True
    return (previous == following and previous in {"+", "-"})


def normalize_frontend_source(source: str) -> str:
    normalized = "\n".join(line.rstrip() for line in source.splitlines())
    if source.endswith(("\n", "\r")):
        normalized += "\n"
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized


def preserve_comment(text: str, *, line_number: int) -> bool:
    stripped = text.strip()
    if line_number == 1 and stripped.startswith("#!"):
        return True
    return bool(NOTICE_RE.search(stripped) or DIRECTIVE_RE.search(stripped))


def regex_literal_allowed_after(token) -> bool:
    return (token or "") in REGEX_PREFIX_TOKENS


def is_frontend_hardening_candidate(path: Path) -> bool:
    rel_path = rel(path)
    lowered_name = path.name.lower()
    if not rel_path.startswith(FRONTEND_HARDEN_PREFIXES):
        return False
    if path.suffix.lower() not in FRONTEND_HARDEN_SUFFIXES:
        return False
    if lowered_name.endswith(FRONTEND_HARDEN_EXCLUDED_SUFFIXES):
        return False
    if TEST_FILE_RE.search(path.name) or FRONTEND_STORY_RE.search(path.name):
        return False
    rel_parts = {part.lower() for part in Path(rel_path).parts}
    return rel_parts.isdisjoint(FRONTEND_HARDEN_EXCLUDED_PARTS)


def transform_frontend_source(source: str, *, is_tsx: bool):
    output = []
    index = 0
    line_number = 1
    last_token = None
    jsx_depth = 0
    length = len(source)

    while index < length:
        char = source[index]
        following = source[index + 1] if index + 1 < length else ""

        if is_tsx and jsx_depth > 0:
            output.append(char)
            if char == "\n":
                line_number += 1
            if char in {'"', "'"}:
                quote = char
                index += 1
                while index < length:
                    current = source[index]
                    output.append(current)
                    if current == "\n":
                        line_number += 1
                    if current == "\\":
                        index += 1
                        if index < length:
                            escaped = source[index]
                            output.append(escaped)
                            if escaped == "\n":
                                line_number += 1
                    elif current == quote:
                        break
                    index += 1
                else:
                    return source, False, "unterminated_jsx_attribute"
            elif char == "{":
                jsx_depth += 1
            elif char == "}":
                jsx_depth = max(0, jsx_depth - 1)
            elif char == ">" and jsx_depth == 1:
                jsx_depth = 0
            index += 1
            continue

        if char.isspace():
            output.append(char)
            if char == "\n":
                line_number += 1
            index += 1
            continue

        if is_identifier_start(char):
            end = index + 1
            while end < length and is_identifier_part(source[end]):
                end += 1
            token = source[index:end]
            output.append(token)
            last_token = token
            index = end
            continue

        if char in {'"', "'", "`"}:
            quote = char
            start = index
            index += 1
            while index < length:
                current = source[index]
                if current == "\n":
                    line_number += 1
                    if quote != "`":
                        return source, False, "newline_in_string_literal"
                if current == "\\":
                    index += 2
                    continue
                if current == quote:
                    index += 1
                    output.append(source[start:index])
                    last_token = "literal"
                    break
                index += 1
            else:
                return source, False, "unterminated_string_or_template"
            continue

        if char == "/" and following == "/":
            end = index + 2
            while end < length and source[end] not in "\r\n":
                end += 1
            comment = source[index:end]
            if preserve_comment(comment, line_number=line_number):
                output.append(comment)
            index = end
            continue

        if char == "/" and following == "*":
            end = index + 2
            while end + 1 < length and source[end : end + 2] != "*/":
                end += 1
            if end + 1 >= length:
                return source, False, "unterminated_block_comment"
            end += 2
            comment = source[index:end]
            start_line = line_number
            line_number += comment.count("\n")
            if preserve_comment(comment, line_number=start_line):
                output.append(comment)
            else:
                previous = last_non_whitespace(output)
                next_char = next_non_whitespace(source, end)
                if previous == "{" and next_char == "}":
                    output.append("/* */")
                elif "\n" in comment:
                    output.append("\n")
                elif needs_separator(previous, next_char):
                    output.append(" ")
            index = end
            continue

        if char == "/" and following not in {"/", "*"} and regex_literal_allowed_after(last_token):
            end = index + 1
            escaped = False
            in_character_class = False
            while end < length:
                current = source[end]
                if current == "\n":
                    break
                if escaped:
                    escaped = False
                elif current == "\\":
                    escaped = True
                elif current == "[":
                    in_character_class = True
                elif current == "]" and in_character_class:
                    in_character_class = False
                elif current == "/" and not in_character_class:
                    end += 1
                    while end < length and is_identifier_part(source[end]):
                        end += 1
                    output.append(source[index:end])
                    last_token = "literal"
                    index = end
                    break
                end += 1
            else:
                output.append(char)
                last_token = char
                index += 1
                continue
            if index == end:
                continue
            if end >= length or source[end - 1] != "/" and not is_identifier_part(source[end - 1]):
                output.append(char)
                last_token = char
                index += 1
            continue

        if is_tsx and char == "<" and (following.isalpha() or following in {">", "/"}):
            jsx_depth = 1
            output.append(char)
            last_token = char
            index += 1
            continue

        if char == "=" and following == ">":
            output.append("=>")
            last_token = "=>"
            index += 2
            continue

        output.append(char)
        last_token = char
        index += 1

    transformed = normalize_frontend_source("".join(output))
    return transformed, transformed != source, None


checked = []
skipped = []
not_hardened = []
for path in sorted(root.rglob("*")):
    if not path.is_file() or not is_frontend_hardening_candidate(path):
        continue
    rel_path = rel(path)
    try:
        source = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        skipped.append((rel_path, "non_utf8"))
        continue
    transformed, changed, skip_reason = transform_frontend_source(
        source,
        is_tsx=path.suffix.lower() == ".tsx",
    )
    if skip_reason:
        skipped.append((rel_path, skip_reason))
    elif changed:
        not_hardened.append(rel_path)
    else:
        checked.append(rel_path)

if not checked:
    print("[sourcecode-tree] frontend hardening validation found no hardened candidate files", file=sys.stderr)
    if skipped:
        for rel_path, reason in skipped[:100]:
            print(f"  - skipped {rel_path}: {reason}", file=sys.stderr)
    raise SystemExit(1)

if not_hardened:
    print("[sourcecode-tree] frontend hardening validation found unhashed candidates:", file=sys.stderr)
    for rel_path in not_hardened[:100]:
        print(f"  - {rel_path}", file=sys.stderr)
    raise SystemExit(1)

print(
    "[sourcecode-tree] frontend hardening validation: "
    f"hardened_candidates={len(checked)} skipped={len(skipped)}"
)
if skipped:
    shown = ", ".join(f"{rel_path} ({reason})" for rel_path, reason in skipped[:20])
    suffix = "" if len(skipped) <= 20 else f", ... (+{len(skipped) - 20})"
    print(f"[sourcecode-tree] frontend hardening validation skipped paths: {shown}{suffix}")
PY_VALIDATE_FRONTEND_HARDENING
}

validate_sourcecode_tree() {
  local rel_path
  local required_paths=(
    "backend"
    "frontend"
    "docker"
    "data"
    "nexus-web"
    "nexus-itemDetail"
    "docker-compose.yml"
    "docker-compose.full.yml"
    "README.md"
    "README_EN.md"
    "Makefile"
    "scripts/setup-env.sh"
    "docker/env/backend/env.example"
    "LICENSE"
  )
  local forbidden_paths=(
    ".github"
    "docs"
    "deploy"
    "agent_checkpoints"
    "backend/tests"
    "frontend/tests"
    "CLAUDE.md"
    "docker-compose.hybrid.yml"
    "scripts/build-frontend.sh"
    "scripts/compose-up-local-build.sh"
    "scripts/compose-up-with-fallback.bat"
    "scripts/compose-up-with-fallback.ps1"
    "scripts/compose-up-with-fallback.sh"
    "scripts/deploy-linux.sh"
    "scripts/download-release-assets.py"
    "scripts/generate-release-branch.sh"
    "scripts/package-release-images.sh"
    "scripts/release-assets"
    "scripts/release-allowlist.txt"
    "scripts/release-bundle-contract.json"
    "scripts/release-tag-cleanup.txt"
    "scripts/release-templates"
    "scripts/release.sh"
    "scripts/release_version.py"
    "scripts/setup_security_tools.bat"
    "scripts/setup_security_tools.ps1"
    "scripts/setup_security_tools.sh"
    "scripts/sourcecode-templates"
    "scripts/write-release-snapshot-lock.py"
  )

  for rel_path in "${required_paths[@]}"; do
    [[ -e "$OUTPUT_DIR/$rel_path" ]] || die "missing required sourcecode path: $rel_path"
  done

  for rel_path in "${forbidden_paths[@]}"; do
    [[ ! -e "$OUTPUT_DIR/$rel_path" ]] || die "forbidden path present in sourcecode tree: $rel_path"
  done

  assert_no_sanitizer_artifacts
  assert_frontend_hardening

  if ! grep -Fq "商业交付、商业支持" "$OUTPUT_DIR/README.md"; then
    die "public sourcecode readme is missing the project distribution notice: README.md"
  fi
  if ! grep -Fq "separate commercial delivery/support terms may apply outside the license" "$OUTPUT_DIR/README_EN.md"; then
    die "public sourcecode readme is missing the project distribution notice: README_EN.md"
  fi

  [[ -d "$OUTPUT_DIR/scripts" ]] || die "scripts directory is required"
  [[ "$(find "$OUTPUT_DIR/scripts" -mindepth 1 | wc -l)" -eq 1 ]] || \
    die "scripts directory contains unexpected files"
  [[ -f "$OUTPUT_DIR/scripts/setup-env.sh" ]] || die "scripts/setup-env.sh is required"

  for rel_path in README.md README_EN.md Makefile scripts/setup-env.sh docker-compose.yml docker-compose.full.yml; do
    if grep -Fq "docker-compose.hybrid.yml" "$OUTPUT_DIR/$rel_path"; then
      die "public sourcecode tree still references hybrid compose entrypoint: $rel_path"
    fi
    if grep -Fq "compose-up-with-fallback" "$OUTPUT_DIR/$rel_path"; then
      die "public sourcecode tree still references compose fallback wrapper: $rel_path"
    fi
    if grep -Fq "docker compose up" "$OUTPUT_DIR/$rel_path"; then
      die "public sourcecode tree still references bare docker compose up: $rel_path"
    fi
  done

  for rel_path in README.md README_EN.md; do
    if ! grep -Fq "docker compose -f docker-compose.yml -f docker-compose.full.yml up --build" "$OUTPUT_DIR/$rel_path"; then
      die "public sourcecode readme is missing the full local-build entrypoint: $rel_path"
    fi
  done

  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    (
      cd "$OUTPUT_DIR"
      docker compose -f docker-compose.yml -f docker-compose.full.yml config >/dev/null
    )
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      [[ $# -ge 2 ]] || die "--output requires a value"
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --source)
      [[ $# -ge 2 ]] || die "--source requires a value"
      SOURCE_DIR="$2"
      shift 2
      ;;
    --ref)
      [[ $# -ge 2 ]] || die "--ref requires a value"
      SOURCE_REF="$2"
      shift 2
      ;;
    --validate)
      VALIDATE="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown option: $1"
      ;;
  esac
done

[[ -n "$OUTPUT_DIR" ]] || die "--output is required"

SOURCE_DIR="$(cd "$SOURCE_DIR" && pwd)"
[[ -d "$SOURCE_DIR/.git" || -f "$SOURCE_DIR/.git" ]] || die "source directory is not a git repository: $SOURCE_DIR"
if [[ -n "$SOURCE_REF" ]]; then
  git -C "$SOURCE_DIR" rev-parse --verify "${SOURCE_REF}^{commit}" >/dev/null 2>&1 || \
    die "git ref does not resolve to a commit: $SOURCE_REF"
fi

OUTPUT_DIR="$(mkdir -p "$OUTPUT_DIR" && cd "$OUTPUT_DIR" && pwd)"

case "$OUTPUT_DIR" in
  "$SOURCE_DIR"|"$SOURCE_DIR"/*)
    die "output directory must be outside the source tree"
    ;;
esac

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

export_tracked_tree
prune_public_tree
overlay_templates
sanitize_public_tree
clean_generated_tree

if [[ "$VALIDATE" == "true" ]]; then
  validate_sourcecode_tree
fi

log "sourcecode tree generated at $OUTPUT_DIR"
