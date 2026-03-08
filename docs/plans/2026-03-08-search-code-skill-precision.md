# Search Code Skill Precision Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Strengthen the existing internal `search_code` tool skill so agents call MCP-backed code search more precisely and stop defaulting to the stale keyword-only contract.

**Architecture:** Keep the current runtime unchanged and treat the internal tool skill bundle as the mitigation layer. Update the authoritative `search_code` skill, the shared MCP playbook, the public tool doc, and the skill maintenance index together so memory sync stays consistent.

**Tech Stack:** Markdown docs, internal tool-skill snapshot sync, pytest validation.

---

### Task 1: Record the root-cause design

**Files:**
- Create: `docs/plans/2026-03-08-search-code-skill-precision-design.md`
- Create: `docs/plans/2026-03-08-search-code-skill-precision.md`

**Step 1: Write the design summary**

Document the observed log failure (`pattern Field required`) and the successful regex path.

**Step 2: Verify affected docs**

Run: `rg -n 'search_code' backend/docs/agent-tools`

Expected: show the skill doc, tool doc, playbook, and index entry that must stay aligned.

### Task 2: Update the authoritative `search_code` skill

**Files:**
- Modify: `backend/docs/agent-tools/skills/search_code.skill.md`

**Step 1: Replace the stale keyword-only guidance**

Add the MCP-specific rule: prefer `is_regex=true`, keep regex simple, and always narrow `directory` + `file_pattern`.

**Step 2: Add safe examples and fallback flow**

Include copyable examples for literal, punctuation-heavy, and alternation searches, plus a response path for `unsafe regex` errors.

### Task 3: Sync the playbook and tool docs

**Files:**
- Modify: `backend/docs/agent-tools/MCP_TOOL_PLAYBOOK.md`
- Modify: `backend/docs/agent-tools/tools/search_code.md`

**Step 1: Update the MCP contract wording**

Clarify that public action input stays on `keyword`, but MCP-backed `search_code_advanced` currently expects `pattern`, so the stable public call shape is `keyword + is_regex=true`.

**Step 2: Update common pitfalls**

Document the two dominant failure classes: missing `pattern` and unsafe regex rejection.

### Task 4: Update the skill maintenance list

**Files:**
- Modify: `backend/docs/agent-tools/SKILLS_INDEX.md`

**Step 1: Mark `search_code` as a重点维护项**

Add an explicit maintenance section so future edits know this skill carries MCP precision guidance.

### Task 5: Validate the doc bundle still loads

**Files:**
- Test: `backend/tests/test_tool_skills_memory_sync.py`

**Step 1: Run targeted validation**

Run: `cd backend && python3 -m pytest tests/test_tool_skills_memory_sync.py -q`

Expected: passing test that confirms the tool skill snapshot still includes `search_code`, the index, and shared playbook content.
