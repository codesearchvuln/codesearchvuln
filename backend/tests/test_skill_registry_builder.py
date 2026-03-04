import json
from pathlib import Path

from scripts.build_skill_registry import build_skill_registry


def _write_skill(
    skill_dir: Path,
    *,
    name: str,
    description: str,
    body: str = "This skill executes a multi-step workflow.",
) -> None:
    skill_dir.mkdir(parents=True, exist_ok=True)
    (skill_dir / "SKILL.md").write_text(
        "\n".join(
            [
                "---",
                f"name: {name}",
                f"description: {description}",
                "---",
                "",
                body,
                "",
            ]
        ),
        encoding="utf-8",
    )


def test_build_skill_registry_keeps_namespaced_duplicates_and_full_mirror(tmp_path):
    agents_root = tmp_path / ".agents" / "skills"
    codex_root = tmp_path / ".codex" / "skills"
    superpowers_root = tmp_path / ".codex" / "superpowers" / "skills"
    codex_home_root = tmp_path / "data" / "mcp" / "codex-home" / "skills"
    registry_root = tmp_path / "registry"

    _write_skill(
        agents_root / "using-superpowers",
        name="using-superpowers",
        description="Use when starting a conversation. Enables rapid skill discovery.",
    )
    _write_skill(
        codex_root / "using-superpowers",
        name="using-superpowers",
        description="Codex namespace variant. Contains codex-specific defaults.",
    )
    _write_skill(
        superpowers_root / "using-superpowers",
        name="using-superpowers",
        description="Superpowers namespace variant for advanced workflows.",
    )
    _write_skill(
        codex_home_root / "using-superpowers",
        name="using-superpowers",
        description="Installed codex-home copy used at runtime.",
    )

    agents_skill_dir = agents_root / "using-superpowers"
    (agents_skill_dir / "scripts").mkdir(parents=True, exist_ok=True)
    (agents_skill_dir / "bin").mkdir(parents=True, exist_ok=True)
    (agents_skill_dir / "scripts" / "run.sh").write_text("#!/bin/sh\necho ok\n", encoding="utf-8")
    (agents_skill_dir / "bin" / "helper").write_text("binary-placeholder\n", encoding="utf-8")
    (agents_skill_dir / "__pycache__").mkdir(parents=True, exist_ok=True)
    (agents_skill_dir / "__pycache__" / "x.pyc").write_bytes(b"pyc")
    (agents_skill_dir / "node_modules").mkdir(parents=True, exist_ok=True)
    (agents_skill_dir / "node_modules" / "ignore.js").write_text("ignored\n", encoding="utf-8")

    result = build_skill_registry(
        registry_root=registry_root,
        source_roots=[agents_root, codex_root, superpowers_root, codex_home_root],
    )

    assert result["total_skills"] == 4
    assert result["errors"] == []

    manifest = json.loads((registry_root / "manifest.json").read_text(encoding="utf-8"))
    skill_ids = {item["skill_id"] for item in manifest["skills"]}
    assert "using-superpowers@agents" in skill_ids
    assert "using-superpowers@codex" in skill_ids
    assert "using-superpowers@superpowers" in skill_ids
    assert "using-superpowers@codex_home" in skill_ids

    mirrored_agents = registry_root / "skills" / "using-superpowers@agents"
    assert (mirrored_agents / "SKILL.md").exists()
    assert (mirrored_agents / "scripts" / "run.sh").exists()
    assert (mirrored_agents / "bin" / "helper").exists()
    assert not (mirrored_agents / "__pycache__").exists()
    assert not (mirrored_agents / "node_modules").exists()

    skills_md = (registry_root / "SKILLS.md").read_text(encoding="utf-8")
    assert "`using-superpowers@agents`" in skills_md
    assert "`using-superpowers@codex`" in skills_md
    assert "`using-superpowers@superpowers`" in skills_md
    assert "`using-superpowers@codex_home`" in skills_md

    aliases = json.loads((registry_root / "aliases.json").read_text(encoding="utf-8"))
    assert "using-superpowers" in aliases
    assert set(aliases["using-superpowers"]) == {
        "using-superpowers@agents",
        "using-superpowers@codex",
        "using-superpowers@superpowers",
        "using-superpowers@codex_home",
    }
